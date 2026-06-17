import { render, screen, fireEvent } from '@testing-library/react-native';
import { LifeHubSheet } from '@/components/shared/LifeHubSheet';

// Regression guard for the "pick a domain → bounced to Today" bug: a pick must
// route through onPick (parent-owned navigation), NOT trigger the dismiss/bounce
// path. The parent flags the pick so its onClose stands down.
describe('LifeHubSheet', () => {
  it('picking a domain calls onPick with that tab route', () => {
    const onPick = jest.fn();
    const onClose = jest.fn();
    render(<LifeHubSheet visible onPick={onPick} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('life-hub-tile-health'));
    expect(onPick).toHaveBeenCalledWith('/(tabs)/health');
  });

  it('routes the Explore tile to the explore tab', () => {
    // (A pick closes the sheet, so each render exercises one tile.)
    const onPick = jest.fn();
    render(<LifeHubSheet visible onPick={onPick} onClose={() => {}} />);

    fireEvent.press(screen.getByTestId('life-hub-tile-polymath')); // Explore
    expect(onPick).toHaveBeenCalledWith('/(tabs)/explore');
  });

  it('does not navigate when nothing is picked', () => {
    const onPick = jest.fn();
    render(<LifeHubSheet visible onPick={onPick} onClose={() => {}} />);
    expect(onPick).not.toHaveBeenCalled();
  });
});
