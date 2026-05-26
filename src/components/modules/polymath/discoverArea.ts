import type { Ionicons } from '@expo/vector-icons';
import type { DiscoverArea } from './DiscoverGrid';
import type { SuggestedArea } from '@/ai/types';

// Mapping from AI category → tile presentation. Mirrors the visual language
// of the hardcoded fallback grid so AI suggestions feel native.
const CATEGORY_VISUAL: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; tint: string }
> = {
  arts:       { icon: 'color-palette',   tint: '#FFD66B' },
  science:    { icon: 'planet',          tint: '#7FB8FF' },
  tech:       { icon: 'sparkles',        tint: '#A584FF' },
  sports:     { icon: 'trail-sign',      tint: '#FF8C3C' },
  music:      { icon: 'musical-notes',   tint: '#FF99C5' },
  writing:    { icon: 'create',          tint: '#C9A0FF' },
  language:   { icon: 'chatbubbles',     tint: '#F4C16A' },
  philosophy: { icon: 'leaf',            tint: '#7EE0B8' },
  other:      { icon: 'apps',            tint: '#C5B3FF' },
};

export function suggestedAreaToDiscoverArea(s: SuggestedArea): DiscoverArea {
  const visual = CATEGORY_VISUAL[s.category] ?? CATEGORY_VISUAL.other;
  return {
    name: s.name,
    category: s.category,
    icon: visual.icon,
    tint: visual.tint,
    blurb: s.blurb,
    whyThisFits: s.whyThisFits,
  };
}
