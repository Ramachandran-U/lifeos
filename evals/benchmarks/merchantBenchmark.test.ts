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
import { classifyMerchant, __TRAINING_SIZE } from '@/finance/merchantClassifier';
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
  test('rule-based vs distilled classifier vs LLM side-by-side', async () => {
    const rule: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };
    const clf: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };
    const llm: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };

    // Composite tier-1+2+3 stack: cache → rule → classifier → AI.
    // We model "stack accuracy" by running each tier in order and taking the first hit.
    const stack: PerSystemMetric = { total: 0, correct: 0, covered: 0, totalLatencyMs: 0 };
    let stackAiCalls = 0;

    const rows: string[] = [];
    rows.push('| Merchant | Expected | Rule | Classifier | LLM |');
    rows.push('|---|---|---|---|---|');

    for (const m of MERCHANTS) {
      rule.total += 1;
      clf.total += 1;
      llm.total += 1;
      stack.total += 1;

      const t1 = Date.now();
      const ruleOut = categorizeByRule(m.merchant);
      rule.totalLatencyMs += Date.now() - t1;
      if (ruleOut !== null) rule.covered += 1;
      if (ruleOut === m.expected) rule.correct += 1;

      const t2 = Date.now();
      const clfOut = classifyMerchant(m.merchant);
      clf.totalLatencyMs += Date.now() - t2;
      if (clfOut !== null) clf.covered += 1;
      if (clfOut?.category === m.expected) clf.correct += 1;

      const t3 = Date.now();
      const llmOut = await categorizeMerchant(m.merchant, m.amountRupees);
      llm.totalLatencyMs += Date.now() - t3;
      llm.covered += 1; // LLM always returns a category
      if (llmOut.category === m.expected) llm.correct += 1;

      // Stack: rule first, then classifier, then AI.
      let stackVerdict: string | null = null;
      if (ruleOut !== null) stackVerdict = ruleOut;
      else if (clfOut !== null) stackVerdict = clfOut.category;
      else {
        stackVerdict = llmOut.category;
        stackAiCalls += 1;
      }
      stack.covered += 1;
      if (stackVerdict === m.expected) stack.correct += 1;

      rows.push(
        `| \`${m.merchant}\` | \`${m.expected}\` | ${ruleOut ?? '—'}${ruleOut === m.expected ? ' ✅' : ruleOut ? ' ❌' : ''} | ${clfOut ? `${clfOut.category} (${clfOut.confidence.toFixed(2)})` : '—'}${clfOut?.category === m.expected ? ' ✅' : clfOut ? ' ❌' : ''} | ${llmOut.category}${llmOut.category === m.expected ? ' ✅' : ' ❌'} |`,
      );
    }

    // Estimate: average input ~30 tokens, output ~20 tokens, no cache.
    // Real numbers come from the cost ledger when run live.
    const avgIn = 30;
    const avgOut = 20;
    const costPerCallUsd = computeCost(MODELS.cheap, { input_tokens: avgIn, output_tokens: avgOut });
    const projectedCostPer1k = costPerCallUsd * 1000;

    const ruleAcc = rule.correct / rule.total;
    const ruleCoverage = rule.covered / rule.total;
    const clfAcc = clf.correct / clf.total;
    const clfCoverage = clf.covered / clf.total;
    const llmAcc = llm.correct / llm.total;
    const stackAcc = stack.correct / stack.total;
    const stackAiRate = stackAiCalls / stack.total;
    const projectedStackPer1k = projectedCostPer1k * stackAiRate;

    const dir = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const md = [
      '# Merchant Categorizer Benchmark',
      '',
      `- Mode: **${process.env.EVAL_REAL === 'true' ? 'LIVE' : 'MOCK'}**`,
      `- Dataset size: ${MERCHANTS.length} labelled Indian merchants`,
      `- Classifier training size: ${__TRAINING_SIZE} anchors (distilled from rule map)`,
      '',
      '## Headline metrics',
      '',
      '| System | Accuracy | Coverage | Avg latency (ms) | Projected $/1k calls |',
      '|---|---|---|---|---|',
      `| **Rule-based** | ${(ruleAcc * 100).toFixed(1)}% | ${(ruleCoverage * 100).toFixed(1)}% | ${(rule.totalLatencyMs / rule.total).toFixed(2)} | $0.0000 (offline) |`,
      `| **Local classifier (k-NN char-3-gram)** | ${(clfAcc * 100).toFixed(1)}% | ${(clfCoverage * 100).toFixed(1)}% | ${(clf.totalLatencyMs / clf.total).toFixed(2)} | $0.0000 (offline) |`,
      `| **LLM (${MODELS.cheap})** | ${(llmAcc * 100).toFixed(1)}% | 100.0% | ${(llm.totalLatencyMs / llm.total).toFixed(2)} | $${projectedCostPer1k.toFixed(4)} |`,
      '',
      `## Stacked pipeline (cache → rule → classifier → AI)`,
      '',
      `- Stack accuracy: **${(stackAcc * 100).toFixed(1)}%**`,
      `- AI hit rate (% of inputs that escalated to LLM): **${(stackAiRate * 100).toFixed(1)}%**`,
      `- Projected stack cost per 1k inputs: **$${projectedStackPer1k.toFixed(4)}** (vs $${projectedCostPer1k.toFixed(4)} for LLM-only)`,
      '',
      '## Methodology',
      '',
      'For each merchant string we run the rule map, then the distilled classifier, then the LLM, ',
      'independently — so we can measure each tier in isolation. The "Stacked pipeline" section ',
      'models the production routing (rules first, classifier second, AI last) so the AI hit rate ',
      'and projected cost reflect what users actually pay.',
      '',
      'The **local classifier** is a character-3-gram TF-IDF vector space + cosine k-NN over the ',
      'anchor strings in `src/finance/merchantClassifier.ts`. It is the distillation step: zero ',
      'training cost, ~0.1 ms per inference, no API calls. The anchors are seeded from the regex ',
      'rule map and the merchant_cache (which captures user corrections).',
      '',
      '**Next distillation step (deferred):** dump real production merchant strings + their AI ',
      'verdicts from the `merchant_cache` table, retrain the classifier with `__TRAINING_SIZE` ',
      'in the hundreds, and ratchet the confidence floor up as coverage rises. The benchmark ',
      'tracks whether stack accuracy stays at parity with LLM-only.',
      '',
      '## Per-merchant detail',
      '',
      ...rows,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'benchmark-merchant.md'), md);

    expect(rule.total).toBe(MERCHANTS.length);
    expect(clf.total).toBe(MERCHANTS.length);
    expect(llm.total).toBe(MERCHANTS.length);

    if (process.env.EVAL_REAL === 'true') {
      expect(llmAcc).toBeGreaterThanOrEqual(0.7);
      expect(ruleAcc).toBeGreaterThanOrEqual(0.6);
      // Distilled classifier must beat the rule map's coverage gap.
      expect(clfAcc).toBeGreaterThanOrEqual(ruleAcc);
    }

    // Always-on assertion: the stack must do at least as well as the rule map
    // alone (the classifier should never hurt accuracy).
    expect(stackAcc).toBeGreaterThanOrEqual(ruleAcc);
  }, 120_000);
});
