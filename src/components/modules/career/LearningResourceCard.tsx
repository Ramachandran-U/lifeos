import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Caption } from '@/components/ui/Typography';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  course: 'videocam',
  book: 'book',
  project: 'code-slash',
  person: 'people',
  practice: 'barbell',
};

interface LearningResourceCardProps {
  title: string;
  type: string;
  estimatedHours: number;
  status: string;
  progress?: number;
}

export function LearningResourceCard({ title, type, estimatedHours, status, progress = 0 }: LearningResourceCardProps) {
  const icon = TYPE_ICONS[type] ?? 'document';

  return (
    <Card moduleColor={colors.career} style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={icon} size={20} color={colors.career} />
        <View style={styles.content}>
          <Body style={styles.title}>{title}</Body>
          <View style={styles.meta}>
            <Caption>{estimatedHours}h estimated</Caption>
            <Badge label={status.replace('_', ' ')} variant={status === 'completed' ? 'health' : 'career'} />
          </View>
          {status === 'in_progress' && (
            <ProgressBar value={progress} color={colors.career} height={4} />
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bodyMedium,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
