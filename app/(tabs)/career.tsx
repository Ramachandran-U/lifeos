import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { SkillGapChart } from '@/components/modules/career/SkillGapChart';
import { LearningResourceCard } from '@/components/modules/career/LearningResourceCard';
import { useAI } from '@/hooks/useAI';
import { analyseSkillGap } from '@/ai/functions';
import type { SkillGapAnalysis } from '@/ai/types';

export default function CareerScreen() {
  const { call, loading } = useAI();
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);

  const handleRefresh = async () => {
    const result = await call(() =>
      analyseSkillGap({
        currentRole: 'Software Engineer',
        targetRole: 'Senior Product Manager',
        timelineMonths: 24,
        currentSkills: ['JavaScript', 'React', 'SQL'],
      })
    );
    if (result) setAnalysis(result);
  };

  useFocusEffect(
    useCallback(() => {
      if (!analysis) handleRefresh();
    }, [analysis])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Career" icon="briefcase" color={colors.career} />

        {loading && !analysis && (
          <View style={styles.loadingContainer}>
            <LoadingDots />
            <Body style={styles.loadingText}>Analysing your career path...</Body>
          </View>
        )}

        {analysis && (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card moduleColor={colors.career} style={styles.targetCard}>
                <Label color={colors.career}>YOUR PATH</Label>
                <Heading style={styles.pathTitle}>You → Senior Product Manager</Heading>
                <ProgressBar value={15} color={colors.career} />
                <Caption>15% of the way there</Caption>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Body style={styles.sectionTitle}>Skill Gaps</Body>
              <SkillGapChart gaps={analysis.gaps} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Body style={styles.sectionTitle}>Learning Path</Body>
              {analysis.resources.map((resource, i) => (
                <LearningResourceCard
                  key={i}
                  title={resource.title}
                  type={resource.type}
                  estimatedHours={resource.estimatedHours}
                  status="not_started"
                />
              ))}
            </Animated.View>

            <Button
              title="Refresh suggestions"
              variant="secondary"
              onPress={handleRefresh}
              style={styles.refreshButton}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  targetCard: {
    gap: spacing.sm,
  },
  pathTitle: {
    fontSize: fontSizes.xl,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  refreshButton: {
    marginTop: spacing.md,
  },
});
