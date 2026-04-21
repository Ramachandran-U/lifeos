import { create } from 'zustand';

export const ONBOARDING_COMPLETE = 100;

export type DomainId = 'goals' | 'health' | 'finance' | 'career' | 'social' | 'polymath';

interface UserState {
  userId: string | null;
  name: string;
  email: string;
  onboardingStage: number;
  primaryDomains: DomainId[];
  activatedModules: DomainId[];
  setUser: (userId: string, name: string, email: string, onboardingStage: number) => void;
  setOnboardingStage: (stage: number) => void;
  setPrimaryDomains: (domains: DomainId[]) => void;
  markModuleActivated: (module: DomainId) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  name: '',
  email: '',
  onboardingStage: 0,
  primaryDomains: [],
  activatedModules: [],
  setUser: (userId, name, email, onboardingStage) => set({ userId, name, email, onboardingStage }),
  setOnboardingStage: (onboardingStage) => set({ onboardingStage }),
  setPrimaryDomains: (primaryDomains) => set({ primaryDomains }),
  markModuleActivated: (module) =>
    set((s) =>
      s.activatedModules.includes(module)
        ? s
        : { activatedModules: [...s.activatedModules, module] },
    ),
  reset: () =>
    set({ userId: null, name: '', email: '', onboardingStage: 0, primaryDomains: [], activatedModules: [] }),
}));
