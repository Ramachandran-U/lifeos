import type { Env } from './index';
import { pgInsert } from './lib/supabase';

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

// Output-token ceiling per provider call. Tunable via wrangler.toml [vars]
// MAX_TOKENS_CAP without redeploying client code. Bounded to [DEFAULT_CAP,
// HARD_CAP] so an accidental "100000" doesn't melt our credit budget and an
// empty/0 value doesn't silently break long generations.
const DEFAULT_MAX_TOKENS_CAP = 4096;
const HARD_MAX_TOKENS_CAP = 8000;
const DEFAULT_REQUEST_MAX_TOKENS = 1200;

export function resolveMaxTokensCap(env: Pick<Env, 'MAX_TOKENS_CAP'>): number {
  const raw = env.MAX_TOKENS_CAP;
  if (!raw) return DEFAULT_MAX_TOKENS_CAP;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS_CAP;
  return Math.min(Math.max(parsed, DEFAULT_REQUEST_MAX_TOKENS), HARD_MAX_TOKENS_CAP);
}

export function resolveOutputTokens(
  body: Pick<ClientRequest, 'maxTokens'>,
  env: Pick<Env, 'MAX_TOKENS_CAP'>,
): number {
  const cap = resolveMaxTokensCap(env);
  return Math.min(body.maxTokens ?? DEFAULT_REQUEST_MAX_TOKENS, cap);
}

const CACHE_MIN_CHARS = 1024;

type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

// Gemini function-calling part shapes. A message's `content` is either a plain
// string (the common case — passed through as a single text part) or, in a
// tool-use conversation, an array of these parts so the assistant's
// functionCall turn and the caller's functionResponse turn round-trip verbatim.
export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

// A tool the model may call. Mirrors Gemini's FunctionDeclaration — name +
// description + a JSON-schema `parameters` object. The proxy passes these
// straight through; it does NOT execute tools (that happens on-device, where
// the user's local SQLite lives — see src/ai/agent/runtime.ts).
export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface ClientRequest {
  system?: string | SystemBlock[];
  messages: Array<{ role: 'user' | 'assistant'; content: string | GeminiPart[] }>;
  maxTokens?: number;
  model?: string;
  cacheSystem?: boolean;
  /** When present, enables Gemini function-calling. Tool-use is Gemini-only. */
  tools?: FunctionDeclaration[];
  /** Optional passthrough for Gemini's toolConfig (defaults to AUTO mode). */
  toolConfig?: unknown;
}

interface NormalisedResponse {
  text: string;
  usage: unknown;
  model: string;
  /** Present only when the model asked to call one or more tools this turn. */
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}

// --- Gemini content mapping (pure, exported for unit tests) ---

/**
 * Maps client `messages` to Gemini `contents`. A string content becomes a
 * single text part; an array content (tool-use turns) is passed through as-is.
 */
export function mapMessagesToGeminiContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string | GeminiPart[] }>,
): Array<{ role: string; parts: unknown[] }> {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: typeof m.content === 'string' ? [{ text: m.content }] : m.content,
  }));
}

/**
 * Extracts text and any functionCall parts from a Gemini generateContent
 * response. Text parts are concatenated; functionCall parts are collected so
 * the on-device runtime can dispatch them.
 */
export function parseGeminiCandidate(parsed: unknown): {
  text: string;
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const p = parsed as {
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  };
  const parts = p.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => (typeof part.text === 'string' ? part.text : '')).join('');
  const functionCalls = parts
    .filter((part) => part.functionCall)
    .map((part) => {
      const fc = part.functionCall as { name: string; args?: Record<string, unknown> };
      return { name: fc.name, args: fc.args ?? {} };
    });
  return { text, functionCalls };
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
      max_tokens: resolveOutputTokens(body, env),
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

async function geminiGenerate(
  model: string,
  payload: string,
  env: Env,
): Promise<{ res: Response; text: string }> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  // LATENCY POLICY: on 429 (free-tier per-minute quota), do NOT sleep-retry the
  // same overloaded provider — return immediately so proxyClaude fails over to
  // the next provider in the chain (Groq has separate quota + very low TTFT).
  // The previous code honoured Gemini's "retry in Xs" hint and slept up to 25s
  // before the chain could even try Groq, which added seconds of tail latency.
  // Only transient 5xx gets a single short same-provider retry (a blip, not a wait).
  let res!: Response;
  let text = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    text = await res.text();
    if (res.ok || res.status === 429) break; // 429 → fail over to next provider now
    if (!(res.status >= 500 && res.status < 600)) break; // non-transient → abort
    await new Promise((r) => setTimeout(r, 400)); // one short 5xx retry
  }
  return { res, text };
}

async function callGemini(body: ClientRequest, env: Env): Promise<NormalisedResponse> {
  const requested = pickModel('gemini', body.model);
  const sys = flattenSystem(body);
  const contents = mapMessagesToGeminiContents(body.messages);
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  const payload = JSON.stringify({
    ...(sys ? { system_instruction: { parts: [{ text: sys }] } } : {}),
    contents,
    // Tool-use: forward the declarations and let the model choose (AUTO).
    ...(hasTools
      ? {
          tools: [{ functionDeclarations: body.tools }],
          toolConfig: body.toolConfig ?? { functionCallingConfig: { mode: 'AUTO' } },
        }
      : {}),
    generationConfig: {
      maxOutputTokens: resolveOutputTokens(body, env),
      // gemini-flash-latest (2.5 Flash) enables "thinking" by default, and
      // thinking tokens are billed against maxOutputTokens — so the model can
      // spend the whole budget reasoning and truncate the actual JSON
      // ("Unbalanced JSON in AI response"). Every LifeOS call is short,
      // structured output, so disable thinking to give the full budget to the
      // response. thinkingBudget:0 is ignored by models that don't support it.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let model = requested;
  let { res, text } = await geminiGenerate(model, payload, env);

  // Graceful degradation: an unrecognised / not-yet-GA model ID (e.g. a preview
  // "gemini-3-flash" that isn't live on this key) returns 400/404. Rather than
  // breaking the call, retry once on the known-good default model. Lets us roll
  // out new model IDs without risking a hard outage if the string is wrong.
  if (!res.ok && (res.status === 400 || res.status === 404) && model !== DEFAULTS.gemini) {
    console.warn(
      `[gemini-fallback] ${requested} returned ${res.status} — falling back to ${DEFAULTS.gemini}. ` +
      `This likely means the model ID was renamed or deprecated. Check AI Studio for the current ID.`,
    );
    model = DEFAULTS.gemini;
    ({ res, text } = await geminiGenerate(model, payload, env));
  }

  if (!res.ok) throw new ProviderError('gemini', res.status, text);
  const parsed = JSON.parse(text);
  const { text: out, functionCalls } = parseGeminiCandidate(parsed);
  return {
    text: out,
    usage: parsed.usageMetadata ?? null,
    model,
    ...(functionCalls.length > 0 ? { functionCalls } : {}),
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
      max_tokens: resolveOutputTokens(body, env),
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
      max_completion_tokens: resolveOutputTokens(body, env),
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
  ctx?: ExecutionContext,
  userId?: string,
): Promise<Response> {
  const workerStart = Date.now();
  let body: ClientRequest & { task?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
  const task = body.task;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const primary = (env.LLM_PROVIDER ?? 'anthropic').toLowerCase() as keyof typeof DEFAULTS;
  let chain = FALLBACK_CHAIN[primary] ?? [primary, 'groq', 'anthropic'];

  // Tool-use is Gemini-only: the other providers map `messages[].content` as a
  // plain string, so the functionCall / functionResponse part arrays in a
  // tool conversation would be mangled. Pin the chain to gemini when tools are
  // requested rather than silently failing over to a provider that can't honour
  // them.
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'tool-use requires the gemini provider, which is not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
      );
    }
    chain = ['gemini'];
  }

  const errors: Array<{ provider: string; status: number; detail: string }> = [];

  for (const provider of chain) {
    // Skip providers without an API key configured.
    if (provider === 'anthropic' && !env.ANTHROPIC_API_KEY) continue;
    if (provider === 'gemini' && !env.GEMINI_API_KEY) continue;
    if (provider === 'openai' && !env.OPENAI_API_KEY) continue;
    if (provider === 'groq' && !env.GROQ_API_KEY) continue;

    try {
      const provStart = Date.now();
      let result: NormalisedResponse;
      if (provider === 'gemini') result = await callGemini(body, env);
      else if (provider === 'openai') result = await callOpenAI(body, env);
      else if (provider === 'groq') result = await callGroq(body, env);
      else result = await callAnthropic(body, env);
      const providerMs = Date.now() - provStart;

      // Fire-and-forget cost-event write. Skipped if ctx/userId or Supabase
      // creds aren't set so local-dev runs don't fail.
      if (ctx && userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.waitUntil(recordCostEvent(env, {
          userId,
          task,
          provider,
          model: result.model,
          usage: result.usage,
        }));
      }

      // Return usage to the client under canonical (Anthropic-style) field
      // names so the on-device ledger/telemetry reads the same keys regardless
      // of provider. The cost-event write above intentionally uses the raw
      // `result.usage` (recordCostEvent re-normalises per provider).
      const clientPayload = { ...result, usage: toCanonicalUsage(provider, result.usage) };
      return new Response(JSON.stringify(clientPayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...cors,
          // Latency breakdown for the client span: time in the upstream provider
          // call vs total Worker handler time. `Access-Control-Expose-Headers`
          // lets the web client read it cross-origin (native fetch isn't gated).
          'Server-Timing': `provider;desc="${provider}";dur=${providerMs}, worker;dur=${Date.now() - workerStart}`,
          'Access-Control-Expose-Headers': 'Server-Timing',
        },
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

interface CostEventInput {
  userId: string;
  task: string | undefined;
  provider: string;
  model: string;
  usage: unknown;
}

interface NormalisedUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

/**
 * Canonical (Anthropic-style) usage shape returned to the client, so the
 * on-device cost ledger reads the same field names for every provider.
 */
export function toCanonicalUsage(provider: string, usage: unknown): {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
} {
  const u = normaliseUsage(provider, usage);
  return {
    input_tokens: u.input,
    output_tokens: u.output,
    cache_read_input_tokens: u.cacheRead,
    cache_creation_input_tokens: u.cacheCreation,
  };
}

// Each upstream gives usage in its own shape. This collapses to the four
// counters we store; anything unknown defaults to 0 so a schema drift doesn't
// poison the ledger or make the insert fail.
export function normaliseUsage(provider: string, usage: unknown): NormalisedUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  if (provider === 'anthropic') {
    return {
      input: num(u.input_tokens),
      output: num(u.output_tokens),
      cacheRead: num(u.cache_read_input_tokens),
      cacheCreation: num(u.cache_creation_input_tokens),
    };
  }
  if (provider === 'gemini') {
    return {
      input: num(u.promptTokenCount),
      output: num(u.candidatesTokenCount),
      cacheRead: num(u.cachedContentTokenCount),
      cacheCreation: 0,
    };
  }
  // openai + groq use the same shape.
  return {
    input: num(u.prompt_tokens),
    output: num(u.completion_tokens),
    cacheRead: 0,
    cacheCreation: 0,
  };
}

async function recordCostEvent(env: Env, ev: CostEventInput): Promise<void> {
  const usage = normaliseUsage(ev.provider, ev.usage);
  // Skip empty rows — happens on schema drift or non-LLM passthroughs.
  if (usage.input === 0 && usage.output === 0 && usage.cacheRead === 0) return;
  try {
    await pgInsert(env, 'ai_cost_events', {
      user_id: ev.userId,
      task: ev.task ?? null,
      provider: ev.provider,
      model: ev.model,
      input_tokens: usage.input,
      output_tokens: usage.output,
      cache_read_tokens: usage.cacheRead,
      cache_creation_tokens: usage.cacheCreation,
    });
  } catch {
    // Best-effort: ledger writes must never user-facing failure.
  }
}
