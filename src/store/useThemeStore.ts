import { create } from 'zustand';
import { Platform } from 'react-native';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

function loadPersistedMode(): ThemeMode {
  if (Platform.OS === 'web') {
    try {
      const stored = localStorage.getItem('lifeos_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
  }
  return 'dark';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: loadPersistedMode(),
  setMode: (mode) => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem('lifeos_theme', mode); } catch { /* ignore */ }
    }
    set({ mode });
  },
  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },
}));
