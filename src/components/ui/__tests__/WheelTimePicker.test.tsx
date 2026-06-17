import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { WheelTimePicker } from '@/components/ui/WheelTimePicker';

const OPTIONS = ['07:00', '07:30', '08:00', '08:30', '09:00'];

describe('WheelTimePicker', () => {
  it('renders the selected value', () => {
    const { getAllByText } = render(
      <WheelTimePicker label="Wake time" options={OPTIONS} selected="08:00" onSelect={() => {}} />,
    );
    // The wheel renders every option row; the selected one must be among them.
    expect(getAllByText('08:00').length).toBeGreaterThan(0);
  });

  it('keeps the centre selection frame transparent so it never hides the value', () => {
    // Regression guard: the frame overlays the scroll content (last child), so an
    // opaque fill there paints over the centred wake/sleep time and hides it.
    const { getByTestId } = render(
      <WheelTimePicker label="Wake time" options={OPTIONS} selected="08:00" onSelect={() => {}} />,
    );
    const frame = getByTestId('wheel-center-frame');
    const flat = StyleSheet.flatten(frame.props.style) as { backgroundColor?: string };
    expect(flat.backgroundColor ?? 'transparent').toBe('transparent');
  });
});
