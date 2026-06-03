import { render, screen } from '@testing-library/react-native';
import { XpChip } from '@/components/gamification/XpChip';

describe('XpChip', () => {
  it('renders the amount with the default + prefix and XP suffix', () => {
    render(<XpChip amount={50} />);
    expect(screen.getByText('+50 XP')).toBeTruthy();
  });

  it('honours a custom prefix', () => {
    render(<XpChip amount={120} prefix="" />);
    expect(screen.getByText('120 XP')).toBeTruthy();
  });
});
