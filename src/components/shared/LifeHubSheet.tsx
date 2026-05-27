import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Heading } from '@/components/ui/Typography';
import { SPRING, useStaggerDelay } from '@/theme/motion';

type Hub = {
  route: '/(tabs)/goals' | '/(tabs)/health' | '/(tabs)/finance' | '/(tabs)/career' | '/(tabs)/social' | '/(tabs)/explore';
  label: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  colorKey: 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath';
  caption: string;
};

const HUBS: Hub[] = [
  { route: '/(tabs)/goals',   label: 'Goals',   icon: 'flag',      colorKey: 'goal',     caption: 'Vision, plans, milestones' },
  { route: '/(tabs)/health',  label: 'Health',  icon: 'heart',     colorKey: 'health',   caption: 'Activity, sleep, vitals' },
  { route: '/(tabs)/finance', label: 'Finance', icon: 'wallet',    colorKey: 'finance',  caption: 'Budgets, goals, spending' },
  { route: '/(tabs)/career',  label: 'Career',  icon: 'briefcase', colorKey: 'career',   caption: 'Skills, growth, upskilling' },
  { route: '/(tabs)/social',  label: 'Social',  icon: 'people',    colorKey: 'social',   caption: 'Stay close to your people' },
  // The 6th scored domain ("mind") was only reachable via the Explore tab —
  // surfaced here so the Life hub covers every domain the radar scores. (BUG-009)
  { route: '/(tabs)/explore', label: 'Explore', icon: 'compass',   colorKey: 'polymath', caption: 'Curiosity, hobbies, learning' },
];

interface LifeHubSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LifeHubSheet({ visible, onClose }: LifeHubSheetProps) {
  const c = useColors();
  const router = useRouter();
  // 50 ms step matches the MOTION scene-06 chart for inner grid cascade.
  const stagger = useStaggerDelay();

  const handlePick = (route: Hub['route']) => {
    onClose();
    router.push(route);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(480).delay(150)}
        exiting={FadeOut.duration(460).delay(80)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().stiffness(SPRING.soft.stiffness).damping(SPRING.soft.damping)}
        exiting={SlideOutDown.duration(520)}
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
              entering={FadeIn.delay(700 + stagger(i, 50)).duration(320)}
              style={styles.tileWrap}
            >
              <Pressable
                onPress={() => handlePick(h.route)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: c.card,
                    borderColor: pressed ? c[h.colorKey] : c.border,
                  },
                ]}
              >
                <View style={[styles.iconBubble, { backgroundColor: c[h.colorKey] + '22' }]}>
                  <Ionicons name={h.icon} size={24} color={c[h.colorKey]} />
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
