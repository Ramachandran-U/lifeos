/**
 * Guilt-phrase denylist over EVERY companion / comeback surface (R3+R4).
 *
 * Extends the STREAK_AT_RISK precedent (constants/__tests__/notifications.test.ts)
 * from one constant to the whole Wave-4 copy surface: the mood reasons, the
 * comeback sheet, the companion sheet, and the comeback notification. Scans
 * the SOURCE files (same technique as motionTokenCompliance) so copy edits
 * can't dodge the guard by moving strings around.
 *
 * If this fails: reframe toward momentum, warmth, and permission to be away.
 * The companion never guilts; away time is rest, not loss.
 */
import * as fs from 'fs';
import * as path from 'path';
import { deriveMood } from '../mood';
import { COMEBACK_GENTLE_NOTIFICATION } from '@/constants/notifications';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Word-bounded patterns over lowercased text (plain substrings would flag
 *  "Close" for "lose"). Keep the vocabulary in sync with notifications.test.ts. */
const GUILT_TERMS: RegExp[] = [
  /\blose\b/,
  /\blosing\b/,
  /\blost\b/,
  /\bat risk\b/,
  /don'?t leave/,
  /\babandoned\b/,
  /miss you if/, // conditional-guilt framing; plain "missed you" warmth is fine
  /disappointed/,
  /sad without/,
  /break (?:your|a) streak/,
  /midnight/,
  /\breset\b/,
  /\bexpires?\b/,
  /last chance/,
  /\bhurry\b/,
  /only today/,
  /running out/,
  /\bshame\b/,
  /\bguilt\b/,
  /starving/,
  /\bsick\b/,
  /\bdying\b/,
];

const COPY_SOURCE_FILES = [
  'src/companion/mood.ts',
  'src/components/shared/ComebackSheet.tsx',
  'src/components/companion/CompanionSheet.tsx',
  'src/components/companion/CompanionAvatar.tsx',
  'src/constants/notifications.ts',
  'src/hooks/useComeback.ts',
];

function violations(label: string, text: string): string[] {
  const lower = text.toLowerCase();
  return GUILT_TERMS.filter((t) => t.test(lower)).map((t) => `${label} matches ${t}`);
}

/** Drop comments so a docstring QUOTING a banned phrase as a counter-example
 *  (e.g. mood.ts's `never says "you abandoned me"`) can't false-positive.
 *  None of the scanned files carry `//` inside a string literal. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('companion + comeback copy carries zero guilt', () => {
  test('every deriveMood reason is guilt-free', () => {
    const reasons = [
      deriveMood({ bestActiveStreak: 0, streakAtRisk: false, todayCompletionPct: 0, daysSinceLastOpen: 30, stagnantDomain: false, unclaimedChests: 0 }),
      deriveMood({ bestActiveStreak: 0, streakAtRisk: true, todayCompletionPct: 0, daysSinceLastOpen: 0, stagnantDomain: false, unclaimedChests: 0 }),
      deriveMood({ bestActiveStreak: 0, streakAtRisk: false, todayCompletionPct: 0, daysSinceLastOpen: 0, stagnantDomain: true, unclaimedChests: 0 }),
      deriveMood({ bestActiveStreak: 9, streakAtRisk: false, todayCompletionPct: 1, daysSinceLastOpen: 0, stagnantDomain: false, unclaimedChests: 0 }),
      deriveMood({ bestActiveStreak: 0, streakAtRisk: false, todayCompletionPct: 0, daysSinceLastOpen: 0, stagnantDomain: false, unclaimedChests: 3 }),
      deriveMood({ bestActiveStreak: 0, streakAtRisk: false, todayCompletionPct: 0.4, daysSinceLastOpen: 0, stagnantDomain: false, unclaimedChests: 0 }),
    ];
    for (const { mood, reason } of reasons) {
      expect(violations(`mood:${mood}`, reason)).toEqual([]);
    }
  });

  test('the comeback notification is an invitation, not a threat', () => {
    expect(violations('comeback title', COMEBACK_GENTLE_NOTIFICATION.title)).toEqual([]);
    expect(violations('comeback body', COMEBACK_GENTLE_NOTIFICATION.body)).toEqual([]);
  });

  test('no companion/comeback source file carries guilt phrasing in its strings', () => {
    const found: string[] = [];
    for (const rel of COPY_SOURCE_FILES) {
      const full = path.join(REPO_ROOT, ...rel.split('/'));
      const src = stripComments(fs.readFileSync(full, 'utf8'));
      // Scan only string literals — identifiers like pendingStreakLoss would
      // otherwise false-positive on "lost"/"loss".
      const literals = src.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];
      for (const lit of literals) {
        for (const v of violations(rel, lit)) found.push(`${v} :: ${lit.slice(0, 80)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
