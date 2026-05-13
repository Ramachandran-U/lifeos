import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export function XpChip({ amount, prefix = '+' }: { amount: number; prefix?: string }) {
  const c = useColors();
  return (
    <View style={[styles.chip, { backgroundColor: c.xp + '22', borderColor: c.xp + '55' }]}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.xp }}>
        {prefix}{amount} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
