import { create } from 'zustand';
import { generateMotivation } from '@/ai/functions';
import type { Motivation, MotivationInput } from '@/ai/types';

type CacheKey = string;

interface MotivationState {
  cache: Record<CacheKey, Motivation>;
  inflight: Record<CacheKey, Promise<Motivation> | undefined>;
  getOrFetch: (input: MotivationInput) => Promise<Motivation>;
  clear: () => void;
}

const keyFor = (input: MotivationInput): CacheKey =>
  `${input.module}::${input.context.trim().toLowerCase()}`;

export const useMotivationStore = create<MotivationState>((set, get) => ({
  cache: {},
  inflight: {},
  getOrFetch: async (input) => {
    const key = keyFor(input);
    const cached = get().cache[key];
    if (cached) return cached;
    const pending = get().inflight[key];
    if (pending) return pending;

    const promise = (async () => {
      const result = await generateMotivation(input);
      set((s) => ({
        cache: { ...s.cache, [key]: result },
        inflight: { ...s.inflight, [key]: undefined },
      }));
      return result;
    })();

    set((s) => ({ inflight: { ...s.inflight, [key]: promise } }));
    return promise;
  },
  clear: () => set({ cache: {}, inflight: {} }),
}));
