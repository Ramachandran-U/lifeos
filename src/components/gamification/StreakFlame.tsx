import { View, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  count: number;
  graceUsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { flame: 18, text: 13 },
  md: { flame: 26, text: 16 },
  lg: { flame: 36, text: 22 },
};

export function StreakFlame({ count, graceUsed = false, size = 'md' }: Props) {
  const c = useColors();
  const s = SIZES[size];
  const opacity = graceUsed ? 0.5 : 1;

  return (
    <View style={[styles.row, { opacity }]}>
      <Text style={{ fontSize: s.flame }}>🔥</Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: s.text, color: c.streak }}>{count}</Text>
      {graceUsed && <Text style={{ fontFamily: fonts.body, fontSize: 10, color: c.textMuted, marginLeft: 2 }}>grace</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
