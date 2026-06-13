import { create } from 'zustand';
import type { ProposedAction } from '@/ai/agent/actionQueue';

/**
 * UI state for the persistent voice companion.
 *
 * The companion is mounted ONCE above the tab navigator (see app/(tabs)/_layout.tsx)
 * so the live audio session survives tab navigation — that's what lets the voice
 * agent open a tab and keep the conversation going. This store is the decoupled
 * open/minimize switch any screen can flip (e.g. the Today mic button) plus the
 * queue of writes the agent has PROPOSED but the user hasn't confirmed yet.
 *
 * Not persisted: a voice conversation never spans an app restart.
 */
interface VoiceStoreState {
  /** Is the companion active (connected/connecting)? */
  open: boolean;
  /** Collapsed to a pill (still live) vs. the full expanded panel. */
  minimized: boolean;
  /** Writes the agent proposed this session, awaiting the user's confirm. */
  pendingActions: ProposedAction[];

  openVoice: () => void;
  minimize: () => void;
  expand: () => void;
  close: () => void;

  addPendingAction: (action: ProposedAction) => void;
  removePendingAction: (index: number) => void;
  clearPending: () => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  open: false,
  minimized: false,
  pendingActions: [],

  // Opening always lands on the expanded panel and clears stale proposals from a
  // previous conversation.
  openVoice: () => set({ open: true, minimized: false, pendingActions: [] }),
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
  close: () => set({ open: false, minimized: false, pendingActions: [] }),

  addPendingAction: (action) =>
    set((s) => ({ pendingActions: [...s.pendingActions, action] })),
  removePendingAction: (index) =>
    set((s) => ({ pendingActions: s.pendingActions.filter((_, i) => i !== index) })),
  clearPending: () => set({ pendingActions: [] }),
}));
