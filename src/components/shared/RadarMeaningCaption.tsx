import { StyleSheet } from 'react-native';
import { Text as AuroraText } from '@/components/ui/Text';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { STARTER_COPY } from '@/constants/starterCopy';

/**
 * Zero-state radar meaning (cold_start_v1, spec §3.7). Mounted inside the
 * Today hero Animated.View immediately after <HexRadar/>, so the radar itself
 * does not move one pixel and the caption shares the hero's existing entry
 * fade — no separate animation, no idle animation. Plain Text over
 * react-native-web: identical on iOS, Android, and web.
 *
 * `maxWidth` follows the existing component-geometry prop convention — the
 * Today mount passes the same 340 the HexRadar size={340} mount uses.
 */
interface RadarMeaningCaptionProps {
  maxWidth: number;
}

export function RadarMeaningCaption({ maxWidth }: RadarMeaningCaptionProps) {
  const c = useColors();
  return (
    <AuroraText variant="caption" color={c.textSecondary} style={[styles.caption, { maxWidth }]}>
      {STARTER_COPY.radarMeaning}
    </AuroraText>
  );
}

const styles = StyleSheet.create({
  caption: { textAlign: 'center', marginTop: spacing.sm },
});
