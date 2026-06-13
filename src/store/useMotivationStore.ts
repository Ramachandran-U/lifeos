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
      try {
        const result = await generateMotivation(input);
        set((s) => ({ cache: { ...s.cache, [key]: result } }));
        return result;
      } finally {
        // Always release the inflight slot — on BOTH success and failure. The old
        // code only cleared it on success, so a single failed AI call (network
        // blip / 429) left the rejected promise cached and replayed forever,
        // permanently breaking motivation for that key until reload.
        set((s) => ({ inflight: { ...s.inflight, [key]: undefined } }));
      }
    })();

    set((s) => ({ inflight: { ...s.inflight, [key]: promise } }));
    return promise;
  },
  clear: () => set({ cache: {}, inflight: {} }),
}));
