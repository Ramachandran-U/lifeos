import { create } from 'zustand';

interface AmbientEvent {
  type: 'sweep' | 'pulse';
  hue: string;
  ts: number;
}

interface AmbientEventState {
  sweep: AmbientEvent | null;
  pulse: AmbientEvent | null;
  fireSweep: (hue: string) => void;
  firePulse: (hue: string) => void;
  clearSweep: () => void;
  clearPulse: () => void;
}

export const useAmbientEventStore = create<AmbientEventState>((set) => ({
  sweep: null,
  pulse: null,
  fireSweep: (hue) => set({ sweep: { type: 'sweep', hue, ts: Date.now() } }),
  firePulse: (hue) => set({ pulse: { type: 'pulse', hue, ts: Date.now() } }),
  clearSweep: () => set({ sweep: null }),
  clearPulse: () => set({ pulse: null }),
}));
