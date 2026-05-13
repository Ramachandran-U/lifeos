import { useColors } from './colors';

// Surface hierarchy accessor. Four roles only — anything else is a misuse.
//   ground  → root canvas (the screen background gradient lives below this)
//   surface → modal / sheet body
//   raised  → pressed states, secondary cards
//   card    → translucent glass — all content cards

export function useSurfaces() {
  const c = useColors();
  return {
    ground: c.background,
    surface: c.surface,
    raised: c.surfaceAlt,
    card: c.card,
  };
}
