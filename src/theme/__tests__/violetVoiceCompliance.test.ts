/**
 * Guard E — violet is a voice, not a paint (founder ruling, 2026-06-14).
 *
 * Violet (`c.primary` / `primaryDim` / `primaryText`) means THE BRAND OR THE
 * AI IS SPEAKING: the wordmark, the front door, the planner's suggestions,
 * the AI's chat/voice/transparency attributions, the companion, the install
 * ask. It never means "this is a button", "this is selected", or
 * "gamification" (which speaks xp gold / streak ember / badge amber — the xp
 * token itself left the violet family in this ruling).
 *
 * The Aurora-era residue this kills: Button/Button3D silently DEFAULTED to
 * violet, so every untoned CTA shipped purple. The defaults are gone (tone is
 * a required prop), the ~80 residual surfaces were re-toned, and this ratchet
 * keeps it that way: a violet read outside the allowlist is a red build.
 *
 * ONE-WAY RATCHET (same culture as Guards A–D): entries are removed as voice
 * surfaces are redesigned away — never added without a founder-approved PR
 * labelled `manifesto-change`. A false positive is allowlisted with a voice
 * comment, never fixed by weakening the regex.
 *
 * Seed: 51 files, measured 2026-06-14 (ruling day, post-sweep). Reproduce:
 * empty the ALLOWLIST and run this test — the failure list is the seed.
 * Convenience approximation:
 *   rg "c\.primary(Dim|Text)?\b|colors\.primary\b" src app -g '*.ts' -g '*.tsx'
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

const VIOLET_READ = /c\.primary(Dim|Text)?\b|colors\.primary\b/;

const ALLOWLIST = new Set<string>([
  // ── The brand signature (front door + opening moment) ──
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(auth)/welcome.tsx',
  'app/welcome-intent.tsx',
  // ── The AI extraction + planner-generated onboarding steps ──
  'app/(onboarding)/discovery-intro.tsx',
  'app/(onboarding)/discovery-paste.tsx',
  'app/(onboarding)/discovery-chat.tsx',
  // Spoken onboarding (the AI guide talking the user through setup) — a voice
  // surface, like discovery-chat above.
  'app/(onboarding)/discovery-voice.tsx',
  'app/(onboarding)/day1-routine.tsx',
  // ── The planner speaking (eyebrows, proposals, diffs; index.tsx also
  //    carries its frozen flag-off legacy branch — kill-switch path) ──
  'app/(tabs)/index.tsx',
  'src/components/shared/DailyBriefing.tsx',
  'src/components/shared/WhatNextCard.tsx',
  'src/components/shared/CoachActionsCard.tsx',
  'src/components/shared/AdaptationCard.tsx',
  'src/components/shared/GoalReplanSheet.tsx',
  'src/components/shared/GoalRebalanceSheet.tsx',
  'src/components/shared/PriorityChangeSheet.tsx',
  'src/components/shared/DomainNudgeCard.tsx',
  'src/components/shared/RoutineDiffPreview.tsx',
  'src/components/shared/NextMoveHero.tsx',
  'src/components/shared/TodayHeader.tsx',
  // ── The AI's own pages/sheets (one attribution each on the reviews) ──
  'app/chat.tsx',
  'app/what-lifeos-knows.tsx',
  'app/what-lifeos-remembers.tsx',
  'app/monthly-insight.tsx',
  'app/finance-review.tsx',
  'app/annual-review.tsx',
  'app/evening-reflect.tsx',
  // VoiceCompanion went violet-free: the AI's voice surface now speaks entirely
  // in ink / semantic tokens (state colour + audio-reactive ink halo), so it no
  // longer reads a primary token. Removed from the allowlist as the ratchet
  // shrinks — never to return without a founder-approved manifesto-change PR.
  'src/components/shared/NarrationToggle.tsx',
  // ── The companion (founder call: the AI made visible) + comeback warmth ──
  'src/components/companion/CompanionSheet.tsx',
  'src/components/shared/ComebackSheet.tsx',
  // ── The brand asking for residency ──
  'src/components/shared/InstallSheet.tsx',
  'src/components/shared/AddToHomeScreenPrompt.tsx',
  // ── The two synthesis visualizations: the life-shape polygon and the
  //    LifeScore ring — the brand's view across all six domains ──
  'src/components/gamification/HexRadar.tsx',
  'src/components/shared/LifeScoreHero.tsx',
  // ── Brand event language, invisible at rest ──
  'src/components/shared/InkCanvas.tsx',
  // ── Quiet functional uses: primaryDim switch tracks; focus borders;
  //    component-default fallbacks (call sites pass context colors) ──
  'app/settings.tsx',
  'app/notifications-settings.tsx',
  'app/(tabs)/profile.tsx',
  'src/components/shared/ProfileSidebar.tsx',
  'src/components/shared/OnboardingIntroSection.tsx',
  'src/components/ui/Button.tsx',
  'src/components/ui/Input.tsx',
  'src/components/ui/EmptyState.tsx',
  'src/components/ui/ProgressBar.tsx',
  // LoadingDots no longer reads a violet token — it defaults to neutral ink
  // (violet is the brand/AI voice, not a generic loading colour). Removed from
  // the allowlist as the ratchet shrinks.
  'src/components/ui/DomainGlyph.tsx',
  'src/components/ui/DomainChip.tsx',
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
      if (rel.startsWith('src/theme/')) continue; // token definitions
      // Frozen flag-off trees, deletion-bound (PARKED 13.1) — not worth
      // re-toning code that dies on graduation.
      if (rel.startsWith('src/screens/legacy/')) continue;
      if (ALLOWLIST.has(rel)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (VIOLET_READ.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe('violet voice compliance — violet is the brand/AI speaking, nothing else', () => {
  it('no file outside the sanctioned voices reads a primary token', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'Violet read outside the sanctioned voices (founder ruling 2026-06-14): ' +
        'violet means the brand or the AI is speaking. Buttons take an explicit ' +
        'contextual tone (domain hue / xp gold / ink); selection states are ink; ' +
        'gamification speaks gold/ember. Growing this allowlist requires a ' +
        'founder-approved PR labelled manifesto-change. Violations:\n  ' +
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
