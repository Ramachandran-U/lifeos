import { useColors, DOMAIN_GRADIENTS } from '@/theme/colors';

export type GoalType = 'career' | 'health' | 'finance' | 'social' | 'learning' | 'personal' | string;

export function useGoalTypeColor() {
  const c = useColors();
  return (goalType: string): { color: string; light: string; label: string; gradient: readonly [string, string] } => {
    switch (goalType) {
      case 'career':   return { color: c.career,   light: c.careerLight,   label: 'Career',   gradient: DOMAIN_GRADIENTS.career };
      case 'health':   return { color: c.health,   light: c.healthLight,   label: 'Health',   gradient: DOMAIN_GRADIENTS.health };
      case 'finance':  return { color: c.finance,  light: c.financeLight,  label: 'Finance',  gradient: DOMAIN_GRADIENTS.finance };
      case 'social':   return { color: c.social,   light: c.socialLight,   label: 'Social',   gradient: DOMAIN_GRADIENTS.social };
      case 'learning': return { color: c.polymath, light: c.polymathLight, label: 'Learning', gradient: DOMAIN_GRADIENTS.polymath };
      case 'personal':
      default:         return { color: c.primary,  light: c.primaryLight,  label: 'Personal', gradient: DOMAIN_GRADIENTS.primary };
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
