// Canonical domain iconography. One Lucide icon per domain — the single source
// of truth so the radar, routine blocks, chips, and entry screen all show the
// SAME symbol for a domain. Hue + icon-shape travel together (Aurora Principle 3,
// color-blind robustness). The Unicode DOMAIN_GLYPHS in colors.ts are retained
// only as a legacy fallback; new surfaces should use these icons.

import {
  Target,
  HeartPulse,
  TrendingUp,
  Briefcase,
  Users,
  Sparkles,
  Moon,
  Square,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

export const DOMAIN_ICONS = {
  goal: Target,
  health: HeartPulse,
  finance: TrendingUp,
  career: Briefcase,
  social: Users,
  polymath: Sparkles,
} satisfies Record<string, LucideIcon>;

export type DomainKey = keyof typeof DOMAIN_ICONS;

// Routine blocks carry non-domain block types alongside the six domains.
export const MODULE_ICONS: Record<string, LucideIcon> = {
  ...DOMAIN_ICONS,
  rest: Moon,
  work: Square,
  meal: UtensilsCrossed,
};
