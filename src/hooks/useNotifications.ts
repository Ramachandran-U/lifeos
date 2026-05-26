import * as Notifications from 'expo-notifications';
import { addDays, setHours, setMinutes, parseISO } from 'date-fns';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') {
    // Re-register opportunistically so admin broadcasts can reach this device.
    // No-op on web. Failures are non-fatal.
    void (await import('@/utils/pushRegister')).registerPushToken().catch(() => {});
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    void (await import('@/utils/pushRegister')).registerPushToken().catch(() => {});
    return true;
  }
  return false;
}

async function cancelNotification(id: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const match = scheduled.find((n) => n.identifier === id);
  if (match) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

async function scheduleLocalNotification(options: {
  id: string;
  title: string;
  body: string;
  trigger: Date;
}) {
  await cancelNotification(options.id);

  if (options.trigger <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: options.id,
    content: {
      title: options.title,
      body: options.body,
      data: { screen: options.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: options.trigger,
    },
  });
}

export async function scheduleOnboardingNotifications(installDate: Date) {
  const day3 = setMinutes(setHours(addDays(installDate, 3), 8), 0);
  const day7 = setMinutes(setHours(addDays(installDate, 7), 8), 0);
  const day14 = setMinutes(setHours(addDays(installDate, 14), 8), 0);

  await scheduleLocalNotification({
    id: 'onboarding_day3',
    title: 'Day 3 check-in',
    body: 'Ready to set up your health goals? Takes 2 minutes.',
    trigger: day3,
  });

  await scheduleLocalNotification({
    id: 'onboarding_day7',
    title: 'Week 1 milestone',
    body: 'Time to set your financial goals and connect with your social circle.',
    trigger: day7,
  });

  await scheduleLocalNotification({
    id: 'onboarding_day14',
    title: 'Unlock the Polymath Engine',
    body: 'Two weeks in! Time to explore your curiosities and creative side.',
    trigger: day14,
  });
}

export async function scheduleWeightNotification(lastLogDate: Date) {
  const nextReminder = addDays(lastLogDate, 21);
  await scheduleLocalNotification({
    id: 'weight_reminder',
    title: 'Time to log your weight',
    body: 'Track your progress — it takes 10 seconds.',
    trigger: setMinutes(setHours(nextReminder, 9), 0),
  });
}

export async function scheduleDailyRoutineNotification(wakeTime: string) {
  await cancelNotification('daily_routine');

  const [hours, minutes] = wakeTime.split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_routine',
    content: {
      title: 'Good morning!',
      body: 'Your daily routine is ready. Let\'s make today count.',
      data: { screen: 'today' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });
}

export async function scheduleGoalTaskReminder() {
  await cancelNotification('goal_task_reminder');

  await Notifications.scheduleNotificationAsync({
    identifier: 'goal_task_reminder',
    content: {
      title: 'Goal check-in',
      body: 'You have a high-priority task still open. Can you tackle it before end of day?',
      data: { screen: 'goals' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 15,
      minute: 0,
    },
  });
}

export async function scheduleStreakAtRiskNotification() {
  await cancelNotification('streak_at_risk');

  await Notifications.scheduleNotificationAsync({
    identifier: 'streak_at_risk',
    content: {
      title: 'Streak at risk!',
      body: 'Don\'t lose your streak — complete one task before midnight to keep it alive.',
      data: { screen: 'today' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

export async function scheduleSocialOverdueNudge(overdueCount?: number) {
  await cancelNotification('social_overdue');

  // Personalised body when we know the current overdue count; otherwise the
  // generic version (used the first time before any contacts exist).
  let body = 'You haven\'t reached out to anyone this week. A quick message can make someone\'s day.';
  if (typeof overdueCount === 'number' && overdueCount > 0) {
    body =
      overdueCount === 1
        ? 'One person in your circle is overdue. A short message tonight will close the loop.'
        : `${overdueCount} people in your circle are overdue. Pick one to reach out to tonight.`;
  } else if (overdueCount === 0) {
    // No-op — caller should skip the schedule when nobody is overdue.
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: 'social_overdue',
    content: {
      title: 'Reconnect with someone',
      body,
      data: { screen: 'social' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
    },
  });
}

/**
 * Refresh the body text of the social_overdue notification with the live
 * overdue count — but ONLY if the user has already opted in (i.e. an existing
 * social_overdue notification is scheduled). Never enables the notification
 * for a user who has it turned off.
 *
 * Call this from the Social Hub on focus.
 */
export async function refreshSocialOverdueBody(overdueCount: number): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some((n) => n.identifier === 'social_overdue');
    if (!exists) return;
    if (overdueCount === 0) {
      await Notifications.cancelScheduledNotificationAsync('social_overdue').catch(() => {});
      return;
    }
    await scheduleSocialOverdueNudge(overdueCount);
  } catch {
    // Non-fatal — notifications are best-effort.
  }
}

export async function cancelAllCustomNotifications() {
  const ids = ['goal_task_reminder', 'streak_at_risk', 'social_overdue', 'daily_routine'];
  for (const id of ids) {
    await cancelNotification(id);
  }
}

export function useNotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;

      if (screen === 'onboarding_day3') {
        router.push('/(onboarding)/day3-health' as never);
      } else if (screen === 'onboarding_day7') {
        router.push('/(onboarding)/day7-finance' as never);
      } else if (screen === 'onboarding_day14') {
        router.push('/(onboarding)/day14-polymath' as never);
      } else if (screen === 'weight_reminder') {
        router.push('/(tabs)/health');
      } else if (screen === 'goals') {
        router.push('/(tabs)/goals');
      } else if (screen === 'social') {
        router.push('/(tabs)/social');
      } else if (screen === 'daily_routine' || screen === 'today') {
        router.push('/(tabs)');
      }
    });

    return () => subscription.remove();
  }, [router]);
}
