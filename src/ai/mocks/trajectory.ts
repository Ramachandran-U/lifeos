import type { TrajectoryAssessment, TrajectoryAssessmentInput } from '../types';

export function buildMockTrajectoryAssessment(
  input: TrajectoryAssessmentInput,
): TrajectoryAssessment {
  const gap = input.actualProgressPct - input.expectedProgressPct;
  const recalibration: string[] = [];

  if (input.status === 'behind') {
    const verdict = `You're ${Math.abs(gap)} points behind pace on "${input.visionTitle}" — recoverable, but this quarter matters.`;
    if (input.laggingTitles[0]) recalibration.push(`Finish "${input.laggingTitles[0]}" before starting anything new.`);
    if (input.laggingTitles[1]) recalibration.push(`Schedule weekly time for "${input.laggingTitles[1]}".`);
    recalibration.push('Cut one low-priority goal so the vision gets your focus.');
    return { verdict, recalibration: recalibration.slice(0, 3) };
  }

  if (input.status === 'ahead') {
    return {
      verdict: `You're ${gap} points ahead on "${input.visionTitle}" — ${input.completedSubGoals}/${input.totalSubGoals} milestones done early.`,
      recalibration: [
        'Raise the bar: add a stretch milestone for next quarter.',
        input.laggingTitles[0]
          ? `Keep momentum on "${input.laggingTitles[0]}".`
          : 'Start the next phase of your vision now.',
      ],
    };
  }

  return {
    verdict: `You're on track for "${input.visionTitle}" — ${input.actualProgressPct}% done at ${input.expectedProgressPct}% expected.`,
    recalibration: [
      input.laggingTitles[0]
        ? `Make "${input.laggingTitles[0]}" your single focus this quarter.`
        : 'Pick one milestone to push hardest this quarter.',
    ],
  };
}
