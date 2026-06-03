import { render, screen, fireEvent } from '@testing-library/react-native';
import { GoalCard } from '@/components/modules/goals/GoalCard';

describe('GoalCard', () => {
  it('renders title, status and rounded progress', () => {
    render(<GoalCard title="Run a marathon" level="Milestone" status="On track" progress={42.6} />);
    expect(screen.getByText('Run a marathon')).toBeTruthy();
    expect(screen.getByText('On track')).toBeTruthy();
    expect(screen.getByText('43% complete')).toBeTruthy();
  });

  it('shows the goal-type label for a known type', () => {
    render(<GoalCard title="Save more" level="Goal" status="Active" progress={0} goalType="finance" />);
    expect(screen.getByText('FINANCE')).toBeTruthy();
  });

  it('hides the comment badge when commentCount is 0 (default)', () => {
    render(<GoalCard title="No comments" level="Goal" status="Active" progress={10} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('renders the comment count badge when commentCount > 0', () => {
    render(<GoalCard title="Talked about" level="Goal" status="Active" progress={10} commentCount={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<GoalCard title="Tap me" level="Goal" status="Active" progress={50} onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without an onPress handler (static card)', () => {
    render(<GoalCard title="Static" level="Goal" status="Done" progress={100} />);
    expect(screen.getByText('Static')).toBeTruthy();
    expect(screen.getByText('100% complete')).toBeTruthy();
  });
});
