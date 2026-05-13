// Force mock mode unless explicitly opted into a live run.
if (!process.env.EVAL_REAL) {
  process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true';
}

import * as fs from 'fs';
import * as path from 'path';
import type { EvalSuite, GraderResult } from './types';
import { summarize as summarizeCost } from '@/ai/costLedger';
import { getSpans, summarizeTrace } from '@/ai/tracing';

import decomposeGoalSuite from './cases/decomposeGoal';
import generateFinancialPlanSuite from './cases/generateFinancialPlan';
import generateRoutineSuite from './cases/generateRoutine';
import categorizeMerchantSuite from './cases/categorizeMerchant';
import ragRetrieveSuite from './cases/ragRetrieve';
import planRoutineAgentSuite from './cases/planRoutineAgent';
import parseBloodReportSafetySuite from './cases/parseBloodReportSafety';
import discoveryChatSuite from './cases/discoveryChat';
import replanRemainingDaySuite from './cases/replanRemainingDay';

const suites: EvalSuite<any, any>[] = [
  decomposeGoalSuite,
  generateFinancialPlanSuite,
  generateRoutineSuite,
  categorizeMerchantSuite,
  ragRetrieveSuite,
  planRoutineAgentSuite,
  parseBloodReportSafetySuite,
  discoveryChatSuite,
  replanRemainingDaySuite,
];

interface CaseReport {
  name: string;
  passed: boolean;
  graders: GraderResult[];
}

interface SuiteReport {
  name: string;
  threshold: number;
  passRate: number;
  cases: CaseReport[];
}

const reports: SuiteReport[] = [];

afterAll(() => {
  const dir = path.join(__dirname, 'reports');
  fs.mkdirSync(dir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const mode = process.env.EVAL_REAL === 'true' ? 'LIVE' : 'MOCK';

  const cost = summarizeCost();
  const trace = summarizeTrace();
  const spans = getSpans();

  fs.writeFileSync(
    path.join(dir, 'latest.json'),
    JSON.stringify({ generatedAt, mode, suites: reports, cost, trace }, null, 2),
  );
  fs.writeFileSync(
    path.join(dir, 'traces.jsonl'),
    spans.map((s) => JSON.stringify(s)).join('\n'),
  );

  const lines: string[] = [
    '# LifeOS AI Eval Report',
    '',
    `- Generated: ${generatedAt}`,
    `- Mode: **${mode}**`,
    '',
    '## Summary',
    '',
    '| Suite | Pass rate | Threshold | Status |',
    '|---|---|---|---|',
    ...reports.map((r) => {
      const ok = r.passRate >= r.threshold;
      return `| \`${r.name}\` | ${(r.passRate * 100).toFixed(1)}% (${r.cases.filter((c) => c.passed).length}/${r.cases.length}) | ${(r.threshold * 100).toFixed(0)}% | ${ok ? '✅ pass' : '❌ fail'} |`;
    }),
    '',
    '## Cost & token usage',
    '',
    `- Calls: **${cost.calls}**`,
    `- Input tokens: ${cost.totalInputTokens.toLocaleString()}`,
    `- Output tokens: ${cost.totalOutputTokens.toLocaleString()}`,
    `- Cache-read tokens: ${cost.totalCacheReadTokens.toLocaleString()} (hit rate: ${(cost.cacheHitRate * 100).toFixed(1)}%)`,
    `- Total cost: **$${cost.totalCostUsd.toFixed(4)}**`,
    '',
    ...(cost.calls > 0
      ? [
          '| Task | Calls | Cost (USD) |',
          '|---|---|---|',
          ...Object.entries(cost.byTask).map(([t, v]) => `| \`${t}\` | ${v.calls} | $${v.costUsd.toFixed(4)} |`),
          '',
          '| Model | Calls | Cost (USD) |',
          '|---|---|---|',
          ...Object.entries(cost.byModel).map(([m, v]) => `| \`${m}\` | ${v.calls} | $${v.costUsd.toFixed(4)} |`),
          '',
        ]
      : ['_(No live calls — all suites ran in mock mode.)_', '']),
    '## Tracing',
    '',
    `- Spans recorded: **${trace.total}** (${trace.errors} errors)`,
    `- Total wall time across spans: ${trace.totalDurationMs} ms`,
    `- Avg span duration: ${trace.avgDurationMs.toFixed(1)} ms`,
    ...(trace.total > 0
      ? [
          '',
          '| Span name | Count | Total ms | Errors |',
          '|---|---|---|---|',
          ...Object.entries(trace.byName).map(
            ([n, v]) => `| \`${n}\` | ${v.count} | ${v.totalMs} | ${v.errors} |`,
          ),
        ]
      : ['- _Raw span dump: `evals/reports/traces.jsonl`_']),
    '',
    '## Per-case detail',
    '',
  ];
  for (const r of reports) {
    lines.push(`### \`${r.name}\``, '');
    for (const c of r.cases) {
      lines.push(`- ${c.passed ? '✅' : '❌'} **${c.name}**`);
      for (const g of c.graders) {
        if (!g.passed) lines.push(`  - ❌ \`${g.name}\`${g.detail ? ` — ${g.detail}` : ''}`);
      }
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(dir, 'latest.md'), lines.join('\n'));
});

describe('LifeOS AI evals', () => {
  for (const suite of suites) {
    test(`${suite.name} — pass rate >= ${(suite.threshold * 100).toFixed(0)}%`, async () => {
      const caseReports: CaseReport[] = [];
      for (const c of suite.cases) {
        let output: unknown;
        try {
          output = await suite.run(c.input);
        } catch (err) {
          caseReports.push({
            name: c.name,
            passed: false,
            graders: [{ name: 'run', passed: false, detail: err instanceof Error ? err.message : String(err) }],
          });
          continue;
        }
        const graders = await Promise.all(c.graders.map((g) => g(output as never, c.input)));
        caseReports.push({ name: c.name, passed: graders.every((g) => g.passed), graders });
      }
      const passed = caseReports.filter((c) => c.passed).length;
      const passRate = passed / caseReports.length;
      reports.push({ name: suite.name, threshold: suite.threshold, passRate, cases: caseReports });

      if (passRate < suite.threshold) {
        const fails = caseReports
          .filter((c) => !c.passed)
          .map((c) => {
            const failed = c.graders.filter((g) => !g.passed).map((g) => `${g.name}${g.detail ? ` (${g.detail})` : ''}`);
            return `${c.name}: ${failed.join('; ')}`;
          })
          .join(' | ');
        throw new Error(`${suite.name} pass rate ${(passRate * 100).toFixed(1)}% < threshold ${(suite.threshold * 100).toFixed(0)}%. Failures: ${fails}`);
      }
    });
  }
});
