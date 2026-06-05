import { render, screen, fireEvent } from '@testing-library/react-native';
import { RabbitHoleExitSummary } from '@/components/modules/polymath/RabbitHoleExitSummary';

describe('RabbitHoleExitSummary', () => {
  it('renders the shape recap', () => {
    render(<RabbitHoleExitSummary depth={5} branches={2} synapses={1} xp={100} onDone={() => {}} />);
    expect(screen.getByText('depth 5 · 2 branches · 1 🔗')).toBeTruthy();
  });

  it('passes null on Done and the trimmed name on "Name & keep"', () => {
    const onDone = jest.fn();
    render(<RabbitHoleExitSummary depth={3} branches={1} synapses={0} xp={25} onDone={onDone} />);
    fireEvent.press(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalledWith(null);

    fireEvent.changeText(screen.getByLabelText('Name this map'), '  Flocking deep-dive  ');
    fireEvent.press(screen.getByText('Name & keep'));
    expect(onDone).toHaveBeenCalledWith('Flocking deep-dive');
  });
});
