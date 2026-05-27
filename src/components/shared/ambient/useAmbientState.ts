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

export interface AmbientPulseConfig {
  hue: string;
  period: number;
}

export interface AmbientParticleConfig {
  count: number;
  hues: string[];
}

export interface AmbientState {
  preset: AmbientPreset;
  pulse: AmbientPulseConfig | null;
  particles: AmbientParticleConfig | null;
}

const DOMAIN_HUES: Record<string, string> = {
  goal: '#FF6B35',
  health: '#00C896',
  finance: '#F0B429',
  career: '#5B4FE8',
  social: '#FF4D8B',
  polymath: '#00B4D8',
  rest: '#A8A8C0',
  work: '#A8A8C0',
  meal: '#F0B429',
};

const ALL_DOMAIN_HUES = ['#FF6B35', '#00C896', '#F0B429', '#5B4FE8', '#FF4D8B', '#00B4D8'];

interface UseAmbientStateOptions {
  liveBlockModule?: string | null;
  allBlocksDone?: boolean;
  voiceActive?: boolean;
}

export function useAmbientState(opts: UseAmbientStateOptions = {}): AmbientState {
  const { liveBlockModule, allBlocksDone, voiceActive } = opts;
  const hour = useCurrentHour();
  const preset = presetForHour(hour);

  const pulse: AmbientPulseConfig | null =
    voiceActive ? { hue: '#A584FF', period: 2400 } :
    liveBlockModule ? { hue: DOMAIN_HUES[liveBlockModule] ?? '#A584FF', period: 4000 } :
    null;

  const particles: AmbientParticleConfig | null =
    voiceActive ? { count: 14, hues: ALL_DOMAIN_HUES } :
    allBlocksDone ? { count: 8, hues: ALL_DOMAIN_HUES } :
    null;

  return { preset, pulse, particles };
}
