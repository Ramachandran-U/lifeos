import { View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';

interface CardProps extends ViewProps {
  moduleColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ moduleColor, style, children, ...props }: CardProps) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          padding: spacing.md,
          ...shadows.sm,
        },
        moduleColor ? { borderLeftWidth: 4, borderLeftColor: moduleColor } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
