import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Thin wrapper over the browser Web Speech API for one-shot voice dictation
 * (used by voice food logging). Web-only and feature-detected — on native, or
 * in a browser without SpeechRecognition, `supported` is false and the caller
 * simply hides the entry point. This deliberately does NOT touch the Gemini
 * Live voice path (`voiceClient.ts`); it's a separate, lightweight transcript
 * source.
 */

// Minimal structural types for the bits of the Web Speech API we use — the DOM
// lib doesn't ship SpeechRecognition types, and they're vendor-prefixed.
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  const g = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getCtor() !== null;
}

/**
 * Map Web Speech API error codes to actionable copy. The raw codes ('network',
 * 'not-allowed') read as developer noise, and each common failure has a
 * different user remedy — mic permission vs. no mic vs. the browser's speech
 * service being unreachable (Chrome's recogniser is cloud-backed, so corporate
 * networks / privacy browsers can block it while the rest of the app works).
 */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'no-speech':
      return "Didn't catch that — try again.";
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it for this site in your browser settings, then retry.';
    case 'audio-capture':
      return 'No microphone found. Check your input device and try again.';
    case 'network':
      return "Your browser couldn't reach its speech service — some browsers and networks block it. Check your connection or try Chrome.";
    default:
      return 'Voice input failed. Try again, or type your meal instead.';
  }
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognition {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('Voice input is not supported on this device.');
      return;
    }
    setError(null);
    setTranscript('');
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = (e) => {
      setError(speechErrorMessage(e.error));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, []);

  // Abort any in-flight recognition on unmount.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported: isSpeechRecognitionSupported(), listening, transcript, error, start, stop, reset };
}
