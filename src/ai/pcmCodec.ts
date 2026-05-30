/**
 * Shared PCM16 codec + player contract for the Gemini Live voice path.
 *
 * Gemini Live native-audio output is mono, little-endian, 16-bit PCM at 24 kHz.
 * The web player streams it through Web Audio; the native player accumulates a
 * turn and plays it as a WAV via expo-av. Both share the decode/encode helpers
 * and the `PcmPlayerHandle` contract below.
 */

export const PCM_OUTPUT_SAMPLE_RATE = 24000;

export interface PcmPlayerOptions {
  /** Sample rate of the incoming PCM16 stream. Defaults to 24 kHz (Gemini Live). */
  sampleRate?: number;
  /** Fired when playback starts after being idle. */
  onStart?: () => void;
  /** Fired once the queue (web) or the turn's audio (native) has finished. */
  onDrain?: () => void;
  onError?: (msg: string) => void;
}

export interface PcmPlayerHandle {
  /** Feed one base64 PCM16 chunk. Web plays it live; native buffers it. */
  enqueue: (pcm16Base64: string) => void;
  /**
   * Signal that the model's turn is complete. No-op on web (it streams live);
   * on native this flushes the buffered turn to the speaker.
   */
  endTurn: () => void;
  /**
   * Unlock/resume audio output. MUST be safe to call from a user-gesture
   * handler — on web that's what lifts the autoplay suspension.
   */
  resume: () => void;
  /** Stop immediately and clear anything pending (barge-in / interrupt). */
  stop: () => void;
  isPlaying: () => boolean;
  dispose: () => void;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let s = '';
    // Chunk to avoid blowing the argument limit on large buffers.
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64ToFloat32(base64: string): Float32Array {
  const bytes = base64ToBytes(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

/**
 * Wrap accumulated raw PCM16 byte chunks in a minimal 44-byte mono WAV header
 * and return the whole thing base64-encoded — playable on native via a
 * `data:audio/wav;base64,...` URI.
 */
export function pcmChunksToWavBase64(chunks: Uint8Array[], sampleRate: number): string {
  let dataLen = 0;
  for (const c of chunks) dataLen += c.byteLength;

  const out = new Uint8Array(44 + dataLen);
  const dv = new DataView(out.buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true); // PCM fmt chunk size
  dv.setUint16(20, 1, true); // audio format = PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); // byte rate = rate * channels * bytesPerSample
  dv.setUint16(32, 2, true); // block align = channels * bytesPerSample
  dv.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  dv.setUint32(40, dataLen, true);

  let off = 44;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return bytesToBase64(out);
}
