/**
 * Guard C — idle-wash imports (Manifesto P4).
 *
 * "We never let glow idle." The resting base is colors.background with nothing
 * moving. This guard fails on any NEW import of the idle-wash family:
 * AuroraBackground, AuroraAnimatedBackground, AuroraGlow, and the relative
 * ambient/GradientMesh + ambient/presets paths.
 *
 * The relative alternatives REQUIRE the `ambient/` segment on purpose: an
 * optional `(?:ambient\/)?` would match `import { resolvePreset } from
 * './presets'` in src/celebration/CelebrationHost.tsx — the event-driven
 * celebration layer this guard exists to PROTECT. The event layer is untouched
 * and unmatched: EnergySweep, ParticleField, useAmbientEventStore (in
 * src/components/shared/ambient/) and everything in src/celebration/ stay as
 * celebration language — triggered by a completion, and it ends.
 *
 * src/components/ui/AuroraGlow.tsx has zero importers today — it stays in the
 * regex so the first future import is a red build, and contributes no
 * allowlist entry.
 *
 * ONE-WAY RATCHET: entries are removed as the color cluster retires the wash —
 * never added without a founder-approved PR labelled `manifesto-change`.
 *
 * Seed: 43 import occurrences across 42 files (41 importers — 38 ×
 * AuroraBackground incl. app/(tabs)/index.tsx, 3 × AuroraAnimatedBackground on
 * the auth screens — plus src/components/shared/AuroraBackground.tsx itself,
 * which imports ./ambient/GradientMesh). Measured: 2026-06-10 (landing day).
 * Reproduce: empty the ALLOWLIST below and run
 *   npx jest src/theme/__tests__/ambientWashCompliance.test.ts
 * — the failure list is the seed. Convenience approximation:
 *   rg "from ['\"](@/components/shared/AuroraBackground|@/components/shared/AuroraAnimatedBackground|@/components/ui/AuroraGlow|\.{1,2}/ambient/(GradientMesh|presets))['\"]" src app -l
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

const IDLE_WASH_IMPORT =
  /from ['"](?:@\/components\/shared\/AuroraBackground|@\/components\/shared\/AuroraAnimatedBackground|@\/components\/ui\/AuroraGlow|\.{1,2}\/ambient\/(?:GradientMesh|presets))['"]/;

const ALLOWLIST = new Set<string>([
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(auth)/welcome.tsx',
  'app/(onboarding)/day1-career.tsx',
  'app/(onboarding)/day1-routine.tsx',
  'app/(onboarding)/day1-vision.tsx',
  'app/(onboarding)/day14-polymath.tsx',
  'app/(onboarding)/day3-health.tsx',
  'app/(onboarding)/day7-finance.tsx',
  'app/(onboarding)/day7-social.tsx',
  'app/(onboarding)/discovery-chat.tsx',
  'app/(onboarding)/discovery-confirm.tsx',
  'app/(onboarding)/discovery-intro.tsx',
  'app/(onboarding)/discovery-paste.tsx',
  'app/(tabs)/career.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/finance.tsx',
  'app/(tabs)/goals.tsx',
  'app/(tabs)/health.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/rewards.tsx',
  'app/(tabs)/social.tsx',
  'app/activity.tsx',
  'app/annual-review.tsx',
  'app/chat.tsx',
  'app/contact/[id].tsx',
  'app/data-residency.tsx',
  'app/edit-priorities.tsx',
  'app/evening-reflect.tsx',
  'app/expedition-detail.tsx',
  'app/finance-category.tsx',
  'app/finance-merchant.tsx',
  'app/finance-review.tsx',
  'app/how-it-works.tsx',
  'app/monthly-insight.tsx',
  'app/notifications-settings.tsx',
  'app/terms-privacy.tsx',
  'app/welcome-intent.tsx',
  'app/what-lifeos-knows.tsx',
  'app/what-lifeos-remembers.tsx',
  'src/components/modules/polymath/RabbitHoleScreen.tsx',
  'src/components/shared/AuroraBackground.tsx',
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
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (IDLE_WASH_IMPORT.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe('ambient wash compliance — no new idle-wash imports', () => {
  it('no file outside the allowlist imports the idle-wash family', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'New idle-wash import. We never let glow idle (Manifesto P4): the resting ' +
        'base is colors.background with nothing moving. For a completion moment, ' +
        'fire the event layer (useAmbientEventStore sweep / CelebrationHost behind ' +
        'celebrationEngine) — it must end. Violations:\n  ' +
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
