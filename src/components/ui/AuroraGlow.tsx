import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';

type WebGlowStyle = {
  width: number;
  height: number;
  borderRadius: number;
  background: string;
  filter: string;
};

interface AuroraGlowProps {
  color?: string;
  size?: number;
  intensity?: number; // 0..1, default 0.45
  style?: StyleProp<ViewStyle>;
}

// Radial blur halo. Used behind z3 surfaces (reward overlay, level-up) and
// behind heroes (hex radar). On web this is a CSS radial gradient with a
// blur filter; on native it's a softly-tinted blur-less circle (RN can't
// blur a single layer without expo-blur, which costs perf). The cheaper
// approximation reads as 'glow' at the sizes we use here.
export function AuroraGlow({
  color = '#A584FF',
  size = 240,
  intensity = 0.45,
  style,
}: AuroraGlowProps) {
  const alphaHex = Math.round(intensity * 255)
    .toString(16)
    .padStart(2, '0');
  const dim = color + alphaHex;

  if (Platform.OS === 'web') {
    const webStyle: WebGlowStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
      background: `radial-gradient(circle, ${dim}, transparent 60%)`,
      filter: 'blur(20px)',
    };
    return (
      <View
        pointerEvents="none"
        style={[webStyle as unknown as ViewStyle, style]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: dim },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    opacity: 0.7,
  },
});
