/**
 * Guards defect D12: a failed motivation fetch must NOT poison the cache key.
 * The old store only cleared the inflight slot on success, so one rejected call
 * was replayed forever — motivation stayed broken for that key until reload.
 */
jest.mock('@/ai/functions', () => ({ generateMotivation: jest.fn() }));

import { useMotivationStore } from '@/store/useMotivationStore';
import { generateMotivation } from '@/ai/functions';
import type { Motivation, MotivationInput } from '@/ai/types';

const genMock = generateMotivation as jest.MockedFunction<typeof generateMotivation>;

const input: MotivationInput = { module: 'goals', context: 'finish the report' };
const motivation: Motivation = { quote: 'Keep going.', microTip: 'Start with one line.' };

beforeEach(() => {
  genMock.mockReset();
  useMotivationStore.getState().clear();
});

describe('useMotivationStore.getOrFetch', () => {
  it('caches on success and does not refetch the same key', async () => {
    genMock.mockResolvedValue(motivation);
    const a = await useMotivationStore.getState().getOrFetch(input);
    const b = await useMotivationStore.getState().getOrFetch(input);
    expect(a).toEqual(motivation);
    expect(b).toEqual(motivation);
    expect(genMock).toHaveBeenCalledTimes(1);
  });

  it('clears the inflight slot on failure so a later call RETRIES (D12)', async () => {
    genMock.mockRejectedValueOnce(new Error('429 rate limited'));
    await expect(useMotivationStore.getState().getOrFetch(input)).rejects.toThrow('429');

    // The poisoned-cache bug would replay the rejection here; instead it retries.
    genMock.mockResolvedValueOnce(motivation);
    const result = await useMotivationStore.getState().getOrFetch(input);
    expect(result).toEqual(motivation);
    expect(genMock).toHaveBeenCalledTimes(2);
  });
});
