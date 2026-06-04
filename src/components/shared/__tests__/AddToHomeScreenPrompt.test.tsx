import { render, screen, fireEvent } from '@testing-library/react-native';

// Store import chain (via useColors → preferences) pulls AsyncStorage through
// persist; use the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { AddToHomeScreenPrompt } from '@/components/shared/AddToHomeScreenPrompt';
import type { UseAddToHomeScreenResult } from '@/hooks/useAddToHomeScreen';

// The component is presentation only; the platform/standalone/dismissed gating
// lives in useAddToHomeScreen (unit-tested via resolveA2HS). Mock the hook so we
// can drive each variant deterministically.
const mockInstall = jest.fn();
const mockDismiss = jest.fn();
let mockState: UseAddToHomeScreenResult;

jest.mock('@/hooks/useAddToHomeScreen', () => ({
  useAddToHomeScreen: () => mockState,
}));

function setHook(over: Partial<UseAddToHomeScreenResult>): void {
  mockState = {
    variant: null,
    canInstall: false,
    install: mockInstall,
    dismiss: mockDismiss,
    ...over,
  };
}

afterEach(() => jest.clearAllMocks());

describe('AddToHomeScreenPrompt', () => {
  it('renders nothing when there is no variant (native / installed / unsupported)', () => {
    setHook({ variant: null });
    expect(render(<AddToHomeScreenPrompt />).toJSON()).toBeNull();
  });

  it('shows the iOS Share-sheet instructions for the ios variant', () => {
    setHook({ variant: 'ios' });
    render(<AddToHomeScreenPrompt />);
    expect(screen.getByText('INSTALL LIFEOS')).toBeTruthy();
    expect(screen.getByText(/Add to Home Screen/i)).toBeTruthy();
    expect(screen.queryByText('Install')).toBeNull(); // no one-tap on iOS
  });

  it('shows the Android ⋮-menu instructions when one-tap install is unavailable', () => {
    setHook({ variant: 'android', canInstall: false });
    render(<AddToHomeScreenPrompt />);
    expect(screen.getByText(/Install app/i)).toBeTruthy();
    expect(screen.queryByText('Install')).toBeNull();
  });

  it('shows a one-tap Install button on Android when a prompt was captured, and calls install()', () => {
    setHook({ variant: 'android', canInstall: true });
    render(<AddToHomeScreenPrompt />);
    const btn = screen.getByText('Install');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(mockInstall).toHaveBeenCalledTimes(1);
  });

  it('calls dismiss() when the close button is pressed', () => {
    setHook({ variant: 'ios' });
    render(<AddToHomeScreenPrompt />);
    fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
