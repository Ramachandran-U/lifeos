/**
 * Pluggable embedder. In live mode (VOYAGE_API_KEY set), calls Voyage's
 * `voyage-3-lite` (1024-dim). In mock mode, uses a deterministic hash-based
 * pseudo-embedding (256-dim) so CI is offline and reproducible.
 *
 * Voyage was chosen over OpenAI for cost (~5x cheaper at this size class) and
 * over Anthropic because Anthropic doesn't ship a first-party embeddings API.
 */

const HASH_DIM = 256;

function hashEmbed(text: string): number[] {
  // Token-frequency style: each word hashed into N buckets, summed, then L2-normalized.
  const v = new Array<number>(HASH_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h = Math.imul(h ^ t.charCodeAt(i), 16777619);
    }
    const bucket = Math.abs(h) % HASH_DIM;
    v[bucket]! += 1;
    // Add bigram-like signal so similar phrases cluster
    const bucket2 = Math.abs(Math.imul(h, 2654435761)) % HASH_DIM;
    v[bucket2]! += 0.5;
  }
  return l2Normalize(v);
}

function l2Normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

async function voyageEmbed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  const isMock = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';
  if (apiKey && !isMock) return voyageEmbed(text, apiKey);
  return hashEmbed(text);
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText));
}
