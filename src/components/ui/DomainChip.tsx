import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';
import { DomainGlyph, type DomainKey } from './DomainGlyph';

interface DomainChipProps {
  domain: DomainKey;
  value?: string;
  dim?: boolean;
}

// Compact pill pairing the domain glyph + a small value (e.g. "2/3", "—",
// "40m"). Used in the Today briefing row and module headers.
export function DomainChip({ domain, value, dim = false }: DomainChipProps) {
  const c = useColors();
  const hue = (c as Record<string, string>)[domain] ?? c.primary;
  const hueDim = (c as Record<string, string>)[`${domain}Dim`] ?? c.surfaceAlt;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${domain}${value ? `, ${value}` : ''}`}
      style={[
        styles.chip,
        {
          // Active chips use the domain's named Dim container; chrome stays neutral.
          backgroundColor: dim ? c.surfaceAlt : hueDim,
          borderColor: c.border,
        },
      ]}
    >
      <DomainGlyph domain={domain} size={11} color={dim ? c.textMuted : hue} />
      {value !== undefined && (
        <Text variant="micro" color={dim ? c.textMuted : hue}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
