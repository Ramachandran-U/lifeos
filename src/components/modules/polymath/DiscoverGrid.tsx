import { useMemo } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';

export interface DiscoverArea {
  name: string;
  category: 'arts' | 'science' | 'tech' | 'sports' | 'music' | 'writing' | 'language' | 'philosophy' | 'other';
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  blurb: string;
  /** Set when the area was returned by the AI personalisation pass. */
  whyThisFits?: string;
}

export const FALLBACK_AREAS: DiscoverArea[] = [
  { name: 'Astronomy',        category: 'science',    icon: 'planet',        tint: '#7FB8FF', blurb: 'Stars, galaxies, cosmology' },
  { name: 'Jazz piano',       category: 'music',      icon: 'musical-notes', tint: '#FF99C5', blurb: 'Improvisation & theory' },
  { name: 'Photography',      category: 'arts',       icon: 'camera',        tint: '#FFD66B', blurb: 'Composition & light' },
  { name: 'Stoicism',         category: 'philosophy', icon: 'leaf',          tint: '#7EE0B8', blurb: 'Practical ancient wisdom' },
  { name: 'Climbing',         category: 'sports',     icon: 'trail-sign',    tint: '#FF8C3C', blurb: 'Bouldering & route reading' },
  { name: 'Creative writing', category: 'writing',    icon: 'create',        tint: '#C9A0FF', blurb: 'Short stories & essays' },
  { name: 'Spanish',          category: 'language',   icon: 'chatbubbles',   tint: '#F4C16A', blurb: 'Speak in 3 months' },
  { name: 'AI & ML',          category: 'tech',       icon: 'sparkles',      tint: '#A584FF', blurb: 'Models, agents, evals' },
  { name: 'Drawing',          category: 'arts',       icon: 'brush',         tint: '#FF99C5', blurb: 'Daily sketch habit' },
  { name: 'Chess',            category: 'other',      icon: 'apps',          tint: '#C5B3FF', blurb: 'Tactics & endgames' },
  { name: 'Cooking',          category: 'other',      icon: 'restaurant',    tint: '#FFC23A', blurb: 'World cuisines' },
  { name: 'Meditation',       category: 'philosophy', icon: 'flower',        tint: '#7EE0B8', blurb: 'Daily mindfulness' },
];

interface Props {
  onPick: (area: DiscoverArea) => void;
  /** Override the default static list — used to render AI-personalised suggestions. */
  areas?: DiscoverArea[];
}

const SCREEN_W = Dimensions.get('window').width;

export function DiscoverGrid({ onPick, areas }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handlePress = (area: DiscoverArea) => {
    Haptics.selectionAsync();
    onPick(area);
  };

  const source = areas && areas.length > 0 ? areas : FALLBACK_AREAS;

  // Instagram-style: 3-col grid, one 2x2 feature tile per 8 tiles.
  // Feature index alternates left/right within each block of 8.
  const tiles = source.map((area, idx) => {
    const block = Math.floor(idx / 8);
    const posInBlock = idx % 8;
    const featurePos = block % 2 === 0 ? 2 : 0; // col index for feature in this block
    const isFeature = posInBlock === featurePos;
    return { area, isFeature };
  });

  // Grid math: 3 columns, gutters between.
  const horizontalPadding = spacing.xl * 2;
  const gutter = spacing.xs;
  const cellSize = Math.floor((SCREEN_W - horizontalPadding - gutter * 2) / 3);
  const featureSize = cellSize * 2 + gutter;

  return (
    <View style={styles.grid}>
      {tiles.map(({ area, isFeature }, i) => (
        <Animated.View
          key={area.name}
          entering={FadeIn.delay(i * 30).duration(300)}
          style={isFeature ? { width: featureSize, height: featureSize } : { width: cellSize, height: cellSize }}
        >
          <Pressable
            onPress={() => handlePress(area)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: hexWithAlpha(area.tint, 0.14), borderColor: hexWithAlpha(area.tint, 0.35) },
              pressed && styles.tilePressed,
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: hexWithAlpha(area.tint, 0.22) }]}>
              <Ionicons name={area.icon} size={isFeature ? 32 : 20} color={area.tint} />
            </View>
            <View style={styles.tileText}>
              <Body style={[styles.tileTitle, isFeature && styles.tileTitleLarge]} numberOfLines={2}>
                {area.name}
              </Body>
              {isFeature && <Caption style={styles.tileBlurb} numberOfLines={2}>{area.blurb}</Caption>}
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tilePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    gap: 2,
  },
  tileTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
  },
  tileTitleLarge: {
    fontSize: 18,
    lineHeight: 22,
  },
  tileBlurb: {
    color: colors.textSecondary,
  },
});
