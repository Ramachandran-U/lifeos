import { render, screen, fireEvent } from '@testing-library/react-native';
import { ChestCard } from '@/components/gamification/ChestCard';
import type { ChestRecord } from '@/db/queries/chests';

const makeChest = (overrides: Partial<ChestRecord> = {}): ChestRecord => ({
  id: 'chest-1',
  userId: 'u1',
  source: 'peak_beat',
  status: 'pending',
  seed: 'chest:u1:2026-06-10:chest-1',
  contents: null,
  dayLocal: '2026-06-10',
  grantedAt: '2026-06-10T18:00:00.000Z',
  claimedAt: null,
  createdAt: '2026-06-10T18:00:00.000Z',
  updatedAt: '2026-06-10T18:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('ChestCard', () => {
  it('renders the waiting copy with the grant reason and an Open CTA', () => {
    render(<ChestCard chest={makeChest()} onOpen={jest.fn()} />);
    expect(screen.getByText('A chest is waiting')).toBeTruthy();
    expect(screen.getByText(/finishing every block today/)).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('never renders urgency copy — no countdowns, no expiry threats', () => {
    render(<ChestCard chest={makeChest()} onOpen={jest.fn()} />);
    expect(screen.queryByText(/expires|hurry|left|only/i)).toBeNull();
    expect(screen.getByText(/open whenever you like/)).toBeTruthy();
  });

  it('fires onOpen with the chest id when tapped', () => {
    const onOpen = jest.fn();
    render(<ChestCard chest={makeChest({ id: 'chest-9' })} onOpen={onOpen} />);
    fireEvent.press(screen.getByLabelText('Open reward chest'));
    expect(onOpen).toHaveBeenCalledWith('chest-9');
  });

  it('maps each grant source to its reason line', () => {
    render(<ChestCard chest={makeChest({ source: 'milestone' })} onOpen={jest.fn()} />);
    expect(screen.getByText(/streak milestone/)).toBeTruthy();
  });

  it("minimal mode renders the plain claim row — no glyph, no theatre", () => {
    const onOpen = jest.fn();
    render(<ChestCard chest={makeChest()} onOpen={onOpen} minimal />);
    expect(screen.getByText('A reward is waiting')).toBeTruthy();
    expect(screen.queryByText('🎁')).toBeNull();
    fireEvent.press(screen.getByLabelText('Claim reward chest'));
    expect(onOpen).toHaveBeenCalledWith('chest-1');
  });
});
