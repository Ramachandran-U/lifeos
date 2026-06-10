import { isEnabled } from '@/config/flags';
import { usePreferencesStore } from '@/store/usePreferencesStore';

/**
 * Celebration micro-sounds (M5) — expo-audio, NOT the deprecated expo-av.
 *
 * Gating is double opt-in: the compile-time `soundEffects` flag AND the
 * user's `soundEnabled` preference (default OFF — sound is a treat the user
 * asks for, never a surprise). `gamification: 'off'` silences everything.
 *
 * Audio mode: playsInSilentMode false (the iOS mute switch always wins) and
 * interruptionMode 'mixWithOthers' (never duck the user's podcast for a
 * 300 ms chime).
 *
 * Everything is lazy + best-effort: expo-audio and the wav assets load on
 * the FIRST eligible play, so the module is import-safe in node tests and
 * adds nothing to boot; failures (Expo Go quirks, web autoplay policy) are
 * swallowed — a missing chime must never break a celebration.
 */

export type SfxName = 'chime' | 'sweep' | 'fanfare' | 'sparkle';

interface AudioPlayerLike {
  seekTo: (seconds: number) => void;
  play: () => void;
}

let audioApi: typeof import('expo-audio') | null = null;
let modeSet = false;
const players = new Map<SfxName, AudioPlayerLike>();

function sfxSource(name: SfxName): number {
  switch (name) {
    case 'chime':
      return require('../../assets/sfx/chime.wav') as number;
    case 'sweep':
      return require('../../assets/sfx/sweep.wav') as number;
    case 'fanfare':
      return require('../../assets/sfx/fanfare.wav') as number;
    case 'sparkle':
      return require('../../assets/sfx/sparkle.wav') as number;
  }
}

export function soundOn(): boolean {
  if (!isEnabled('soundEffects')) return false;
  const prefs = usePreferencesStore.getState();
  return prefs.soundEnabled && prefs.gamification !== 'off';
}

/** Fire-and-forget. Never throws; never blocks the caller. */
export function playSfx(name: SfxName): void {
  if (!soundOn()) return;
  void (async () => {
    try {
      if (!audioApi) {
        audioApi = await import('expo-audio');
      }
      if (!modeSet) {
        modeSet = true;
        await audioApi
          .setAudioModeAsync({
            playsInSilentMode: false,
            interruptionMode: 'mixWithOthers',
            shouldPlayInBackground: false,
          })
          .catch(() => undefined);
      }
      let player = players.get(name);
      if (!player) {
        player = audioApi.createAudioPlayer(sfxSource(name)) as AudioPlayerLike;
        players.set(name, player);
      }
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is garnish. Silence is always an acceptable outcome.
    }
  })();
}

/** Test seam. */
export function __resetSoundEngineForTests(): void {
  audioApi = null;
  modeSet = false;
  players.clear();
}
