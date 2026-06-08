import { render, screen } from '@testing-library/react-native';
import { XpChip } from '@/components/gamification/XpChip';

// The chip splits its text into prefix / animated-number / suffix nodes so the
// number can roll on change, so assert via the composed accessibility label.
describe('XpChip', () => {
  it('renders the amount with the default + prefix and XP suffix', () => {
    render(<XpChip amount={50} />);
    expect(screen.getByLabelText('+50 XP')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('honours a custom prefix', () => {
    render(<XpChip amount={120} prefix="" />);
    expect(screen.getByLabelText('120 XP')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
  });
});
