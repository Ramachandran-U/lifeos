import { render, screen } from '@testing-library/react-native';
import { CompanionFallback } from '@/components/companion/CompanionFallback';
import { COSMETICS } from '@/constants/cosmetics';

describe('CompanionFallback', () => {
  it('renders the mood glyph with an accessible mood label', () => {
    render(<CompanionFallback mood="content" />);
    expect(screen.getByLabelText('Your companion is content')).toBeTruthy();
    expect(screen.getByText('🙂')).toBeTruthy();
  });

  it('maps each mood to its own glyph', () => {
    const { rerender } = render(<CompanionFallback mood="resting" />);
    expect(screen.getByText('😴')).toBeTruthy();
    rerender(<CompanionFallback mood="thriving" />);
    expect(screen.getByText('😊')).toBeTruthy();
    rerender(<CompanionFallback mood="concerned" />);
    expect(screen.getByText('🫶')).toBeTruthy();
  });

  it('shows an equipped-cosmetic badge when one is worn', () => {
    const aura = COSMETICS[0];
    render(<CompanionFallback mood="content" equipped={[aura.id]} />);
    expect(screen.getByText(aura.emoji)).toBeTruthy();
  });

  it('renders no badge when nothing is equipped', () => {
    render(<CompanionFallback mood="content" />);
    for (const item of COSMETICS) {
      expect(screen.queryByText(item.emoji)).toBeNull();
    }
  });
});
