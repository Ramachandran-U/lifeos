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

/**
 * Comeback nudge (R4, comeback_v1) — a single OPT-IN one-shot scheduled 3 days
 * after each open, replaced on every open (so it only ever fires after a real
 * gap). Same copy contract as above: warm invitation, zero countdowns, zero
 * streak threats, explicit permission to ignore. Denylist-tested.
 */
export const COMEBACK_GENTLE_NOTIFICATION = {
  title: 'Your day is ready when you are',
  body: 'No rush and nothing owed — LifeOS is keeping your plans warm whenever you feel like a small step.',
} as const;

/** Shared storage key for the notifications-settings toggles (screen + the
 *  comeback rescheduler read the same prefs). */
export const NOTIFICATION_PREFS_KEY = 'lifeos.notifications.prefs';
