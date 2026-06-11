import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface SectionTitleProps {
  children: string;          // sentence case — "Skill gaps", never shouted caps
  count?: number;            // trailing count, e.g. "Saved paths · 3"; omitted = no count rendered
  trailing?: ReactNode;      // action slot (e.g. "Add" pill, chevron); omitted = title-only row
}

// The app-wide section header (Ink + Signal §3.0.2): a sentence-case headline
// set in textVariants.h3 (Nunito-ExtraBold 18/22) — never a mono-caps eyebrow.
// No background, no border, no Card; the words carry the hierarchy.
export function SectionTitle({ children, count, trailing }: SectionTitleProps) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text variant="h3" color={c.textPrimary}>
        {children}
        {count != null ? (
          <Text variant="h3" color={c.textMuted}>{` · ${count}`}</Text>
        ) : null}
      </Text>
      {trailing ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
});
