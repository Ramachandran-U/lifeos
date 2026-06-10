import type { CompanionMood } from '@/companion/types';

/**
 * The Rive ⇄ product contract for the companion (M3, flag: riveCompanion).
 *
 * The .riv asset is authored in the Rive editor against EXACTLY this surface;
 * the React components bind to it blindly. If the artboard/state-machine/input
 * names below change, this file is the single place to update.
 *
 * State machine 'Companion':
 *   - number input `mood`  : 0 idle · 1 celebrate · 2 concerned · 3 sleeping
 *   - trigger `levelUp`    : confetti hop
 *   - trigger `streakSave` : shield catch
 *   - trigger `streakLoss` : gentle stumble + recover (NEVER a death/sick pose
 *     — the compassion constraint applies to the art too)
 */

export const COMPANION_ARTBOARD = 'Companion';
export const COMPANION_STATE_MACHINE = 'Companion';
export const COMPANION_MOOD_INPUT = 'mood';

/** The four visual moods the Rive artboard implements. */
export type CompanionRiveMood = 'idle' | 'celebrate' | 'concerned' | 'sleeping';

export const RIVE_MOOD_VALUE: Record<CompanionRiveMood, number> = {
  idle: 0,
  celebrate: 1,
  concerned: 2,
  sleeping: 3,
};

export type CompanionRiveTrigger = 'levelUp' | 'streakSave' | 'streakLoss';

export const COMPANION_TRIGGER_INPUTS: Record<CompanionRiveTrigger, string> = {
  levelUp: 'levelUp',
  streakSave: 'streakSave',
  streakLoss: 'streakLoss',
};

/**
 * Product moods (R3, five values) → the artboard's four visual moods. The
 * artboard intentionally has FEWER states than the product model so the art
 * stays readable at avatar size; thriving/curious/content all map to idle
 * (the breathing base loop) with celebrate reserved for reactions.
 */
export function riveMoodFor(mood: CompanionMood): CompanionRiveMood {
  switch (mood) {
    case 'resting':
      return 'sleeping';
    case 'concerned':
      return 'concerned';
    case 'thriving':
    case 'curious':
    case 'content':
      return 'idle';
  }
}

/**
 * Where the .riv asset lives once authored.
 *
 * NULL until the artwork lands: the asset has not been authored yet, and a
 * static require() of a missing file fails the Metro bundle, so nothing may
 * reference the path until the file exists. While null, <Companion> renders
 * CompanionFallback on every platform regardless of the riveCompanion flag.
 *
 * When the asset is ready:
 *   1. add `assets/rive/companion.riv` (Metro: `.riv` is already an assetExt)
 *   2. copy to `public/rive/companion.riv` for the web runtime
 *   3. return the platform sources here:
 *      native → expo-asset resolved URI of require('../../../assets/rive/companion.riv')
 *      web    → '/rive/companion.riv'
 *
 * NOTE: the Rive native runtime requires a dev-client / EAS build — it is not
 * available in Expo Go (load failure there falls back gracefully too).
 */
export function getCompanionRiveSource(): { native: string | null; web: string | null } | null {
  return null;
}
