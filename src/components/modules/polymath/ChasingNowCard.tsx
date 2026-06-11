import { View, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Label } from '@/components/ui/Typography';
import { PressableScale } from '@/components/ui/PressableScale';
import type { ChasingThread } from '@/explore/chasing';

interface Props {
  threads: ChasingThread[];
  onPull: (thread: ChasingThread) => void;
  /** Kept for call-site compatibility; the row re-skin carries no dismiss
   *  affordance (Ink + Signal §3.2 item 3 — question + Pull only). */
  onDismiss?: (thread: ChasingThread) => void;
}

/**
 * "Chasing now" — the live questions the model believes the user is circling.
 * Re-skinned in the W4 Explore PR (Ink + Signal §3.0.7 / §3.2 item 3,
 * 2026-06-12): the CHASING NOW caps eyebrow and Card chrome died; each thread
 * is a plain hairline row — question in bodyMedium, `Pull →` in polymath.
 * The screen renders the `Chasing now` SectionTitle above this component.
 */
export function ChasingNowCard({ threads, onPull }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  if (threads.length === 0) return null;

  const handlePull = (t: ChasingThread) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onPull(t);
  };

  return (
    <View>
      {threads.map((t) => (
        <PressableScale
          key={t.question}
          onPress={() => handlePull(t)}
          accessibilityRole="button"
          accessibilityLabel={t.question}
          style={[styles.row, { borderTopColor: c.border }]}
        >
          <Body style={styles.question} numberOfLines={2}>{t.question}</Body>
          <Label color={c.polymath}>Pull →</Label>
        </PressableScale>
      ))}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  question: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: c.textPrimary,
  },
});
