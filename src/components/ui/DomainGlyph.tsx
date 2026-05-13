import { Text as RNText, TextStyle, StyleProp } from 'react-native';
import { DOMAIN_GLYPHS, useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type DomainKey = keyof typeof DOMAIN_GLYPHS;

interface DomainGlyphProps {
  domain: DomainKey;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

// Aurora Principle 3 — domain hue + glyph travel together. Use this primitive
// anywhere a domain is identified by colour so screen-readers see a label.
export function DomainGlyph({ domain, size = 14, color, style }: DomainGlyphProps) {
  const c = useColors();
  const hue = (c as Record<string, string>)[domain] ?? c.primary;
  return (
    <RNText
      accessibilityLabel={`${domain} domain`}
      style={[
        {
          fontFamily: fonts.display,
          fontSize: size,
          color: color ?? hue,
          lineHeight: size * 1.05,
        },
        style,
      ]}
    >
      {DOMAIN_GLYPHS[domain]}
    </RNText>
  );
}
