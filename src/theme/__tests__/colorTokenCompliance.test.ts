/**
 * Guard A — raw color literals outside src/theme/ (Manifesto P3, P5).
 *
 * Color is meaning: every hue ships as a token in src/theme/colors.ts and is
 * read via useColors()/colors — never inlined. This guard fails on any quoted
 * hex literal or rgba()/hsl() functional literal in src/** or app/** outside
 * src/theme/ (the one legal home for color definitions).
 *
 * ONE-WAY RATCHET (same culture as motionTokenCompliance.test.ts): the
 * ALLOWLIST below is the landing-day offender set. Entries are REMOVED as
 * files are migrated to tokens — never added without a founder-approved PR
 * labelled `manifesto-change`. A false positive is handled by allowlisting
 * that one file with a comment — never by weakening a regex.
 *
 * Seed: 232 occurrences (185 quoted-hex + 47 rgba()/hsl()) across 65 files.
 * Measured: 2026-06-10 (landing day).
 * Reproduce: empty the ALLOWLIST below and run
 *   npx jest src/theme/__tests__/colorTokenCompliance.test.ts
 * — the failure list is the seed. Convenience approximation (also exclude
 * src/theme, __tests__ dirs, and *.test.* files, as this guard's walk does):
 *   rg "(['\"])#[0-9a-fA-F]{3,8}\1|\brgba?\(|\bhsla?\(" src app -t ts -l
 *
 * Known, decided limitation (recorded so it cannot be re-litigated as an
 * excuse): a hex value embedded mid-template-literal (not immediately
 * quote-delimited) is not matched by the quote-anchored regex. Accepted for
 * this wave — the rgba/hsl regex catches the common web-shadow constructions —
 * and revisited only at the ESLint migration. Not grounds to widen the regex
 * ad hoc or to skip a migration.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

const RAW_HEX = /(['"`])#[0-9a-fA-F]{3,8}\1/;
const RAW_FUNCTIONAL = /\brgba?\(|\bhsla?\(/;

const ALLOWLIST = new Set<string>([
  'app/(auth)/_layout.tsx',
  'app/(onboarding)/_layout.tsx',
  'app/(onboarding)/day1-routine.tsx',
  'app/(onboarding)/discovery-chat.tsx',
  'app/(tabs)/goals.tsx',
  'app/(tabs)/health.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/profile.tsx',
  'app/+html.tsx',
  'app/_layout.tsx',
  'app/expedition-detail.tsx',
  'app/notifications-settings.tsx',
  'app/what-lifeos-knows.tsx',
  'app/what-lifeos-remembers.tsx',
  'src/components/gamification/AvatarRing.tsx',
  'src/components/gamification/LevelLadder.tsx',
  'src/components/gamification/ProgressPath.tsx',
  'src/components/gamification/QuestDetailSheet.tsx',
  'src/components/modules/goals/GoalDetailSheet.tsx',
  'src/components/modules/health/AddFoodSheet.tsx',
  'src/components/modules/health/BarcodeScannerWeb.tsx',
  'src/components/modules/health/CalorieRing.tsx',
  'src/components/modules/health/EditVitalsSheet.tsx',
  'src/components/modules/health/MealSuggestionsCard.tsx',
  'src/components/modules/health/WaterCard.tsx',
  'src/components/modules/polymath/AddInterestSheet.tsx',
  'src/components/modules/polymath/DiscoverGrid.tsx',
  'src/components/modules/polymath/LogExplorationSheet.tsx',
  'src/components/modules/polymath/YouTubeImportCard.tsx',
  'src/components/modules/polymath/discoverArea.ts',
  'src/components/modules/profile/AvatarEditSheet.tsx',
  'src/components/modules/social/ContactsImportCard.tsx',
  'src/components/shared/AddToHomeScreenPrompt.tsx',
  // ratchet −5 (Ink + Signal W1 PR-2): the wash files died; useAmbientState
  // re-tokenized — entries removed, never to return.
  // ratchet −14 (Ink + Signal W2 PR-3): the structural-color sweep retokened
  // these files' last literals (inkOnColor/onPrimary labels, overlay scrims,
  // surfaceAlt pills) — entries removed, never to return.
  'src/components/shared/DailySummarySheet.tsx',
  'src/components/shared/DraggableRoutineList.tsx',
  'src/components/shared/ErrorBoundary.tsx',
  'src/components/shared/GoalRebalanceSheet.tsx',
  'src/components/shared/GoalReplanSheet.tsx',
  'src/components/shared/PriorityChangeSheet.tsx',
  'src/components/shared/ProfileSidebar.tsx',
  'src/components/shared/RoutineBlock.tsx',
  'src/components/shared/VoiceAssistantSheet.tsx',
  'src/components/shared/YesterdayLogSheet.tsx',
  'src/components/ui/AuroraGlow.tsx',
  'src/finance/categoryGroups.ts',
  'src/finance/display.ts',
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
      if (rel.startsWith('src/theme/')) continue; // token definitions — the one legal home
      if (ALLOWLIST.has(rel)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (RAW_HEX.test(line) || RAW_FUNCTIONAL.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe('color token compliance — no raw color literals outside src/theme/', () => {
  it('src/** and app/** read color through tokens, never inline literals', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'Raw color literal found outside src/theme/. Color is meaning (Manifesto P3): ' +
        'read tokens via useColors() / colors.ts, or add a semantic token to ' +
        'src/theme/colors.ts. Never inline a hue. Violations:\n  ' +
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
