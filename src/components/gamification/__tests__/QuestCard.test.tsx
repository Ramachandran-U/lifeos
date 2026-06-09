import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuestCard } from '@/components/gamification/QuestCard';
import { MODULE_META, type Quest } from '@/constants/gamification';

const makeQuest = (overrides: Partial<Quest> = {}): Quest => ({
  id: 'q1',
  title: 'Log 3 meals today',
  module: 'health',
  xp: 30,
  progress: 1,
  total: 3,
  type: 'daily',
  ...overrides,
});

describe('QuestCard', () => {
  it('renders the title, module emoji, XP chip and progress fraction', () => {
    render(<QuestCard quest={makeQuest()} />);
    expect(screen.getByText('Log 3 meals today')).toBeTruthy();
    expect(screen.getByText(MODULE_META.health.emoji)).toBeTruthy();
    // XpChip splits its text into prefix/number/suffix nodes; assert via the
    // composed accessibility label it exposes.
    expect(screen.getByLabelText('+30 XP')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('shows the completion check when progress reaches total', () => {
    render(<QuestCard quest={makeQuest({ progress: 3, total: 3 })} />);
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('does not render the check while incomplete', () => {
    render(<QuestCard quest={makeQuest({ progress: 0, total: 5 })} />);
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<QuestCard quest={makeQuest()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Log 3 meals today'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // quests_v2 claim affordance
  it('renders a Claim pill (not the check) for a completed-unclaimed v2 quest', () => {
    const onClaim = jest.fn();
    render(
      <QuestCard
        quest={makeQuest({ progress: 3, total: 3, status: 'completed', metricKey: 'meals_logged' })}
        onClaim={onClaim}
      />,
    );
    const pill = screen.getByLabelText('Claim 30 XP for Log 3 meals today');
    expect(pill).toBeTruthy();
    expect(screen.queryByText('✓')).toBeNull();
    fireEvent.press(pill);
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('shows the check (no pill) once claimed', () => {
    render(
      <QuestCard
        quest={makeQuest({ progress: 3, total: 3, status: 'claimed', metricKey: 'meals_logged' })}
        onClaim={jest.fn()}
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.queryByLabelText(/Claim 30 XP/)).toBeNull();
  });

  it('never shows a Claim pill without an onClaim handler (legacy quests)', () => {
    render(<QuestCard quest={makeQuest({ progress: 3, total: 3 })} />);
    expect(screen.queryByLabelText(/Claim/)).toBeNull();
    expect(screen.getByText('✓')).toBeTruthy();
  });
});
