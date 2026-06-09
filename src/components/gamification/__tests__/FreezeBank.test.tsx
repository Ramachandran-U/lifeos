import { render, screen } from '@testing-library/react-native';
import { FreezeBank } from '@/components/gamification/FreezeBank';
import { FREEZE_EARN_XP } from '@/gamification/streakEngine';

describe('FreezeBank', () => {
  it('renders the empty state with progress toward the first shield', () => {
    render(<FreezeBank freezes={0} progressXP={50} />);
    expect(screen.getByText('No streak shields banked')).toBeTruthy();
    expect(screen.getByText(new RegExp(`${FREEZE_EARN_XP - 50} XP until your next shield`))).toBeTruthy();
  });

  it('renders the banked count', () => {
    render(<FreezeBank freezes={1} progressXP={120} />);
    expect(screen.getByText('1 streak shield banked')).toBeTruthy();
  });

  it('renders the bank-full message at cap', () => {
    render(<FreezeBank freezes={2} progressXP={FREEZE_EARN_XP} />);
    expect(screen.getByText('2 streak shields banked')).toBeTruthy();
    expect(screen.getByText(/Bank full/)).toBeTruthy();
  });
});
