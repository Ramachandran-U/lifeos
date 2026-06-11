/**
 * Guard D — LABEL-CAPS surfaces (Manifesto P5).
 *
 * "We never reach for a border, a label-cap, or a card where a headline would
 * do." Type does the talking: new emphasis is a typography.ts variant
 * (hero→micro), not a hand-rolled caps eyebrow. Four patterns, each a
 * violation in a non-allowlisted file:
 *
 *   1. variant="micro"                       (.tsx only)
 *   2. <SectionLabel …>                      (.tsx only)
 *   3. textTransform: 'uppercase'            (.ts AND .tsx — typography.ts is
 *      the only legal home and today's only .ts match in the tree)
 *   4. two-plus-word ALL-CAPS literal in JSX text or a string prop
 *      (catches `YOUR NEXT MOVE`, label="BEST STREAK")  (.tsx only — the
 *      pattern is noisy in .ts data/SQL files; a scoping decision, not a hedge)
 *
 * ONE-WAY RATCHET: entries are removed as screens migrate to headline
 * hierarchy — never added without a founder-approved PR labelled
 * `manifesto-change`. False positive → allowlist that one file with a comment,
 * never weaken a regex.
 *
 * Seed: 171 occurrences across 65 files (union of all four patterns,
 * including src/theme/typography.ts as the sole .ts entry).
 * Measured: 2026-06-10 (landing day).
 * Reproduce: empty the ALLOWLIST below and run
 *   npx jest src/theme/__tests__/capsLabelCompliance.test.ts
 * — the failure list is the seed. Convenience approximation:
 *   rg "variant=[\"']micro[\"']|<SectionLabel[\s>/]|textTransform:\s*['\"]uppercase['\"]" src app -l
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

// [regex, applies to .ts files, applies to .tsx files]
const CAPS_PATTERNS: ReadonlyArray<readonly [RegExp, boolean, boolean]> = [
  [/variant=["']micro["']/, false, true],
  [/<SectionLabel[\s>/]/, false, true],
  [/textTransform:\s*['"]uppercase['"]/, true, true],
  [/["'>][A-Z][A-Z]+(?: [A-Z0-9/+&.'-]+)+["'<]/, false, true],
];

const ALLOWLIST = new Set<string>([
  'app/(onboarding)/day1-career.tsx',
  'app/(onboarding)/day1-routine.tsx',
  'app/(onboarding)/day1-vision.tsx',
  'app/(onboarding)/day14-polymath.tsx',
  'app/(onboarding)/day7-finance.tsx',
  'app/(tabs)/career.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/finance.tsx',
  'app/(tabs)/goals.tsx',
  'app/(tabs)/health.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/profile.tsx',
  'app/(tabs)/rewards.tsx',
  'app/(tabs)/social.tsx',
  'app/activity.tsx',
  'app/annual-review.tsx',
  'app/contact/[id].tsx',
  'app/data-residency.tsx',
  'app/edit-priorities.tsx',
  'app/evening-reflect.tsx',
  'app/finance-category.tsx',
  'app/finance-review.tsx',
  'app/monthly-insight.tsx',
  'app/notifications-settings.tsx',
  'app/what-lifeos-knows.tsx',
  'app/what-lifeos-remembers.tsx',
  // founder-approved manifesto-change batch (resolution 8, approved 2026-06-10): hero metadata caps in the W3 first-win hero.
  'src/components/gamification/FirstWinCard.tsx',
  'src/components/gamification/ProgressPath.tsx',
  'src/components/gamification/QuestDetailSheet.tsx',
  'src/components/modules/career/CareerStrategyView.tsx',
  'src/components/modules/finance/FinanceGoalCard.tsx',
  'src/components/modules/finance/SubscriptionsBillsCard.tsx',
  'src/components/modules/finance/WeeklyInsightCard.tsx',
  'src/components/modules/goals/AddGoalSheet.tsx',
  'src/components/modules/health/BloodReportCard.tsx',
  'src/components/modules/health/EnergyCard.tsx',
  'src/components/modules/health/FitDashboard.tsx',
  'src/components/modules/health/HealthSummaryCard.tsx',
  'src/components/modules/health/MealSuggestionsCard.tsx',
  'src/components/modules/health/RecoveryCard.tsx',
  'src/components/modules/health/WaterCard.tsx',
  'src/components/modules/polymath/ChasingNowCard.tsx',
  'src/components/modules/polymath/ConstellationView.tsx',
  'src/components/modules/polymath/DiscoverGrid.tsx',
  'src/components/modules/polymath/ExpeditionProgressRow.tsx',
  'src/components/modules/polymath/FrontierCard.tsx',
  'src/components/modules/polymath/RabbitHoleBreadcrumb.tsx',
  'src/components/modules/polymath/RabbitHoleForkButton.tsx',
  'src/components/modules/polymath/SparkHeroCard.tsx',
  'src/components/modules/polymath/YouTubeImportCard.tsx',
  'src/components/modules/social/ContactsImportCard.tsx',
  'src/components/modules/social/UpcomingBirthdaysCard.tsx',
  'src/components/shared/AddToHomeScreenPrompt.tsx',
  'src/components/shared/CoachActionsCard.tsx',
  'src/components/shared/DailyBriefing.tsx',
  'src/components/shared/DomainNudgeCard.tsx',
  'src/components/shared/LifeScoreHero.tsx',
  'src/components/shared/OvercommitmentCard.tsx',
  'src/components/shared/PriorityChangeSheet.tsx',
  'src/components/shared/RoutineDiffPreview.tsx',
  'src/components/shared/WeeklyBalanceCard.tsx',
  'src/components/shared/WhatNextCard.tsx',
  'src/components/ui/DomainChip.tsx',
  'src/components/ui/SectionLabel.tsx',
  'src/components/ui/WheelTimePicker.tsx',
  'src/theme/typography.ts',
]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(REPO_ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (ALLOWLIST.has(rel)) continue;
      const isTsx = rel.endsWith('.tsx');
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const [regex, onTs, onTsx] of CAPS_PATTERNS) {
          if ((isTsx ? onTsx : onTs) && regex.test(line)) {
            violations.push(`${rel}:${i + 1}  ${line.trim()}`);
            break;
          }
        }
      });
    }
  }
  return violations;
}

describe('caps label compliance — no new LABEL-CAPS surfaces', () => {
  it('no file outside the allowlist adds a caps eyebrow or uppercase transform', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'New LABEL-CAPS surface. Type does the talking (Manifesto P5): set the ' +
        'words as an h1/h2/h3 headline from src/theme/typography.ts. A caps eyebrow ' +
        "is wayfinding furniture, never the message — and never above the screen's " +
        'hero. Violations:\n  ' +
        violations.join('\n  '),
      );
    }
  });

  it('the allowlist only shrinks (entries must exist on disk)', () => {
    for (const rel of ALLOWLIST) {
      const full = path.join(REPO_ROOT, ...rel.split('/'));
      expect({ rel, exists: fs.existsSync(full) }).toEqual({ rel, exists: true });
    }
  });
});
