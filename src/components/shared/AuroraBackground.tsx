import { View, StyleSheet, Platform } from 'react-native';

interface Bloom {
  color: string;
  size: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  opacity?: number;
}

const DEFAULT_BLOOMS: Bloom[] = [
  { color: '#A584FF', size: 520, top: -180, left: -120, opacity: 0.35 },
  { color: '#7FB8FF', size: 420, top: 20,   right: -160, opacity: 0.22 },
  { color: '#FF99C5', size: 460, bottom: -200, left: '20%', opacity: 0.18 },
];

const WEB_GRADIENT = `
  radial-gradient(60% 40% at 20% 0%, rgba(165,132,255,0.35), transparent 60%),
  radial-gradient(50% 35% at 90% 20%, rgba(127,184,255,0.22), transparent 60%),
  radial-gradient(40% 30% at 50% 100%, rgba(255,153,197,0.18), transparent 60%),
  linear-gradient(180deg, #0A0612, #120A1E 60%, #0A0612)
`;

export function AuroraBackground({ blooms = DEFAULT_BLOOMS }: { blooms?: Bloom[] }) {
  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundImage: WEB_GRADIENT } as unknown as object]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0612', overflow: 'hidden' }]}>
      {blooms.map((b, i) => (
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
