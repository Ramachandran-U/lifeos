import { View, StyleSheet } from 'react-native';

interface SparklineProps {
  values: number[];
  color: string;
  height?: number;
  /** Optional reference target; drawn as a dashed horizontal line. */
  target?: number;
}

/**
 * Minimal bar-style sparkline built from flexed <View> columns — avoids pulling
 * in an SVG dependency. Each bar's height is proportional to the max value.
 */
export function Sparkline({ values, color, height = 36, target }: SparklineProps) {
  const max = Math.max(1, ...values, target ?? 0);
  return (
    <View style={[styles.row, { height }]}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: h,
                backgroundColor: color,
                opacity: v === 0 ? 0.15 : 0.9,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 4,
  },
});
