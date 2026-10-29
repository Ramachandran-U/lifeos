/**
 * Feature-detection coverage for the EXPORTED pure helper in
 * src/hooks/useSpeechRecognition.ts (node project): isSpeechRecognitionSupported().
 *
 * The React hook itself (useSpeechRecognition) is intentionally NOT tested here —
 * it needs renderHook (useState/useRef/useEffect + browser SpeechRecognition
 * lifecycle), which this node project can't run. Reported as skipped.
 *
 * isSpeechRecognitionSupported feature-detects via getCtor():
 *   web + (SpeechRecognition | webkitSpeechRecognition) present  → true
 *   otherwise (native/node, or web with neither global)          → false
 */

import { Platform } from 'react-native';
import { isSpeechRecognitionSupported } from '../useSpeechRecognition';

// The node-suite react-native stub exposes a mutable Platform.OS; flip it per
// case. Cast to the stub's literal union (no `any`).
type MutablePlatform = { OS: 'node' | 'web' | 'ios' | 'android' };
const platform = Platform as unknown as MutablePlatform;

type SpeechGlobals = typeof globalThis & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};
const g = globalThis as SpeechGlobals;

const originalOS = platform.OS;

// A throwaway constructor stand-in — getCtor only checks for presence, never
// instantiates it during feature detection.
class FakeSpeechRecognition {}

afterEach(() => {
  platform.OS = originalOS;
  delete g.SpeechRecognition;
  delete g.webkitSpeechRecognition;
});

describe('isSpeechRecognitionSupported', () => {
  it('returns false on native/node regardless of any globals', () => {
    platform.OS = 'ios';
    g.SpeechRecognition = FakeSpeechRecognition;

    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('returns false on web when neither SpeechRecognition global exists', () => {
    platform.OS = 'web';

    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('returns true on web when the standard SpeechRecognition global exists', () => {
    platform.OS = 'web';
    g.SpeechRecognition = FakeSpeechRecognition;

    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it('returns true on web via the vendor-prefixed webkitSpeechRecognition global', () => {
    platform.OS = 'web';
    g.webkitSpeechRecognition = FakeSpeechRecognition;

    expect(isSpeechRecognitionSupported()).toBe(true);
  });
});
