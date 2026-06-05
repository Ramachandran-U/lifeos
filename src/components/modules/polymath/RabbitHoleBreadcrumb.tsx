import { View, Pressable, StyleSheet } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fontSizes } from '@/theme/typography';
import { Body, Label } from '@/components/ui/Typography';

export interface BreadcrumbItem {
  id: string;
  title: string;
}

interface Props {
  /** Root → current node, inclusive. */
  trail: BreadcrumbItem[];
  onJump?: (id: string) => void;
}

/** The path from root to the current node — a screen-reader-friendly way to see
 * where you've been and jump back to any visited node. */
export function RabbitHoleBreadcrumb({ trail, onJump }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  if (trail.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Label color={c.textMuted}>YOUR PATH</Label>
      {trail.map((item, i) => {
        const here = i === trail.length - 1;
        return (
          <Pressable
            key={item.id}
            onPress={() => onJump?.(item.id)}
            accessibilityRole="button"
            accessibilityLabel={here ? `${item.title} (you are here)` : `Jump to ${item.title}`}
          >
            <Body style={[styles.item, { color: here ? c.polymath : c.textSecondary }]} numberOfLines={1}>
              {i + 1}. {item.title}
            </Body>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (_c: AppColors) => StyleSheet.create({
  wrap: { gap: 4, paddingVertical: spacing.sm },
  item: { fontSize: fontSizes.sm },
});
