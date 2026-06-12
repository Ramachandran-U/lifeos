import { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { fonts, fontSizes } from '@/theme/typography';
import { Caption, Heading, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Button3D } from '@/components/ui/Button3D';

interface Props {
  depth: number;
  branches: number;
  synapses: number;
  xp: number;
  onDone: (name: string | null) => void;
}

/** A recap on exit. XP is already banked (scored as the shape formed), so both
 * buttons just leave — naming is optional and pays nothing. */
export function RabbitHoleExitSummary({ depth, branches, synapses, xp, onDone }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [name, setName] = useState('');
  return (
    <Card style={styles.card}>
      <Label color={c.polymath}>✦ THIS RABBIT HOLE</Label>
      <Heading style={styles.stat}>
        depth {depth} · {branches} {branches === 1 ? 'branch' : 'branches'} · {synapses} 🔗
      </Heading>
      <Caption style={{ color: c.textMuted }}>+{xp} XP, banked as you explored</Caption>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name this map (optional)"
        placeholderTextColor={c.textMuted}
        style={styles.input}
        accessibilityLabel="Name this map"
      />
      <View style={styles.row}>
        <Button title="Name & keep" variant="secondary" onPress={() => onDone(name.trim() || null)} style={styles.btn} />
        <Button3D title="Done" tone="polymath" onPress={() => onDone(null)} style={styles.btn} />
      </View>
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  stat: { fontSize: fontSizes.lg, color: c.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: c.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1 },
});
