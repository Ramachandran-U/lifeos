import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type Variant = 'single_shot' | 'agent';

/**
 * Per-task variant overrides for the kill/keep loop (#3-act).
 *
 * LOCKED DECISION: the system NEVER silently flips a variant. It surfaces the
 * outcome verdict (see variantPolicy.getTaskVerdict) and the user decides; this
 * store holds that human choice. No entry = use the task's default (agent).
 */
interface VariantState {
  overrides: Record<string, Variant>;
  setOverride: (task: string, variant: Variant) => void;
  clearOverride: (task: string) => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useVariantStore = create<VariantState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (task, variant) =>
        set((s) => ({ overrides: { ...s.overrides, [task]: variant } })),
      clearOverride: (task) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[task];
          return { overrides: next };
        }),
    }),
    {
      name: 'lifeos_variant_overrides_v1',
      storage,
      partialize: (state) => ({ overrides: state.overrides }),
    },
  ),
);
