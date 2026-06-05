import { render, screen, fireEvent } from '@testing-library/react-native';
import { RabbitHoleForkButton } from '@/components/modules/polymath/RabbitHoleForkButton';

describe('RabbitHoleForkButton', () => {
  it('renders the deeper label + "not yet opened" cost for a ghost fork', () => {
    render(<RabbitHoleForkButton direction="deeper" hint="the underlying invariant" state="ghost" onPress={() => {}} />);
    expect(screen.getByText('GO DEEPER')).toBeTruthy();
    expect(screen.getByText('the underlying invariant')).toBeTruthy();
    expect(screen.getByText('● not yet opened')).toBeTruthy();
  });

  it('renders the sideways label + "already explored" cost for a realized fork', () => {
    render(<RabbitHoleForkButton direction="sideways" hint="a third medium" state="realized" onPress={() => {}} />);
    expect(screen.getByText('BRANCH SIDEWAYS')).toBeTruthy();
    expect(screen.getByText('✓ already explored')).toBeTruthy();
  });

  it('fires onPress when enabled and not when disabled', () => {
    const onPress = jest.fn();
    const { rerender } = render(<RabbitHoleForkButton direction="deeper" hint="h" state="ghost" onPress={onPress} />);
    fireEvent.press(screen.getByText('GO DEEPER'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<RabbitHoleForkButton direction="deeper" hint="h" state="ghost" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('GO DEEPER'));
    expect(onPress).toHaveBeenCalledTimes(1); // still 1 — disabled press is a no-op
  });
});
