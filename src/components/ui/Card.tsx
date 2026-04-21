import { View, ViewProps, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';

interface CardProps extends ViewProps {
  moduleColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ moduleColor, style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        moduleColor ? { borderLeftWidth: 4, borderLeftColor: moduleColor } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
});
