/**
 * Scheduler-function coverage for src/hooks/useNotifications.ts (components project).
 *
 * Covers the EXPORTED, pure-ish async schedulers — no React rendering:
 *  • scheduleSocialOverdueNudge — 0 / 1 / many body variants + early-return at
 *    count 0 (no schedule), and the unconditional pre-cancel.
 *  • refreshSocialOverdueBody — the opt-in guard (NO-OP when no social_overdue
 *    notification is already scheduled), cancel-at-count-0, and re-schedule when
 *    one exists with a positive count.
 *  • scheduleLocalNotification (reached via the exported scheduleWeightNotification
 *    / scheduleOnboardingNotifications wrappers) — skips a trigger that is in the
 *    past, schedules one in the future.
 *
 * expo-notifications and expo-router are stubbed with jest.fn()s; we assert on
 * call args/order. useNotificationNavigation is intentionally NOT tested here —
 * it is hook-internal (useRouter + useEffect) and needs renderHook, which this
 * node project can't run. Reported as skipped.
 */

// expo-notifications has no stub in jest.mocks/, so mock it inline. The mocks are
// created INSIDE the factory and pulled back out with jest.requireMock: this suite
// runs under the `components` project (babel-jest via jest-expo), where the ES
// `import` of the module under test is hoisted ABOVE any `const` in this file, so a
// factory closing over outer jest.fn() vars would read them before they exist
// ("setNotificationHandler is not a function"). The module under test calls
// setNotificationHandler at load time and reads the SchedulableTriggerInputTypes
// enum, so both must be present on the mock.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
}));

const notificationsMock = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
const mockGetAllScheduledNotificationsAsync = notificationsMock.getAllScheduledNotificationsAsync;
const mockCancelScheduledNotificationAsync = notificationsMock.cancelScheduledNotificationAsync;
const mockScheduleNotificationAsync = notificationsMock.scheduleNotificationAsync;

// useNotificationNavigation pulls in expo-router; stub useRouter so the import
// graph resolves in node (the hook itself is not exercised here).
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import {
  scheduleSocialOverdueNudge,
  refreshSocialOverdueBody,
  scheduleWeightNotification,
  scheduleOnboardingNotifications,
} from '../useNotifications';

interface ScheduleCall {
  identifier: string;
  content: { title: string; body: string; data: { screen: string } };
  trigger: { type: string; date?: Date; hour?: number; minute?: number };
}

function lastScheduleArg(): ScheduleCall {
  const calls = mockScheduleNotificationAsync.mock.calls;
  return calls[calls.length - 1][0] as ScheduleCall;
}

beforeEach(() => {
  mockGetAllScheduledNotificationsAsync.mockReset();
  mockCancelScheduledNotificationAsync.mockReset();
  mockScheduleNotificationAsync.mockReset();
  // cancelNotification() reads the scheduled list before cancelling; default to
  // "nothing scheduled" so the unrelated pre-cancel paths are quiet by default.
  mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
  mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
  mockScheduleNotificationAsync.mockResolvedValue(undefined);
});

describe('scheduleSocialOverdueNudge', () => {
  it('uses the generic body when no count is provided', async () => {
    await scheduleSocialOverdueNudge();

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = lastScheduleArg();
    expect(arg.identifier).toBe('social_overdue');
    expect(arg.content.body).toContain("haven't reached out to anyone");
    expect(arg.content.data.screen).toBe('social');
    expect(arg.trigger).toEqual({ type: 'daily', hour: 18, minute: 0 });
  });

  it('uses the singular body when exactly one person is overdue', async () => {
    await scheduleSocialOverdueNudge(1);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(lastScheduleArg().content.body).toBe(
      'One person in your circle is overdue. A short message tonight will close the loop.',
    );
  });

  it('uses the pluralised body with the count when many are overdue', async () => {
    await scheduleSocialOverdueNudge(4);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(lastScheduleArg().content.body).toBe(
      '4 people in your circle are overdue. Pick one to reach out to tonight.',
    );
  });

  it('early-returns without scheduling when the count is 0', async () => {
    await scheduleSocialOverdueNudge(0);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('always cancels any existing social_overdue nudge first', async () => {
    // One is already scheduled, so the pre-cancel must fire.
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'social_overdue' }]);

    await scheduleSocialOverdueNudge(2);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('social_overdue');
  });
});

describe('refreshSocialOverdueBody', () => {
  it('is a NO-OP when no social_overdue notification is already scheduled (opt-in guard)', async () => {
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'daily_routine' }]);

    await refreshSocialOverdueBody(5);

    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the nudge when the user has opted in but nobody is overdue (count 0)', async () => {
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'social_overdue' }]);

    await refreshSocialOverdueBody(0);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('social_overdue');
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('re-schedules with the live count when one already exists and the count is positive', async () => {
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'social_overdue' }]);

    await refreshSocialOverdueBody(3);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(lastScheduleArg().content.body).toBe(
      '3 people in your circle are overdue. Pick one to reach out to tonight.',
    );
  });

  it('swallows errors from the scheduled-list lookup (best-effort)', async () => {
    mockGetAllScheduledNotificationsAsync.mockRejectedValue(new Error('boom'));

    await expect(refreshSocialOverdueBody(2)).resolves.toBeUndefined();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleLocalNotification (via scheduleWeightNotification)', () => {
  it('skips scheduling when the computed trigger is in the past', async () => {
    // Reminder fires 21 days after the last log; a log far in the past lands
    // the trigger before "now", so it must be skipped.
    const longAgo = new Date('2000-01-01T09:00:00.000Z');

    await scheduleWeightNotification(longAgo);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a DATE-triggered reminder when the trigger is in the future', async () => {
    // 21 days before "now" + 21 days ⇒ today; bias to clearly-future by using now.
    const recent = new Date();

    await scheduleWeightNotification(recent);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = lastScheduleArg();
    expect(arg.identifier).toBe('weight_reminder');
    expect(arg.trigger.type).toBe('date');
    expect(arg.trigger.date).toBeInstanceOf(Date);
    expect((arg.trigger.date as Date).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('scheduleOnboardingNotifications', () => {
  it('schedules all three future onboarding check-ins from a fresh install', async () => {
    await scheduleOnboardingNotifications(new Date());

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(3);
    const ids = mockScheduleNotificationAsync.mock.calls.map(
      (c) => (c[0] as ScheduleCall).identifier,
    );
    expect(ids).toEqual(['onboarding_day3', 'onboarding_day7', 'onboarding_day14']);
  });

  it('skips check-ins whose trigger is already in the past', async () => {
    // Install 10 days ago: the day3 (+3) and day7 (+7) triggers are now in the
    // past, while day14 (+14 ⇒ ~4 days out) is still in the future.
    const installed = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    await scheduleOnboardingNotifications(installed);

    const ids = mockScheduleNotificationAsync.mock.calls.map(
      (c) => (c[0] as ScheduleCall).identifier,
    );
    expect(ids).toEqual(['onboarding_day14']);
  });
});
