// Time-of-day ambient presets — tuned for VISIBLE atmospheric presence.
//
// Previous pass was too conservative (8-12% opacity = invisible).
// These values are designed so you can FEEL the time of day when you
// glance at the screen, while still keeping content fully readable.

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

// Morning (6-10 AM): cool violet at top, teal accent, fresh and calm.
const MORNING: AmbientPreset = {
  id: 'morning',
  blooms: {
    dark: [
      { color: '#A584FF', size: 580, top: -160, left: -100, opacity: 0.45 },
      { color: '#7EE0B8', size: 480, top: 40, right: -120, opacity: 0.28 },
      { color: '#7FB8FF', size: 420, bottom: -180, left: '20%', opacity: 0.20 },
    ],
    light: [
      { color: '#A584FF', size: 580, top: -160, left: -100, opacity: 0.18 },
      { color: '#7EE0B8', size: 480, top: 40, right: -120, opacity: 0.12 },
      { color: '#7FB8FF', size: 420, bottom: -180, left: '20%', opacity: 0.08 },
    ],
  },
  meshPeriod: 22000,
  orbPeriod: 14000,
  webGradient: {
    dark: `
      radial-gradient(65% 45% at 20% 0%, rgba(165,132,255,0.45), transparent 65%),
      radial-gradient(55% 40% at 85% 15%, rgba(126,224,184,0.28), transparent 60%),
      radial-gradient(45% 35% at 45% 100%, rgba(127,184,255,0.20), transparent 60%),
      linear-gradient(180deg, #0A0612, #0D0818 60%, #0A0612)
    `,
    light: `
      radial-gradient(65% 45% at 20% 0%, rgba(165,132,255,0.22), transparent 65%),
      radial-gradient(55% 40% at 85% 15%, rgba(126,224,184,0.14), transparent 60%),
      radial-gradient(45% 35% at 45% 100%, rgba(127,184,255,0.10), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFFFFF 60%, #F7F4FC)
    `,
  },
};

// Midday (10 AM - 4 PM): warm gold enters prominently, teal retreats.
const MIDDAY: AmbientPreset = {
  id: 'midday',
  blooms: {
    dark: [
      { color: '#A584FF', size: 540, top: -140, left: -80, opacity: 0.38 },
      { color: '#F0B429', size: 460, top: 60, right: -60, opacity: 0.25 },
      { color: '#7EE0B8', size: 360, bottom: -200, left: '30%', opacity: 0.12 },
    ],
    light: [
      { color: '#A584FF', size: 540, top: -140, left: -80, opacity: 0.15 },
      { color: '#F0B429', size: 460, top: 60, right: -60, opacity: 0.12 },
      { color: '#7EE0B8', size: 360, bottom: -200, left: '30%', opacity: 0.06 },
    ],
  },
  meshPeriod: 20000,
  orbPeriod: 16000,
  webGradient: {
    dark: `
      radial-gradient(65% 45% at 18% 0%, rgba(165,132,255,0.38), transparent 65%),
      radial-gradient(55% 40% at 82% 18%, rgba(240,180,41,0.25), transparent 60%),
      radial-gradient(40% 30% at 55% 100%, rgba(126,224,184,0.12), transparent 60%),
      linear-gradient(180deg, #0A0612, #110A16 60%, #0A0612)
    `,
    light: `
      radial-gradient(65% 45% at 18% 0%, rgba(165,132,255,0.18), transparent 65%),
      radial-gradient(55% 40% at 82% 18%, rgba(240,180,41,0.14), transparent 60%),
      radial-gradient(40% 30% at 55% 100%, rgba(126,224,184,0.07), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFFDF5 60%, #F7F4FC)
    `,
  },
};

// Evening (4-9 PM): OBVIOUSLY warmer — magenta and amber dominate.
const EVENING: AmbientPreset = {
  id: 'evening',
  blooms: {
    dark: [
      { color: '#A584FF', size: 480, top: -120, left: -80, opacity: 0.30 },
      { color: '#FF8C3C', size: 500, top: 100, right: -80, opacity: 0.30 },
      { color: '#FF4D8B', size: 440, bottom: -120, left: '10%', opacity: 0.25 },
    ],
    light: [
      { color: '#A584FF', size: 480, top: -120, left: -80, opacity: 0.12 },
      { color: '#FF8C3C', size: 500, top: 100, right: -80, opacity: 0.12 },
      { color: '#FF4D8B', size: 440, bottom: -120, left: '10%', opacity: 0.10 },
    ],
  },
  meshPeriod: 24000,
  orbPeriod: 18000,
  webGradient: {
    dark: `
      radial-gradient(55% 40% at 16% 0%, rgba(165,132,255,0.30), transparent 65%),
      radial-gradient(55% 45% at 85% 28%, rgba(255,140,60,0.30), transparent 60%),
      radial-gradient(50% 35% at 35% 100%, rgba(255,77,139,0.25), transparent 60%),
      linear-gradient(180deg, #0A0612, #160A14 60%, #0A0612)
    `,
    light: `
      radial-gradient(55% 40% at 16% 0%, rgba(165,132,255,0.15), transparent 65%),
      radial-gradient(55% 45% at 85% 28%, rgba(255,140,60,0.14), transparent 60%),
      radial-gradient(50% 35% at 35% 100%, rgba(255,77,139,0.12), transparent 60%),
      linear-gradient(180deg, #F7F4FC, #FFF5F8 60%, #F7F4FC)
    `,
  },
};

// Night (9 PM - 6 AM): deep, quiet, one cool moonlight point.
const NIGHT: AmbientPreset = {
  id: 'night',
  blooms: {
    dark: [
      { color: '#A584FF', size: 500, top: -180, left: -120, opacity: 0.28 },
      { color: '#E0D8FF', size: 320, top: -40, right: -20, opacity: 0.10 },
    ],
    light: [
      { color: '#A584FF', size: 500, top: -180, left: -120, opacity: 0.10 },
      { color: '#C5B3FF', size: 320, top: -40, right: -20, opacity: 0.06 },
    ],
  },
  meshPeriod: 30000,
  orbPeriod: 26000,
  webGradient: {
    dark: `
      radial-gradient(55% 40% at 15% 0%, rgba(165,132,255,0.28), transparent 65%),
      radial-gradient(35% 30% at 80% 10%, rgba(224,216,255,0.10), transparent 60%),
      linear-gradient(180deg, #080510, #0A0612 60%, #080510)
    `,
    light: `
      radial-gradient(55% 40% at 15% 0%, rgba(165,132,255,0.12), transparent 65%),
      radial-gradient(35% 30% at 80% 10%, rgba(197,179,255,0.07), transparent 60%),
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
