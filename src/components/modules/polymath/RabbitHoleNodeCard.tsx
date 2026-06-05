import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { RabbitHoleForkButton } from './RabbitHoleForkButton';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import { advanceRabbitHole } from '@/explore/rabbitHoleActions';
import type { RabbitHoleNode } from '@/explore/rabbitHoleTree';

interface Props {
  node: RabbitHoleNode;
  onClimb: () => void;
  onMap: () => void;
}

/** The focused reading view of the cursor node: a ~30-second read plus its two
 * forks. Both nav actions are NON-destructive — "Climb to parent" moves the
 * cursor up without deleting anything. */
export function RabbitHoleNodeCard({ node, onClimb, onMap }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const isAdvancing = useRabbitHoleStore((s) => s.isAdvancing);
  const [deeper, sideways] = node.forks;
  const isRoot = node.parentId == null;

  const climb = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onClimb();
  };

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: c.polymath }]}>
        <Caption style={{ color: c.polymath, fontFamily: fonts.heading, letterSpacing: 0.5 }}>
          {node.arrivedVia == null ? '✦ START' : node.arrivedVia === 'deeper' ? '↓ DEEPER' : '↻ SIDEWAYS'}
        </Caption>
        <Heading style={styles.title}>{node.title}</Heading>
        <Body style={styles.body}>{node.body}</Body>

        <View style={styles.forks}>
          <RabbitHoleForkButton
            direction="deeper"
            hint={deeper.hint}
            state={deeper.state}
            disabled={isAdvancing}
            onPress={() => void advanceRabbitHole('deeper')}
          />
          <RabbitHoleForkButton
            direction="sideways"
            hint={sideways.hint}
            state={sideways.state}
            disabled={isAdvancing}
            onPress={() => void advanceRabbitHole('sideways')}
          />
        </View>

        <View style={styles.nav}>
          <Pressable onPress={climb} disabled={isRoot} accessibilityRole="button" hitSlop={8}>
            <Body style={{ color: isRoot ? c.textMuted : c.textSecondary }}>‹ Climb to parent</Body>
          </Pressable>
          <Pressable onPress={onMap} accessibilityRole="button" hitSlop={8}>
            <Body style={{ color: c.textSecondary }}>⊞ Jump to map</Body>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: fontSizes.xl, color: c.textPrimary },
  body: { color: c.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  forks: { gap: spacing.sm, marginTop: spacing.xs },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
});
