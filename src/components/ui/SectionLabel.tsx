import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface SectionLabelProps {
  children: ReactNode;
  color?: string;
  icon?: ReactNode;
}

// Aurora eyebrow — JetBrains Mono micro caps. Used above every meaningful
// section. Color defaults to muted; pass a domain hue when labeling a section
// that belongs to a single domain.
export function SectionLabel({ children, color, icon }: SectionLabelProps) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {icon}
      <Text variant="micro" color={color ?? c.textMuted}>
        {children as string}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
