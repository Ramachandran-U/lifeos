import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { ONBOARDING_SCRIPTS } from '@/integrations/elevenlabs/scripts';

// expo-speech backend — free, offline, zero quota.
// When MP3 assets exist (npm run gen:onboarding-audio), swap the play path
// to expo-av Audio.Sound + position-based cue firing at 100 ms intervals.
// The hook surface stays identical; only the engine changes.

const RATE: Partial<Record<string, number>> = { ios: 0.48, android: 0.95 };

const SCRIPT_MAP = Object.fromEntries(ONBOARDING_SCRIPTS.map((s) => [s.id, s]));

export interface UseNarrationResult {
  isPlaying: boolean;
  isAvailable: boolean;
  isMuted: boolean;
  /** Card ids that have been cued so far — drives OnboardingIntroSection. */
  revealedCards: ReadonlySet<string>;
  /** All intro cards for this script have been revealed. */
  allCardsRevealed: boolean;
  /** Toggle mute / unmute. If unmuted, starts (or replays) the narration. */
  toggle: () => void;
  /** Stop narration, fire all remaining unrevealed cards immediately. */
  skip: () => void;
  /** Stop narration and timers; does not reveal remaining cards. */
  stop: () => void;
}

export function useNarration(scriptId: string): UseNarrationResult {
  const script = SCRIPT_MAP[scriptId] ?? null;
  const narrationEnabled = usePreferencesStore((s) => s.narrationEnabled);
  const setNarrationEnabled = usePreferencesStore((s) => s.setNarrationEnabled);

  const [isPlaying, setPlaying] = useState(false);
  const [revealedCards, setRevealedCards] = useState<ReadonlySet<string>>(new Set());

  const playedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const scheduleCards = useCallback(
    (cards: { id: string; atMs: number }[]) => {
      clearTimers();
      timersRef.current = cards.map((card) =>
        setTimeout(() => {
          setRevealedCards((prev) => new Set([...prev, card.id]));
        }, card.atMs),
      );
    },
    [clearTimers],
  );

  const startSpeech = useCallback(() => {
    if (!script) return;
    Speech.speak(script.text, {
      rate: RATE[Platform.OS] ?? 0.95,
      pitch: 1.0,
      language: 'en-US',
      onStart: () => setPlaying(true),
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
    scheduleCards(script.introCards);
  }, [script, scheduleCards]);

  // Auto-play once on mount when narration is enabled.
  useEffect(() => {
    if (!script || !narrationEnabled || playedRef.current) return;
    playedRef.current = true;
    startSpeech();

    return () => {
      Speech.stop().catch(() => undefined);
      clearTimers();
      setPlaying(false);
    };
    // Only re-run when the script itself changes (navigating between screens).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  const toggle = useCallback(() => {
    if (!script) return;

    if (!narrationEnabled) {
      // Enable preference and start fresh.
      setNarrationEnabled(true);
      playedRef.current = false;
      setRevealedCards(new Set());
      startSpeech();
      return;
    }

    Speech.isSpeakingAsync()
      .then((speaking) => {
        if (speaking) {
          Speech.stop().catch(() => undefined);
          clearTimers();
          setPlaying(false);
        } else {
          // Replay from the start.
          setRevealedCards(new Set());
          startSpeech();
        }
      })
      .catch(() => undefined);
  }, [script, narrationEnabled, setNarrationEnabled, startSpeech, clearTimers]);

  const skip = useCallback(() => {
    if (!script) return;
    Speech.stop().catch(() => undefined);
    clearTimers();
    setPlaying(false);
    setRevealedCards(new Set(script.introCards.map((c) => c.id)));
  }, [script, clearTimers]);

  const stop = useCallback(() => {
    Speech.stop().catch(() => undefined);
    clearTimers();
    setPlaying(false);
  }, [clearTimers]);

  const allCardsRevealed =
    script !== null && revealedCards.size >= script.introCards.length;

  return {
    isPlaying,
    isAvailable: script !== null,
    isMuted: !narrationEnabled,
    revealedCards,
    allCardsRevealed,
    toggle,
    skip,
    stop,
  };
}
