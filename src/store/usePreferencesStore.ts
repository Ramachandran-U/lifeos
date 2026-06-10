import { create } from 'zustand';
import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light';
export type DensityMode = 'compact' | 'cozy' | 'spacious';
export type MotionIntensity = 'off' | 'subtle' | 'normal' | 'bold';
export type GamificationVisibility = 'full' | 'minimal' | 'off';

export interface PreferencesState {
  theme: ThemeMode;
  density: DensityMode;
  motionIntensity: MotionIntensity;
  gamification: GamificationVisibility;
  narrationEnabled: boolean;
  /** M5 (soundEffects flag): celebration micro-sounds. Default OFF — opt-in. */
  soundEnabled: boolean;

  setTheme: (m: ThemeMode) => void;
  toggleTheme: () => void;
  setDensity: (d: DensityMode) => void;
  setMotionIntensity: (m: MotionIntensity) => void;
  setGamification: (g: GamificationVisibility) => void;
  setNarrationEnabled: (v: boolean) => void;
  toggleNarration: () => void;
  setSoundEnabled: (v: boolean) => void;
}

const STORAGE_KEY = 'lifeos_preferences_v1';
const LEGACY_THEME_KEY = 'lifeos_theme';

interface PersistedShape {
  theme?: ThemeMode;
  density?: DensityMode;
  motionIntensity?: MotionIntensity;
  gamification?: GamificationVisibility;
  narrationEnabled?: boolean;
  soundEnabled?: boolean;
}

function loadPersisted(): PersistedShape {
  if (Platform.OS !== 'web') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedShape;
    // Legacy migration — useThemeStore previously stored only the theme key.
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return { theme: legacy };
  } catch {
    /* ignore */
  }
  return {};
}

function persist(state: PersistedShape) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const initial = loadPersisted();

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  const snapshot = () => {
    const { theme, density, motionIntensity, gamification, narrationEnabled, soundEnabled } = get();
    return { theme, density, motionIntensity, gamification, narrationEnabled, soundEnabled };
  };

  return {
    theme: initial.theme ?? 'dark',
    density: initial.density ?? 'cozy',
    motionIntensity: initial.motionIntensity ?? 'normal',
    gamification: initial.gamification ?? 'full',
    narrationEnabled: initial.narrationEnabled ?? true,
    soundEnabled: initial.soundEnabled ?? false,

    setTheme: (theme) => {
      set({ theme });
      persist(snapshot());
    },
    toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    setDensity: (density) => {
      set({ density });
      persist(snapshot());
    },
    setMotionIntensity: (motionIntensity) => {
      set({ motionIntensity });
      persist(snapshot());
    },
    setGamification: (gamification) => {
      set({ gamification });
      persist(snapshot());
    },
    setNarrationEnabled: (narrationEnabled) => {
      set({ narrationEnabled });
      persist(snapshot());
    },
    toggleNarration: () => get().setNarrationEnabled(!get().narrationEnabled),
    setSoundEnabled: (soundEnabled) => {
      set({ soundEnabled });
      persist(snapshot());
    },
  };
});
