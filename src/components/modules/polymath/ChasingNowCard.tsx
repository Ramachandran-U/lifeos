import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import type { ChasingThread } from '@/explore/chasing';

interface Props {
  threads: ChasingThread[];
  onPull: (thread: ChasingThread) => void;
  onDismiss: (thread: ChasingThread) => void;
}

/**
 * "Chasing now" — the lead surface of the redesigned Explore tab. Shows the
 * live questions the model believes the user is circling, each defended by the
 * evidence ("↳ rationale"). The first thread is presented in full with actions;
 * any others are compact, tappable follow-ons.
 */
export function ChasingNowCard({ threads, onPull, onDismiss }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  if (threads.length === 0) return null;

  const [lead, ...rest] = threads;

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handlePull = (t: ChasingThread) => { haptic(); onPull(t); };
  const handleDismiss = (t: ChasingThread) => { haptic(); onDismiss(t); };

  return (
    <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: c.polymath }]}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="git-network-outline" size={16} color={c.polymath} />
        <Label color={c.polymath}>CHASING NOW</Label>
        <View style={styles.liveRow}>
          <View style={[styles.dot, { backgroundColor: c.polymath }]} />
          <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>live</Caption>
        </View>
      </View>

      <Heading style={styles.question}>{lead.question}</Heading>

      <View style={styles.rationaleRow}>
        <Caption style={{ color: c.polymath, fontFamily: fonts.heading }}>↳ </Caption>
        <Caption style={[styles.rationale, { color: c.textSecondary }]}>{lead.rationale}</Caption>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => handlePull(lead)}
          style={[styles.pullBtn, { backgroundColor: c.polymath }]}
        >
          <Caption style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Pull this thread</Caption>
          <Ionicons name="arrow-forward" size={15} color={c.inkOnColor} />
        </Pressable>
        <Pressable onPress={() => handleDismiss(lead)} style={styles.skipBtn} hitSlop={6}>
          <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>not now</Caption>
        </Pressable>
      </View>

      {rest.length > 0 && (
        <View style={styles.restWrap}>
          {rest.map((t) => (
            <Pressable
              key={t.question}
              onPress={() => handlePull(t)}
              style={[styles.restRow, { borderColor: c.border }]}
            >
              <Body style={[styles.restQuestion, { color: c.textPrimary }]} numberOfLines={2}>
                {t.question}
              </Body>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  question: { fontSize: fontSizes.xl, color: c.textPrimary },
  rationaleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  rationale: { flex: 1, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  pullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
  },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 8 },
  restWrap: { gap: spacing.xs, marginTop: spacing.xs },
  restRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderRadius: 12,
  },
  restQuestion: { flex: 1, fontSize: fontSizes.sm },
});
