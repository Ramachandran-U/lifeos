import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';
import { DomainGlyph, type DomainKey } from './DomainGlyph';

interface ModuleHeaderProps {
  title: string;
  /** The solid domain hue — rendered as the R1 block surface. */
  color: string;
  /** Preferred: renders the canonical domain glyph in inkOnColor. */
  domain?: DomainKey;
  /** Fallback for non-domain headers — an Ionicons glyph name. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional right-aligned stat (e.g. live BMI). Omit until real data exists. */
  stat?: { value: string; label: string };
}

// The R1 block (Ink + Signal, Cluster 3 §C): one solid, full-bleed domain-hue
// surface per module screen. Content on it uses inkOnColor only — the hue IS
// the surface, never a tint. Call sites hoist this OUT of their padded
// content container so the block spans the full viewport width
// (negative-margin compensation is banned).
export function ModuleHeader({ title, color, domain, icon, stat }: ModuleHeaderProps) {
  const c = useColors();

  return (
    <View testID="module-header" style={[styles.container, { backgroundColor: color }]}>
      <View style={styles.titleRow}>
        {domain ? (
          <DomainGlyph domain={domain} size={28} color={c.inkOnColor} strokeWidth={2.25} />
        ) : icon ? (
          <Ionicons name={icon} size={28} color={c.inkOnColor} />
        ) : null}
        <Text variant="h1" style={{ color: c.inkOnColor }}>{title}</Text>
      </View>
      {stat ? (
        <View style={styles.stat}>
          <Text variant="display" numeric style={{ color: c.inkOnColor }}>{stat.value}</Text>
          <Text variant="caption" style={{ color: c.inkOnColor }}>{stat.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  stat: {
    alignItems: 'flex-end',
  },
});
