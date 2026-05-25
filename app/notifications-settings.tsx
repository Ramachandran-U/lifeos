import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { getUser } from '@/db/queries/users';
import {
  scheduleDailyRoutineNotification,
  scheduleGoalTaskReminder,
  scheduleStreakAtRiskNotification,
  scheduleSocialOverdueNudge,
  requestNotificationPermissions,
} from '@/hooks/useNotifications';

type ToggleId = 'daily_routine' | 'goal_task_reminder' | 'streak_at_risk' | 'social_overdue';

interface ToggleDef {
  id: ToggleId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  time: string;
}

const TOGGLES: ToggleDef[] = [
  {
    id: 'daily_routine',
    icon: 'sunny-outline',
    title: 'Morning routine',
    detail: 'A nudge at your wake time with today’s plan ready to go.',
    time: 'At wake time',
  },
  {
    id: 'goal_task_reminder',
    icon: 'flag-outline',
    title: 'Goal check-in',
    detail: 'Mid-afternoon ping if a high-priority task is still open.',
    time: '3:00 PM',
  },
  {
    id: 'streak_at_risk',
    icon: 'flame-outline',
    title: 'Streak at risk',
    detail: 'Evening alert if you’re about to break a streak by midnight.',
    time: '8:00 PM',
  },
  {
    id: 'social_overdue',
    icon: 'people-outline',
    title: 'Reconnect nudge',
    detail: 'Reminder to reach out if you haven’t messaged anyone this week.',
    time: '6:00 PM',
  },
];

const STORAGE_KEY = 'lifeos.notifications.prefs';

const DEFAULT_PREFS: Record<ToggleId, boolean> = {
  daily_routine: true,
  goal_task_reminder: true,
  streak_at_risk: true,
  social_overdue: true,
};

// Storage is cross-platform: localStorage on web, AsyncStorage on native.
// Previous implementation gated on `Platform.OS !== 'web'` and returned
// defaults on native — so iOS/Android toggles appeared to persist within
// a session but reset to all-on every cold start. The inverted guard was
// the bug.
async function loadPrefs(): Promise<Record<ToggleId, boolean>> {
  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(STORAGE_KEY)
        : await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Record<ToggleId, boolean>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

async function savePrefs(prefs: Record<ToggleId, boolean>): Promise<void> {
  try {
    const json = JSON.stringify(prefs);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, json);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, json);
    }
  } catch {
    // ignore — preference persistence is best-effort
  }
}

export default function NotificationsSettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<ToggleId, boolean>>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // Hydrate persisted prefs after mount. Defaults render immediately so the
  // screen never flashes a loading state; the persisted values overwrite
  // them once storage resolves (usually <10ms).
  useEffect(() => {
    let cancelled = false;
    loadPrefs().then((stored) => {
      if (!cancelled) setPrefs(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((res) => setPermission(res.status === 'granted' ? 'granted' : res.status === 'denied' ? 'denied' : 'undetermined'))
      .catch(() => setPermission('undetermined'));
  }, []);

  const requestPerms = useCallback(async () => {
    const granted = await requestNotificationPermissions();
    setPermission(granted ? 'granted' : 'denied');
  }, []);

  const setToggle = useCallback(async (id: ToggleId, value: boolean) => {
    const next = { ...prefs, [id]: value };
    setPrefs(next);
    await savePrefs(next);

    if (!value) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      return;
    }

    if (permission !== 'granted') {
      const granted = await requestNotificationPermissions();
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) return;
    }

    if (id === 'daily_routine') {
      const user = getUser();
      if (user?.wakeTime) await scheduleDailyRoutineNotification(user.wakeTime).catch(() => {});
    } else if (id === 'goal_task_reminder') {
      await scheduleGoalTaskReminder().catch(() => {});
    } else if (id === 'streak_at_risk') {
      await scheduleStreakAtRiskNotification().catch(() => {});
    } else if (id === 'social_overdue') {
      await scheduleSocialOverdueNudge().catch(() => {});
    }
  }, [prefs, permission]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={[styles.back, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={c.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <AuroraText variant="micro" muted>STAY ON TRACK</AuroraText>
              <AuroraText variant="h1" style={{ marginTop: 4 }}>Notifications</AuroraText>
            </View>
          </View>

          <AuroraText variant="body" secondary style={styles.lede}>
            LifeOS only ever sends you four kinds of nudges, all scheduled on your device. Turn off anything that doesn’t serve you.
          </AuroraText>

          {permission !== 'granted' && (
            <GlassCard accent={c.warning} style={styles.permissionCard}>
              <SectionLabel color={c.warning}>PERMISSION NEEDED</SectionLabel>
              <AuroraText variant="bodyLg" style={{ marginTop: 4 }}>
                Notifications are {permission === 'denied' ? 'blocked' : 'not yet enabled'} on this device.
              </AuroraText>
              <AuroraText variant="caption" muted style={{ marginTop: 4 }}>
                {permission === 'denied'
                  ? 'Enable LifeOS notifications in your system settings to receive nudges.'
                  : 'Grant permission so your chosen reminders can fire.'}
              </AuroraText>
              {permission !== 'denied' && (
                <Pressable
                  onPress={requestPerms}
                  style={[styles.permissionBtn, { borderColor: c.warning, backgroundColor: c.warning + '1A' }]}
                  accessibilityRole="button"
                >
                  <AuroraText variant="caption" color={c.warning}>Enable notifications</AuroraText>
                </Pressable>
              )}
            </GlassCard>
          )}

          <GlassCard accent={c.primary} style={styles.section}>
            <SectionLabel color={c.primary}>NUDGES</SectionLabel>
            <View style={styles.rowList}>
              {TOGGLES.map((t, i) => (
                <View
                  key={t.id}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: c.primary + '14', borderColor: c.primary + '33' }]}>
                    <Ionicons name={t.icon} size={18} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuroraText variant="bodyLg">{t.title}</AuroraText>
                    <AuroraText variant="caption" muted style={{ marginTop: 2 }}>{t.detail}</AuroraText>
                    <AuroraText variant="micro" muted style={{ marginTop: 2 }}>{t.time}</AuroraText>
                  </View>
                  <Switch
                    value={prefs[t.id]}
                    onValueChange={(v) => setToggle(t.id, v)}
                    trackColor={{ false: c.border, true: c.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard style={styles.section}>
            <SectionLabel>WHAT WE WON’T DO</SectionLabel>
            <AuroraText variant="caption" muted style={{ marginTop: spacing.xs }}>
              No marketing pings, no streak shaming, no 2am alerts. Nudges are local-only — they never leave your device, and the schedules above are the only ones LifeOS will ever set.
            </AuroraText>
          </GlassCard>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? spacing.lg : 0,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  lede: { marginBottom: spacing.sm },
  section: { gap: spacing.sm },
  permissionCard: { gap: spacing.xs },
  permissionBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  rowList: { marginTop: spacing.sm, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
