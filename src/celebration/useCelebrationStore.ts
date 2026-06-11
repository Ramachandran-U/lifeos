import { create } from 'zustand';
import { isEnabled } from '@/config/flags';
import { playSfx, type SfxName } from '@/sound/soundEngine';
import { classifyTier } from './classify';
import type { CelebrationEvent, CelebrationInput, CelebrationTier } from './types';

/**
 * Celebration queue (M2). Mirrors useRewardQueueStore's tiny FIFO: one beat
 * plays at a time; the host calls complete() when its renderer finishes.
 *
 * celebrate() is THE public entry point: it classifies (single choke point),
 * drops micro beats (the chip's own burst is the whole celebration), and
 * no-ops entirely while the celebrationEngine flag is off — so call sites
 * never need their own gate and the queue can't grow unattended.
 */

const MAX_QUEUED = 3; // peaks are rare; a backlog longer than this reads as noise

interface CelebrationState {
  active: CelebrationEvent | null;
  queue: CelebrationEvent[];
  celebrate: (input: CelebrationInput) => void;
  complete: () => void;
}

let counter = 0;
const nextId = () => `cb_${++counter}`;

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  active: null,
  queue: [],

  celebrate: (input) => {
    if (!isEnabled('celebrationEngine')) return;
    const tier = classifyTier(input);
    if (tier === 'micro') return;
    // M5: sound rides the same classification (double opt-in inside playSfx —
    // soundEffects flag AND the user's soundEnabled preference, default off).
    const sfx = sfxFor(input, tier);
    if (sfx) playSfx(sfx);
    const event: CelebrationEvent = { ...input, tier, id: nextId() };
    const { active, queue } = get();
    if (!active) {
      set({ active: event });
    } else if (queue.length < MAX_QUEUED) {
      set({ queue: [...queue, event] });
    }
    // Queue full → drop. Better to lose a burst than to rain confetti for 10s.
  },

  complete: () => {
    const [next, ...rest] = get().queue;
    set({ active: next ?? null, queue: rest });
  },
}));

/** tier×kind → micro-sound. Standard beats share the chime; epic beats split
 *  by character (identity fanfare vs the day-complete sweep). */
function sfxFor(input: CelebrationInput, tier: CelebrationTier): SfxName | null {
  if (tier === 'standard') return 'chime';
  if (tier === 'epic') {
    return input.kind === 'levelUp' || input.kind === 'milestone' || input.kind === 'firstWin' ? 'fanfare' : 'sweep';
  }
  return null;
}

/** Convenience for non-React call sites (stores, effects). */
export function celebrate(input: CelebrationInput): void {
  useCelebrationStore.getState().celebrate(input);
}
