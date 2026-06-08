// Minimal ElevenLabs TTS client used by the dev-time generation script in
// scripts/generate-onboarding-audio.ts. NOT imported from app code — the
// app only ever plays the bundled MP3s produced by the script.

const API_BASE = 'https://api.elevenlabs.io/v1';

export interface SynthesisOptions {
  apiKey: string;
  voiceId: string;
  text: string;
  // eleven_turbo_v2_5 is the cheapest/lowest-latency. eleven_multilingual_v2
  // is the highest-quality. Onboarding is one-shot so we default to v2.
  modelId?: string;
}

export async function synthesize({
  apiKey,
  voiceId,
  text,
  modelId = 'eleven_multilingual_v2',
}: SynthesisOptions): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  return res.arrayBuffer();
}

// Word-boundary timestamp from the ElevenLabs /with-timestamps endpoint.
export interface WordTimestamp {
  word: string;
  start: number;  // seconds from audio start
  end: number;
}

export interface SynthesisWithTimestampsResult {
  audioBuffer: ArrayBuffer;
  words: WordTimestamp[];
}

/**
 * Synthesizes audio AND returns per-word timestamps via the
 * /text-to-speech/{voiceId}/with-timestamps endpoint (ElevenLabs v2+).
 *
 * The result lets the generation script write cue manifests that the
 * useNarration hook can use for frame-accurate card reveals once we swap
 * the playback engine from expo-speech to expo-av.
 *
 * Only called by scripts/generate-onboarding-audio.ts — never at app runtime.
 */
export async function synthesizeWithTimestamps({
  apiKey,
  voiceId,
  text,
  modelId = 'eleven_multilingual_v2',
}: SynthesisOptions): Promise<SynthesisWithTimestampsResult> {
  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }

  const json = (await res.json()) as {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  // Decode base64 audio to ArrayBuffer.
  const binary = Buffer.from(json.audio_base64, 'base64');
  const audioBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength,
  ) as ArrayBuffer;

  // Collapse character-level alignment into word-level timestamps.
  const words: WordTimestamp[] = [];
  const { characters, character_start_times_seconds, character_end_times_seconds } =
    json.alignment;

  let wordChars = '';
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i]!;
    if (wordChars === '') wordStart = character_start_times_seconds[i]!;

    if (ch === ' ' || ch === '\n') {
      if (wordChars.length > 0) {
        words.push({ word: wordChars, start: wordStart, end: character_end_times_seconds[i - 1]! });
        wordChars = '';
      }
    } else {
      wordChars += ch;
    }
  }
  if (wordChars.length > 0) {
    words.push({
      word: wordChars,
      start: wordStart,
      end: character_end_times_seconds[characters.length - 1]!,
    });
  }

  return { audioBuffer, words };
}
