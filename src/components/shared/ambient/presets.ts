// Time-of-day ambient presets. Each preset defines the bloom orbs (colors,
// positions, opacities) and mesh parameters for that time window. The
// presets are consumed by useAmbientState which selects one based on the
// current hour.
//
// Design reference: docs/aurora-refined-v2 AMBIENT-PLAN.md

export interface AmbientBloom {
  color: string;
  size: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  opacity: number;
}

export interface AmbientPreset {
  id: 'morning' | 'midday' | 'evening' | 'night';
  blooms: { dark: AmbientBloom[]; light: AmbientBloom[] };
  meshPeriod: number;
  orbPeriod: number;
  webGradient: { dark: string; light: string };
}

// Morning (6-10 AM): cool violet at top, faint teal at foot.
const MORNING: AmbientPreset = {
  id: 'morning',
  blooms: {
    dark: [
      { color: '#A584FF', size: 520, top: -180, left: -120, opacity: 0.32 },
      { color: '#7EE0B8', size: 420, top: 20, right: -160, opacity: 0.18 },
      { color: '#7FB8FF', size: 380, bottom: -200, left: '25%', opacity: 0.12 },
    ],
    light: [
      { color: '#A584FF', size: 520, top: -180, left: -120, opacity: 0.12 },
      { color: '#7EE0B8', size: 420, top: 20, right: -160, opacity: 0.07 },
      { color: '#7FB8FF', size: 380, bottom: -200, left: '25%', opacity: 0.05 },
    ],
  },
  meshPeriod: 22000,
  orbPeriod: 14000,
  webGradient: {
    dark: `
      radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.32), transparent 60%),
      radial-gradient(50% 35% at 85% 15%, rgba(126,224,184,0.18), transparent 60%),
      radial-gradient(40% 30% at 50% 100%, rgba(127,184,255,0.12), transparent 60%),
      linear-gradient(180deg, #0A0612, #0D0818 60%, #0A0612)
    `,
    light: `
      radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.16), transparent 60%),
      radial-gradient(50% 35% at 85% 15%, rgba(126,224,184,0.10), transparent 60%),
      radial-gradient(40% 30% at 50% 100%, rgba(127,184,255,0.06), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFFFFF 60%, #F7F4FC)
    `,
  },
};

// Midday (10 AM - 4 PM): warmer, gold node enters, teal retreats.
const MIDDAY: AmbientPreset = {
  id: 'midday',
  blooms: {
    dark: [
      { color: '#A584FF', size: 480, top: -160, left: -100, opacity: 0.28 },
      { color: '#F0B429', size: 360, top: 80, right: -80, opacity: 0.14 },
      { color: '#7EE0B8', size: 320, bottom: -220, left: '30%', opacity: 0.08 },
    ],
    light: [
      { color: '#A584FF', size: 480, top: -160, left: -100, opacity: 0.10 },
      { color: '#F0B429', size: 360, top: 80, right: -80, opacity: 0.06 },
      { color: '#7EE0B8', size: 320, bottom: -220, left: '30%', opacity: 0.04 },
    ],
  },
  meshPeriod: 20000,
  orbPeriod: 16000,
  webGradient: {
    dark: `
      radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.28), transparent 60%),
      radial-gradient(45% 35% at 80% 20%, rgba(240,180,41,0.14), transparent 60%),
      radial-gradient(35% 25% at 55% 100%, rgba(126,224,184,0.08), transparent 60%),
      linear-gradient(180deg, #0A0612, #100A18 60%, #0A0612)
    `,
    light: `
      radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.14), transparent 60%),
      radial-gradient(45% 35% at 80% 20%, rgba(240,180,41,0.08), transparent 60%),
      radial-gradient(35% 25% at 55% 100%, rgba(126,224,184,0.05), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFFDF5 60%, #F7F4FC)
    `,
  },
};

// Evening (4-9 PM): magenta + amber enter, orbs sink lower.
const EVENING: AmbientPreset = {
  id: 'evening',
  blooms: {
    dark: [
      { color: '#A584FF', size: 440, top: -140, left: -100, opacity: 0.22 },
      { color: '#FF8C3C', size: 400, top: 120, right: -120, opacity: 0.15 },
      { color: '#FF4D8B', size: 380, bottom: -160, left: '15%', opacity: 0.14 },
    ],
    light: [
      { color: '#A584FF', size: 440, top: -140, left: -100, opacity: 0.09 },
      { color: '#FF8C3C', size: 400, top: 120, right: -120, opacity: 0.06 },
      { color: '#FF4D8B', size: 380, bottom: -160, left: '15%', opacity: 0.06 },
    ],
  },
  meshPeriod: 24000,
  orbPeriod: 18000,
  webGradient: {
    dark: `
      radial-gradient(55% 35% at 18% 0%, rgba(165,132,255,0.22), transparent 60%),
      radial-gradient(50% 40% at 85% 30%, rgba(255,140,60,0.15), transparent 60%),
      radial-gradient(45% 30% at 40% 100%, rgba(255,77,139,0.14), transparent 60%),
      linear-gradient(180deg, #0A0612, #140A18 60%, #0A0612)
    `,
    light: `
      radial-gradient(55% 35% at 18% 0%, rgba(165,132,255,0.12), transparent 60%),
      radial-gradient(50% 40% at 85% 30%, rgba(255,140,60,0.08), transparent 60%),
      radial-gradient(45% 30% at 40% 100%, rgba(255,77,139,0.07), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFF5F8 60%, #F7F4FC)
    `,
  },
};

// Night (9 PM - 6 AM): one moonlight point, deep violet rest. Almost still.
const NIGHT: AmbientPreset = {
  id: 'night',
  blooms: {
    dark: [
      { color: '#A584FF', size: 400, top: -200, left: -140, opacity: 0.18 },
      { color: '#FFFFFF', size: 280, top: -60, right: -40, opacity: 0.06 },
    ],
    light: [
      { color: '#A584FF', size: 400, top: -200, left: -140, opacity: 0.07 },
      { color: '#C5B3FF', size: 280, top: -60, right: -40, opacity: 0.04 },
    ],
  },
  meshPeriod: 30000,
  orbPeriod: 26000,
  webGradient: {
    dark: `
      radial-gradient(50% 35% at 15% 0%, rgba(165,132,255,0.18), transparent 60%),
      radial-gradient(30% 25% at 80% 10%, rgba(255,255,255,0.06), transparent 60%),
      linear-gradient(180deg, #080510, #0A0612 60%, #080510)
    `,
    light: `
      radial-gradient(50% 35% at 15% 0%, rgba(165,132,255,0.08), transparent 60%),
      radial-gradient(30% 25% at 80% 10%, rgba(197,179,255,0.05), transparent 60%),
      linear-gradient(180deg, #F4F0FA, #F7F4FC 60%, #F4F0FA)
    `,
  },
};

export const AMBIENT_PRESETS = { morning: MORNING, midday: MIDDAY, evening: EVENING, night: NIGHT } as const;
export type AmbientPresetId = keyof typeof AMBIENT_PRESETS;

export function presetForHour(hour: number): AmbientPreset {
  if (hour >= 6 && hour < 10) return MORNING;
  if (hour >= 10 && hour < 16) return MIDDAY;
  if (hour >= 16 && hour < 21) return EVENING;
  return NIGHT;
}
