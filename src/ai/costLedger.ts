/**
 * In-memory cost & token ledger. Call sites record usage after every callAI;
 * eval reports + a future debug screen can dump the totals.
 *
 * Pricing (USD per 1M tokens) — update if Anthropic changes their published rates.
 * Source: anthropic.com/pricing as of 2026-Q1. Cache reads are 10% of input,
 * cache writes are 1.25x input (5-min ephemeral).
 */
export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const PRICING: Record<string, ModelPricing> = {
  // Anthropic (fallback chain only — runtime provider is Gemini)
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-opus-4-7': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  // Gemini (the live provider — see modelRouter.ts MODELS). Gemini bills caching
  // as storage-per-hour, not a per-token write, so cacheWrite is 0 here.
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  'gemini-3.5-flash': { input: 1.5, output: 9, cacheRead: 0.15, cacheWrite: 0 },
  'gemini-flash-latest': { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  // Groq (cheap tier fast-path — EXPO_PUBLIC_CHEAP_PROVIDER=groq). Groq pricing
  // is token-based with no caching discount tier, so cacheRead == input.
  // Rates: console.groq.com/docs/openai/pricing (USD per 1M tokens, as of 2026-Q2).
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79, cacheRead: 0.59, cacheWrite: 0 },
  'llama-3.1-8b-instant':    { input: 0.05, output: 0.08, cacheRead: 0.05, cacheWrite: 0 },
  'llama3-8b-8192':          { input: 0.05, output: 0.08, cacheRead: 0.05, cacheWrite: 0 },
  'llama3-70b-8192':         { input: 0.59, output: 0.79, cacheRead: 0.59, cacheWrite: 0 },
  'gemma2-9b-it':            { input: 0.2,  output: 0.2,  cacheRead: 0.2,  cacheWrite: 0 },
};

export interface UsageRecord {
  model: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

const ledger: UsageRecord[] = [];

function priceFor(model: string): ModelPricing {
  const exact = PRICING[model];
  if (exact) return exact;
  // Unknown model: fall back within the same provider family so a renamed or
  // preview model ID isn't priced against the wrong vendor's rates.
  if (model.startsWith('gemini-')) return PRICING['gemini-2.5-flash']!;
  if (model.startsWith('llama') || model.startsWith('gemma') || model.startsWith('mixtral')) {
    return PRICING['llama-3.3-70b-versatile']!;
  }
  return PRICING['claude-haiku-4-5-20251001']!;
}

export function computeCost(
  model: string,
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number },
): number {
  const p = priceFor(model);
  const inp = usage.input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const cr = usage.cache_read_input_tokens ?? 0;
  const cw = usage.cache_creation_input_tokens ?? 0;
  return (inp * p.input + out * p.output + cr * p.cacheRead + cw * p.cacheWrite) / 1_000_000;
}

export function recordUsage(opts: {
  model: string;
  task: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | null;
}): void {
  if (!opts.usage) return;
  const u = opts.usage;
  ledger.push({
    model: opts.model,
    task: opts.task,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    costUsd: computeCost(opts.model, u),
  });
}

export function getLedger(): readonly UsageRecord[] {
  return ledger;
}

export function clearLedger(): void {
  ledger.length = 0;
}

export interface LedgerSummary {
  calls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  byTask: Record<string, { calls: number; costUsd: number }>;
  byModel: Record<string, { calls: number; costUsd: number }>;
}

export function summarize(): LedgerSummary {
  const sum: LedgerSummary = {
    calls: ledger.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCostUsd: 0,
    cacheHitRate: 0,
    byTask: {},
    byModel: {},
  };
  for (const r of ledger) {
    sum.totalInputTokens += r.inputTokens;
    sum.totalOutputTokens += r.outputTokens;
    sum.totalCacheReadTokens += r.cacheReadTokens;
    sum.totalCostUsd += r.costUsd;
    sum.byTask[r.task] ??= { calls: 0, costUsd: 0 };
    sum.byTask[r.task]!.calls++;
    sum.byTask[r.task]!.costUsd += r.costUsd;
    sum.byModel[r.model] ??= { calls: 0, costUsd: 0 };
    sum.byModel[r.model]!.calls++;
    sum.byModel[r.model]!.costUsd += r.costUsd;
  }
  const totalIn = sum.totalInputTokens + sum.totalCacheReadTokens;
  sum.cacheHitRate = totalIn > 0 ? sum.totalCacheReadTokens / totalIn : 0;
  return sum;
}
