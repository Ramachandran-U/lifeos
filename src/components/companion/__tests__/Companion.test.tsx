import { render, screen } from '@testing-library/react-native';
import { Companion } from '@/components/companion/Companion';
import { resetFlagOverrides, setFlagOverride } from '@/config/flags';

describe('Companion (public surface)', () => {
  afterEach(() => resetFlagOverrides());

  it('renders the fallback while the riveCompanion flag is off (the default)', () => {
    render(<Companion mood="content" />);
    expect(screen.getByLabelText('Your companion is content')).toBeTruthy();
  });

  it('renders the fallback even with the flag ON while no .riv asset exists', () => {
    // getCompanionRiveSource() is null until the artwork lands — the Rive
    // runtime must not be touched (no lazy chunk, no native module).
    setFlagOverride({ riveCompanion: true });
    render(<Companion mood="thriving" />);
    expect(screen.getByLabelText('Your companion is thriving')).toBeTruthy();
  });
});
