import { View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { useElevation } from '@/theme/elevation';

interface CardProps extends ViewProps {
  moduleColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Ink card — a solid ink surface (elevation z1) with a hairline border.
// Blur and corner glow died in the Ink + Signal recommit (Cluster 3 §A.7):
// solid `card` needs no glass. The `moduleColor` left border survives until
// the W2 structural pass removes the prop (R3 glyphs replace edge accents).
export function Card({ moduleColor, style, children, ...props }: CardProps) {
  const elev = useElevation('z1');

  return (
    <View
      style={[
        {
          ...elev,
          borderRadius: radii.card,
          padding: spacing.md,
          overflow: 'hidden',
        },
        moduleColor ? { borderLeftWidth: 3, borderLeftColor: moduleColor } : undefined,
        style,
      ]}
      {...props}
    >
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
}
