import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
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

export function ConstellationView({ input }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const constellation = projectConstellation(input);
  const synapses = countSynapses(constellation);
  const stats = constellationStats(input);

  if (constellation.nodes.length === 0) {
    return (
      <Card style={styles.empty}>
        <Ionicons name="telescope-outline" size={32} color={c.textMuted} />
        <Body style={{ color: c.textMuted, textAlign: 'center' }}>
          Save sparks and complete expeditions to grow your constellation.
        </Body>
      </Card>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Label color={c.polymath} style={styles.sectionLabel}>YOUR CONSTELLATION</Label>
        <View style={styles.statsRow}>
          <Caption style={{ color: c.textMuted }}>
            <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{constellation.nodes.length}</Caption> nodes
          </Caption>
          <Caption style={{ color: c.textMuted }}>
            <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{synapses}</Caption> synapses
          </Caption>
          <Caption style={{ color: c.textMuted }}>
            depth <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{stats.depth}</Caption> · breadth <Caption style={{ fontFamily: fonts.heading, color: c.polymath }}>{stats.breadth}</Caption>
          </Caption>
        </View>
      </View>
      <View style={styles.grid}>
        {constellation.nodes.slice(0, 20).map((n) => {
          const icon = TYPE_ICON[n.type] ?? 'ellipse-outline';
          const opacity = 0.4 + Math.min(n.salience, 3) * 0.2;
          return (
            <View key={n.id} style={[styles.node, { borderColor: c.polymath + Math.round(opacity * 255).toString(16).padStart(2, '0'), backgroundColor: c.polymath + '11' }]}>
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
  sectionLabel: { letterSpacing: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  node: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
});
