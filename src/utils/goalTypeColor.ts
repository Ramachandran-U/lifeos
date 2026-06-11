import { useColors } from '@/theme/colors';

export type GoalType = 'career' | 'health' | 'finance' | 'social' | 'learning' | 'personal' | string;

export interface GoalTypeColor {
  /** The full-saturation hue — color AS a surface (fills, solid progress, R1/R3). */
  hue: string;
  /** The per-mode text form — color ON a surface (labels, status words, R2). */
  text: string;
  /** The only legal tinted container for this domain. */
  dim: string;
  label: string;
  /** @deprecated legacy alias of `hue` — swept to hue/text/dim in the W2 structural pass. */
  color: string;
  /** @deprecated legacy alias of `dim` — swept in the W2 structural pass. */
  light: string;
}

// Ink + Signal (Cluster 3 §A.2): this hook owns goal-type palette semantics.
// Goal type 'personal' maps to the GOAL domain — violet is the brand/AI
// signal and is banned from domain content (violet policy §A.4).
export function useGoalTypeColor() {
  const c = useColors();
  const make = (hue: string, text: string, dim: string, label: string): GoalTypeColor => ({
    hue, text, dim, label, color: hue, light: dim,
  });
  return (goalType: string): GoalTypeColor => {
    switch (goalType) {
      case 'career':   return make(c.career,   c.careerText,   c.careerDim,   'Career');
      case 'health':   return make(c.health,   c.healthText,   c.healthDim,   'Health');
      case 'finance':  return make(c.finance,  c.financeText,  c.financeDim,  'Finance');
      case 'social':   return make(c.social,   c.socialText,   c.socialDim,   'Social');
      case 'learning': return make(c.polymath, c.polymathText, c.polymathDim, 'Learning');
      case 'personal':
      default:         return make(c.goal,     c.goalText,     c.goalDim,     'Personal');
    }
  };
}

export const GOAL_TYPE_LEGEND: { goalType: string; label: string }[] = [
  { goalType: 'career',   label: 'Career' },
  { goalType: 'health',   label: 'Health' },
  { goalType: 'finance',  label: 'Finance' },
  { goalType: 'social',   label: 'Social' },
  { goalType: 'learning', label: 'Learning' },
  { goalType: 'personal', label: 'Personal' },
];
