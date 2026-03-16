import { create } from 'zustand';
import { getGoalsByUser, createGoal, updateGoalStatus, getChildGoals } from '@/db/queries/goals';

interface GoalState {
  goals: ReturnType<typeof getGoalsByUser>;
  loadGoals: (userId: string) => void;
  addGoal: (data: Parameters<typeof createGoal>[0]) => string;
  completeGoal: (id: string) => void;
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
}));
