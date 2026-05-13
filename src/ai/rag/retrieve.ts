import { embedText, embedMany } from './embed';

export interface RagItem {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface IndexedItem extends RagItem {
  embedding: number[];
}

export interface RetrievalHit extends RagItem {
  score: number;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function indexItems(items: RagItem[]): Promise<IndexedItem[]> {
  const embeddings = await embedMany(items.map((i) => i.text));
  return items.map((it, i) => ({ ...it, embedding: embeddings[i]! }));
}

export async function retrieveTopK(
  query: string,
  index: IndexedItem[],
  k = 5,
): Promise<RetrievalHit[]> {
  if (index.length === 0) return [];
  const qVec = await embedText(query);
  const scored = index.map((it) => ({
    id: it.id,
    text: it.text,
    metadata: it.metadata,
    score: cosine(qVec, it.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Convenience for the agent: given raw items and a query, return formatted
 * context strings ready to splice into a prompt.
 */
export async function retrieveContext(
  query: string,
  items: RagItem[],
  k = 5,
): Promise<{ hits: RetrievalHit[]; formatted: string }> {
  const idx = await indexItems(items);
  const hits = await retrieveTopK(query, idx, k);
  const formatted = hits.map((h, i) => `[${i + 1}] (score=${h.score.toFixed(3)}) ${h.text}`).join('\n');
  return { hits, formatted };
}
