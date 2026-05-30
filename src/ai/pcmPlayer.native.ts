/**
 * Native (iOS/Android) playback for the model's PCM16 audio. Metro resolves
 * this file in place of `pcmPlayer.ts` on native.
 *
 * Web streams audio through Web Audio, but there's no AudioContext on native.
 * Instead we accumulate the turn's PCM chunks, wrap them in a WAV container at
 * `endTurn()`, and play the whole reply via expo-av from a data URI. This adds
 * a small "play after the turn finishes" delay versus the web streaming path,
 * but it's reliable and uses no native modules beyond expo-av.
 *
 * `playsInSilentModeIOS` is essential — without it the reply is silent whenever
 * the iOS ringer switch is on, which looks exactly like "no audio".
 */

import { Audio } from 'expo-av';
import {
  base64ToBytes,
  pcmChunksToWavBase64,
  PCM_OUTPUT_SAMPLE_RATE,
  type PcmPlayerHandle,
  type PcmPlayerOptions,
} from './pcmCodec';

export { base64ToFloat32 } from './pcmCodec';
export type { PcmPlayerHandle, PcmPlayerOptions } from './pcmCodec';

export function createPcmPlayer(opts: PcmPlayerOptions = {}): PcmPlayerHandle {
  const sampleRate = opts.sampleRate ?? PCM_OUTPUT_SAMPLE_RATE;
  let chunks: Uint8Array[] = [];
  let sound: Audio.Sound | null = null;
  let playing = false;
  let audioModeReady = false;

  const ensureAudioMode = async () => {
    if (audioModeReady) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      audioModeReady = true;
    } catch {
      /* non-fatal — playback may still work with default mode */
    }
  };

  const unload = async (s: Audio.Sound | null) => {
    if (!s) return;
    try {
      await s.unloadAsync();
    } catch {
      /* noop */
    }
  };

  const playAccumulated = async () => {
    const pending = chunks;
    chunks = [];
    if (pending.length === 0) {
      if (playing) {
        playing = false;
        opts.onDrain?.();
      }
      return;
    }

    await ensureAudioMode();
    const wavBase64 = pcmChunksToWavBase64(pending, sampleRate);
    try {
      await unload(sound);
      sound = null;
      const { sound: snd } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${wavBase64}` },
        { shouldPlay: true },
      );
      sound = snd;
      snd.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          playing = false;
          void unload(snd);
          if (sound === snd) sound = null;
          opts.onDrain?.();
        }
      });
    } catch {
      playing = false;
      opts.onError?.('Could not play the audio reply.');
      opts.onDrain?.();
    }
  };

  return {
    enqueue: (pcm16Base64: string) => {
      try {
        chunks.push(base64ToBytes(pcm16Base64));
      } catch {
        /* skip malformed chunk */
      }
    },
    endTurn: () => {
      if (chunks.length === 0) return;
      if (!playing) {
        playing = true;
        opts.onStart?.();
      }
      void playAccumulated();
    },
    resume: () => {
      void ensureAudioMode();
    },
    stop: () => {
      chunks = [];
      playing = false;
      const s = sound;
      sound = null;
      if (s) {
        s.stopAsync().catch(() => {});
        void unload(s);
      }
    },
    isPlaying: () => playing,
    dispose: () => {
      chunks = [];
      playing = false;
      const s = sound;
      sound = null;
      void unload(s);
    },
  };
}
