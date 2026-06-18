import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Heading } from '@/components/ui/Typography';
import { DomainGlyph, type DomainKey } from '@/components/ui/DomainGlyph';
import { MOTION_BUDGET, SPRING, useStaggerDelay } from '@/theme/motion';
import { useSheetLifecycle } from '@/hooks/useSheetLifecycle';

type Hub = {
  route: '/(tabs)/goals' | '/(tabs)/health' | '/(tabs)/finance' | '/(tabs)/career' | '/(tabs)/social' | '/(tabs)/explore';
  label: string;
  colorKey: DomainKey;
  caption: string;
};

const HUBS: Hub[] = [
  { route: '/(tabs)/goals',   label: 'Goals',   colorKey: 'goal',     caption: 'Vision, plans, milestones' },
  { route: '/(tabs)/health',  label: 'Health',  colorKey: 'health',   caption: 'Activity, sleep, vitals' },
  { route: '/(tabs)/finance', label: 'Finance', colorKey: 'finance',  caption: 'Budgets, goals, spending' },
  { route: '/(tabs)/career',  label: 'Career',  colorKey: 'career',   caption: 'Skills, growth, upskilling' },
  { route: '/(tabs)/social',  label: 'Social',  colorKey: 'social',   caption: 'Stay close to your people' },
  // The 6th scored domain ("mind") was only reachable via the Explore tab —
  // surfaced here so the Life hub covers every domain the radar scores. (BUG-009)
  { route: '/(tabs)/explore', label: 'Explore', colorKey: 'polymath', caption: 'Curiosity, hobbies, learning' },
];

interface LifeHubSheetProps {
  visible: boolean;
  /**
   * Navigate to the chosen domain. The PARENT owns navigation (and flags the
   * pick) so the sheet-close that follows does not also bounce back to Today —
   * which is what previously swallowed the navigation.
   */
  onPick: (route: Hub['route']) => void;
  onClose: () => void;
}

export function LifeHubSheet({ visible, onPick, onClose }: LifeHubSheetProps) {
  const c = useColors();
  // 50 ms step matches the MOTION scene-06 chart for inner grid cascade.
  const stagger = useStaggerDelay();
  // M0.4: keeps the Modal mounted through the exit animations — see the hook.
  const sheet = useSheetLifecycle(visible, onClose);

  const handlePick = (route: Hub['route']) => {
    // Parent navigates (and records the pick); we just animate the sheet shut.
    onPick(route);
    sheet.requestClose();
  };

  return (
    <Modal visible={sheet.mounted} transparent animationType="fade" onRequestClose={sheet.requestClose}>
      {!sheet.closing && (
      <Animated.View
        entering={FadeIn.duration(MOTION_BUDGET.scrimEnter).delay(150)}
        exiting={FadeOut.duration(MOTION_BUDGET.scrimExit).delay(80)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={sheet.requestClose} />
      </Animated.View>
      )}
      {!sheet.closing && (
      <Animated.View
        entering={SlideInDown.springify().stiffness(SPRING.soft.stiffness).damping(SPRING.soft.damping)}
        exiting={SlideOutDown.duration(MOTION_BUDGET.sheetExit)}
        style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Heading style={[styles.title, { color: c.textPrimary }]}>Your life modules</Heading>
        <Body style={[styles.subtitle, { color: c.textMuted }]}>
          Pick a domain to dive in.
        </Body>

        <View style={styles.grid}>
          {HUBS.map((h, i) => (
            <Animated.View
              key={h.route}
              entering={FadeIn.delay(700 + stagger(i, 50)).duration(MOTION_BUDGET.sheetContentEnter)}
              style={styles.tileWrap}
            >
              <Pressable
                testID={`life-hub-tile-${h.colorKey}`}
                onPress={() => handlePick(h.route)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: c.card,
                    borderColor: pressed ? c[h.colorKey] : c.border,
                  },
                ]}
              >
                <View style={[styles.iconBubble, { backgroundColor: (c as Record<string, string>)[`${h.colorKey}Dim`] }]}>
                  <DomainGlyph domain={h.colorKey} size={24} color={c[h.colorKey]} strokeWidth={2.25} />
                </View>
                <Body style={[styles.tileLabel, { color: c.textPrimary }]}>{h.label}</Body>
                <Body style={[styles.tileCaption, { color: c.textMuted }]} numberOfLines={1}>
                  {h.caption}
                </Body>
              </Pressable>
            </Animated.View>
          ))}
        </View>
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
    paddingBottom: spacing.xxxl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center' },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tileWrap: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  tile: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileLabel: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
  tileCaption: {
    fontSize: fontSizes.xs,
  },
});
