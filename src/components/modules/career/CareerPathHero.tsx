import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Text } from '@/components/ui/Text';
import { Body, Caption } from '@/components/ui/Typography';
import { Button3D } from '@/components/ui/Button3D';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { SkillGapAnalysis } from '@/ai/types';
import type { SavedCareerPath } from '@/db/careerStorage';

interface CareerPathHeroProps {
  /** Roles backing state C (the loaded analysis). */
  currentRole: string;
  targetRole: string;
  /** State C when non-null. */
  analysis: SkillGapAnalysis | null;
  /** State B when non-null and no analysis is loaded. */
  latestSavedPath: SavedCareerPath | null;
  /** State A CTA — opens CareerSetupSheet. */
  onMapPath: () => void;
  /** State B primary — loads the saved path. */
  onResumePath: (path: SavedCareerPath) => void;
  /** State B quiet action — opens CareerSetupSheet fresh. */
  onStartNew: () => void;
}

// §3.3 state A sample route — curated static copy, no AI call, no PII. The
// four strings are byte-committed by AC4; do not re-word them.
const SAMPLE_ROUTE_CAPTION = 'Sample route · Senior Engineer → Staff Engineer · 12 wk';
const SAMPLE_ROUTE_ROWS = [
  'Wk 1 — Ship a system-design one-pager',
  'Wk 5 — Lead a cross-team design review',
  'Wk 12 — Case study: a measurable production win',
] as const;

// Real progress from the skill-gap analysis — moved verbatim from the legacy
// screen (CareerScreen.legacy.tsx renderResults): how far current levels are
// toward required levels, aggregated across gaps. Replaces a hardcoded 15%
// placeholder that showed every user the same fake number.
const LEVEL_VALUE: Record<string, number> = {
  none: 0,
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

/**
 * THE Career hero (Ink + Signal §3.3): value before form. Three states:
 *  - A (zero career data): the promise + a curated sample route + `Map my path`
 *  - B (saved paths exist, none loaded): the most recent saved path + resume
 *  - C (analysis loaded): the live path with real progress in display type
 *
 * Chrome: type on the screen background behind a 4px `c.career` left border
 * (structural color, R9) — no Card. Display numerals render in `c.careerText`
 * in BOTH themes (ratified amendment R4). No idle motion lives here — the
 * screen owns the one hero-budget entry.
 */
export function CareerPathHero({
  currentRole,
  targetRole,
  analysis,
  latestSavedPath,
  onMapPath,
  onResumePath,
  onStartNew,
}: CareerPathHeroProps) {
  const c = useColors();

  // ── State C — analysis loaded ─────────────────────────────────────────────
  if (analysis) {
    const gaps = analysis.gaps;
    const have = gaps.reduce((sum, g) => sum + (LEVEL_VALUE[g.currentLevel] ?? 0), 0);
    const need = gaps.reduce((sum, g) => sum + (LEVEL_VALUE[g.requiredLevel] ?? 100), 0);
    const pct = need > 0 ? Math.round((have / need) * 100) : 0;
    return (
      <View style={[styles.root, { borderLeftColor: c.career }]}>
        <Text variant="h1">{`${currentRole} → ${targetRole}`}</Text>
        <Text variant="display" numeric color={c.careerText}>
          {`${pct}%`}
        </Text>
        <ProgressBar value={pct} color={c.career} />
        <Caption style={{ color: c.textSecondary }}>
          {gaps.length > 0 ? `${pct}% of the way there` : 'Add your current skills to track progress'}
        </Caption>
      </View>
    );
  }

  // ── State B — saved paths exist, none loaded ──────────────────────────────
  if (latestSavedPath) {
    const path = latestSavedPath;
    const handleStartNew = () => {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      onStartNew();
    };
    return (
      <View style={[styles.root, { borderLeftColor: c.career }]}>
        <Text variant="h1">{`${path.currentRole} → ${path.targetRole}`}</Text>
        <Caption style={{ color: c.textSecondary }}>
          {`Saved ${new Date(path.savedAt).toLocaleDateString()} · ${path.timelineMonths / 12} yr`}
        </Caption>
        <Button3D
          title="Resume this path"
          tone="career"
          fullWidth
          onPress={() => onResumePath(path)}
          style={styles.cta}
        />
        <Pressable
          onPress={handleStartNew}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Start a new one"
          style={styles.textAction}
        >
          <Body style={[styles.textActionLabel, { color: c.career }]}>Start a new one</Body>
        </Pressable>
      </View>
    );
  }

  // ── State A — zero career data ─────────────────────────────────────────────
  return (
    <View style={[styles.root, { borderLeftColor: c.career }]}>
      <Text variant="h1">Your next role has a route.</Text>
      <Text variant="body" color={c.textSecondary}>
        Name the destination. LifeOS maps the skill gaps, the learning path, and the weekly
        artifacts that get you there.
      </Text>
      <View style={styles.sampleBlock}>
        <Caption style={{ color: c.textMuted }}>{SAMPLE_ROUTE_CAPTION}</Caption>
        {SAMPLE_ROUTE_ROWS.map((row) => (
          <View key={row} style={[styles.sampleRow, { borderLeftColor: c.career }]}>
            <Body style={{ color: c.textPrimary }}>{row}</Body>
          </View>
        ))}
      </View>
      <Button3D title="Map my path" tone="career" fullWidth onPress={onMapPath} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  sampleBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sampleRow: {
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    paddingVertical: 2,
  },
  cta: {
    marginTop: spacing.sm,
  },
  textAction: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  textActionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
});
