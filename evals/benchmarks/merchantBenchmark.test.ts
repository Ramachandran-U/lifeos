/**
 * Side-by-side benchmark: rule-based categorizer vs LLM categorizer.
 *
 * Output: console table + `evals/reports/benchmark-merchant.md` with accuracy,
 * coverage (rule-only), per-call latency, and projected $/1k calls. The
 * methodology is the foundation for a future distillation: collect cases the
 * rules miss, label them, fine-tune a small model on the labelled set.
 *
 * In mock mode the LLM returns 'other' for everything, so the LLM accuracy
 * column will be ~0 — the value of the mock run is verifying the harness
 * itself. Run `npm run evals:live` to get meaningful LLM numbers.
 */

if (!process.env.EVAL_REAL) {
  process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true';
}

import * as fs from 'fs';
import * as path from 'path';
import { categorizeByRule } from '@/finance/categorizer';
import { categorizeMerchant } from '@/ai/functions';
import { computeCost } from '@/ai/costLedger';
import { MODELS } from '@/ai/modelRouter';
import { MERCHANTS } from '../datasets/merchants';

interface PerSystemMetric {
  total: number;
  correct: number;
  covered: number;
  totalLatencyMs: number;
}

describe('merchantCategorizer benchmark', () => {
  test('rule-based vs LLM side-by-side', async () => {
    const rule: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };
    const llm: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };

    const rows: string[] = [];
    rows.push('| Merchant | Expected | Rule | LLM |');
    rows.push('|---|---|---|---|');

    for (const m of MERCHANTS) {
      rule.total += 1;
      llm.total += 1;

      const t1 = Date.now();
      const ruleOut = categorizeByRule(m.merchant);
      rule.totalLatencyMs += Date.now() - t1;
      if (ruleOut !== null) rule.covered += 1;
      if (ruleOut === m.expected) rule.correct += 1;

      const t2 = Date.now();
      const llmOut = await categorizeMerchant(m.merchant, m.amountRupees);
      llm.totalLatencyMs += Date.now() - t2;
      llm.covered += 1; // LLM always returns a category
      if (llmOut.category === m.expected) llm.correct += 1;

      rows.push(`| \`${m.merchant}\` | \`${m.expected}\` | ${ruleOut ?? '—'}${ruleOut === m.expected ? ' ✅' : ' ❌'} | ${llmOut.category}${llmOut.category === m.expected ? ' ✅' : ' ❌'} |`);
    }

    // Estimate: average input ~30 tokens, output ~20 tokens, no cache.
    // Real numbers come from the cost ledger when run live.
    const avgIn = 30;
    const avgOut = 20;
    const costPerCallUsd = computeCost(MODELS.cheap, { input_tokens: avgIn, output_tokens: avgOut });
    const projectedCostPer1k = costPerCallUsd * 1000;

    const ruleAcc = rule.correct / rule.total;
    const ruleCoverage = rule.covered / rule.total;
    const llmAcc = llm.correct / llm.total;

    const dir = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const md = [
      '# Merchant Categorizer Benchmark',
      '',
      `- Mode: **${process.env.EVAL_REAL === 'true' ? 'LIVE' : 'MOCK'}**`,
      `- Dataset size: ${MERCHANTS.length} labelled Indian merchants`,
      '',
      '## Headline metrics',
      '',
      '| System | Accuracy | Coverage | Avg latency (ms) | Projected $/1k calls |',
      '|---|---|---|---|---|',
      `| **Rule-based** | ${(ruleAcc * 100).toFixed(1)}% | ${(ruleCoverage * 100).toFixed(1)}% | ${(rule.totalLatencyMs / rule.total).toFixed(2)} | $0.0000 (offline) |`,
      `| **LLM (Haiku 4.5)** | ${(llmAcc * 100).toFixed(1)}% | 100.0% | ${(llm.totalLatencyMs / llm.total).toFixed(2)} | $${projectedCostPer1k.toFixed(4)} |`,
      '',
      '## Methodology',
      '',
      'For each merchant string the rule classifier runs first; if it returns null we ' +
        'fall back to the LLM. This benchmark runs both classifiers on the **full** dataset ' +
        'so we can quantify what we lose by skipping the LLM (the rules\' coverage gap) and ' +
        'what we gain in cost by routing through rules first.',
      '',
      '**Distillation path:** collect ~500 production merchant strings the rules miss, label ' +
        'with the LLM, fine-tune a 1.5B-param classifier (e.g. Llama 3.2 1B). Target: match ' +
        'LLM accuracy within 3 points at 1/20th the cost-per-call.',
      '',
      '## Per-merchant detail',
      '',
      ...rows,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'benchmark-merchant.md'), md);

    // The harness must always produce numbers; we don't assert accuracy here
    // because the LLM mock always returns 'other'. Live mode adds an upper-bound
    // assertion below.
    expect(rule.total).toBe(MERCHANTS.length);
    expect(llm.total).toBe(MERCHANTS.length);

    if (process.env.EVAL_REAL === 'true') {
      expect(llmAcc).toBeGreaterThanOrEqual(0.7);
      expect(ruleAcc).toBeGreaterThanOrEqual(0.6);
    }
  }, 120_000);
});
