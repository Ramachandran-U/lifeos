import { render, screen, waitFor } from '@testing-library/react-native';

// Stores persist via AsyncStorage under jest-expo; give it an in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Deterministic decompose — return a minimal valid hierarchy with no real AI call.
const mockDecompose = jest.fn();
jest.mock('@/ai/functions', () => ({
  decomposeGoal: (...a: unknown[]) => mockDecompose(...a),
}));

// Store + persistence boundaries (the hint path never reaches a real save).
jest.mock('@/store/useUserStore', () => ({
  useUserStore: () => ({ userId: 'user_fake_1', name: 'Sam' }),
}));
const mockLoadGoals = jest.fn();
jest.mock('@/store/useGoalStore', () => ({
  useGoalStore: (sel: (s: { loadGoals: () => void }) => unknown) => sel({ loadGoals: mockLoadGoals }),
}));
jest.mock('@/db/queries/goals', () => ({ createGoal: jest.fn() }));
jest.mock('@/utils/persistHierarchy', () => ({ persistHierarchy: jest.fn() }));

import { AddGoalSheet } from '@/components/modules/goals/AddGoalSheet';
import type { GoalHierarchy } from '@/ai/types';

const HIERARCHY: GoalHierarchy = {
  primaryGoal: { title: 'Learn to paint', type: 'personal' },
  yearly: { title: 'Hold a small exhibition', milestone: 'Show 10 pieces' },
  monthly: [
    { month: 1, title: 'Master fundamentals', milestone: 'Daily sketching' },
    { month: 2, title: 'Colour theory', milestone: 'Two studies a week' },
  ],
  weekly: [{ week: 1, focus: 'Sketch daily', tasks: ['Warm-up', 'Study'] }],
  dailyTaskExamples: ['Sketch for 20 minutes'],
};

const HINT = /Drafted from your voice request/i;

describe('AddGoalSheet — voice-draft Save hint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecompose.mockResolvedValue(HIERARCHY);
  });

  it('shows the "review and tap Save" hint when opened from voice (initialVision + autoDecompose)', async () => {
    render(
      <AddGoalSheet visible initialVision="I want to become a painter" autoDecompose onClose={() => {}} />,
    );
    // autoDecompose runs the break-it-down step; the editable plan + Save appear.
    await waitFor(() => expect(screen.getByText('Save goal')).toBeTruthy());
    // The voice draft is NOT saved until the user taps Save — the hint says so.
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('does not show the voice hint on the normal FAB path (no initialVision)', () => {
    render(<AddGoalSheet visible onClose={() => {}} />);
    // No spoken vision → no auto-decompose, and the hint must never appear.
    expect(screen.queryByText(HINT)).toBeNull();
    expect(screen.getByText('Break it down')).toBeTruthy();
  });
});
