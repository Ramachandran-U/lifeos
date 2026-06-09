import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ChestOpenOverlay } from '@/components/gamification/ChestOpenOverlay';
import type { ChestContents } from '@/gamification/lootTable';

// Pin motion to the reduce-motion path: anticipation collapses to 0ms so the
// roll + reveal are synchronous under fake timers (the wiggle theatre is
// timing-sensitive Reanimated work, exercised on device, not in jsdom).
jest.mock('@/theme/motion', () => {
  const actual = jest.requireActual('@/theme/motion');
  return { ...actual, useMotionScale: () => 0 };
});

describe('ChestOpenOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function open(contents: ChestContents, props: Partial<Parameters<typeof ChestOpenOverlay>[0]> = {}) {
    const onOpen = jest.fn(() => contents);
    const onClose = jest.fn();
    render(<ChestOpenOverlay visible onOpen={onOpen} onClose={onClose} {...props} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    return { onOpen, onClose };
  }

  it('renders nothing while not visible', () => {
    render(<ChestOpenOverlay visible={false} onOpen={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText('🎁')).toBeNull();
  });

  it('rolls exactly once and reveals an XP drop', () => {
    const { onOpen } = open({ type: 'xp', amount: 42 });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+42 XP')).toBeTruthy();
  });

  it('reveals a freeze drop with the banked copy', () => {
    open({ type: 'freeze' });
    expect(screen.getByText('A streak shield')).toBeTruthy();
    expect(screen.getByText(/auto-spend/)).toBeTruthy();
  });

  it('reveals a cosmetic drop by its display name', () => {
    open({ type: 'cosmetic', cosmeticId: 'aura_aurora' });
    expect(screen.getByText('Aurora Glow')).toBeTruthy();
  });

  it('dismisses via the CTA', () => {
    const { onClose } = open({ type: 'xp', amount: 30 });
    fireEvent.press(screen.getByLabelText('Dismiss chest reward'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes silently when the chest was already opened elsewhere (null roll)', () => {
    const onOpen = jest.fn(() => null);
    const onClose = jest.fn();
    render(<ChestOpenOverlay visible onOpen={onOpen} onClose={onClose} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
