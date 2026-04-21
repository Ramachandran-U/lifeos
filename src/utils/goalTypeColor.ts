import { useColors } from '@/theme/colors';

export type GoalType = 'career' | 'health' | 'finance' | 'social' | 'learning' | 'personal' | string;

export function useGoalTypeColor() {
  const c = useColors();
  return (goalType: string): { color: string; light: string; label: string } => {
    switch (goalType) {
      case 'career':   return { color: c.career,   light: c.careerLight,   label: 'Career' };
      case 'health':   return { color: c.health,   light: c.healthLight,   label: 'Health' };
      case 'finance':  return { color: c.finance,  light: c.financeLight,  label: 'Finance' };
      case 'social':   return { color: c.social,   light: c.socialLight,   label: 'Social' };
      case 'learning': return { color: c.polymath, light: c.polymathLight, label: 'Learning' };
      case 'personal':
      default:         return { color: c.primary,  light: c.primaryLight,  label: 'Personal' };
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
