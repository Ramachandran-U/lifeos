import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { useThemeStore } from '@/store/useThemeStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { SyncStatus } from '@/components/shared/SyncStatus';
import { exportBackup, importBackup } from '@/sync/backup';
import { useFlagStore } from '@/store/useFlagStore';
import { useUserStore } from '@/store/useUserStore';
import { getUser, updateUser } from '@/db/queries/users';
import { db } from '@/db';
import { initDatabase } from '@/db';
import {
  scheduleDailyRoutineNotification,
  scheduleGoalTaskReminder,
  scheduleStreakAtRiskNotification,
  scheduleSocialOverdueNudge,
  cancelAllCustomNotifications,
} from '@/hooks/useNotifications';

/**
 * Yield one painted frame before a synchronous, thread-blocking call.
 * PBKDF2 key derivation (encrypt/decryptBackup → deriveKey, ~hundreds of ms at
 * 150k iters) blocks the JS thread, so without this the `backupBusy` "Working…"
 * state is set but React hasn't committed + painted it before the freeze — the
 * spinner would only appear *after* the block. Double rAF resolves after the
 * busy frame is on screen (setTimeout fallback where rAF is unavailable).
 */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled);
  const telemetryEnabled = useTelemetryStore((s) => s.enabled);
  const setTelemetryEnabled = useTelemetryStore((s) => s.setEnabled);
  const { userId, name, reset } = useUserStore();
  const [editName, setEditName] = useState(name);
  const [editAge, setEditAge] = useState('');
  const [notifDailyRoutine, setNotifDailyRoutine] = useState(true);
  const [notifGoalReminder, setNotifGoalReminder] = useState(true);
  const [notifStreakAtRisk, setNotifStreakAtRisk] = useState(true);
  const [notifSocialNudge, setNotifSocialNudge] = useState(true);
  const [backupPass, setBackupPass] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const backupEnabled = useFlagStore((s) => s.isEnabled('backup_enabled'));

  useFocusEffect(
    useCallback(() => {
      const user = getUser();
      if (user) {
        setEditName(user.name);
        setEditAge(user.age?.toString() ?? '');
      }
    }, [])
  );

  const handleSaveProfile = () => {
    if (!userId) return;
    updateUser(userId, {
      name: editName,
      age: editAge ? parseInt(editAge, 10) : undefined,
    });
  };

  const handleExport = async () => {
    if (backupPass.trim().length < 6) {
      Alert.alert('Passphrase too short', 'Use at least 6 characters — you will need it to restore.');
      return;
    }
    setBackupBusy(true);
    try {
      await yieldToPaint(); // paint the "Working…" state before PBKDF2 blocks the thread
      await exportBackup(backupPass);
      setBackupPass('');
      Alert.alert('Backup created', 'Your encrypted backup was saved. Keep the passphrase safe — without it the backup cannot be restored.');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBackupBusy(false);
    }
  };

  const doImport = async () => {
    setBackupBusy(true);
    try {
      await yieldToPaint(); // paint the "Working…" state before PBKDF2 blocks the thread
      const res = await importBackup(backupPass);
      if (res.applied) {
        setBackupPass('');
        if (Platform.OS === 'web') {
          Alert.alert('Restored', 'Your data was restored. The page will reload.', [
            { text: 'OK', onPress: () => window.location.reload() },
          ]);
        } else {
          Alert.alert('Restored', 'Your data was restored. Fully close and reopen the app to see it.');
        }
      } else if (res.reason === 'wrong_platform') {
        Alert.alert('Different platform', 'That backup was made on a different platform and can only be restored there.');
      } else if (res.reason === 'invalid_file') {
        Alert.alert('Not a LifeOS backup', 'That file is not a valid LifeOS backup.');
      }
      // cancelled → silent
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Wrong passphrase or corrupted file.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImport = () => {
    if (backupPass.trim().length < 6) {
      Alert.alert('Enter the passphrase', 'Type the passphrase for the backup you want to restore.');
      return;
    }
    Alert.alert(
      'Restore from backup?',
      'This OVERWRITES the data on this device with the backup. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => { void doImport(); } },
      ],
    );
  };

  const handleExportData = async () => {
    try {
      const user = getUser();
      const data = JSON.stringify({ user, exportedAt: new Date().toISOString() }, null, 2);
      if (await Sharing.isAvailableAsync()) {
        // Share as text content
        Alert.alert('Export', 'Data export ready. Copy the JSON from the console.', [{ text: 'OK' }]);
        console.log('LifeOS Data Export:', data);
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert('Export failed', 'Could not export your data.');
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete all data?',
      'This will permanently erase everything. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await Notifications.cancelAllScheduledNotificationsAsync();
              // Drop and recreate tables
              await initDatabase();
              reset();
              router.replace('/(auth)/welcome');
            } catch {
              Alert.alert('Error', 'Could not delete data.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
          <Heading>Settings</Heading>
          <View style={styles.spacer} />
        </View>

        <Card style={styles.section}>
          <Label>Profile</Label>
          <Input label="Name" value={editName} onChangeText={setEditName} />
          <Input label="Age" value={editAge} onChangeText={setEditAge} keyboardType="number-pad" />
          <Button title="Save" variant="secondary" onPress={handleSaveProfile} />
        </Card>

        <Card style={styles.section}>
          <Label>AI</Label>
          <Body style={styles.infoText}>
            Mode: {process.env.ANTHROPIC_API_KEY ? 'API Key' : process.env.USE_AI_MOCK === 'true' ? 'Mock Mode' : 'CLI Proxy'}
          </Body>
        </Card>

        <Card style={styles.section}>
          <Label>Sync</Label>
          <SyncStatus />
        </Card>

        {backupEnabled && (
        <Card style={styles.section}>
          <Label>Backup & Restore</Label>
          <Body style={styles.infoText}>
            Export an encrypted copy of everything (including data that never syncs), or restore from one. Your passphrase encrypts it and can&apos;t be recovered — keep it safe.
          </Body>
          <Input
            label="Passphrase"
            value={backupPass}
            onChangeText={setBackupPass}
            secureTextEntry
            placeholder="At least 6 characters"
          />
          <Button
            title={backupBusy ? 'Working…' : 'Export encrypted backup'}
            variant="secondary"
            onPress={handleExport}
            disabled={backupBusy}
          />
          <Button title="Restore from backup…" variant="ghost" onPress={handleImport} disabled={backupBusy} />
        </Card>
        )}

        <Card style={styles.section}>
          <Label>Notifications</Label>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>Daily routine reminder</Body>
            <Switch
              value={notifDailyRoutine}
              onValueChange={async (val) => {
                setNotifDailyRoutine(val);
                if (val) {
                  const user = getUser();
                  if (user?.wakeTime) await scheduleDailyRoutineNotification(user.wakeTime);
                } else {
                  await Notifications.cancelScheduledNotificationAsync('daily_routine').catch(() => {});
                }
              }}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={notifDailyRoutine ? c.primary : c.textMuted}
            />
          </View>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>Goal task reminder (3 PM)</Body>
            <Switch
              value={notifGoalReminder}
              onValueChange={async (val) => {
                setNotifGoalReminder(val);
                if (val) await scheduleGoalTaskReminder();
                else await Notifications.cancelScheduledNotificationAsync('goal_task_reminder').catch(() => {});
              }}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={notifGoalReminder ? c.primary : c.textMuted}
            />
          </View>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>Streak at-risk (8 PM)</Body>
            <Switch
              value={notifStreakAtRisk}
              onValueChange={async (val) => {
                setNotifStreakAtRisk(val);
                if (val) await scheduleStreakAtRiskNotification();
                else await Notifications.cancelScheduledNotificationAsync('streak_at_risk').catch(() => {});
              }}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={notifStreakAtRisk ? c.primary : c.textMuted}
            />
          </View>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>Social reconnect nudge (6 PM)</Body>
            <Switch
              value={notifSocialNudge}
              onValueChange={async (val) => {
                setNotifSocialNudge(val);
                if (val) await scheduleSocialOverdueNudge();
                else await Notifications.cancelScheduledNotificationAsync('social_overdue').catch(() => {});
              }}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={notifSocialNudge ? c.primary : c.textMuted}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Label>Data</Label>
          <Button title="Export my data" variant="secondary" onPress={handleExportData} />
          <Button title="Delete all my data" variant="danger" onPress={handleDeleteAllData} />
        </Card>

        <Card style={styles.section}>
          <Label>Appearance</Label>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>Light mode</Body>
            <Switch
              value={themeMode === 'light'}
              onValueChange={(val) => setThemeMode(val ? 'light' : 'dark')}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={themeMode === 'light' ? c.primary : c.textMuted}
            />
          </View>
          {/* M5 (soundEffects): celebration micro-sounds, strictly opt-in.
              Respects the iOS mute switch and never ducks other audio. */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Body style={styles.switchLabel}>Celebration sounds</Body>
              <Caption>Tiny chimes on reward moments. Always silent when your phone is on mute.</Caption>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={soundEnabled ? c.primary : c.textMuted}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Label>Privacy</Label>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Body style={styles.switchLabel}>Share anonymous usage stats</Body>
              <Caption>Helps us spot bugs and find which features need work. No personal data — only a random device id.</Caption>
            </View>
            <Switch
              value={telemetryEnabled}
              onValueChange={setTelemetryEnabled}
              trackColor={{ false: c.border, true: c.primary + '80' }}
              thumbColor={telemetryEnabled ? c.primary : c.textMuted}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Label>About</Label>
          <Body style={styles.infoText}>LifeOS v1.0.0</Body>
          <Caption>Your Digital Life Architect</Caption>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  spacer: {
    width: 60,
  },
  section: {
    gap: spacing.sm,
  },
  infoText: {},
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchLabel: {
    flex: 1,
    fontSize: fontSizes.sm,
  },
  switchLabelCol: {
    flex: 1,
    gap: 2,
    marginRight: spacing.sm,
  },
});
