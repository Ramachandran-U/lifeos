import { colors } from '@/theme/colors';

// Slimmed in the Ink + Signal recommit (Cluster 3 §B): the time-of-day preset
// machinery died with the wash; only the EARNED particle trigger survives
// (day-complete, voice — "Celebrate moments, rest quiet").

export interface AmbientParticleConfig {
  count: number;
  hues: string[];
}

export interface AmbientState {
  particles: AmbientParticleConfig | null;
}

// Domain hues are mode-independent, so the static export is correct here.
const ALL_DOMAIN_HUES = [
  colors.goal,
  colors.health,
  colors.finance,
  colors.career,
  colors.social,
  colors.polymath,
];

interface UseAmbientStateOptions {
  allBlocksDone?: boolean;
  voiceActive?: boolean;
}

export function useAmbientState(opts: UseAmbientStateOptions = {}): AmbientState {
  const { allBlocksDone, voiceActive } = opts;

  const particles: AmbientParticleConfig | null =
    voiceActive ? { count: 14, hues: ALL_DOMAIN_HUES } :
    allBlocksDone ? { count: 8, hues: ALL_DOMAIN_HUES } :
    null;

  return { particles };
}
