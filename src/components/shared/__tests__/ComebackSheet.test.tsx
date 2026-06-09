import { render, screen, fireEvent } from '@testing-library/react-native';
import { ComebackSheet } from '@/components/shared/ComebackSheet';
import { useCompanionStore } from '@/store/useCompanionStore';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(() => ({ companion: null, cosmetics: '[]' })),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));

describe('ComebackSheet', () => {
  beforeEach(() => {
    useCompanionStore.setState({ mood: 'resting', reason: 'x', identity: null });
  });

  it('welcomes back with the gap and zero loss-framing', () => {
    render(<ComebackSheet visible days={7} onClaim={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText(/It's been 7 days/)).toBeTruthy();
    expect(screen.getByText(/right where you left it/)).toBeTruthy();
    // The denylist test guards the source; assert the live render too.
    expect(screen.queryByText(/lost|reset|expired|streak broke/i)).toBeNull();
  });

  it('mentions the companion by name once named', () => {
    useCompanionStore.setState({
      mood: 'resting',
      reason: 'x',
      identity: { name: 'Pip', createdAt: 'x', equipped: [] },
    });
    render(<ComebackSheet visible days={5} onClaim={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(/Pip missed you — they napped the whole time/)).toBeTruthy();
  });

  it('fires onClaim from the ease-back CTA', () => {
    const onClaim = jest.fn();
    render(<ComebackSheet visible days={4} onClaim={onClaim} onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Ease back in'));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('offers a no-cost Maybe later', () => {
    const onClose = jest.fn();
    render(<ComebackSheet visible days={4} onClaim={jest.fn()} onClose={onClose} />);
    expect(screen.getByLabelText('Maybe later')).toBeTruthy();
  });
});
