import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title and caption', () => {
    render(<EmptyState icon="flag-outline" title="No goals yet" caption="Tap + to add your first goal" />);
    expect(screen.getByText('No goals yet')).toBeTruthy();
    expect(screen.getByText('Tap + to add your first goal')).toBeTruthy();
  });

  it('omits the caption and CTA when not provided', () => {
    render(<EmptyState icon="flag-outline" title="Empty" />);
    expect(screen.getByText('Empty')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders and fires the CTA', () => {
    const onPress = jest.fn();
    render(<EmptyState icon="flag-outline" title="Empty" cta={{ label: 'Add goal', onPress }} />);
    fireEvent.press(screen.getByText('Add goal'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
