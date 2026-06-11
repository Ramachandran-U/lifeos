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

  it('renders the trustNote above the CTA when provided (Ink + Signal §3.0.4)', () => {
    render(
      <EmptyState
        icon="mail-outline"
        title="Connect your inbox"
        trustNote="Only transaction emails are scanned — nothing is uploaded."
        cta={{ label: 'Connect Gmail', onPress: jest.fn() }}
      />,
    );
    expect(
      screen.getByText('Only transaction emails are scanned — nothing is uploaded.'),
    ).toBeTruthy();
    expect(screen.getByText('Connect Gmail')).toBeTruthy();
  });

  it('omits the trustNote row when not provided', () => {
    render(<EmptyState icon="mail-outline" title="Connect your inbox" />);
    expect(screen.queryByText(/scanned/)).toBeNull();
  });
});
