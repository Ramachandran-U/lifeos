import { useColors } from '@/theme/colors';
import { DOMAIN_ICONS, type DomainKey } from '@/theme/domainIcons';

export type { DomainKey };

interface DomainGlyphProps {
  domain: DomainKey;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Aurora Principle 3 — domain hue + icon-shape travel together, so a domain is
// identifiable without relying on colour alone. Use this primitive anywhere a
// domain is shown by colour. Backed by the canonical DOMAIN_ICONS map.
export function DomainGlyph({ domain, size = 14, color, strokeWidth = 2 }: DomainGlyphProps) {
  const c = useColors();
  const hue = (c as Record<string, string>)[domain] ?? c.primary;
  // Fall back to the goal glyph if `domain` isn't a canonical key. Callers
  // sometimes pass a routine-block `module` (e.g. 'rest' | 'meal' | 'work')
  // cast to DomainKey — those aren't in DOMAIN_ICONS, so an unguarded lookup
  // yields `undefined` and rendering `<undefined/>` throws React error #130
  // (blank screen). Every other icon-map lookup in the app guards with a
  // fallback; this is the one that didn't.
  const Icon = DOMAIN_ICONS[domain] ?? DOMAIN_ICONS.goal;
  return (
    <Icon
      size={size}
      color={color ?? hue}
      strokeWidth={strokeWidth}
      accessibilityLabel={`${domain} domain`}
    />
  );
}
