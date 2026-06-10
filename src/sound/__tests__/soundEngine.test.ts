import { setFlagOverride, resetFlagOverrides } from '@/config/flags';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { playSfx, soundOn, __resetSoundEngineForTests } from '../soundEngine';

describe('soundEngine — double opt-in gating (M5)', () => {
  afterEach(() => {
    resetFlagOverrides();
    usePreferencesStore.setState({ soundEnabled: false, gamification: 'full' });
    __resetSoundEngineForTests();
  });

  test('silent while the soundEffects flag is off (the default)', () => {
    usePreferencesStore.setState({ soundEnabled: true });
    expect(soundOn()).toBe(false);
  });

  test('silent while the user preference is off — flag alone is not consent', () => {
    setFlagOverride({ soundEffects: true });
    usePreferencesStore.setState({ soundEnabled: false });
    expect(soundOn()).toBe(false);
  });

  test("gamification 'off' silences everything, regardless of the toggles", () => {
    setFlagOverride({ soundEffects: true });
    usePreferencesStore.setState({ soundEnabled: true, gamification: 'off' });
    expect(soundOn()).toBe(false);
  });

  test('flag + preference + gamification on → sound on', () => {
    setFlagOverride({ soundEffects: true });
    usePreferencesStore.setState({ soundEnabled: true, gamification: 'minimal' });
    expect(soundOn()).toBe(true);
  });

  test('playSfx never throws while gated (no module/asset loading happens)', () => {
    expect(() => playSfx('chime')).not.toThrow();
    expect(() => playSfx('fanfare')).not.toThrow();
  });

  test('the user preference defaults to OFF', () => {
    // Fresh store state in node tests — sound must be something users choose.
    expect(usePreferencesStore.getState().soundEnabled).toBe(false);
  });
});
