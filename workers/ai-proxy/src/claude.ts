import type { Env } from './index';

/**
 * Provider-agnostic LLM proxy. Endpoint name stayed `/claude` for client
 * compatibility, but the upstream is selected via `env.LLM_PROVIDER`
 * (`anthropic` | `gemini` | `openai`). Every provider's response is
 * normalised to `{text, usage, model}` so the client doesn't change.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULTS = {
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-flash-latest',
  openai: 'gpt-4o-mini',
  // Free + fast Llama on Groq. Generous free tier (~14.4k req/day).
  groq: 'llama-3.3-70b-versatile',
} as const;

// When the primary provider returns 5xx or 429, try the next one in line so a
// single upstream outage (e.g. Gemini's "high demand 503") doesn't bubble up
// as a user-facing error. Each entry must have its API key set or it's skipped.
const FALLBACK_CHAIN: Record<string, Array<keyof typeof DEFAULTS>> = {
  gemini:    ['gemini', 'groq', 'anthropic'],
  groq:      ['groq', 'gemini', 'anthropic'],
  anthropic: ['anthropic', 'groq', 'gemini'],
  openai:    ['openai', 'groq', 'anthropic'],
};

const MAX_TOKENS_CAP = 2000;
const CACHE_MIN_CHARS = 1024;

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

interface ClientRequest {
  system?: string | SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  model?: string;
  cacheSystem?: boolean;
}

interface NormalisedResponse {
  text: string;
  usage: unknown;
  model: string;
}

function flattenSystem(input: ClientRequest): string | undefined {
  if (!input.system) return undefined;
  if (typeof input.system === 'string') return input.system;
  return input.system.map((b) => b.text).join('\n\n');
}

function normaliseAnthropicSystem(input: ClientRequest): string | SystemBlock[] | undefined {
  if (!input.system) return undefined;
  if (Array.isArray(input.system)) return input.system;
  if (input.cacheSystem && input.system.length >= CACHE_MIN_CHARS) {
    return [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }];
  }
  return input.system;
}

function pickModel(provider: keyof typeof DEFAULTS, requested: string | undefined): string {
  if (!requested) return DEFAULTS[provider];
  const matches =
    (provider === 'anthropic' && requested.startsWith('claude-')) ||
    (provider === 'gemini' && requested.startsWith('gemini-')) ||
    (provider === 'openai' && (requested.startsWith('gpt-') || requested.startsWith('o'))) ||
    (provider === 'groq' && (requested.startsWith('llama-') || requested.startsWith('gemma') || requested.startsWith('mixtral')));
  return matches ? requested : DEFAULTS[provider];
}

async function callAnthropic(body: ClientRequest, env: Env): Promise<NormalisedResponse> {
  const model = pickModel('anthropic', body.model);
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(body.maxTokens ?? 1200, MAX_TOKENS_CAP),
      system: normaliseAnthropicSystem(body),
      messages: body.messages,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError('anthropic', res.status, text);
  const parsed = JSON.parse(text);
  return {
    text: parsed.content?.[0]?.text ?? '',
    usage: parsed.usage ?? null,
    model: parsed.model ?? model,
  };
}

async function callGemini(body: ClientRequest, env: Env): Promise<NormalisedResponse> {
  const model = pickModel('gemini', body.model);
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const sys = flattenSystem(body);
  const contents = body.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const payload = JSON.stringify({
    ...(sys ? { system_instruction: { parts: [{ text: sys }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(body.maxTokens ?? 1200, MAX_TOKENS_CAP),
    },
  });

  // Retry on transient overload (5xx) and per-minute quota hits (429). Free
  // tier returns 429 with "Please retry in Xs" — honour that hint, capped.
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
  if (!res.ok) throw new ProviderError('gemini', res.status, text);
  const parsed = JSON.parse(text);
  const out = parsed.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return {
    text: out,
    usage: parsed.usageMetadata ?? null,
    model,
  };
}

async function callGroq(body: ClientRequest, env: Env): Promise<NormalisedResponse> {
  const model = pickModel('groq', body.model);
  const sys = flattenSystem(body);
  const messages = [
    ...(sys ? [{ role: 'system', content: sys }] : []),
    ...body.messages,
  ];
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Math.min(body.maxTokens ?? 1200, MAX_TOKENS_CAP),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError('groq', res.status, text);
  const parsed = JSON.parse(text);
  return {
    text: parsed.choices?.[0]?.message?.content ?? '',
    usage: parsed.usage ?? null,
    model: parsed.model ?? model,
  };
}

async function callOpenAI(body: ClientRequest, env: Env): Promise<NormalisedResponse> {
  const model = pickModel('openai', body.model);
  const sys = flattenSystem(body);
  const messages = [
    ...(sys ? [{ role: 'system', content: sys }] : []),
    ...body.messages,
  ];
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: Math.min(body.maxTokens ?? 1200, MAX_TOKENS_CAP),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError('openai', res.status, text);
  const parsed = JSON.parse(text);
  return {
    text: parsed.choices?.[0]?.message?.content ?? '',
    usage: parsed.usage ?? null,
    model: parsed.model ?? model,
  };
}

class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    public detail: string,
  ) {
    super(`${provider} ${status}`);
  }
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

  const primary = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase() as keyof typeof DEFAULTS;
  const chain = FALLBACK_CHAIN[primary] ?? [primary, 'groq', 'anthropic'];

  const errors: Array<{ provider: string; status: number; detail: string }> = [];

  for (const provider of chain) {
    // Skip providers without an API key configured.
    if (provider === 'anthropic' && !env.ANTHROPIC_API_KEY) continue;
    if (provider === 'gemini' && !env.GEMINI_API_KEY) continue;
    if (provider === 'openai' && !env.OPENAI_API_KEY) continue;
    if (provider === 'groq' && !env.GROQ_API_KEY) continue;

    try {
      let result: NormalisedResponse;
      if (provider === 'gemini') result = await callGemini(body, env);
      else if (provider === 'openai') result = await callOpenAI(body, env);
      else if (provider === 'groq') result = await callGroq(body, env);
      else result = await callAnthropic(body, env);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    } catch (e) {
      if (e instanceof ProviderError) {
        errors.push({ provider: e.provider, status: e.status, detail: e.detail.slice(0, 200) });
        // 5xx / 429 → try next in chain. Anything else (auth/400) → abort.
        const isFailover = e.status === 429 || (e.status >= 500 && e.status < 600);
        if (!isFailover) {
          return new Response(
            JSON.stringify({ error: `${e.provider} ${e.status}`, detail: e.detail.slice(0, 500) }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
          );
        }
        // else: continue loop
      } else {
        errors.push({ provider, status: 0, detail: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // All providers exhausted.
  return new Response(
    JSON.stringify({ error: 'all llm providers failed', attempts: errors }),
    { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
  );
}
