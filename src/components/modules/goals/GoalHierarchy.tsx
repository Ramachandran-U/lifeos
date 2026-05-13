import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface HierarchyNode {
  id: string;
  title: string;
  level: string;
  status: string;
  children: HierarchyNode[];
}

interface GoalHierarchyProps {
  tree: HierarchyNode;
  onToggleComplete?: (id: string, currentStatus: string) => void;
}

function HierarchyLevel({ node, depth, onToggleComplete }: {
  node: HierarchyNode;
  depth: number;
  onToggleComplete?: (id: string, currentStatus: string) => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isCompleted = node.status === 'completed';
  const completedChildren = node.children.filter((c) => c.status === 'completed').length;
  const progress = hasChildren ? (completedChildren / node.children.length) * 100 : (isCompleted ? 100 : 0);

  return (
    <View style={[styles.nodeContainer, { marginLeft: depth * 16 }]}>
      <Pressable
        style={styles.nodeRow}
        onPress={() => hasChildren ? setExpanded(!expanded) : onToggleComplete?.(node.id, node.status)}
      >
        {hasChildren ? (
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={c.textMuted}
          />
        ) : (
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={isCompleted ? c.success : c.textMuted}
          />
        )}
        <View style={styles.nodeContent}>
          <Body style={[styles.nodeTitle, isCompleted && styles.completedTitle]}>{node.title}</Body>
          {hasChildren && (
            <ProgressBar value={progress} color={c.goal} height={4} />
          )}
        </View>
        <Caption>{node.level}</Caption>
      </Pressable>

      {expanded && node.children.map((child) => (
        <HierarchyLevel
          key={child.id}
          node={child}
          depth={depth + 1}
          onToggleComplete={onToggleComplete}
        />
      ))}
    </View>
  );
}

export function GoalHierarchy({ tree, onToggleComplete }: GoalHierarchyProps) {
  const c = useColors();
  const styles = makeStyles(c);
  return <HierarchyLevel node={tree} depth={0} onToggleComplete={onToggleComplete} />;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  nodeContainer: {
    marginTop: spacing.xs,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  nodeContent: {
    flex: 1,
    gap: 4,
  },
  nodeTitle: {
    fontSize: fontSizes.sm,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
});
