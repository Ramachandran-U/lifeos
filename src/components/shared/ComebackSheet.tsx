import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Heading } from '@/components/ui/Typography';
import { MOTION_BUDGET, SPRING } from '@/theme/motion';
import { useSheetLifecycle } from '@/hooks/useSheetLifecycle';
import { Companion } from '@/components/companion/Companion';
import { useCompanionStore } from '@/store/useCompanionStore';
import { useFlagStore } from '@/store/useFlagStore';

interface Props {
  visible: boolean;
  /** Days away — drives the headline copy. */
  days: number;
  onClaim: () => void;
  onClose: () => void;
}

/**
 * Comeback welcome (R4). Tone contract, guarded by the guilt-denylist test:
 * warm, zero guilt, zero loss-framing — it mirrors the Quiet Comeback card on
 * the rewards tab ("none of it reset"). The companion missed them; nothing is
 * owed. One CTA eases back in; dismissing costs nothing and nothing nags.
 */
export function ComebackSheet({ visible, days, onClaim, onClose }: Props) {
  const c = useColors();
  const sheet = useSheetLifecycle(visible, onClose);
  const mood = useCompanionStore((s) => s.mood);
  const identity = useCompanionStore((s) => s.identity);
  const companionOn = useFlagStore((s) => s.isEnabled('companion_v1'));

  const companionLine = identity
    ? `${identity.name} missed you — they napped the whole time.`
    : 'Your day is right where you left it.';

  return (
    <Modal visible={sheet.mounted} transparent animationType="fade" onRequestClose={sheet.requestClose}>
      {!sheet.closing && (
        <Animated.View
          entering={FadeIn.duration(MOTION_BUDGET.scrimEnter)}
          exiting={FadeOut.duration(MOTION_BUDGET.scrimExit)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[styles.overlay, { backgroundColor: c.overlay }]}
            onPress={sheet.requestClose}
            accessibilityLabel="Close welcome back sheet"
          />
        </Animated.View>
      )}
      {!sheet.closing && (
        <Animated.View
          entering={SlideInDown.springify().stiffness(SPRING.soft.stiffness).damping(SPRING.soft.damping)}
          exiting={SlideOutDown.duration(MOTION_BUDGET.sheetExit)}
          style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          <View style={styles.hero}>
            {companionOn ? (
              <Companion mood={mood} size={72} equipped={identity?.equipped ?? []} />
            ) : (
              <Text style={styles.wave}>👋</Text>
            )}
            <Heading style={[styles.title, { color: c.textPrimary }]}>Welcome back</Heading>
            <Body style={[styles.body, { color: c.textMuted }]}>
              {`It's been ${days} days — and everything is right where you left it. ${companionLine}`}
            </Body>
            <Body style={[styles.body, { color: c.textSecondary }]}>
              A small gift is waiting on your Rewards tab, and today only needs one tiny step.
            </Body>
          </View>

          <Pressable
            onPress={onClaim}
            accessibilityRole="button"
            accessibilityLabel="Ease back in"
            style={[styles.cta, { backgroundColor: c.primary }]}
          >
            <Text style={[styles.ctaText, { color: c.textPrimary }]}>Ease back in</Text>
          </Pressable>
          <Pressable
            onPress={sheet.requestClose}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
            style={styles.secondary}
          >
            <Text style={[styles.secondaryText, { color: c.textMuted }]}>Maybe later</Text>
          </Pressable>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  wave: { fontSize: 56 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', fontSize: fontSizes.sm, lineHeight: 20 },
  cta: {
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryText: { fontFamily: fonts.body, fontSize: fontSizes.sm },
});
