import { render, screen } from '@testing-library/react-native';
import { FreezeBank } from '@/components/gamification/FreezeBank';
import { FREEZE_EARN_XP } from '@/gamification/streakEngine';
import { STARTER_COPY } from '@/constants/starterCopy';
import { darkColors } from '@/theme/colors';
import { StyleSheet } from 'react-native';

describe('FreezeBank', () => {
  it('renders the zero state as a forming shield, never a "No …" deficit (§3.5)', () => {
    render(<FreezeBank freezes={0} progressXP={50} />);
    expect(screen.getByText(STARTER_COPY.freezeForming)).toBeTruthy();
    const sub = screen.getByText(
      new RegExp(`${FREEZE_EARN_XP - 50} ${STARTER_COPY.freezeFormingSub.slice(0, 8)}`),
    );
    expect(sub).toBeTruthy();
    // The starter sub-line is promoted from textMuted to textSecondary.
    const flat = StyleSheet.flatten(sub.props.style) as { color?: string };
    expect(flat.color).toBe(darkColors.textSecondary);
    expect(screen.queryByText('No streak shields banked')).toBeNull();
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
