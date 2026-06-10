import { render, screen, fireEvent } from '@testing-library/react-native';
import { CompanionSheet } from '@/components/companion/CompanionSheet';
import { useCompanionStore } from '@/store/useCompanionStore';
import { useGameStore } from '@/store/useGameStore';
import { COSMETICS } from '@/constants/cosmetics';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(() => ({ companion: null, cosmetics: '[]' })),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));

const AURA = COSMETICS[0];

describe('CompanionSheet', () => {
  beforeEach(() => {
    useCompanionStore.setState({
      mood: 'content',
      reason: 'All calm here. Happy to see you.',
      identity: null,
    });
    useGameStore.setState({ cosmetics: [AURA.id] });
  });

  it('first run shows the naming form instead of the wardrobe', () => {
    render(<CompanionSheet visible onClose={jest.fn()} userId="u1" />);
    expect(screen.getByText(/What should we call them/)).toBeTruthy();
    expect(screen.queryByText(/Wardrobe/)).toBeNull();
  });

  it('saving a name flips the sheet to the wardrobe', () => {
    render(<CompanionSheet visible onClose={jest.fn()} userId="u1" />);
    fireEvent.changeText(screen.getByLabelText('Companion name'), 'Lumen');
    fireEvent.press(screen.getByLabelText('Save companion name'));
    expect(screen.getByText('Lumen')).toBeTruthy();
    expect(screen.getByText(/Wardrobe — found in chests/)).toBeTruthy();
  });

  it('shows the plain-words mood reason', () => {
    render(<CompanionSheet visible onClose={jest.fn()} userId="u1" />);
    expect(screen.getByText('All calm here. Happy to see you.')).toBeTruthy();
  });

  it('owned cosmetics equip on tap; locked ones stay silhouettes with no buy path', () => {
    useCompanionStore.setState({
      identity: { name: 'Lumen', createdAt: 'x', equipped: [] },
    });
    render(<CompanionSheet visible onClose={jest.fn()} userId="u1" />);

    fireEvent.press(screen.getByLabelText(AURA.label));
    expect(useCompanionStore.getState().identity?.equipped).toContain(AURA.id);

    // Every unowned tile is described as chest loot — and nothing in the
    // sheet ever says "buy"/"purchase"/"unlock now".
    const locked = COSMETICS.filter((item) => item.id !== AURA.id);
    for (const item of locked) {
      expect(screen.getByLabelText(`${item.label}, found in chests`)).toBeTruthy();
    }
    expect(screen.queryByText(/buy|purchase|\$/i)).toBeNull();
  });
});
