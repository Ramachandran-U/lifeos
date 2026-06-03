import { render, screen, fireEvent } from '@testing-library/react-native';
import { InterestCard } from '@/components/modules/polymath/InterestCard';
import type { Interest } from '@/db/queries/interests';

// InterestCard is a presentational leaf: it takes an Interest plus a fistful of
// callbacks and renders progress via the pure progressRatio() helper. The only
// import worth driving is the Interest shape, so we mint a fake one and assert
// the render branches (depth label, protect toggle copy, progress copy) and
// that each affordance fires its callback. progressRatio is exercised for real.

function makeInterest(overrides: Partial<Interest> = {}): Interest {
  return {
    id: 'interest_fake_1',
    userId: 'user_fake_1',
    name: 'Watercolour basics',
    category: 'arts',
    weeklyMinutesTarget: 120,
    weeklyMinutesActual: 0,
    enjoymentLevel: 3,
    explorationDepth: 'taste',
    status: 'active',
    discoveredBy: 'user',
    timeProtected: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const noopProps = {
  onLog: () => {},
  onDelete: () => {},
  onEditDepth: () => {},
  onToggleProtect: () => {},
};

describe('InterestCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the interest name, category and progress copy', () => {
    render(<InterestCard interest={makeInterest()} weeklyActual={45} {...noopProps} />);
    expect(screen.getByText('Watercolour basics')).toBeTruthy();
    expect(screen.getByText('ARTS')).toBeTruthy();
    expect(screen.getByText('45 / 120 min this week')).toBeTruthy();
  });

  it('renders the friendly depth label for a known depth', () => {
    render(<InterestCard interest={makeInterest({ explorationDepth: 'deep_dive' })} weeklyActual={0} {...noopProps} />);
    expect(screen.getByText('Deep dive')).toBeTruthy();
  });

  it('falls back to the raw depth value when unknown', () => {
    render(<InterestCard interest={makeInterest({ explorationDepth: 'mystery' })} weeklyActual={0} {...noopProps} />);
    expect(screen.getByText('mystery')).toBeTruthy();
  });

  it('shows "Protect time" when time is not protected', () => {
    render(<InterestCard interest={makeInterest({ timeProtected: false })} weeklyActual={0} {...noopProps} />);
    expect(screen.getByText('Protect time')).toBeTruthy();
    expect(screen.queryByText('Protected')).toBeNull();
  });

  it('shows "Protected" when time is protected', () => {
    render(<InterestCard interest={makeInterest({ timeProtected: true })} weeklyActual={0} {...noopProps} />);
    expect(screen.getByText('Protected')).toBeTruthy();
  });

  it('calls onLog when the Log button is pressed', () => {
    const onLog = jest.fn();
    render(<InterestCard interest={makeInterest()} weeklyActual={0} {...noopProps} onLog={onLog} />);
    fireEvent.press(screen.getByText('Log'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('calls onEditDepth when the depth pill is pressed', () => {
    const onEditDepth = jest.fn();
    render(<InterestCard interest={makeInterest()} weeklyActual={0} {...noopProps} onEditDepth={onEditDepth} />);
    fireEvent.press(screen.getByText('Taste'));
    expect(onEditDepth).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleProtect when the protect pill is pressed', () => {
    const onToggleProtect = jest.fn();
    render(<InterestCard interest={makeInterest()} weeklyActual={0} {...noopProps} onToggleProtect={onToggleProtect} />);
    fireEvent.press(screen.getByText('Protect time'));
    expect(onToggleProtect).toHaveBeenCalledTimes(1);
  });
});
