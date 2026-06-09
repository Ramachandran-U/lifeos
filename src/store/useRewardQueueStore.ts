import { create } from 'zustand';
import type { DomainKey } from '@/components/ui/DomainGlyph';

// Aurora reward choreography — a tiny FIFO queue of "beats" that play one at
// a time with a fixed inter-beat gap. The existing pendingBadges queue
// (useGameStore) and pendingLevelUp slot continue to render the slower beats;
// this store owns the *immediate* feedback beats (XP chip flyaway, source
// flash) that should land within ~250ms of an action.

export type RewardBeatInput =
  | { type: 'xp'; amount: number; domain?: DomainKey }
  | { type: 'streak'; label: string; count: number }
  // streak_protection_v1 — a banked freeze just rescued a streak. Rendered as
  // a shield chip so the save is *seen* (loss aversion needs visible saves).
  | { type: 'streakSave'; label: string; count: number };

export type RewardBeat = RewardBeatInput & { id: string };

interface RewardQueueState {
  active: RewardBeat | null;
  queue: RewardBeat[];
  enqueue: (beat: RewardBeatInput) => void;
  complete: () => void; // called by orchestrator when a beat finishes
}

let counter = 0;
const nextId = () => `rb_${Date.now()}_${++counter}`;

export const useRewardQueueStore = create<RewardQueueState>((set, get) => ({
  active: null,
  queue: [],
  enqueue: (beat) => {
    const withId = { ...beat, id: nextId() } as RewardBeat;
    const { active } = get();
    if (!active) {
      set({ active: withId });
    } else {
      set({ queue: [...get().queue, withId] });
    }
  },
  complete: () => {
    const [next, ...rest] = get().queue;
    set({ active: next ?? null, queue: rest });
  },
}));

// Convenience helper — call from anywhere XP is awarded so the user sees the
// flyaway chip even when the XP rail itself is off-screen.
export function enqueueXPReward(amount: number, domain?: DomainKey) {
  if (amount <= 0) return;
  useRewardQueueStore.getState().enqueue({ type: 'xp', amount, domain });
}
