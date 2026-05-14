import { ViewStyle, Platform } from 'react-native';
import { useThemeStore } from '@/store/useThemeStore';

// Aurora elevation — 4 levels. Dark mode uses translucency + glow, light mode
// uses soft cast shadows. Consumers should call `useElevation(level)` and spread
// the returned style; never write a raw boxShadow / shadowColor.

export type Elevation = 'z0' | 'z1' | 'z2' | 'z3';

interface ElevationStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  // RN shadow props (iOS); on Android `elevation` is set; on web boxShadow.
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  // Web only — Aurora glow lives here. RN ignores it.
  boxShadow?: string;
}

const darkLevels: Record<Elevation, ElevationStyle> = {
  z0: {},
  z1: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  z2: {
    backgroundColor: 'rgba(26,16,40,0.92)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
  },
  z3: {
    backgroundColor: 'rgba(26,16,40,0.94)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 18,
    boxShadow: '0 16px 40px rgba(8,4,16,0.5)',
  },
};

const lightLevels: Record<Elevation, ElevationStyle> = {
  z0: {},
  z1: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(20,8,40,0.10)',
    borderWidth: 1,
    shadowColor: '#140828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    boxShadow: '0 1px 4px rgba(20,8,40,0.05)',
  },
  z2: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(20,8,40,0.10)',
    borderWidth: 1,
    shadowColor: '#140828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    boxShadow: '0 8px 24px rgba(20,8,40,0.12)',
  },
  z3: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(20,8,40,0.10)',
    borderWidth: 1,
    shadowColor: '#140828',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 40,
    elevation: 16,
    boxShadow: '0 16px 40px rgba(20,8,40,0.10)',
  },
};

export function getElevation(level: Elevation, mode: 'dark' | 'light'): ViewStyle {
  const src = mode === 'light' ? lightLevels[level] : darkLevels[level];
  // RN doesn't understand boxShadow; web does. Strip for native.
  if (Platform.OS === 'web') return src as ViewStyle;
  const { boxShadow: _omit, ...rest } = src;
  return rest as ViewStyle;
}

export function useElevation(level: Elevation): ViewStyle {
  const mode = useThemeStore((s) => s.mode);
  return getElevation(level, mode);
}
