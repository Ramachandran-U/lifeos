import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUserStore } from '@/store/useUserStore';
import { getSparkByDate } from '@/db/queries/sparks';
import { format } from 'date-fns';
import { RabbitHoleScreen } from '@/components/modules/polymath/RabbitHoleScreen';
import type { RabbitHoleSeed } from '@/explore/rabbitHoleActions';

/**
 * Rabbit-hole route — renders the persistent, branchable decision-tree map.
 * Seed: inline "chasing now" / frontier thread via params takes precedence;
 * falls back to today's daily spark.
 */
export default function RabbitHoleRoute() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const { sparkId, seedTitle, seedBody, seedInterest, seedAdjacent, treeId } = useLocalSearchParams<{
    sparkId?: string;
    seedTitle?: string;
    seedBody?: string;
    seedInterest?: string;
    seedAdjacent?: string;
    treeId?: string;
  }>();

  const today = format(new Date(), 'yyyy-MM-dd');

  const seed = useMemo<RabbitHoleSeed | null>(() => {
    if (seedTitle) {
      return {
        sparkId: sparkId ?? `inline-${seedTitle}`,
        title: seedTitle,
        body: seedBody ?? '',
        threadStarter: seedTitle,
        seedInterest: seedInterest ?? '',
        adjacentField: seedAdjacent ?? '',
      };
    }
    const spark = userId ? getSparkByDate(userId, today) : undefined;
    return spark
      ? {
          sparkId: spark.id,
          title: spark.title,
          body: spark.body,
          threadStarter: spark.threadStarter,
          seedInterest: spark.seedInterest,
          adjacentField: spark.adjacentField,
        }
      : null;
  }, [seedTitle, seedBody, seedInterest, seedAdjacent, sparkId, userId, today]);

  return <RabbitHoleScreen seed={seed} treeId={treeId ?? undefined} onExit={() => router.back()} />;
}
