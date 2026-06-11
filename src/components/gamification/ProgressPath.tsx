import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { LEVEL_PERKS } from '@/constants/gamification';
import { levelTitle, type Streaks } from '@/utils/gamification';

interface Props {
  currentLevel: number;
  /** Progress within the current level, 0..1 — partially lights the next leg. */
  levelPct: number;
  /** Streaks JSON — achieved milestone tiers become landmarks on the trail. */
  streaks: Streaks;
  badgeCount: number;
}

/**
 * The journey map (R5, flag: progress_map_v1) — a winding trail over data the
 * app already tracks: levels + LEVEL_PERKS ahead, milestone tiers and badges
 * earned behind. Replaces the LevelLadder card on Rewards behind the flag.
 * Pure presentation over existing state — no schema, no new counters.
 */

const NODE_COUNT = 4; // current level + the next three
const LEG_HEIGHT = 96;
const TOP_PAD = 28;

export function ProgressPath({ currentLevel, levelPct, streaks, badgeCount }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(320);

  const height = TOP_PAD * 2 + LEG_HEIGHT * (NODE_COUNT - 1);
  const xAt = (i: number) => (i % 2 === 0 ? width * 0.22 : width * 0.78);
  const yAt = (i: number) => TOP_PAD + i * LEG_HEIGHT;

  // One cubic leg per level step; the first leg lights up with levelPct.
  const legs = Array.from({ length: NODE_COUNT - 1 }, (_, i) => {
    const x1 = xAt(i);
    const y1 = yAt(i);
    const x2 = xAt(i + 1);
    const y2 = yAt(i + 1);
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  });

  // Landmarks already earned — shown at the trailhead, where the path comes
  // from: achieved milestone tiers (union across streaks) and the badge count.
  const earnedTiers = Array.from(
    new Set(Object.values(streaks).flatMap((s) => s.milestones ?? [])),
  ).sort((a, b) => a - b);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {(earnedTiers.length > 0 || badgeCount > 0) && (
        <View style={styles.landmarks}>
          {earnedTiers.map((tier) => (
            <View key={tier} style={[styles.landmark, { backgroundColor: c.card, borderColor: c.streak + '55' }]}>
              <Text style={[styles.landmarkText, { color: c.streak }]}>{`🔥 ${tier}-day`}</Text>
            </View>
          ))}
          {badgeCount > 0 && (
            <View style={[styles.landmark, { backgroundColor: c.card, borderColor: c.badge + '55' }]}>
              <Text style={[styles.landmarkText, { color: c.badge }]}>{`★ ${badgeCount} badge${badgeCount > 1 ? 's' : ''}`}</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height }}>
        <Svg width="100%" height={height}>
          {legs.map((d, i) => (
            <Path
              key={`bg-${i}`}
              d={d}
              stroke={c.border}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {/* The first leg lights with in-level progress (dash trick avoids
              measuring path length: scale a generous dash by pct). */}
          <Path
            d={legs[0]}
            stroke={c.primary}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${Math.max(0.01, levelPct) * LEG_HEIGHT * 1.4} ${LEG_HEIGHT * 4}`}
          />
          {Array.from({ length: NODE_COUNT }, (_, i) => (
            <Circle
              key={`node-${i}`}
              cx={xAt(i)}
              cy={yAt(i)}
              r={i === 0 ? 17 : 13}
              fill={i === 0 ? c.primary : c.card}
              stroke={i === 0 ? c.primaryDim : c.border}
              strokeWidth={2}
            />
          ))}
        </Svg>

        {/* RN labels over the SVG (no Skia/SVG font plumbing needed). */}
        {Array.from({ length: NODE_COUNT }, (_, i) => {
          const lvl = currentLevel + i;
          const perk = (LEVEL_PERKS[lvl] ?? [])[0];
          const onLeft = i % 2 === 0;
          return (
            <View
              key={`label-${i}`}
              style={[
                styles.nodeLabelWrap,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  top: yAt(i) - 16,
                  left: onLeft ? width * 0.22 + 28 : undefined,
                  right: onLeft ? undefined : width * 0.22 + 28,
                  alignItems: onLeft ? 'flex-start' : 'flex-end',
                },
              ]}
            >
              <Text style={[styles.nodeTitle, { color: i === 0 ? c.textPrimary : c.textSecondary }]}>
                {`L${lvl} · ${levelTitle(lvl)}`}
              </Text>
              {perk ? (
                <Text style={[styles.nodePerk, { color: c.textMuted }]} numberOfLines={1}>
                  {perk}
                </Text>
              ) : null}
              {i === 0 && (
                <Text style={[styles.youChip, { color: c.primaryDim }]}>YOU ARE HERE</Text>
              )}
            </View>
          );
        })}
        {/* Level numbers centred on the nodes. */}
        {Array.from({ length: NODE_COUNT }, (_, i) => (
          <Text
            key={`num-${i}`}
            style={[
              styles.nodeNum,
              {
                top: yAt(i) - (i === 0 ? 10 : 8),
                left: xAt(i) - 16,
                color: i === 0 ? '#FFF' : c.textMuted,
                fontSize: i === 0 ? fontSizes.md : fontSizes.sm,
              },
            ]}
          >
            {currentLevel + i}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  landmarks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  landmark: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  landmarkText: { fontFamily: fonts.heading, fontSize: fontSizes.xs },
  nodeLabelWrap: { position: 'absolute', maxWidth: '55%', gap: 1 },
  nodeTitle: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  nodePerk: { fontFamily: fonts.body, fontSize: fontSizes.xs },
  youChip: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1 },
  nodeNum: {
    position: 'absolute',
    width: 32,
    textAlign: 'center',
    fontFamily: fonts.heading,
  },
});
