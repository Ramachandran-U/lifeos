import { create } from 'zustand';

/**
 * Reactive signal + status for the sync engine (P1 Increment 3 + status pill).
 *
 * The sync reducer writes pulled changes straight into local storage, out of
 * band from React. Screens read entity data on focus (`useFocusEffect`) and
 * have no idea a background pull changed it. This store fixes that two ways:
 *  - `appliedTick` is bumped when a pull applies ≥1 change, so a focused screen
 *    that includes it in its load effect's deps re-reads immediately.
 *  - `phase` + `lastSyncedAt` drive a visible status pill, so a disabled flag or
 *    a stale device announces itself instead of costing a debugging session.
 *  - `hydrated` flips true once the engine has completed its FIRST drain pass
 *    (successful pull, empty pull, failed pull, or a terminal skip — disabled /
 *    signed-out / no Supabase token). It means "sync has done all it's going to
 *    do to bring server state down; whatever's local now is what we've got."
 *    Screens that would otherwise manufacture fresh-id rows to fill an apparent
 *    gap (e.g. Today's roll-forward clone) wait for this so they don't race the
 *    pull and end up with the server's copy AND a local duplicate.
 *
 * Intentionally NOT persisted — per-session repaint + status, not state.
 */
export type SyncPhase = 'disabled' | 'signed_out' | 'idle' | 'pushing' | 'pulling';

interface SyncState {
  /** Increments each time a pull applies ≥1 remote mutation. */
  appliedTick: number;
  /** Epoch ms of the last pull that applied changes. */
  lastAppliedAt: number | null;
  /** Current engine activity, for the status readout. */
  phase: SyncPhase;
  /** Epoch ms of the last successful server round-trip (push or pull). */
  lastSyncedAt: number | null;
  /** True once the engine has completed its first drain pass this session. */
  hydrated: boolean;
  /** Bumped by the engine after a pull; no-ops when nothing was applied. */
  markApplied: (count: number) => void;
  /** Set the engine's current activity phase. */
  setPhase: (phase: SyncPhase) => void;
  /** Record a successful server round-trip (sets lastSyncedAt = now). */
  noteSynced: () => void;
  /** Called by the engine at the end of every drain — flips `hydrated` true. */
  markHydrated: () => void;
  /** Reset hydration (on sign-out) so the next user re-hydrates before seeding. */
  resetHydration: () => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  appliedTick: 0,
  lastAppliedAt: null,
  phase: 'idle',
  lastSyncedAt: null,
  hydrated: false,
  markApplied: (count) => {
    if (count <= 0) return;
    set((s) => ({ appliedTick: s.appliedTick + 1, lastAppliedAt: Date.now() }));
  },
  setPhase: (phase) => set({ phase }),
  noteSynced: () => set({ lastSyncedAt: Date.now() }),
  markHydrated: () => set((s) => (s.hydrated ? s : { hydrated: true })),
  resetHydration: () => set({ hydrated: false }),
}));
