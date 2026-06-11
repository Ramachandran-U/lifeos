jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react-native';
import { ConnectRow } from '@/components/ui/ConnectRow';

const baseProps = {
  icon: 'logo-youtube' as const,
  title: 'Connect YouTube',
  caption: 'Turns subscriptions into interests · read-only',
  actionLabel: 'Connect',
  accent: 'tomato', // a domain token value at the call site; any color string in the test
  onPress: jest.fn(),
  testID: 'connect-row-youtube',
};

describe('ConnectRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders title, caption and action label', () => {
    render(<ConnectRow {...baseProps} />);
    expect(screen.getByText('Connect YouTube')).toBeTruthy();
    expect(screen.getByText('Turns subscriptions into interests · read-only')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
  });

  it('carries the required connect-row testID and fires onPress', () => {
    render(<ConnectRow {...baseProps} />);
    fireEvent.press(screen.getByTestId('connect-row-youtube'));
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('status replaces the caption when connected', () => {
    render(<ConnectRow {...baseProps} status="Synced 2h ago · 14 new" />);
    expect(screen.getByText('Synced 2h ago · 14 new')).toBeTruthy();
    expect(screen.queryByText('Turns subscriptions into interests · read-only')).toBeNull();
  });

  it('loading swaps the action label for LoadingDots', () => {
    render(<ConnectRow {...baseProps} loading />);
    expect(screen.queryByText('Connect')).toBeNull();
  });

  it('renders error copy directly under the row', () => {
    render(<ConnectRow {...baseProps} error="Sync failed — try again." />);
    expect(screen.getByText('Sync failed — try again.')).toBeTruthy();
  });

  it('chrome is closed — the component accepts no style prop (type-level)', () => {
    // Dilution trap 3: no caller can re-card the row or float it above content.
    // @ts-expect-error — ConnectRow exposes no `style` prop by design.
    const el = <ConnectRow {...baseProps} style={{ backgroundColor: 'red' }} />;
    expect(el).toBeTruthy();
  });

  it('testID is required (type-level)', () => {
    const { testID: _omitted, ...withoutTestID } = baseProps;
    // @ts-expect-error — testID is required, not optional (§3.0.1 testID contract).
    const el = <ConnectRow {...withoutTestID} />;
    expect(el).toBeTruthy();
  });
});
