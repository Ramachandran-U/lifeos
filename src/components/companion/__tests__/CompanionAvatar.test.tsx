import { render, screen, fireEvent } from '@testing-library/react-native';
import { CompanionAvatar } from '@/components/companion/CompanionAvatar';
import { useCompanionStore } from '@/store/useCompanionStore';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(() => ({ companion: null, cosmetics: '[]' })),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));

describe('CompanionAvatar', () => {
  it('invites a first meeting before naming', () => {
    useCompanionStore.setState({ mood: 'content', reason: 'x', identity: null });
    render(<CompanionAvatar onPress={jest.fn()} />);
    expect(screen.getByLabelText('Meet your companion')).toBeTruthy();
  });

  it('announces the named companion and its mood', () => {
    useCompanionStore.setState({
      mood: 'curious',
      reason: 'x',
      identity: { name: 'Pip', createdAt: 'x', equipped: [] },
    });
    render(<CompanionAvatar onPress={jest.fn()} />);
    expect(screen.getByLabelText('Pip your companion — curious. Tap to visit.')).toBeTruthy();
  });

  it('opens the sheet on tap', () => {
    useCompanionStore.setState({ mood: 'content', reason: 'x', identity: null });
    const onPress = jest.fn();
    render(<CompanionAvatar onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Meet your companion'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
