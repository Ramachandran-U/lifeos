/**
 * Tests for the voice path: PCM16 playback decoding and the mock voice-session
 * lifecycle that drives the UI status states (listening → thinking → speaking).
 */
import { base64ToFloat32 } from '@/ai/pcmPlayer';
import { base64ToBytes, bytesToBase64, pcmChunksToWavBase64 } from '@/ai/pcmCodec';
import type { VoiceEvent } from '@/ai/voiceClient';

function int16ToBase64(samples: number[]): string {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
  return buf.toString('base64');
}

describe('base64ToFloat32 (model audio decode)', () => {
  it('decodes little-endian PCM16 into normalised floats', () => {
    const b64 = int16ToBase64([0, 16384, -16384, 32767, -32768]);
    const out = base64ToFloat32(b64);
    expect(out.length).toBe(5);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0.5, 3);
    expect(out[2]).toBeCloseTo(-0.5, 3);
    expect(out[3]).toBeCloseTo(0.99997, 3);
    expect(out[4]).toBeCloseTo(-1, 3);
  });

  it('returns an empty array for empty input', () => {
    expect(base64ToFloat32('').length).toBe(0);
  });
});

describe('PCM byte helpers + WAV container (native playback)', () => {
  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('wraps PCM chunks in a valid 44-byte mono WAV header', () => {
    const chunkA = base64ToBytes(int16ToBase64([1, 2, 3, 4])); // 8 bytes
    const chunkB = base64ToBytes(int16ToBase64([5, 6])); //        4 bytes
    const wav = base64ToBytes(pcmChunksToWavBase64([chunkA, chunkB], 24000));

    const ascii = (off: number, len: number) =>
      String.fromCharCode(...wav.subarray(off, off + len));
    const u32 = (off: number) =>
      wav[off] | (wav[off + 1] << 8) | (wav[off + 2] << 16) | (wav[off + 3] << 24);
    const u16 = (off: number) => wav[off] | (wav[off + 1] << 8);

    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    expect(u16(20)).toBe(1); // PCM
    expect(u16(22)).toBe(1); // mono
    expect(u32(24)).toBe(24000); // sample rate
    expect(u16(34)).toBe(16); // bits per sample
    const dataLen = 12; // 8 + 4 bytes of PCM
    expect(u32(40)).toBe(dataLen);
    expect(u32(4)).toBe(36 + dataLen); // RIFF chunk size
    expect(wav.byteLength).toBe(44 + dataLen);
  });
});

describe('mock voice session lifecycle', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
  });

  it('opens, echoes the user input, streams a reply, and completes the turn', () => {
    jest.isolateModules(() => {
      // Avoid pulling the real supabase client into the mock path.
      jest.doMock('@/integrations/supabase/session', () => ({
        getSupabaseAccessToken: jest.fn().mockResolvedValue(null),
      }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createVoiceSession } = require('@/ai/voiceClient');

      const events: VoiceEvent[] = [];
      const session = createVoiceSession({ onEvent: (e: VoiceEvent) => events.push(e) });

      // Session opens after its connect delay.
      jest.advanceTimersByTime(300);
      expect(events.map((e) => e.type)).toContain('open');
      expect(session.isOpen()).toBe(true);

      session.sendText('What should I do next?');

      // Input transcript is echoed immediately so the UI can confirm it heard us.
      const input = events.find((e) => e.type === 'inputTranscript');
      expect(input).toBeTruthy();
      expect((input as { text: string }).text).toBe('What should I do next?');

      // Reply streams in, then the turn completes.
      jest.advanceTimersByTime(1600);
      const types = events.map((e) => e.type);
      expect(types).toContain('text');
      expect(types).toContain('turnComplete');

      const reply = events
        .filter((e) => e.type === 'text')
        .map((e) => (e as { text: string }).text)
        .join('');
      expect(reply).toContain('What should I do next?');
    });
  });
});
