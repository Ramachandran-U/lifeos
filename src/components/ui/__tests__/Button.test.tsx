import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

// First RN-component render tests — exercise the Button states added in the
// design work (loading / loadingTitle / disabled) that smoke-mount can't verify.

describe('Button', () => {
  it('renders its title', () => {
    render(<Button variant="primary" title="Save" onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button variant="primary" title="Go" onPress={onPress} />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button variant="primary" title="Go" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Go'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loadingTitle and blocks presses while loading', () => {
    const onPress = jest.fn();
    render(<Button variant="primary" title="Save" loadingTitle="Saving…" loading onPress={onPress} />);
    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.press(screen.getByText('Saving…'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('falls back to title when loading without a loadingTitle', () => {
    render(<Button variant="primary" title="Save" loading onPress={() => {}} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders each variant without crashing', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'xp'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button title={variant} variant={variant} onPress={() => {}} />);
      expect(screen.getByText(variant)).toBeTruthy();
      unmount();
    }
  });
});
