import type { Env } from './index';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_CAP = 2000;
const CACHE_MIN_CHARS = 1024;

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

interface ClientRequest {
  system?: string | SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  model?: string;
  /** When true and `system` is a string >= 1024 chars, the proxy wraps it in
   *  a cache_control block so subsequent calls hit Anthropic's prompt cache. */
  cacheSystem?: boolean;
}

function normalizeSystem(input: ClientRequest): string | SystemBlock[] | undefined {
  if (!input.system) return undefined;
  if (Array.isArray(input.system)) return input.system;
  if (input.cacheSystem && input.system.length >= CACHE_MIN_CHARS) {
    return [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }];
  }
  return input.system;
}

export async function proxyClaude(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  let body: ClientRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const upstream = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: body.model ?? DEFAULT_MODEL,
      max_tokens: Math.min(body.maxTokens ?? 1200, MAX_TOKENS_CAP),
      system: normalizeSystem(body),
      messages: body.messages,
    }),
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `claude ${upstream.status}`, detail: text.slice(0, 500) }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
    );
  }

  try {
    const parsed = JSON.parse(text);
    const out = parsed.content?.[0]?.text ?? '';
    const usage = parsed.usage ?? null;
    const model = parsed.model ?? body.model ?? DEFAULT_MODEL;
    return new Response(JSON.stringify({ text: out, usage, model }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'claude response parse failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
