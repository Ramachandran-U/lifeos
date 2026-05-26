/**
 * Persistent state for the P3-04 Behaviour Intelligence v2 adaptation cards.
 *
 * Detectors run on read; we only persist the ids the user has explicitly
 * dismissed or applied so the same pattern doesn't re-prompt on every focus.
 * Web uses localStorage; native falls back to in-memory (same trade-off as
 * polymath suggestions — the consumer accepts that mobile re-evaluates on
 * cold start, which is acceptable for this surface).
 */

import { Platform } from 'react-native';
import { create } from 'zustand';
import {
  detectBehaviourSuggestions,
  type BehaviourSuggestion,
} from '@/utils/behaviourPatterns';

const KEY = 'lifeos_behaviour_suggestions_v1';

interface Persisted {
  dismissedIds: string[];
  appliedIds: string[];
}

function loadPersisted(): Persisted {
  const empty: Persisted = { dismissedIds: [], appliedIds: [] };
  if (Platform.OS !== 'web') return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Persisted) };
  } catch {
    return empty;
  }
}
function persist(state: Persisted) {
  if (Platform.OS !== 'web') return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

interface State {
  dismissedIds: string[];
  appliedIds: string[];
  suggestions: BehaviourSuggestion[];

  refresh: () => void;
  dismiss: (id: string) => void;
  markApplied: (id: string) => void;
  clearAll: () => void;
}

const initial = loadPersisted();

export const useBehaviourSuggestionsStore = create<State>((set, get) => ({
  dismissedIds: initial.dismissedIds,
  appliedIds: initial.appliedIds,
  suggestions: [],

  refresh: () => {
    const { dismissedIds, appliedIds } = get();
    const suggestions = detectBehaviourSuggestions({ dismissedIds, appliedIds });
    set({ suggestions });
  },

  dismiss: (id) => {
    const next = { dismissedIds: [...get().dismissedIds, id], appliedIds: get().appliedIds };
    set(next);
    persist(next);
    get().refresh();
  },

  markApplied: (id) => {
    const next = { dismissedIds: get().dismissedIds, appliedIds: [...get().appliedIds, id] };
    set(next);
    persist(next);
    get().refresh();
  },

  clearAll: () => {
    set({ dismissedIds: [], appliedIds: [] });
    persist({ dismissedIds: [], appliedIds: [] });
    get().refresh();
  },
}));
