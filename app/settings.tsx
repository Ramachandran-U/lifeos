import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { getUser, updateUser } from '@/db/queries/users';
import { db } from '@/db';
import { initDatabase } from '@/db';

export default function SettingsScreen() {
  const router = useRouter();
  const { userId, name, reset } = useUserStore();
  const [editName, setEditName] = useState(name);
  const [editAge, setEditAge] = useState('');

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
    <SafeAreaView style={styles.container}>
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
          <Label>Notifications</Label>
          <Caption>Manage notifications in your device settings.</Caption>
        </Card>

        <Card style={styles.section}>
          <Label>Data</Label>
          <Button title="Export my data" variant="secondary" onPress={handleExportData} />
          <Button title="Delete all my data" variant="danger" onPress={handleDeleteAllData} />
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
    backgroundColor: colors.background,
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
  infoText: {
    color: colors.textSecondary,
  },
});
