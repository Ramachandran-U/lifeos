import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { RoutineBlock } from '@/components/shared/RoutineBlock';

// The undo affordance lives inside react-native-gesture-handler's <Swipeable>'s
// `renderRightActions`, which only renders after a real pan gesture — something
// jsdom-less RN tests can't drive. Mock Swipeable to render BOTH the block body
// and its right-actions panel so the undo Pressable is reachable. Children +
// the actions render are real RN elements; nothing about the block under test
// is stubbed.
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Swipeable: ({
      children,
      renderRightActions,
    }: {
      children: React.ReactNode;
      renderRightActions?: () => React.ReactNode;
    }) =>
      React.createElement(View, null, children, renderRightActions ? renderRightActions() : null),
  };
});

const baseProps = {
  id: 'blk1',
  startTime: '09:00',
  endTime: '10:00',
  title: 'Morning workout',
  module: 'health',
  status: 'upcoming',
  onComplete: jest.fn(),
};

describe('RoutineBlock', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders the title, duration and module label', () => {
    render(<RoutineBlock {...baseProps} />);
    expect(screen.getByText('Morning workout')).toBeTruthy();
    expect(screen.getByText('1h')).toBeTruthy(); // 09:00 → 10:00
    expect(screen.getByText('HEALTH')).toBeTruthy();
  });

  it('renders the +XP tag when xp is provided', () => {
    render(<RoutineBlock {...baseProps} xp={25} />);
    expect(screen.getByText('+25 XP')).toBeTruthy();
  });

  it('omits the +XP tag when xp is undefined', () => {
    render(<RoutineBlock {...baseProps} />);
    expect(screen.queryByText(/XP$/)).toBeNull();
  });

  it('renders a sub line when provided', () => {
    render(<RoutineBlock {...baseProps} sub="20 min cardio" />);
    expect(screen.getByText('20 min cardio')).toBeTruthy();
  });

  it('shows the completed checkmark for a completed block', () => {
    render(<RoutineBlock {...baseProps} status="completed" />);
    expect(screen.getByTestId('routine-block-blk1-completed')).toBeTruthy();
  });

  it('does not show the completed indicator for an upcoming block', () => {
    render(<RoutineBlock {...baseProps} />);
    expect(screen.queryByTestId('routine-block-blk1-completed')).toBeNull();
  });

  it('shows a NOW pill when the block is the active time window', () => {
    // 08:00–23:59 reliably contains "now" for any CI clock during the day; but
    // to be deterministic we freeze the clock to a time inside the window.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-03T09:30:00'));
    render(<RoutineBlock {...baseProps} startTime="09:00" endTime="10:00" />);
    expect(screen.getByText('NOW')).toBeTruthy();
  });

  it('does not show a NOW pill outside the active window', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-03T12:00:00'));
    render(<RoutineBlock {...baseProps} startTime="09:00" endTime="10:00" />);
    expect(screen.queryByText('NOW')).toBeNull();
  });

  it('fires onComplete after holding past the hold window', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<RoutineBlock {...baseProps} onComplete={onComplete} />);
    const status = screen.getByTestId('routine-block-blk1-status');

    fireEvent(status, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(300); // > HOLD_MS (250)
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('blk1');
  });

  it('does NOT fire onComplete for a too-short press', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<RoutineBlock {...baseProps} onComplete={onComplete} />);
    const status = screen.getByTestId('routine-block-blk1-status');

    fireEvent(status, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(100); // < HOLD_MS
    });
    fireEvent(status, 'pressOut'); // released early → hold cancelled

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not fire onComplete when the block is already completed', () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    render(<RoutineBlock {...baseProps} status="completed" onComplete={onComplete} onUncomplete={jest.fn()} />);
    const status = screen.getByTestId('routine-block-blk1-status');

    fireEvent(status, 'pressIn');
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('fires onUncomplete from the swipe undo action on a completed block', () => {
    const onUncomplete = jest.fn();
    render(
      <RoutineBlock {...baseProps} status="completed" onUncomplete={onUncomplete} />,
    );
    fireEvent.press(screen.getByText('Undo'));
    expect(onUncomplete).toHaveBeenCalledTimes(1);
    expect(onUncomplete).toHaveBeenCalledWith('blk1');
  });

  it('does not render an undo action when onUncomplete is not provided', () => {
    render(<RoutineBlock {...baseProps} status="completed" />);
    expect(screen.queryByText('Undo')).toBeNull();
  });
});
