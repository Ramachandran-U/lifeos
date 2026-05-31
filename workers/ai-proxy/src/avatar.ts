import type { Env } from './index';
import { pgInsert } from './lib/supabase';
import { normaliseUsage, toCanonicalUsage } from './claude';

/**
 * Gamified-avatar image generation via Gemini 2.5 Flash Image ("nano banana").
 *
 * This is intentionally a SEPARATE path from `/claude`: the text proxy
 * normalises every response to `{text, usage, model}` and `parseGeminiCandidate`
 * discards non-text parts, so an image-out response can't ride that path. Here
 * we keep the same auth + rate-limit + cost-ledger guarantees but return the
 * generated image as base64 under `{ imageBase64, mimeType, model, usage }`.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// nano banana. Image-out model — NOT the text gemini-flash models the planner uses.
const AVATAR_MODEL = 'gemini-2.5-flash-image';

// Guard against oversized uploads melting the worker / Gemini's input cap.
// ~8MB of base64 ≈ a 6MB source image, comfortably above a phone photo.
const MAX_INPUT_BASE64_CHARS = 8 * 1024 * 1024;

const DEFAULT_STYLE_PROMPT =
  'Transform the person in this photo into a bold, friendly, gamified cartoon ' +
  'avatar — think a polished mobile-game hero portrait. Vibrant saturated ' +
  'colours, clean thick outlines, soft cel-shading, expressive but flattering. ' +
  'Keep the face clearly recognisable (same hairstyle, skin tone, and key ' +
  'features). Head-and-shoulders framing, simple energetic background. Do not ' +
  'add text, watermarks, or logos.';

interface AvatarRequest {
  /** Base64-encoded source photo (no data: prefix). */
  imageBase64?: string;
  /** MIME type of the source photo. Defaults to image/jpeg. */
  mimeType?: string;
  /** Optional override for the cartoon-ification instruction. */
  stylePrompt?: string;
}

/** Find the first inlineData image part in a Gemini generateContent response.
 *  Exported for unit tests. */
export function extractImagePart(parsed: unknown): { data: string; mimeType: string } | null {
  const p = parsed as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  };
  const parts = p.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    // The REST API returns camelCase `inlineData` on responses.
    const inline = (part.inlineData ?? part.inline_data) as
      | { data?: string; mimeType?: string; mime_type?: string }
      | undefined;
    if (inline?.data) {
      return { data: inline.data, mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png' };
    }
  }
  return null;
}

/** Concatenate any text parts — used to surface a refusal reason on failure.
 *  Exported for unit tests. */
export function extractText(parsed: unknown): string {
  const p = parsed as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  };
  const parts = p.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => (typeof part.text === 'string' ? part.text : '')).join(' ').trim();
}

export async function proxyAvatar(
  req: Request,
  env: Env,
  cors: HeadersInit,
  ctx?: ExecutionContext,
  userId?: string,
): Promise<Response> {
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  if (!env.GEMINI_API_KEY) {
    return json(400, { error: 'avatar generation requires the gemini provider, which is not configured' });
  }

  let body: AvatarRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  const imageBase64 = body.imageBase64?.trim();
  if (!imageBase64) {
    return json(400, { error: 'imageBase64 required' });
  }
  if (imageBase64.length > MAX_INPUT_BASE64_CHARS) {
    return json(413, { error: 'image too large — please use a smaller photo' });
  }

  const mimeType = body.mimeType || 'image/jpeg';
  const prompt = (body.stylePrompt?.trim() || DEFAULT_STYLE_PROMPT).slice(0, 2000);

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const url = `${GEMINI_BASE}/${AVATAR_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  // Retry transient overload (5xx) and per-minute quota (429), honouring the
  // "retry in Xs" hint — same policy as the text path's geminiGenerate.
  let res!: Response;
  let text = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    text = await res.text();
    if (res.ok) break;
    const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retryable) break;
    let waitMs = 800 * (attempt + 1);
    if (res.status === 429) {
      const m = text.match(/retry in ([\d.]+)s/i);
      if (m) waitMs = Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 200, 25_000);
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }

  if (!res.ok) {
    return json(502, { error: `gemini ${res.status}`, detail: text.slice(0, 500) });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(502, { error: 'gemini returned non-JSON response' });
  }

  const image = extractImagePart(parsed);
  if (!image) {
    // Model answered with text only (often a safety refusal). Surface it.
    const reason = extractText(parsed);
    return json(502, {
      error: 'no image generated',
      detail: reason ? reason.slice(0, 300) : 'the model did not return an image',
    });
  }

  const usage = (parsed as { usageMetadata?: unknown }).usageMetadata ?? null;

  // Fire-and-forget cost-event write — source of truth for billing. Mirrors the
  // text path; skipped in local dev when Supabase creds aren't set.
  if (ctx && userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const u = normaliseUsage('gemini', usage);
    if (u.input !== 0 || u.output !== 0) {
      ctx.waitUntil(
        pgInsert(env, 'ai_cost_events', {
          user_id: userId,
          task: 'generateAvatar',
          provider: 'gemini',
          model: AVATAR_MODEL,
          input_tokens: u.input,
          output_tokens: u.output,
          cache_read_tokens: u.cacheRead,
          cache_creation_tokens: u.cacheCreation,
        }).catch(() => {}),
      );
    }
  }

  return json(200, {
    imageBase64: image.data,
    mimeType: image.mimeType,
    model: AVATAR_MODEL,
    usage: toCanonicalUsage('gemini', usage),
  });
}
