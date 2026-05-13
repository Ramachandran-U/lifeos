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

interface PolymathState {
  interests: Interest[];
  log: ExplorationLog[];
  load: (userId: string) => void;
  addInterest: (data: CreateInterestInput) => string;
  editInterest: (id: string, data: Partial<Interest>, userId: string) => void;
  removeInterest: (id: string, userId: string) => void;
  addExploration: (data: CreateExplorationInput, userId: string) => string;
  weeklyMinutes: () => Record<string, number>;
}

export const usePolymathStore = create<PolymathState>((set, get) => ({
  interests: [],
  log: [],

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
    // Keep weeklyMinutesActual in sync for quick reads
    const totals = weeklyMinutesByInterest([...get().log, { ...data, id: '', createdAt: '' } as ExplorationLog]);
    const actual = totals[data.interestId] ?? 0;
    updateInterest(data.interestId, { weeklyMinutesActual: actual });
    get().load(userId);
    return id;
  },

  weeklyMinutes: () => weeklyMinutesByInterest(get().log),
}));
