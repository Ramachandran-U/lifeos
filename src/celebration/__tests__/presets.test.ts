import { MOTION_BUDGET, TIMING } from '@/theme/motion';
import { resolvePreset, presetLifetimeMs } from '../presets';
import type { CelebrationKind, CelebrationTier } from '../types';

const KINDS: CelebrationKind[] = ['xp', 'streak', 'badge', 'levelUp', 'dayComplete', 'milestone', 'firstWin'];
const TIERS: CelebrationTier[] = ['micro', 'standard', 'epic'];

describe('resolvePreset — every tier×kind maps to a renderable preset', () => {
  test('micro always resolves to none (the chip burst IS the celebration)', () => {
    for (const kind of KINDS) {
      const preset = resolvePreset({ kind, tier: 'micro' });
      expect(preset.renderer).toBe('none');
      expect(preset.particleCount).toBe(0);
    }
  });

  test('standard/epic presets are fully renderable', () => {
    for (const kind of KINDS) {
      for (const tier of TIERS.filter((t) => t !== 'micro')) {
        const preset = resolvePreset({ kind, tier });
        expect(preset.renderer).not.toBe('none');
        expect(preset.particleCount).toBeGreaterThan(0);
        expect(preset.durationMs).toBeGreaterThan(0);
        expect(preset.paletteKeys.length).toBeGreaterThan(0);
      }
    }
  });

  test('durations come from motion tokens, never ad-hoc literals', () => {
    const tokenValues = new Set<number>([
      ...Object.values(MOTION_BUDGET),
      ...Object.values(TIMING),
    ]);
    for (const kind of KINDS) {
      for (const tier of ['standard', 'epic'] as const) {
        const preset = resolvePreset({ kind, tier });
        expect(tokenValues.has(preset.durationMs)).toBe(true);
      }
    }
  });

  test('epic renders full-screen confetti; standard renders a burst', () => {
    expect(resolvePreset({ kind: 'dayComplete', tier: 'epic' }).renderer).toBe('confettiFall');
    expect(resolvePreset({ kind: 'levelUp', tier: 'epic' }).renderer).toBe('confettiCannon');
    expect(resolvePreset({ kind: 'milestone', tier: 'epic' }).renderer).toBe('confettiCannon');
    expect(resolvePreset({ kind: 'xp', tier: 'standard' }).renderer).toBe('burst');
    expect(resolvePreset({ kind: 'streak', tier: 'standard' }).renderer).toBe('burst');
  });

  test('firstWin epic is the identity cannon with the R1-amended palette (AC-4)', () => {
    const preset = resolvePreset({ kind: 'firstWin', tier: 'epic' });
    expect(preset.renderer).toBe('confettiCannon');
    expect(preset.paletteKeys).toEqual(['xp', 'primaryDim', 'streak']);
    expect(preset.durationMs).toBe(MOTION_BUDGET.celebrationFall);
  });

  test('streak/milestone presets lead with the streak hue', () => {
    expect(resolvePreset({ kind: 'streak', tier: 'standard' }).paletteKeys[0]).toBe('streak');
    expect(resolvePreset({ kind: 'milestone', tier: 'epic' }).paletteKeys[0]).toBe('streak');
  });

  test('lifetime adds a settle tail on top of the preset duration', () => {
    const preset = resolvePreset({ kind: 'dayComplete', tier: 'epic' });
    expect(presetLifetimeMs(preset)).toBe(preset.durationMs + TIMING.normal);
  });
});
