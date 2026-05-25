import { View, StyleSheet, Platform } from 'react-native';
import { useThemeStore } from '@/store/useThemeStore';

interface Bloom {
  color: string;
  size: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  opacity?: number;
}

const DARK_BLOOMS: Bloom[] = [
  { color: '#A584FF', size: 520, top: -180, left: -120, opacity: 0.35 },
  { color: '#7FB8FF', size: 420, top: 20,   right: -160, opacity: 0.22 },
  { color: '#FF99C5', size: 460, bottom: -200, left: '20%', opacity: 0.18 },
];

// Light-mode blooms keep the same hue families as dark but at much lower
// alpha so the page background reads as soft lavender-white, not violet wash.
// Without this, light-mode pages inherit a dark canvas and any text rendered
// with the light-mode textPrimary (#140828) becomes invisible.
const LIGHT_BLOOMS: Bloom[] = [
  { color: '#A584FF', size: 520, top: -180, left: -120, opacity: 0.12 },
  { color: '#7FB8FF', size: 420, top: 20,   right: -160, opacity: 0.08 },
  { color: '#FF99C5', size: 460, bottom: -200, left: '20%', opacity: 0.07 },
];

const WEB_GRADIENT_DARK = `
  radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.35), transparent 60%),
  radial-gradient(50% 35% at 90% 20%, rgba(127,184,255,0.22), transparent 60%),
  radial-gradient(40% 30% at 50% 100%, rgba(255,153,197,0.18), transparent 60%),
  linear-gradient(180deg, #0A0612, #120A1E 60%, #0A0612)
`;

const WEB_GRADIENT_LIGHT = `
  radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.18), transparent 60%),
  radial-gradient(50% 35% at 90% 20%, rgba(127,184,255,0.12), transparent 60%),
  radial-gradient(40% 30% at 50% 100%, rgba(255,153,197,0.10), transparent 60%),
  linear-gradient(180deg, #F7F4FC, #FFFFFF 60%, #F7F4FC)
`;

const DARK_BASE = '#0A0612';
const LIGHT_BASE = '#F7F4FC';

export function AuroraBackground({ blooms }: { blooms?: Bloom[] }) {
  const mode = useThemeStore((s) => s.mode);
  const isLight = mode === 'light';
  const resolvedBlooms = blooms ?? (isLight ? LIGHT_BLOOMS : DARK_BLOOMS);
  const baseColor = isLight ? LIGHT_BASE : DARK_BASE;
  const webGradient = isLight ? WEB_GRADIENT_LIGHT : WEB_GRADIENT_DARK;

  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundImage: webGradient } as unknown as object]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: baseColor, overflow: 'hidden' }]}>
      {resolvedBlooms.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: b.color,
            opacity: b.opacity ?? 0.25,
            top: b.top as number | undefined,
            left: b.left as number | undefined,
            right: b.right as number | undefined,
            bottom: b.bottom as number | undefined,
          }}
        />
      ))}
    </View>
  );
}
