import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Heading } from './Typography';
import { DomainGlyph, type DomainKey } from './DomainGlyph';

interface ModuleHeaderProps {
  title: string;
  color: string;
  /** Preferred: renders the canonical Lucide domain icon. */
  domain?: DomainKey;
  /** Fallback for non-domain headers — an Ionicons glyph name. */
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ModuleHeader({ title, color, domain, icon }: ModuleHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        {domain ? (
          <DomainGlyph domain={domain} size={24} color={color} strokeWidth={2.25} />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={color} />
        ) : null}
      </View>
      <Heading style={styles.title}>{title}</Heading>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
  },
});
