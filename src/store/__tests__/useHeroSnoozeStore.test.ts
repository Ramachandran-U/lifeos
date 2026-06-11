/**
 * useHeroSnoozeStore — "Not today" hides a hero until the next LOCAL day
 * (Ink + Signal §3.4). Fake timers drive the device clock: a snooze holds for
 * the rest of the snooze day and expires the moment the local date advances.
 */
import { useHeroSnoozeStore } from '../useHeroSnoozeStore';

describe('useHeroSnoozeStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useHeroSnoozeStore.setState({ snoozed: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is not snoozed before snooze() is called', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 9, 30));
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(false);
  });

  it('snooze(domain) hides that domain for the rest of the local day', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 9, 30));
    useHeroSnoozeStore.getState().snooze('social');
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);

    // Still the same local day at 23:59 — still snoozed.
    jest.setSystemTime(new Date(2026, 5, 12, 23, 59));
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);
  });

  it('expires when the device-local date advances one day', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 23, 59));
    useHeroSnoozeStore.getState().snooze('social');
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);

    jest.setSystemTime(new Date(2026, 5, 13, 0, 1));
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(false);
  });

  it('is per-domain — snoozing one domain leaves the others visible', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 12, 0));
    useHeroSnoozeStore.getState().snooze('social');
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);
    expect(useHeroSnoozeStore.getState().isSnoozedToday('health')).toBe(false);
  });

  it('records the device-local calendar date (yyyy-MM-dd) per domain', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 18, 45));
    useHeroSnoozeStore.getState().snooze('career');
    expect(useHeroSnoozeStore.getState().snoozed).toEqual({ career: '2026-06-12' });
  });

  it('re-snoozing on a later day overwrites the stored date', () => {
    jest.setSystemTime(new Date(2026, 5, 12, 12, 0));
    useHeroSnoozeStore.getState().snooze('social');
    jest.setSystemTime(new Date(2026, 5, 14, 12, 0));
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(false);
    useHeroSnoozeStore.getState().snooze('social');
    expect(useHeroSnoozeStore.getState().snoozed).toEqual({ social: '2026-06-14' });
    expect(useHeroSnoozeStore.getState().isSnoozedToday('social')).toBe(true);
  });

  it('persists under the lifeos_hero_snooze_v1 key', () => {
    // The key is load-bearing: AC9 tests reload survival against this name.
    expect(useHeroSnoozeStore.persist.getOptions().name).toBe('lifeos_hero_snooze_v1');
  });
});
