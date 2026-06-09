import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { TIMING } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { useMotivationStore } from '@/store/useMotivationStore';
import type { MotivationInput, Motivation } from '@/ai/types';

interface Props {
  module: MotivationInput['module'];
  context: string;
  accent: string;
}

export function MotivationBanner({ module, context, accent }: Props) {
  const c = useColors();
  const getOrFetch = useMotivationStore((s) => s.getOrFetch);
  const [m, setM] = useState<Motivation | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!context.trim()) return;
    getOrFetch({ module, context })
      .then((res) => { if (mounted) setM(res); })
      .catch(() => { if (mounted) setM(null); });
    return () => { mounted = false; };
  }, [module, context, getOrFetch]);

  if (!m) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(TIMING.normal)}
      style={[styles.wrap, { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent }]}
    >
      <View style={[styles.iconBadge, { backgroundColor: accent }]}>
        <Ionicons name="sparkles" size={14} color="#fff" />
      </View>
      <View style={styles.body}>
        <Body style={[styles.quote, { color: c.textPrimary }]}>{m.quote}</Body>
        <Caption style={{ color: c.textSecondary }}>{m.microTip}</Caption>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    borderWidth: 1, borderLeftWidth: 4, borderRadius: 14,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  iconBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  body: { flex: 1, gap: 2 },
  quote: { fontFamily: fonts.heading, fontSize: fontSizes.md, lineHeight: fontSizes.md * 1.3 },
});
