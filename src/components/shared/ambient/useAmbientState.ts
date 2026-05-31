import { useEffect, useState } from 'react';
import { type AmbientPreset, presetForHour } from './presets';

function useCurrentHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

export interface AmbientParticleConfig {
  count: number;
  hues: string[];
}

export interface AmbientState {
  preset: AmbientPreset;
  particles: AmbientParticleConfig | null;
}

const ALL_DOMAIN_HUES = ['#FF6B35', '#00C896', '#F0B429', '#5B4FE8', '#FF4D8B', '#00B4D8'];

interface UseAmbientStateOptions {
  allBlocksDone?: boolean;
  voiceActive?: boolean;
}

export function useAmbientState(opts: UseAmbientStateOptions = {}): AmbientState {
  const { allBlocksDone, voiceActive } = opts;
  const hour = useCurrentHour();
  const preset = presetForHour(hour);

  const particles: AmbientParticleConfig | null =
    voiceActive ? { count: 14, hues: ALL_DOMAIN_HUES } :
    allBlocksDone ? { count: 8, hues: ALL_DOMAIN_HUES } :
    null;

  return { preset, particles };
}
