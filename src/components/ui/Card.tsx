import { View, ViewProps, ViewStyle, StyleProp, Platform } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { useElevation } from '@/theme/elevation';

interface CardProps extends ViewProps {
  moduleColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Aurora Refined card — translucent glass over the screen gradient (dark) or
// soft cast shadow (light). Existing call sites that pass `moduleColor` get
// the domain-tinted left border + faint corner glow that identifies the
// owning domain (Principle 3).
export function Card({ moduleColor, style, children, ...props }: CardProps) {
  const c = useColors();
  const elev = useElevation('z1');

  return (
    <View
      style={[
        {
          // Translucent glass — uses elevation token's backgroundColor on dark,
          // solid surface on light.
          ...elev,
          borderRadius: radii.card,
          padding: spacing.md,
          overflow: 'hidden',
        },
        // Web-only backdrop-filter for the frosted-glass effect.
        Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as ViewStyle)
          : null,
        moduleColor ? { borderLeftWidth: 3, borderLeftColor: moduleColor } : undefined,
        style,
      ]}
      {...props}
    >
      {moduleColor && Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 70,
              borderTopLeftRadius: radii.card,
              borderTopRightRadius: radii.card,
            },
            { background: `radial-gradient(ellipse at top left, ${moduleColor}22, transparent 70%)` } as unknown as ViewStyle,
          ]}
        />
      ) : null}
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  );
}
