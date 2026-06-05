import type { AppColors } from '@/theme/colors';
import type { BadgeId } from '@/utils/gamification';

export type ModuleKey = 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath';
export type DomainKey = 'goals' | 'health' | 'finance' | 'career' | 'social' | 'polymath';

export type ColorKey = Extract<keyof AppColors, 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath'>;

export interface DomainMeta {
  key: DomainKey;
  label: string;
  emoji: string;
  colorKey: ColorKey;
  angleDeg: number;
}

export const DOMAIN_META: DomainMeta[] = [
  { key: 'goals',   label: 'Goals',   emoji: '🎯', colorKey: 'goal',     angleDeg: -90  },
  { key: 'health',  label: 'Health',  emoji: '💚', colorKey: 'health',   angleDeg: -30  },
  { key: 'finance', label: 'Finance', emoji: '💰', colorKey: 'finance',  angleDeg: 30   },
  { key: 'career',  label: 'Career',  emoji: '🚀', colorKey: 'career',   angleDeg: 90   },
  { key: 'social',  label: 'Social',  emoji: '🤝', colorKey: 'social',   angleDeg: 150  },
  { key: 'polymath', label: 'Mind',   emoji: '🔭', colorKey: 'polymath', angleDeg: -150 },
];

export const MODULE_META: Record<ModuleKey, { label: string; emoji: string; colorKey: ColorKey }> = {
  goal:     { label: 'Goals',   emoji: '🎯', colorKey: 'goal'     },
  health:   { label: 'Health',  emoji: '💚', colorKey: 'health'   },
  finance:  { label: 'Finance', emoji: '💰', colorKey: 'finance'  },
  career:   { label: 'Career',  emoji: '🚀', colorKey: 'career'   },
  social:   { label: 'Social',  emoji: '🤝', colorKey: 'social'   },
  polymath: { label: 'Explore', emoji: '🔭', colorKey: 'polymath' },
};

export const BADGE_META: Record<BadgeId, { label: string; emoji: string; desc: string }> = {
  first_blueprint:    { label: 'First Blueprint',   emoji: '📋', desc: 'Completed onboarding & built your first routine' },
  first_blood_report: { label: 'Health Report',     emoji: '🩸', desc: 'Uploaded your first health data report' },
  streak_30_any:      { label: '30-Day Streak',     emoji: '🔥', desc: 'Maintained any habit streak for 30 consecutive days' },
  skill_mastery:      { label: 'Skill Master',      emoji: '🧠', desc: 'Completed a full learning resource or course' },
  life_balance:       { label: 'Life Balance',      emoji: '⚖️',  desc: 'All 6 domain scores above 60 simultaneously' },
  goal_complete:      { label: 'Goal Crusher',      emoji: '🏆', desc: 'Completed your first major goal milestone' },
  week_1:             { label: 'Week One',          emoji: '📅', desc: 'Opened LifeOS for 7 consecutive days' },
  food_photo:         { label: 'Food Photographer', emoji: '📸', desc: 'Logged a meal using the camera feature' },
  first_connection:   { label: 'First Connection',  emoji: '🤝', desc: 'Added your first contact to Social Hub' },
  inner_orbit:        { label: 'Inner Orbit',       emoji: '🪐', desc: 'All inner-circle contacts inside cadence' },
  polymath_starter:   { label: 'Polymath Starter',  emoji: '🔭', desc: 'Logged time on a deep-dive interest' },
  expedition_complete:{ label: 'Expeditioner',     emoji: '🧭', desc: 'Completed your first expedition' },
  synapse_formed:     { label: 'Synapse',          emoji: '⚡', desc: 'Formed a cross-discipline link in your constellation' },
  curiosity_streak_7: { label: 'Curious Week',     emoji: '🌟', desc: 'Engaged with a spark for 7 consecutive days' },
};

// Badge rarity tiers — the real-life difficulty of earning it, NOT grind time
// (per the game-design review). Milestone = anyone consistent reaches it;
// Mastery = sustained effort; Rare = genuinely hard, usually cross-domain or
// sustained balance. The tier LABEL carries the meaning, so rarity stays
// colour-blind safe (colour only reinforces it).
export type BadgeTier = 'milestone' | 'mastery' | 'rare';

export const BADGE_TIER: Record<BadgeId, BadgeTier> = {
  first_blueprint:    'milestone',
  first_blood_report: 'milestone',
  goal_complete:      'milestone',
  week_1:             'milestone',
  food_photo:         'milestone',
  first_connection:   'milestone',
  polymath_starter:   'milestone',
  skill_mastery:      'mastery',
  streak_30_any:      'mastery',
  expedition_complete:'mastery',
  curiosity_streak_7: 'mastery',
  life_balance:       'rare',
  inner_orbit:        'rare',
  synapse_formed:     'rare',
};

export const BADGE_TIER_META: Record<BadgeTier, { label: string }> = {
  milestone: { label: 'Milestone' },
  mastery:   { label: 'Mastery' },
  rare:      { label: 'Rare' },
};

export type StreakKey = 'workout' | 'learning' | 'foodTracking' | 'journaling' | 'social';

export const STREAK_META: Record<StreakKey, { label: string; emoji: string; colorKey: ColorKey }> = {
  workout:      { label: 'Workout',    emoji: '💪', colorKey: 'health'   },
  learning:     { label: 'Learning',   emoji: '📚', colorKey: 'polymath' },
  foodTracking: { label: 'Food Log',   emoji: '🥗', colorKey: 'health'   },
  journaling:   { label: 'Journaling', emoji: '✍️',  colorKey: 'goal'     },
  social:       { label: 'Social',     emoji: '🤝', colorKey: 'social'   },
};

export const LEVEL_PERKS: Record<number, string[]> = {
  2:  ['Unlock daily quests', 'Streak tracking'],
  3:  ['Badge gallery', 'Weekly insight'],
  4:  ['Routine builder AI', '+5% XP Boost'],
  5:  ['Finance insights', 'Custom avatar frame'],
  6:  ['Goal decomposer', 'Mood tracking'],
  7:  ['Advanced goal templates', 'Streak shield (1/mo)'],
  8:  ['Finance insights Pro', 'Weekly report PDF'],
  9:  ['AI coach mode', 'Priority briefings'],
  10: ['+10% XP boost', 'Custom themes'],
  11: ['LifeOS premium badge', 'All modules unlocked'],
  12: ['Mentor mode', 'Founder status'],
};

export interface Quest {
  id: string;
  title: string;
  module: ModuleKey;
  xp: number;
  progress: number;
  total: number;
  type: 'daily' | 'weekly';
}

export const DEFAULT_QUESTS: Quest[] = [
  { id: 'q_food',     title: 'Log 3 meals today',         module: 'health',   xp: 30,  progress: 0, total: 3, type: 'daily'  },
  { id: 'q_routine',  title: 'Complete morning routine',  module: 'goal',     xp: 50,  progress: 0, total: 5, type: 'daily'  },
  { id: 'q_learn',    title: 'Finish a learning resource', module: 'polymath', xp: 100, progress: 0, total: 1, type: 'weekly' },
];
