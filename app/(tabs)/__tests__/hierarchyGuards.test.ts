/**
 * Hierarchy guards — Ink + Signal §3.0.2 / §4 traps 2, 4, 8 / AC7.
 *
 * The repo has no ESLint, so the module-screen hierarchy contract is enforced
 * as a Jest source-guard (precedent: src/db/queries/__tests__/
 * syncReadContract.test.ts and the src/theme/__tests__ compliance ratchets).
 * It reads the five module-screen route files with fs.readFileSync and fails
 * on the patterns the recomposition kills.
 *
 * Scope notes (decided in the W4 foundation PR, 2026-06-12):
 * - The five SCREEN_FILES are the app/(tabs) ROUTE files only. The verbatim
 *   pre-recomposition trees in src/screens/legacy/*.legacy.tsx are EXEMPT from
 *   every check here — they carry the old surface unchanged until the
 *   module_hierarchy_v1 graduation deletes them (see docs/PARKED_ITEMS.md
 *   §13). This mirrors Guard A's allowlist, which already covered the original
 *   screen files and whose entries followed the extraction 1:1.
 * - HERO_FILES don't all exist yet (each screen PR lands its hero). Missing
 *   files are SKIPPED via fs.existsSync — a deliberate ratchet: the checks arm
 *   themselves the moment a hero file appears.
 * - KILL_TABLE_FILES (§3.0.7) started with the 13 child-card files that were
 *   already emoji-free. UpcomingBirthdaysCard.tsx joined in the W4 Social PR
 *   (2026-06-12 batch B): the §3.4 item 2 re-skin deleted its cake/party
 *   glyphs and caps eyebrow — the append-as-you-sweep ratchet closed at 14/14.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const read = (rel: string) =>
  fs.readFileSync(path.join(REPO_ROOT, ...rel.split('/')), 'utf8');

const exists = (rel: string) => fs.existsSync(path.join(REPO_ROOT, ...rel.split('/')));

/** The five module-screen ROUTE files (thin wrappers / recomposed screens). */
const SCREEN_FILES = [
  'app/(tabs)/health.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/career.tsx',
  'app/(tabs)/social.tsx',
  'app/(tabs)/finance.tsx',
] as const;

/**
 * The five hero component files (§3.0.1 testID contract). Finance has no
 * separate hero file — its hero renders inline in app/(tabs)/finance.tsx, so
 * the route file stands in for it here. Files that don't exist yet are
 * skipped (each screen PR appends its hero by creating the file).
 */
const HERO_FILES = [
  'src/components/modules/health/HealthPulseHero.tsx',
  'src/components/modules/polymath/SparkHeroCard.tsx',
  'src/components/modules/career/CareerPathHero.tsx',
  'src/components/modules/social/ReconnectHero.tsx',
  'app/(tabs)/finance.tsx', // Finance hero slot lives in the route file (§3.5)
  // W4 screens batch C (2026-06-12): the finance hero's render states were
  // extracted to FinanceHero.tsx so the AC8/AC13/R4 unit halves are render-
  // testable (route files run in neither jest project). The route file above
  // keeps its stand-in entry — it still owns the testID slot.
  'src/components/modules/finance/FinanceHero.tsx',
] as const;

/**
 * §3.0.7 child-card kill table — the files whose CAPS eyebrows and emoji die
 * with their screen's PR. Seeded with the 13 files that were emoji-clean at
 * the foundation; UpcomingBirthdaysCard.tsx joined in the W4 Social PR (its
 * glyphs died with the §3.4 item 2 "Coming up" re-skin) — list complete.
 */
const KILL_TABLE_FILES = [
  'src/components/modules/polymath/ExpeditionProgressRow.tsx',
  'src/components/modules/polymath/ChasingNowCard.tsx',
  'src/components/modules/polymath/FrontierCard.tsx',
  'src/components/modules/polymath/CrossDisciplineCard.tsx',
  'src/components/modules/polymath/ConstellationView.tsx',
  'src/components/modules/health/MealSuggestionsCard.tsx',
  'src/components/modules/health/BloodReportCard.tsx',
  'src/components/modules/health/FitDashboard.tsx',
  'src/components/modules/career/CareerStrategyView.tsx',
  'src/components/modules/finance/SubscriptionsBillsCard.tsx',
  'src/components/modules/finance/FinanceGoalCard.tsx',
  'src/components/modules/finance/MilestoneTracker.tsx',
  'src/components/modules/finance/WeeklyInsightCard.tsx',
  'src/components/modules/social/UpcomingBirthdaysCard.tsx',
] as const;

/**
 * Files CREATED by this cluster (hex-literal check). The legacy extractions
 * are deliberately EXEMPT — they carry the pre-existing trees verbatim, and
 * the original screen files' hex literals were already covered by Guard A's
 * allowlist (whose entry moved with the extraction). Hero files are appended
 * via HERO_FILES as they land.
 */
const CLUSTER_CREATED_FILES = [
  'src/components/ui/SectionTitle.tsx',
  'src/components/ui/ConnectRow.tsx',
  'src/components/ui/EmptyState.tsx',
  'src/store/useHeroSnoozeStore.ts',
  // W4 screens batch A (2026-06-12): zero-suppression row components created
  // with the Health/Explore recompositions (§3.0.5 / AC8).
  'src/components/modules/health/HealthStreakRow.tsx',
  'src/components/modules/polymath/WeekStatLine.tsx',
  // W4 screens batch B (2026-06-12): Career sheet/modal extractions (§3.3,
  // trap 2) + the social stat row (§3.4 item 3 / AC8). Heroes are covered via
  // HERO_FILES.
  'src/components/modules/career/CareerSetupSheet.tsx',
  'src/components/modules/career/SavePathModal.tsx',
  'src/components/modules/social/SocialHealthRow.tsx',
  // W4 screens batch C (2026-06-12): the extracted Finance hero (§3.5 / AC8 /
  // AC13 unit halves). Also listed in HERO_FILES for the tint/emoji checks.
  'src/components/modules/finance/FinanceHero.tsx',
  ...SCREEN_FILES,
] as const;

// U+1F300–U+1FAFF — the emoji blocks §3.0.5 bans from this cluster's output.
const EMOJI = /[\u{1F300}-\u{1FAFF}]/u;
// Trap 4 — a domain token concatenated with a quoted alpha/tint suffix.
const ACCENT_TINT = /c\.(health|career|social|finance|polymath)\s*\+\s*'/;
// 3/6/8-digit quoted hex color literal (same anchoring as Guard A).
const RAW_HEX = /(['"`])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\1/;

function violations(files: readonly string[], regex: RegExp, skipMissing = false): string[] {
  const out: string[] = [];
  for (const rel of files) {
    if (skipMissing && !exists(rel)) continue; // existsSync-skip — see header note
    read(rel)
      .split('\n')
      .forEach((line, i) => {
        if (regex.test(line)) out.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
  }
  return out;
}

describe('module-screen hierarchy guards (Ink + Signal §3.0 / AC7)', () => {
  it('no SectionLabel in the five screen route files', () => {
    expect(violations(SCREEN_FILES, /SectionLabel/)).toEqual([]);
  });

  it('no literal-CAPS <Label> usage in the five screen route files', () => {
    expect(violations(SCREEN_FILES, /<Label[ >]/)).toEqual([]);
  });

  it('career.tsx carries no inline form — no TextInput, no Input import (trap 2)', () => {
    expect(
      violations(['app/(tabs)/career.tsx'], /TextInput|from '@\/components\/ui\/Input'/),
    ).toEqual([]);
  });

  it('no emoji (U+1F300–U+1FAFF) in the screens, §3.0.7 files, or hero files (§3.0.5)', () => {
    expect(violations(SCREEN_FILES, EMOJI)).toEqual([]);
    expect(violations(KILL_TABLE_FILES, EMOJI)).toEqual([]);
    expect(violations(HERO_FILES, EMOJI, true)).toEqual([]);
  });

  it("no domain-token tint (c.<domain> + '…') in the hero files (trap 4)", () => {
    expect(violations(HERO_FILES, ACCENT_TINT, true)).toEqual([]);
  });

  it('no new hex color literal in files created by this cluster (AC7)', () => {
    expect(violations(CLUSTER_CREATED_FILES, RAW_HEX)).toEqual([]);
    expect(violations(HERO_FILES, RAW_HEX, true)).toEqual([]);
  });

  it('the guarded file lists exist on disk (route files + seeded kill table)', () => {
    // Same culture as the theme ratchets: a renamed file left on a list would
    // silently disarm its checks — prune or rename instead.
    for (const rel of [...SCREEN_FILES, ...KILL_TABLE_FILES]) {
      expect({ rel, exists: exists(rel) }).toEqual({ rel, exists: true });
    }
  });
});
