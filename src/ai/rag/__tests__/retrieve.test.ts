import { cosine, indexItems, retrieveTopK } from '../retrieve';

describe('rag/retrieve', () => {
  test('cosine: identical vectors -> 1', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  test('cosine: orthogonal vectors -> 0', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  test('cosine: zero-vector safe', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  test('retrieveTopK: ranks the relevant doc first', async () => {
    const items = [
      { id: '1', text: 'Lifted weights at the gym for one hour' },
      { id: '2', text: 'Read about distributed systems and consensus algorithms' },
      { id: '3', text: 'Cooked dinner with friends' },
      { id: '4', text: 'Morning run, 5km in 28 minutes' },
    ];
    const idx = await indexItems(items);
    // Query shares the literal token "gym" with item 1 — the hash-based mock
    // embedder is lexical, so we only assert the top hit is correct.
    const hits = await retrieveTopK('gym session today', idx, 2);
    expect(hits[0]!.id).toBe('1');
    expect(hits.length).toBe(2);
  });

  test('retrieveTopK: empty index -> []', async () => {
    const hits = await retrieveTopK('anything', [], 5);
    expect(hits).toEqual([]);
  });
});
