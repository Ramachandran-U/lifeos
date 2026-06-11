import { StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body } from '@/components/ui/Typography';

interface WeekStatLineProps {
  totalMinutesWeek: number;
  interestCount: number;
}

/**
 * Ink + Signal §3.2 item 4: the week stat is a single LINE, not a Card — and
 * per §3.0.5 zero-suppression (ratified amendment R5) it renders NOTHING at
 * zero: no `THIS WEEK` label, no `0 min`, no StarterLine. The legacy tree
 * keeps its W3 cold-start Card untouched. Enforced here so the AC8 unit test
 * binds to the component, not the screen.
 */
export function WeekStatLine({ totalMinutesWeek, interestCount }: WeekStatLineProps) {
  const c = useColors();

  if (totalMinutesWeek <= 0) return null;

  return (
    <Body style={[styles.line, { color: c.textSecondary }]}>
      {`This week: ${totalMinutesWeek} min across ${interestCount} interests`}
    </Body>
  );
}

const styles = StyleSheet.create({
  line: {
    paddingVertical: spacing.xs,
    ...TABULAR_NUMS,
  },
});
