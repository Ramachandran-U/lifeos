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
  const Icon = DOMAIN_ICONS[domain];
  return (
    <Icon
      size={size}
      color={color ?? hue}
      strokeWidth={strokeWidth}
      accessibilityLabel={`${domain} domain`}
    />
  );
}
