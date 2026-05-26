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
