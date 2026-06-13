import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// track() (via @/utils/telemetry → useTelemetryStore) pulls in AsyncStorage,
// which is unlinked under jest-expo. Use the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-router has no router outside a navigation tree under jest; stub it so we
// can assert the "Open my plan" CTA navigates without a real router.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

// The detector + its data sources live in @/cognition + @/db/queries. Mock all
// the read boundaries so the card's render branches are driven purely by what
// detectOvercommitment returns — no real storage, no real cognition math.
const mockDetect = jest.fn();
jest.mock('@/cognition/overcommitment', () => ({
  detectOvercommitment: (...args: unknown[]) => mockDetect(...args),
}));

const mockRecordInsight = jest.fn((..._args: unknown[]) => 'insight_fake_1');
const mockUpdateInsightStatus = jest.fn();
jest.mock('@/db/queries/cognitiveInsights', () => ({
  recordInsight: (...args: unknown[]) => mockRecordInsight(...args),
  updateInsightStatus: (...args: unknown[]) => mockUpdateInsightStatus(...args),
  isInsightCooldownOk: () => true,
}));

jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksByDate: () => [],
  getRoutineBlocksInRange: () => [],
}));
jest.mock('@/db/queries/behaviour', () => ({
  getEventsLastNDays: () => [],
}));
jest.mock('@/db/queries/health', () => ({
  getLatestSleepHours: () => null,
}));
jest.mock('@/db/queries/users', () => ({
  getUser: () => ({ sleepTargetHours: 8 }),
}));

import { OvercommitmentCard } from '@/components/shared/OvercommitmentCard';
import { setFlagOverride, resetFlagOverrides } from '@/config/flags';

const candidate = {
  severity: 75,
  reasons: ['Three high-energy blocks back to back', 'Sleep is below target'],
  plannedMinutes: 540,
  baselineMinutes: 300,
  loadRatio: 1.8,
};

describe('OvercommitmentCard', () => {
  beforeEach(() => {
    mockDetect.mockReturnValue(candidate);
    setFlagOverride({ overcommitmentDetector: true, overcommitmentVisible: true });
  });

  afterEach(() => {
    resetFlagOverrides();
    jest.clearAllMocks();
  });

  it('renders nothing while the overcommitmentVisible flag is off', () => {
    setFlagOverride({ overcommitmentVisible: false });
    const { toJSON } = render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the detector finds nothing', () => {
    mockDetect.mockReturnValue(null);
    const { toJSON } = render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the candidate is below the severity threshold', () => {
    mockDetect.mockReturnValue({ ...candidate, severity: 10 });
    const { toJSON } = render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    expect(toJSON()).toBeNull();
  });

  it('renders the heavy-day card with planned-vs-baseline minutes and reasons', async () => {
    render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    await waitFor(() => {
      expect(screen.getByText('Tomorrow looks heavy')).toBeTruthy();
    });
    expect(screen.getByText('540 min')).toBeTruthy();
    expect(screen.getByText('300 min')).toBeTruthy();
    expect(screen.getByText('Three high-energy blocks back to back')).toBeTruthy();
  });

  it('uses the softer headline below the high-severity band', async () => {
    mockDetect.mockReturnValue({ ...candidate, severity: 40 });
    render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    await waitFor(() => {
      expect(screen.getByText('Plan trending heavy')).toBeTruthy();
    });
  });

  it('records the insight when shown', async () => {
    render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    await waitFor(() => {
      expect(mockRecordInsight).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to /edit-priorities and accepts the insight on "Open my plan"', async () => {
    render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    await waitFor(() => screen.getByText('Open my plan'));
    fireEvent.press(screen.getByText('Open my plan'));
    expect(mockUpdateInsightStatus).toHaveBeenCalledWith('insight_fake_1', 'accepted');
    expect(mockPush).toHaveBeenCalledWith('/edit-priorities');
  });

  it('dismisses (and hides) the card on "Not now"', async () => {
    render(<OvercommitmentCard userId="user_fake_1" date="2026-06-05" />);
    await waitFor(() => screen.getByText('Not now'));
    fireEvent.press(screen.getByText('Not now'));
    expect(mockUpdateInsightStatus).toHaveBeenCalledWith('insight_fake_1', 'dismissed');
    expect(screen.queryByText('Tomorrow looks heavy')).toBeNull();
  });
});
