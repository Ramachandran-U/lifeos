import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Caption } from '@/components/ui/Typography';
import { projectConstellation, countSynapses, constellationStats, type ConstellationInput } from '@/explore/constellation';

interface Props {
  input: ConstellationInput;
}

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  interest: 'star',
  spark: 'flash',
  expedition: 'compass',
  concept: 'ellipse-outline',
};

/** §3.2 item 6: the constellation earns its slot by content — it renders only
 *  once the input carries at least this many nodes (interests + saved sparks +
 *  expeditions). Below the threshold the component is null: the W4 sweep
 *  (2026-06-12) deleted the empty-placeholder Card. */
export const CONSTELLATION_MIN_NODES = 3;

export function constellationInputNodeCount(input: ConstellationInput): number {
  return input.interests.length + input.sparks.length + input.expeditions.length;
}

// Ink + Signal §3.0.7: the YOUR CONSTELLATION caps eyebrow died in the W4
// Explore sweep (2026-06-12) — the screen renders the `Constellation`
// SectionTitle above this component; the nodes/synapses/depth stats stay here
// as the Caption line under that title.
export function ConstellationView({ input }: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  if (constellationInputNodeCount(input) < CONSTELLATION_MIN_NODES) return null;

  const constellation = projectConstellation(input);
  const synapses = countSynapses(constellation);
  const stats = constellationStats(input);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.statsRow}>
          <Caption style={{ color: c.textMuted }}>
            <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{constellation.nodes.length}</Caption> nodes
          </Caption>
          <Caption style={{ color: c.textMuted }}>
            <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{synapses}</Caption> synapses
          </Caption>
          <Caption style={{ color: c.textMuted }}>
            depth <Caption style={{ fontFamily: fonts.heading, color: c.polymathText }}>{stats.depth}</Caption> · breadth <Caption style={{ fontFamily: fonts.heading, color: c.polymathText }}>{stats.breadth}</Caption>
          </Caption>
        </View>
      </View>
      <View style={styles.grid}>
        {constellation.nodes.slice(0, 20).map((n) => {
          const icon = TYPE_ICON[n.type] ?? 'ellipse-outline';
          const opacity = 0.4 + Math.min(n.salience, 3) * 0.2;
          return (
            // Salience is encoded in the glyph's element opacity (data, like a
            // chart); the chrome stays neutral — no alpha-tinted hues.
            <View key={n.id} style={[styles.node, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
              <Ionicons name={icon} size={14} color={c.polymath} style={{ opacity }} />
              <Caption style={{ color: c.textPrimary, fontSize: 11 }} numberOfLines={1}>{n.label}</Caption>
            </View>
          );
        })}
        {constellation.nodes.length > 20 && (
          <Caption style={{ color: c.textMuted, paddingVertical: 4 }}>+{constellation.nodes.length - 20} more</Caption>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  section: { gap: spacing.sm },
  headerRow: { gap: spacing.xs },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  node: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
});
