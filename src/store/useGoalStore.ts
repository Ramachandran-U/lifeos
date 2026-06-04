import { create } from 'zustand';
import {
  getGoalsByUser,
  createGoal,
  updateGoalStatus,
  getChildGoals,
  softDeleteGoal,
  restoreGoal,
  snoozeGoal,
  resumeGoal,
  reactivateDueGoals,
} from '@/db/queries/goals';

interface GoalState {
  goals: ReturnType<typeof getGoalsByUser>;
  loadGoals: (userId: string) => void;
  addGoal: (data: Parameters<typeof createGoal>[0]) => string;
  completeGoal: (id: string) => void;
  /** Soft-delete a goal (recoverable via restoreGoal). */
  removeGoal: (id: string, userId: string) => void;
  /** Undo a soft-delete. */
  restoreGoal: (id: string, userId: string) => void;
  /** Postpone until `untilDate` (YYYY-MM-DD): status → paused + snoozeUntil. */
  snoozeGoal: (id: string, untilDate: string, userId: string) => void;
  /** Resume a postponed goal now. */
  resumeGoal: (id: string, userId: string) => void;
  /** Auto-resume goals whose snooze date has passed; returns reactivated titles. */
  reactivateDue: (userId: string, today: string) => { id: string; title: string }[];
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  loadGoals: (userId) => {
    const goals = getGoalsByUser(userId);
    set({ goals });
  },
  addGoal: (data) => {
    const id = createGoal(data);
    get().loadGoals(data.userId);
    return id;
  },
  completeGoal: (id) => {
    updateGoalStatus(id, 'completed');
  },
  removeGoal: (id, userId) => {
    softDeleteGoal(id);
    get().loadGoals(userId);
  },
  restoreGoal: (id, userId) => {
    restoreGoal(id);
    get().loadGoals(userId);
  },
  snoozeGoal: (id, untilDate, userId) => {
    snoozeGoal(id, untilDate);
    get().loadGoals(userId);
  },
  resumeGoal: (id, userId) => {
    resumeGoal(id);
    get().loadGoals(userId);
  },
  reactivateDue: (userId, today) => {
    const reactivated = reactivateDueGoals(userId, today);
    if (reactivated.length > 0) get().loadGoals(userId);
    return reactivated;
  },
}));
