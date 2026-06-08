import { AIRequest, AIToolResponse, AvatarGenInput, AvatarGenResult } from './types';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import { recordUsage, computeCost } from './costLedger';
import { startSpan, endSpan } from './tracing';
import { pickMaxTokens, pickProvider } from './modelRouter';
import { track, EVENTS } from '@/utils/telemetry';

const PROXY_URL =
  process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';

/**
 * Parse the Worker's `Server-Timing` header into span metadata, e.g.
 * `provider;desc="gemini";dur=850, worker;dur=860` → { server_providerMs: 850,
 * server_workerMs: 860 }. Lets us see where a slow call spent its time
 * (provider vs Worker) alongside the client-measured ttfb/total. No-op when the
 * header is absent (e.g. cross-origin without expose, or an old Worker).
 */
function parseServerTiming(header: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!header) return out;
  for (const part of header.split(',')) {
    const m = part.match(/^\s*(\w+)[^,]*?;\s*dur=([\d.]+)/);
    if (m) out[`server_${m[1]}Ms`] = Math.round(Number(m[2]));
  }
  return out;
}

async function callViaProxy(request: AIRequest): Promise<AIToolResponse> {
  const span = startSpan('callAI', { task: request.task, model: request.model, cacheSystem: !!request.cacheSystem });

  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      throw new Error('Sign in required to use AI features.');
    }

    // Optional per-task provider hint (e.g. cheap tier → groq). Undefined unless
    // EXPO_PUBLIC_CHEAP_PROVIDER is set; the Worker ignores it if that provider
    // has no key, so it's safe to send. See modelRouter.pickProvider.
    const providerHint = pickProvider(request.task);
    const fetchStart = Date.now();
    const response = await fetch(`${PROXY_URL}/claude`, {
      method: 'POST',
      signal: request.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: request.system,
        messages: request.messages,
        // Default the output budget per task (generation time scales with it);
        // an explicit request.maxTokens still wins. See modelRouter.pickMaxTokens.
        maxTokens: request.maxTokens ?? pickMaxTokens(request.task),
        model: request.model,
        cacheSystem: request.cacheSystem,
        task: request.task,
        ...(providerHint ? { provider: providerHint } : {}),
        ...(request.tools && request.tools.length > 0 ? { tools: request.tools } : {}),
      }),
    });
    const ttfbMs = Date.now() - fetchStart;

    if (response.status === 429) {
      throw new Error("You've hit today's AI limit. Try again tomorrow.");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI proxy ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    // Latency breakdown: client-measured ttfb (request→headers) + total
    // (request→body parsed), plus the Worker's Server-Timing (provider/worker).
    // Lands in span metadata so the trace shows WHERE a slow call spent its time.
    const latency = {
      ttfbMs,
      totalMs: Date.now() - fetchStart,
      ...parseServerTiming(response.headers.get('Server-Timing')),
    };
    if (data.error) throw new Error(data.error);

    const model = data.model ?? request.model ?? 'unknown';
    if (data.usage) {
      recordUsage({ model, task: request.task ?? 'unknown', usage: data.usage });
      track(EVENTS.aiCall, {
        task: request.task ?? 'unknown',
        model,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_tokens: data.usage.cache_read_input_tokens,
      });
      endSpan(span, {
        model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        cacheReadTokens: data.usage.cache_read_input_tokens,
        cacheCreationTokens: data.usage.cache_creation_input_tokens,
        costUsd: computeCost(model, data.usage),
        metadata: latency,
      });
    } else {
      endSpan(span, { model, metadata: latency });
    }

    return {
      text: data.text ?? '',
      functionCalls: Array.isArray(data.functionCalls) ? data.functionCalls : [],
      model,
    };
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Text-only AI call — the contract used by all single-shot functions. */
export async function callAI(request: AIRequest): Promise<string> {
  return (await callViaProxy(request)).text;
}

/**
 * Structured AI call that surfaces tool calls. Used by the tool-use agent
 * runtime, which needs to see `functionCalls` to dispatch them on-device.
 */
export async function callAIRaw(request: AIRequest): Promise<AIToolResponse> {
  return callViaProxy(request);
}

/**
 * Streaming AI call for prose surfaces (chat, narrative). Calls `onChunk` for
 * each text delta as it arrives, then resolves with the full accumulated text.
 * Falls back to a single `onChunk(full_text)` call if the runtime does not
 * expose `response.body` as a ReadableStream.
 *
 * Still goes through the same auth, cost-ledger, telemetry, and tracing as
 * `callAI` — this is NOT a bypass of any of those.
 */
export async function callAIStream(
  request: AIRequest,
  onChunk: (text: string) => void,
): Promise<{ text: string; model: string }> {
  const span = startSpan('callAI', { task: request.task, model: request.model, stream: true });

  try {
    const token = await getSupabaseAccessToken();
    if (!token) throw new Error('Sign in required to use AI features.');

    const providerHint = pickProvider(request.task);
    const fetchStart = Date.now();
    const response = await fetch(`${PROXY_URL}/claude`, {
      method: 'POST',
      signal: request.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: request.system,
        messages: request.messages,
        maxTokens: request.maxTokens ?? pickMaxTokens(request.task),
        model: request.model,
        cacheSystem: request.cacheSystem,
        task: request.task,
        stream: true,
        ...(providerHint ? { provider: providerHint } : {}),
      }),
    });
    const ttfbMs = Date.now() - fetchStart;

    if (response.status === 429) throw new Error("You've hit today's AI limit. Try again tomorrow.");
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`AI proxy ${response.status}: ${errBody.slice(0, 200)}`);
    }

    let accumulated = '';
    let model = request.model ?? 'unknown';
    let usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
    } | null = null;

    const parseLine = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const raw = line.slice(6).trim();
      if (!raw) return;
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (typeof chunk.error === 'string') throw new Error(chunk.error);
      if (typeof chunk.text === 'string') {
        accumulated += chunk.text;
        onChunk(chunk.text);
      }
      if (chunk.done === true) {
        if (typeof chunk.model === 'string') model = chunk.model;
        const u = chunk.usage;
        if (u !== null && u !== undefined && typeof u === 'object') {
          const uo = u as Record<string, unknown>;
          usage = {
            input_tokens: typeof uo.input_tokens === 'number' ? uo.input_tokens : 0,
            output_tokens: typeof uo.output_tokens === 'number' ? uo.output_tokens : 0,
            cache_read_input_tokens:
              typeof uo.cache_read_input_tokens === 'number' ? uo.cache_read_input_tokens : 0,
            cache_creation_input_tokens:
              typeof uo.cache_creation_input_tokens === 'number' ? uo.cache_creation_input_tokens : 0,
          };
        }
      }
    };

    if (response.body) {
      // Modern browser / React Native — true streaming via ReadableStream.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) parseLine(line);
      }
      // Flush any remaining partial line.
      if (buf) parseLine(buf);
    } else {
      // Fallback: body not exposed as ReadableStream — buffer the entire SSE text.
      const text = await response.text();
      for (const line of text.split('\n')) parseLine(line);
    }

    const latency = {
      ttfbMs,
      totalMs: Date.now() - fetchStart,
      ...parseServerTiming(response.headers.get('Server-Timing')),
    };

    if (usage) {
      recordUsage({ model, task: request.task ?? 'unknown', usage });
      track(EVENTS.aiCall, {
        task: request.task ?? 'unknown',
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_input_tokens,
      });
      endSpan(span, {
        model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
        costUsd: computeCost(model, usage),
        metadata: latency,
      });
    } else {
      endSpan(span, { model, metadata: latency });
    }

    return { text: accumulated, model };
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * Avatar image generation (nano banana). A SEPARATE transport from
 * `callViaProxy` because the response is a base64 image, not text — but it
 * keeps the same auth, error-surfacing, cost-ledger, telemetry, and tracing
 * guarantees so this entry point doesn't bypass any of them.
 */
export async function generateAvatarViaProxy(input: AvatarGenInput): Promise<AvatarGenResult> {
  const task = 'generateAvatar';
  const span = startSpan('callAvatar', { task });

  try {
    const token = await getSupabaseAccessToken();
    if (!token) {
      throw new Error('Sign in required to use AI features.');
    }

    const response = await fetch(`${PROXY_URL}/v1/image/avatar`, {
      method: 'POST',
      signal: input.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        stylePrompt: input.stylePrompt,
      }),
    });

    if (response.status === 429) {
      throw new Error("You've hit today's avatar limit. Try again tomorrow.");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI proxy ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (!data.imageBase64) throw new Error('No avatar image returned.');

    const model = data.model ?? 'gemini-2.5-flash-image';
    if (data.usage) {
      recordUsage({ model, task, usage: data.usage });
      track(EVENTS.aiCall, {
        task,
        model,
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_tokens: data.usage.cache_read_input_tokens,
      });
      endSpan(span, {
        model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        costUsd: computeCost(model, data.usage),
      });
    } else {
      endSpan(span, { model });
    }

    return {
      imageBase64: data.imageBase64,
      mimeType: data.mimeType ?? 'image/png',
      model,
    };
  } catch (err) {
    endSpan(span, { status: 'error', error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
