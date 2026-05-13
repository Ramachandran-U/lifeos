// Legacy shim — kept so callers don't all need touching. New code should reach
// for usePreferencesStore directly (it owns theme + density + motion intensity
// + gamification visibility under a single persisted key).

import { usePreferencesStore } from './usePreferencesStore';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export function useThemeStore<T = ThemeState>(selector?: (s: ThemeState) => T): T {
  return usePreferencesStore((s) => {
    const shape: ThemeState = {
      mode: s.theme,
      setMode: s.setTheme,
      toggle: s.toggleTheme,
    };
    return (selector ? selector(shape) : (shape as unknown as T));
  });
}
