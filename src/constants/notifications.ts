/**
 * User-facing copy for local nudge notifications.
 *
 * Kept as a pure constant (no expo imports) so the copy is unit-testable without
 * pulling in expo-notifications. The streak nudge deliberately uses FORWARD /
 * momentum framing and gives explicit permission to skip — never loss-aversion
 * ("don't lose", "at risk", "before midnight", "streak resets"). This honours
 * the app's own "no streak shaming" promise (see app/notifications-settings.tsx)
 * and red line #1 in docs/research/ui-ux-gamification-2026.md §11.
 *
 * Guarded by src/constants/__tests__/notifications.test.ts — the body/title must
 * stay free of loss-aversion phrasing.
 */
export const STREAK_AT_RISK_NOTIFICATION = {
  title: 'Keep your momentum going',
  body: "One small action today keeps your streak going — all good if today is full; there's always tomorrow.",
} as const;
