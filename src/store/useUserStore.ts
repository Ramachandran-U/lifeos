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
  /** file:// URI of the generated gamified avatar, if any. */
  avatarUri: string | null;
  /**
   * Selected voice companion persona id (see src/ai/voicePersonas.ts). null ⇒
   * the default persona. Mirrored here (not just read via getUser) so the
   * companion reconnects reactively when the user changes it in Settings.
   */
  preferredVoiceId: string | null;
  setUser: (userId: string, name: string, email: string, onboardingStage: number) => void;
  setOnboardingStage: (stage: number) => void;
  setPrimaryDomains: (domains: DomainId[]) => void;
  markModuleActivated: (module: DomainId) => void;
  setAvatarUri: (uri: string | null) => void;
  /** Update the reactive mirror only — persistence is the caller's job (updateUser). */
  setPreferredVoiceId: (id: string | null) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  name: '',
  email: '',
  onboardingStage: 0,
  primaryDomains: [],
  activatedModules: [],
  avatarUri: null,
  preferredVoiceId: null,
  setUser: (userId, name, email, onboardingStage) => set({ userId, name, email, onboardingStage }),
  setOnboardingStage: (onboardingStage) => set({ onboardingStage }),
  setPrimaryDomains: (primaryDomains) => set({ primaryDomains }),
  markModuleActivated: (module) =>
    set((s) =>
      s.activatedModules.includes(module)
        ? s
        : { activatedModules: [...s.activatedModules, module] },
    ),
  setAvatarUri: (avatarUri) => set({ avatarUri }),
  setPreferredVoiceId: (preferredVoiceId) => set({ preferredVoiceId }),
  reset: () =>
    set({ userId: null, name: '', email: '', onboardingStage: 0, primaryDomains: [], activatedModules: [], avatarUri: null, preferredVoiceId: null }),
}));
