import {
  riveMoodFor,
  RIVE_MOOD_VALUE,
  COMPANION_TRIGGER_INPUTS,
  getCompanionRiveSource,
} from '@/components/companion/companionContract';
import { COMPANION_MOODS } from '../types';

describe('companion Rive contract', () => {
  test('every product mood maps to a defined artboard mood', () => {
    for (const mood of COMPANION_MOODS) {
      const rive = riveMoodFor(mood);
      expect(RIVE_MOOD_VALUE[rive]).toBeGreaterThanOrEqual(0);
    }
  });

  test('away maps to sleeping, concern to concerned — never anything darker', () => {
    expect(riveMoodFor('resting')).toBe('sleeping');
    expect(riveMoodFor('concerned')).toBe('concerned');
    expect(riveMoodFor('thriving')).toBe('idle');
  });

  test('the trigger surface is exactly the three reaction beats', () => {
    expect(Object.keys(COMPANION_TRIGGER_INPUTS).sort()).toEqual(
      ['levelUp', 'streakLoss', 'streakSave'].sort(),
    );
  });

  test('the asset source is null until the .riv is authored (fallback everywhere)', () => {
    // When this fails, the artwork landed: update the test to assert both
    // platform sources and delete this reminder.
    expect(getCompanionRiveSource()).toBeNull();
  });
});
