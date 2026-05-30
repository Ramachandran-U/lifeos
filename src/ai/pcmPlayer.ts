/**
 * Web playback for the model's streamed PCM16 audio (Gemini Live native-audio
 * output is mono, little-endian, 24 kHz). Chunks arrive over the websocket and
 * are scheduled back-to-back on a single AudioContext timeline so playback is
 * gapless.
 *
 * The native implementation lives in `pcmPlayer.native.ts` (Metro picks it on
 * iOS/Android); this file is the web build. Without it, the assistant's spoken
 * reply is received but never heard.
 *
 * Two web gotchas this handles explicitly:
 *  - Safari exposes the constructor as `webkitAudioContext`, not `AudioContext`.
 *  - Browsers start an AudioContext *suspended* until a user gesture; `resume()`
 *    must be called from a gesture handler (see `resume()` / the send button).
 */

import { Platform } from 'react-native';
import {
  base64ToFloat32,
  PCM_OUTPUT_SAMPLE_RATE,
  type PcmPlayerHandle,
  type PcmPlayerOptions,
} from './pcmCodec';

export { base64ToFloat32 } from './pcmCodec';
export type { PcmPlayerHandle, PcmPlayerOptions } from './pcmCodec';

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis === 'undefined') return null;
  const w = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createPcmPlayer(opts: PcmPlayerOptions = {}): PcmPlayerHandle {
  const Ctor = getAudioContextCtor();
  if (Platform.OS !== 'web' || !Ctor) {
    return {
      enqueue: () => {},
      endTurn: () => {},
      resume: () => {},
      stop: () => {},
      isPlaying: () => false,
      dispose: () => {},
    };
  }

  const sampleRate = opts.sampleRate ?? PCM_OUTPUT_SAMPLE_RATE;
  let ctx: AudioContext | null = null;
  let nextStartTime = 0;
  const activeSources = new Set<AudioBufferSourceNode>();
  let playing = false;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  const ensureCtx = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      ctx = new Ctor({ sampleRate });
    } catch {
      try {
        ctx = new Ctor();
      } catch {
        opts.onError?.('Audio playback is unavailable on this device.');
        return null;
      }
    }
    return ctx;
  };

  const scheduleDrainCheck = () => {
    if (!ctx) return;
    if (drainTimer) clearTimeout(drainTimer);
    const remainingMs = Math.max(0, nextStartTime - ctx.currentTime) * 1000;
    drainTimer = setTimeout(() => {
      drainTimer = null;
      if (activeSources.size === 0 && playing) {
        playing = false;
        opts.onDrain?.();
      }
    }, remainingMs + 80);
  };

  return {
    enqueue: (pcm16Base64: string) => {
      const audioCtx = ensureCtx();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

      let float32: Float32Array;
      try {
        float32 = base64ToFloat32(pcm16Base64);
      } catch {
        return;
      }
      if (float32.length === 0) return;

      const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
      // `.set()` (rather than copyToChannel) avoids the strict Float32Array<ArrayBuffer>
      // generic mismatch and is equivalent for a freshly-created buffer.
      buffer.getChannelData(0).set(float32);

      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);

      const startAt = Math.max(audioCtx.currentTime, nextStartTime);
      if (!playing) {
        playing = true;
        opts.onStart?.();
      }
      src.start(startAt);
      nextStartTime = startAt + buffer.duration;
      activeSources.add(src);
      src.onended = () => {
        activeSources.delete(src);
        if (activeSources.size === 0) scheduleDrainCheck();
      };
      scheduleDrainCheck();
    },
    // Web streams audio live as it arrives, so there's nothing to flush.
    endTurn: () => {},
    resume: () => {
      const audioCtx = ensureCtx();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    },
    stop: () => {
      if (drainTimer) {
        clearTimeout(drainTimer);
        drainTimer = null;
      }
      activeSources.forEach((s) => {
        try {
          s.onended = null;
          s.stop();
        } catch {
          /* already stopped */
        }
        s.disconnect();
      });
      activeSources.clear();
      nextStartTime = ctx ? ctx.currentTime : 0;
      playing = false;
    },
    isPlaying: () => playing,
    dispose: () => {
      if (drainTimer) clearTimeout(drainTimer);
      activeSources.forEach((s) => {
        try {
          s.onended = null;
          s.stop();
        } catch {
          /* noop */
        }
      });
      activeSources.clear();
      ctx?.close().catch(() => {});
      ctx = null;
      playing = false;
    },
  };
}
