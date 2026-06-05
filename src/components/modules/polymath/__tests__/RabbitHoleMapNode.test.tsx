import { render, screen, fireEvent } from '@testing-library/react-native';
import { RabbitHoleMapNode } from '@/components/modules/polymath/RabbitHoleMapNode';

const pos = { x: 0, y: 0, width: 132, height: 64 };

describe('RabbitHoleMapNode', () => {
  it('renders a real node title and fires onPress', () => {
    const onPress = jest.fn();
    render(<RabbitHoleMapNode title="Local rules" kind="cursor" arrivedVia="deeper" {...pos} onPress={onPress} />);
    fireEvent.press(screen.getByText('Local rules'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders a ghost tile as a faint placeholder (no title)', () => {
    render(<RabbitHoleMapNode title="" kind="ghost" accessibilityLabel="Open the deeper fork" {...pos} onPress={() => {}} />);
    expect(screen.getByText('⊕')).toBeTruthy();
    expect(screen.getByLabelText('Open the deeper fork')).toBeTruthy();
  });
});
