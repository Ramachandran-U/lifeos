import { View, StyleSheet } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Caption } from '@/components/ui/Typography';
import { RABBIT_HOLE_MAX_DEPTH } from '@/explore/rabbitHoleTree';

interface Props {
  depth: number;
  max?: number;
}

/** "DEPTH n / 12" pill — fill deepens toward polymath gold as the branch grows. */
export function RabbitHoleDepthBadge({ depth, max = RABBIT_HOLE_MAX_DEPTH }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const deep = depth / max > 0.5;
  return (
    <View style={[styles.pill, { borderColor: c.polymath, backgroundColor: c.polymath + (deep ? '22' : '11') }]}>
      <Caption style={{ color: c.polymath, fontFamily: fonts.heading, letterSpacing: 0.5 }}>
        DEPTH {depth} / {max}
      </Caption>
    </View>
  );
}

const makeStyles = (_c: AppColors) => StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
