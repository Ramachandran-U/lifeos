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
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-opus-4-7': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
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
  return PRICING[model] ?? PRICING['claude-haiku-4-5-20251001']!;
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
