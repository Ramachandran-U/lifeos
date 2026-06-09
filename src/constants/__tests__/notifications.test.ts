import { STREAK_AT_RISK_NOTIFICATION } from '../notifications';

// Guards red line #1 (docs/research/ui-ux-gamification-2026.md §11) and the
// app's own "no streak shaming" promise: the streak nudge must use forward /
// momentum framing, never loss-aversion. If this fails, you reintroduced
// guilt/loss copy — reframe toward momentum + permission to skip.

/** Phrases that signal loss-aversion / streak-shaming. Lowercased substring match. */
const LOSS_AVERSION_TERMS = [
  'lose',
  'losing',
  'at risk',
  "don't",
  'dont',
  'break your streak',
  'break a streak',
  'before midnight',
  'midnight',
  'reset',
  'expire',
  'alive',
  'skip today',
  'shame',
  'last chance',
  'hurry',
];

function assertNoLossAversion(label: string, text: string) {
  const lower = text.toLowerCase();
  for (const term of LOSS_AVERSION_TERMS) {
    expect(`${label} :: ${lower}`).not.toContain(term);
  }
}

describe('STREAK_AT_RISK_NOTIFICATION copy', () => {
  it('has a non-empty title and body', () => {
    expect(STREAK_AT_RISK_NOTIFICATION.title.length).toBeGreaterThan(0);
    expect(STREAK_AT_RISK_NOTIFICATION.body.length).toBeGreaterThan(0);
  });

  it('uses no loss-aversion / streak-shaming phrasing in the title', () => {
    assertNoLossAversion('title', STREAK_AT_RISK_NOTIFICATION.title);
  });

  it('uses no loss-aversion / streak-shaming phrasing in the body', () => {
    assertNoLossAversion('body', STREAK_AT_RISK_NOTIFICATION.body);
  });
});
