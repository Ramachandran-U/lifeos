/**
 * Telemetry opt-in state. Default OFF.
 *
 * Persisted across cold starts via zustand persist (web → localStorage,
 * native → AsyncStorage). The privacy doc covers the opt-in contract.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface TelemetryState {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'lifeos_telemetry_pref_v1',
      storage,
    },
  ),
);
