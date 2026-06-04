import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// useTrajectoryStore persists through zustand's persist middleware, which pulls
// in AsyncStorage — unlinked under jest-expo. Use the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The trajectory MATH (computeTrajectory) is exhaustively unit-tested in the
// node suite (src/utils/__tests__/trajectory.test.ts), so here we mock it to
// drive each render branch deterministically: no_data → null, justStarted,
// and the ahead/behind pace verdict + review flow.
let mockTrajectory: ReturnType<typeof makeResult>;

jest.mock('@/utils/trajectory', () => ({
  computeTrajectory: () => mockTrajectory,
  quarterKey: () => '2026-Q2',
}));

// assessTrajectory is the only AI call the card makes. Mock it so the review
// CTA resolves to a deterministic assessment without hitting the proxy.
const mockAssess = jest.fn();
jest.mock('@/ai/functions', () => ({
  assessTrajectory: (...args: unknown[]) => mockAssess(...args),
}));

import { TrajectoryCard } from '@/components/modules/goals/TrajectoryCard';
import { useTrajectoryStore } from '@/store/useTrajectoryStore';
import type { TrajectoryResult, TrajectoryGoal } from '@/utils/trajectory';

function makeResult(overrides: Partial<TrajectoryResult> = {}): TrajectoryResult {
  return {
    horizonMonths: 36,
    horizonIsDefault: false,
    elapsedMonths: 12,
    elapsedFraction: 0.33,
    actualProgress: 0.2,
    expectedProgress: 0.33,
    deltaPct: -13,
    status: 'behind',
    justStarted: false,
    totalSubGoals: 6,
    completedSubGoals: 2,
    laggingTitles: ['Ship the prototype'],
    ...overrides,
  };
}

const lifeGoal: TrajectoryGoal = {
  id: 'goal_fake_vision',
  level: 'vision',
  status: 'active',
  title: 'Become a generalist polymath',
  timeline: '3 years',
  createdAt: '2025-06-01T00:00:00.000Z',
};

describe('TrajectoryCard', () => {
  beforeEach(() => {
    mockTrajectory = makeResult();
    mockAssess.mockReset();
    // Fresh quarter → needsReview() is true (lastReviewedQuarter starts null).
    useTrajectoryStore.setState({ lastReviewedQuarter: null });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when there is no usable goal tree (no_data)', () => {
    mockTrajectory = makeResult({ status: 'no_data' });
    const { toJSON } = render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the just-getting-started state in the opening window', () => {
    mockTrajectory = makeResult({ justStarted: true, totalSubGoals: 3, status: 'on_track' });
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);
    expect(screen.getByText('Just getting started')).toBeTruthy();
    expect(screen.getByText('3 milestones ahead')).toBeTruthy();
    // No pace verdict / review CTA in the opening window.
    expect(screen.queryByText('Behind pace')).toBeNull();
    expect(screen.queryByText('Recalibrate this quarter')).toBeNull();
  });

  it('renders the behind-pace verdict pill and the vision title', () => {
    mockTrajectory = makeResult({ status: 'behind' });
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);
    expect(screen.getByText('Become a generalist polymath')).toBeTruthy();
    expect(screen.getByText('Behind pace')).toBeTruthy();
    expect(screen.getByText('2/6 milestones · month 12 of 36')).toBeTruthy();
  });

  it('renders the ahead-of-pace verdict pill', () => {
    mockTrajectory = makeResult({ status: 'ahead', actualProgress: 0.5 });
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);
    expect(screen.getByText('Ahead of pace')).toBeTruthy();
  });

  it('shows the quarterly recalibrate CTA when a review is due', () => {
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);
    expect(screen.getByText('Recalibrate this quarter')).toBeTruthy();
    expect(screen.getByText('2026-Q2 check-in')).toBeTruthy();
  });

  it('runs assessTrajectory and renders the assessment when the CTA is pressed', async () => {
    mockAssess.mockResolvedValue({
      verdict: 'You are a touch behind but well within reach.',
      recalibration: ['Block 2 deep-work sessions this week'],
    });
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);

    fireEvent.press(screen.getByText('Recalibrate this quarter'));

    await waitFor(() => {
      expect(screen.getByText('You are a touch behind but well within reach.')).toBeTruthy();
    });
    expect(screen.getByText('Block 2 deep-work sessions this week')).toBeTruthy();
    expect(mockAssess).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error and a try-again CTA when assessTrajectory rejects', async () => {
    mockAssess.mockRejectedValue(new Error('Could not assess trajectory.'));
    render(<TrajectoryCard lifeGoal={lifeGoal} goals={[]} />);

    fireEvent.press(screen.getByText('Recalibrate this quarter'));

    await waitFor(() => {
      expect(screen.getByText('Could not assess trajectory.')).toBeTruthy();
    });
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
