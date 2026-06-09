import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Single platform-guarded haptics surface (Aurora Alive M0).
 *
 * Call sites used to scatter `if (Platform.OS !== 'web') Haptics....catch(...)`
 * — this wrapper centralizes the guard + swallow so haptics can never throw
 * into UI code, and gives the app a SEMANTIC vocabulary:
 *
 *   selection  → focus/choice changes (chips, pickers, tab presses)
 *   light      → ordinary tap acknowledgement
 *   medium     → notable state change
 *   heavy      → reward beats, level-ups (the "thud")
 *   success    → completion moments (block done, badge earned, goal saved)
 *   warning    → destructive confirms + negative outcomes (delete, streak loss)
 *   error      → failures surfaced to the user (AI errors, sync failure)
 *   holdTick   → sub-perceptual mid-gesture tick (e.g. 50% of hold-to-confirm).
 *                Intent feedback only — success still fires on COMMIT, never
 *                on intent (Aurora guardrail 4).
 *
 * All are fire-and-forget no-ops on web.
 */

const isWeb = Platform.OS === 'web';

function impact(style: Haptics.ImpactFeedbackStyle): void {
  if (isWeb) return;
  Haptics.impactAsync(style).catch(() => undefined);
}

function notify(type: Haptics.NotificationFeedbackType): void {
  if (isWeb) return;
  Haptics.notificationAsync(type).catch(() => undefined);
}

export const haptic = {
  selection(): void {
    if (isWeb) return;
    Haptics.selectionAsync().catch(() => undefined);
  },
  light(): void { impact(Haptics.ImpactFeedbackStyle.Light); },
  medium(): void { impact(Haptics.ImpactFeedbackStyle.Medium); },
  heavy(): void { impact(Haptics.ImpactFeedbackStyle.Heavy); },
  success(): void { notify(Haptics.NotificationFeedbackType.Success); },
  warning(): void { notify(Haptics.NotificationFeedbackType.Warning); },
  error(): void { notify(Haptics.NotificationFeedbackType.Error); },
  holdTick(): void { impact(Haptics.ImpactFeedbackStyle.Light); },
} as const;
