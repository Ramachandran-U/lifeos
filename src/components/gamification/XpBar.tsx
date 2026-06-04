// ─── XPBar ───────────────────────────────────────────────────────────────────
// Eased fill progress bar with optional label row. Spring-in on mount.

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface XPBarProps {
  pct: number;          // 0..1
  color: string;
  height?: number;
  bg?: string;
  label?: string;
}

export function XPBar({ pct, color, height = 8, bg, label }: XPBarProps) {
  const c = useColors();
  const clamped = Math.min(1, Math.max(0, pct));

  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(clamped, {
      duration: 1000,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
          <Text style={[styles.pct, { color }]}>{Math.round(clamped * 100)}%</Text>
        </View>
      )}
      <View
        style={{
          backgroundColor: bg ?? c.border,
          borderRadius: 999,
          height,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            fillStyle,
            {
              height: '100%',
              borderRadius: 999,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  pct: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
  },
});
