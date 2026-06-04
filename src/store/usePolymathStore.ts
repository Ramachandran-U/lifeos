import { Platform } from 'react-native';
import { create } from 'zustand';
import {
  createInterest,
  getInterestsByUser,
  updateInterest,
  softDeleteInterest,
  logExploration,
  getExplorationForUser,
  type Interest,
  type ExplorationLog,
  type CreateInterestInput,
  type CreateExplorationInput,
} from '@/db/queries/interests';
import { weeklyMinutesByInterest } from '@/utils/polymath';
import type { CrossDisciplineLink, SuggestedArea } from '@/ai/types';

const SUGGESTIONS_KEY = 'lifeos_polymath_suggestions_v1';
const CROSS_KEY = 'lifeos_polymath_cross_v1';
const SUGGESTIONS_TTL_MS = 24 * 60 * 60 * 1000;

interface SuggestionsCache {
  areas: SuggestedArea[];
  generatedAt: number;
  basedOnInterestIds: string[];
}

interface CrossCache {
  link: CrossDisciplineLink;
  pairKey: string;
  generatedAt: number;
}

function loadSuggestions(): SuggestionsCache | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(SUGGESTIONS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SuggestionsCache;
  } catch {
    return null;
  }
}
function persistSuggestions(s: SuggestionsCache | null) {
  if (Platform.OS !== 'web') return;
  try {
    if (s === null) localStorage.removeItem(SUGGESTIONS_KEY);
    else localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
function loadCross(): CrossCache | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(CROSS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrossCache;
  } catch {
    return null;
  }
}
function persistCross(c: CrossCache | null) {
  if (Platform.OS !== 'web') return;
  try {
    if (c === null) localStorage.removeItem(CROSS_KEY);
    else localStorage.setItem(CROSS_KEY, JSON.stringify(c));
  } catch { /* ignore */ }
}

interface PolymathState {
  interests: Interest[];
  log: ExplorationLog[];
  suggestions: SuggestionsCache | null;
  cross: CrossCache | null;

  load: (userId: string) => void;
  addInterest: (data: CreateInterestInput) => string;
  /** Create several interests, then reload once (avoids N reloads on bulk import). */
  addInterests: (items: CreateInterestInput[]) => void;
  editInterest: (id: string, data: Partial<Interest>, userId: string) => void;
  removeInterest: (id: string, userId: string) => void;
  addExploration: (data: CreateExplorationInput, userId: string) => string;
  weeklyMinutes: () => Record<string, number>;
  setSuggestions: (areas: SuggestedArea[], basedOnInterestIds: string[]) => void;
  clearSuggestions: () => void;
  setCross: (link: CrossDisciplineLink, pairKey: string) => void;
  clearCross: () => void;
}

export const usePolymathStore = create<PolymathState>((set, get) => ({
  interests: [],
  log: [],
  suggestions: loadSuggestions(),
  cross: loadCross(),

  load: (userId) => {
    const interests = getInterestsByUser(userId);
    const log = getExplorationForUser(userId);
    set({ interests, log });
  },

  addInterest: (data) => {
    const id = createInterest(data);
    get().load(data.userId);
    return id;
  },

  addInterests: (items) => {
    if (items.length === 0) return;
    for (const it of items) createInterest(it);
    get().load(items[0]!.userId);
  },

  editInterest: (id, data, userId) => {
    updateInterest(id, data);
    get().load(userId);
  },

  removeInterest: (id, userId) => {
    softDeleteInterest(id);
    get().load(userId);
  },

  addExploration: (data, userId) => {
    const id = logExploration(data);
    const totals = weeklyMinutesByInterest([...get().log, { ...data, id: '', createdAt: '' } as ExplorationLog]);
    const actual = totals[data.interestId] ?? 0;
    updateInterest(data.interestId, { weeklyMinutesActual: actual });
    get().load(userId);
    return id;
  },

  weeklyMinutes: () => weeklyMinutesByInterest(get().log),

  setSuggestions: (areas, basedOnInterestIds) => {
    const next: SuggestionsCache = {
      areas,
      generatedAt: Date.now(),
      basedOnInterestIds,
    };
    set({ suggestions: next });
    persistSuggestions(next);
  },

  clearSuggestions: () => {
    set({ suggestions: null });
    persistSuggestions(null);
  },

  setCross: (link, pairKey) => {
    const next: CrossCache = { link, pairKey, generatedAt: Date.now() };
    set({ cross: next });
    persistCross(next);
  },

  clearCross: () => {
    set({ cross: null });
    persistCross(null);
  },
}));

// Helpers exported for screen logic — kept here to keep TTL knob in one place.
export function suggestionsAreStale(s: SuggestionsCache | null, currentInterestIds: string[]): boolean {
  if (!s) return true;
  if (Date.now() - s.generatedAt > SUGGESTIONS_TTL_MS) return true;
  const a = [...s.basedOnInterestIds].sort().join(',');
  const b = [...currentInterestIds].sort().join(',');
  return a !== b;
}

export function crossIsStale(c: CrossCache | null, pairKey: string): boolean {
  if (!c) return true;
  if (Date.now() - c.generatedAt > SUGGESTIONS_TTL_MS) return true;
  return c.pairKey !== pairKey;
}
