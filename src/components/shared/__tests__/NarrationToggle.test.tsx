import { render, screen, fireEvent } from '@testing-library/react-native';
import { NarrationToggle } from '@/components/shared/NarrationToggle';
import type { UseNarrationResult } from '@/hooks/useNarration';

function makeNarration(overrides: Partial<UseNarrationResult> = {}): UseNarrationResult {
  return {
    isAvailable: true,
    isPlaying: false,
    isMuted: false,
    revealedCards: new Set(),
    allCardsRevealed: false,
    toggle: jest.fn(),
    skip: jest.fn(),
    stop: jest.fn(),
    ...overrides,
  };
}

describe('NarrationToggle', () => {
  it('renders nothing when no narration asset is available', () => {
    const { toJSON } = render(<NarrationToggle narration={makeNarration({ isAvailable: false })} />);
    expect(toJSON()).toBeNull();
  });

  it('shows "Replay" when enabled and idle', () => {
    render(<NarrationToggle narration={makeNarration({ isPlaying: false, isMuted: false })} />);
    expect(screen.getByText('Replay')).toBeTruthy();
  });

  it('shows "Speaking…" while playing', () => {
    render(<NarrationToggle narration={makeNarration({ isPlaying: true })} />);
    expect(screen.getByText('Speaking…')).toBeTruthy();
  });

  it('shows "Tap to narrate" when muted', () => {
    render(<NarrationToggle narration={makeNarration({ isMuted: true })} />);
    expect(screen.getByText('Tap to narrate')).toBeTruthy();
  });

  it('calls toggle() when the chip is pressed', () => {
    const toggle = jest.fn();
    render(<NarrationToggle narration={makeNarration({ toggle })} />);
    fireEvent.press(screen.getByTestId('narration-toggle'));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('shows Skip when unmuted and not all cards revealed', () => {
    render(<NarrationToggle narration={makeNarration({ isMuted: false, allCardsRevealed: false })} />);
    expect(screen.getByTestId('narration-skip')).toBeTruthy();
  });

  it('hides Skip when all cards have been revealed', () => {
    render(<NarrationToggle narration={makeNarration({ allCardsRevealed: true })} />);
    expect(screen.queryByTestId('narration-skip')).toBeNull();
  });

  it('hides Skip when muted', () => {
    render(<NarrationToggle narration={makeNarration({ isMuted: true, allCardsRevealed: false })} />);
    expect(screen.queryByTestId('narration-skip')).toBeNull();
  });

  it('calls skip() when Skip is pressed', () => {
    const skip = jest.fn();
    render(<NarrationToggle narration={makeNarration({ isMuted: false, allCardsRevealed: false, skip })} />);
    fireEvent.press(screen.getByTestId('narration-skip'));
    expect(skip).toHaveBeenCalledTimes(1);
  });
});
