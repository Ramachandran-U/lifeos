import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { ONBOARDING_SCRIPTS } from '@/integrations/elevenlabs/scripts';

// Device-native TTS via expo-speech. Free, offline, zero quota.
// iOS uses AVSpeechSynthesizer (Siri voices), Android uses TextToSpeech,
// web uses the browser SpeechSynthesis API. Quality is "good enough" for
// onboarding — for a more cinematic voice we'd swap the engine behind
// this hook for ElevenLabs (paid).

const SCRIPT_BY_ID = Object.fromEntries(
  ONBOARDING_SCRIPTS.map((s) => [s.id, s.text]),
);

// Rate/pitch tuned slightly slow + warm. On iOS, Siri's enhanced voices
// are auto-selected if installed.
const SPEECH_OPTIONS: Speech.SpeechOptions = {
  rate: Platform.OS === 'ios' ? 0.48 : 0.95,
  pitch: 1.0,
  language: 'en-US',
};

export interface UseOnboardingNarrationResult {
  isPlaying: boolean;
  isAvailable: boolean;
  toggle: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useOnboardingNarration(scriptId: string): UseOnboardingNarrationResult {
  const text = SCRIPT_BY_ID[scriptId] ?? null;
  const narrationEnabled = usePreferencesStore((s) => s.narrationEnabled);
  const [isPlaying, setPlaying] = useState(false);
  const playedRef = useRef(false);

  // Auto-play once on mount when narration is enabled.
  useEffect(() => {
    if (!text || !narrationEnabled || playedRef.current) return;
    playedRef.current = true;

    const start = async () => {
      try {
        // expo-speech doesn't take a Promise interface for completion, so
        // we rely on the lifecycle callbacks.
        Speech.speak(text, {
          ...SPEECH_OPTIONS,
          onStart: () => setPlaying(true),
          onDone: () => setPlaying(false),
          onStopped: () => setPlaying(false),
          onError: () => setPlaying(false),
        });
      } catch {
        setPlaying(false);
      }
    };
    void start();

    return () => {
      Speech.stop().catch(() => undefined);
      setPlaying(false);
    };
    // We only want this to fire once per script id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

  const toggle = async () => {
    if (!text) return;
    try {
      const speaking = await Speech.isSpeakingAsync();
      if (speaking) {
        await Speech.stop();
        setPlaying(false);
      } else {
        Speech.speak(text, {
          ...SPEECH_OPTIONS,
          onStart: () => setPlaying(true),
          onDone: () => setPlaying(false),
          onStopped: () => setPlaying(false),
          onError: () => setPlaying(false),
        });
      }
    } catch {
      /* ignore */
    }
  };

  const stop = async () => {
    try {
      await Speech.stop();
    } catch {
      /* ignore */
    }
    setPlaying(false);
  };

  return { isPlaying, isAvailable: text !== null, toggle, stop };
}
