import { create } from 'zustand';

/**
 * Tiny reactive signal for the sync engine (P1 Increment 3).
 *
 * The sync reducer writes pulled changes straight into local storage, out of
 * band from React. Screens read entity data on focus (`useFocusEffect`) and
 * have no idea a background pull changed it — so the UI stays stale until a
 * manual reload. This store fixes that: the engine bumps `appliedTick` whenever
 * a pull applies ≥1 change, and a focused screen that includes `appliedTick` in
 * its load effect's deps re-reads immediately.
 *
 * Intentionally NOT persisted — it's a per-session repaint signal, not state.
 */
interface SyncState {
  /** Increments each time a pull applies ≥1 remote mutation. */
  appliedTick: number;
  /** Epoch ms of the last pull that applied changes (for a status readout). */
  lastAppliedAt: number | null;
  /** Called by the engine after a pull; no-ops when nothing was applied. */
  markApplied: (count: number) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  appliedTick: 0,
  lastAppliedAt: null,
  markApplied: (count) => {
    if (count <= 0) return;
    set((s) => ({ appliedTick: s.appliedTick + 1, lastAppliedAt: Date.now() }));
  },
}));
