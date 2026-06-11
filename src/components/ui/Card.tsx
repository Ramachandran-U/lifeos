import { View, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { useElevation } from '@/theme/elevation';

interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

// Ink card — a solid ink surface (elevation z1) with a hairline border.
// Blur, corner glow, and the hue left-border prop all died in the Ink +
// Signal recommit (Cluster 3 §A.7, §C): cards are neutral; domain identity
// is an R3 glyph (DomainGlyph) inside the content, never an edge.
export function Card({ style, children, ...props }: CardProps) {
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
        style,
      ]}
      {...props}
    >
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
}
