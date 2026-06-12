import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button3D } from '@/components/ui/Button3D';

// Design-enhancements spike — the tactile 3D button. Mirrors Button's behaviour
// contract (press / disabled / loading) so the new primitive is held to the same
// bar. Visual depth (rim + translateY) is device-verified, not asserted here.

describe('Button3D', () => {
  it('renders its title', () => {
    render(<Button3D tone="primary" title="Start" onPress={() => {}} />);
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button3D tone="primary" title="Go" onPress={onPress} />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button3D tone="primary" title="Go" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loadingTitle and blocks presses while loading', () => {
    const onPress = jest.fn();
    render(<Button3D tone="primary" title="Save" loadingTitle="Saving…" loading onPress={onPress} />);
    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.press(screen.getByText('Saving…'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('falls back to title when loading without a loadingTitle', () => {
    render(<Button3D tone="primary" title="Save" loading onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders each tone without crashing', () => {
    const tones = ['primary', 'goal', 'health', 'finance', 'career', 'social', 'polymath', 'success', 'danger', 'xp'] as const;
    for (const tone of tones) {
      const { unmount } = render(<Button3D title={tone} tone={tone} onPress={() => {}} />);
      expect(screen.getByText(tone)).toBeTruthy();
      unmount();
    }
  });
});
