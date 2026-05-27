import { useTrajectoryStore } from '../useTrajectoryStore';
import { quarterKey } from '@/utils/trajectory';

beforeEach(() => useTrajectoryStore.setState({ lastReviewedQuarter: null }));

describe('useTrajectoryStore', () => {
  it('needs review when nothing has been acknowledged', () => {
    expect(useTrajectoryStore.getState().needsReview()).toBe(true);
  });

  it('stops needing review after the current quarter is marked', () => {
    useTrajectoryStore.getState().markReviewed();
    expect(useTrajectoryStore.getState().lastReviewedQuarter).toBe(quarterKey());
    expect(useTrajectoryStore.getState().needsReview()).toBe(false);
  });

  it('needs review again once a stale (prior) quarter is stored', () => {
    useTrajectoryStore.getState().markReviewed('2000-Q1');
    expect(useTrajectoryStore.getState().needsReview()).toBe(true);
  });
});
