import { create } from 'zustand';

export const ONBOARDING_COMPLETE = 100;

interface UserState {
  userId: string | null;
  name: string;
  onboardingStage: number;
  setUser: (userId: string, name: string, onboardingStage: number) => void;
  setOnboardingStage: (stage: number) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  name: '',
  onboardingStage: 0,
  setUser: (userId, name, onboardingStage) => set({ userId, name, onboardingStage }),
  setOnboardingStage: (onboardingStage) => set({ onboardingStage }),
  reset: () => set({ userId: null, name: '', onboardingStage: 0 }),
}));
