/**
 * Web microphone capture → PCM16 base64 chunks for the Gemini Live API.
 * Web-only — on native, returns a no-op handle.
 *
 * NOTE: uses `createScriptProcessor`, which is deprecated. All current browsers
 * still ship it (with a console warning) but it's slated for removal. Replace
 * with `AudioWorklet` before this ships to production at scale — the refactor
 * needs a separate worklet module file loaded via `audioContext.audioWorklet
 * .addModule()`. ScriptProcessor runs on the main thread (jank risk under
 * load); AudioWorklet runs in a separate audio thread.
 */

import { Platform } from 'react-native';

export interface MicHandle {
  stop: () => void;
}

export interface MicOptions {
  onChunk: (pcm16Base64: string) => void;
  onLevel: (level: number) => void;
  onError: (msg: string) => void;
}

function float32ToInt16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function startMicCapture(opts: MicOptions): MicHandle {
  if (Platform.OS !== 'web') {
    opts.onError('Mic capture is only available on web.');
    return { stop: () => {} };
  }

  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let stopped = false;

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      opts.onError('Microphone access denied.');
      return;
    }
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

    try { ctx = new AudioContext({ sampleRate: 16000 }); } catch { ctx = new AudioContext(); }
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const timeDomain = new Uint8Array(analyser.frequencyBinCount);

    processor.onaudioprocess = (e) => {
      if (stopped) return;
      const input = e.inputBuffer.getChannelData(0);
      let samples = input;
      if (ctx && ctx.sampleRate !== 16000) {
        const ratio = ctx.sampleRate / 16000;
        const outLen = Math.floor(input.length / ratio);
        const resampled = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) resampled[i] = input[Math.floor(i * ratio)];
        samples = resampled;
      }
      opts.onChunk(float32ToInt16Base64(samples));
      analyser.getByteTimeDomainData(timeDomain);
      let sum = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const v = (timeDomain[i] - 128) / 128;
        sum += v * v;
      }
      opts.onLevel(Math.min(1, Math.sqrt(sum / timeDomain.length) * 3));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  })();

  return {
    stop: () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    },
  };
}
