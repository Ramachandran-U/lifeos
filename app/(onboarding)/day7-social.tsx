import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import {
  createContact,
  RELATIONSHIP_META,
  RELATIONSHIP_TIERS,
  type RelationshipType,
} from '@/db/queries/social';
import { logBehaviourEvent } from '@/db/queries/behaviour';

interface Draft {
  id: string;
  name: string;
  relationshipType: RelationshipType;
}

function newDraft(name: string = '', tier: RelationshipType = 'close_friend'): Draft {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, relationshipType: tier };
}

export default function Day7SocialScreen() {
  const router = useRouter();
  const c = useColors();
  const styles = makeStyles(c);
  const { userId } = useUserStore();
  const markModuleActivated = useUserStore((s) => s.markModuleActivated);
  const awardBadge = useGameStore((s) => s.awardBadge);

  const [drafts, setDrafts] = useState<Draft[]>([
    newDraft('', 'inner_circle'),
    newDraft('', 'close_friend'),
    newDraft('', 'family'),
  ]);
  const [importing, setImporting] = useState(false);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const addBlankRow = () => {
    setDrafts((prev) => [...prev, newDraft()]);
  };

  const importFromPhone = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available on web', 'Use Add manually here — phone import works on iOS / Android.');
      return;
    }
    setImporting(true);
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'LifeOS needs contacts access to import people. Names stay on this device.',
        );
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name] });
      const names = data
        .map((d) => (d.name ?? '').trim())
        .filter((n) => n.length > 0)
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .slice(0, 5);
      if (names.length === 0) {
        Alert.alert('No contacts found', 'Add some manually below.');
        return;
      }
      setDrafts(names.map((n) => newDraft(n, 'acquaintance')));
    } catch (err) {
      Alert.alert('Could not load contacts', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setImporting(false);
    }
  };

  const handleContinue = () => {
    if (!userId) return;
    const valid = drafts.filter((d) => d.name.trim().length > 0);
    if (valid.length === 0) {
      Alert.alert('Add at least one contact', 'Name one person you want to stay close to.');
      return;
    }
    try {
      valid.forEach((d) => {
        createContact({
          userId,
          name: d.name.trim(),
          relationshipType: d.relationshipType,
        });
      });
      logBehaviourEvent('onboarding_day7_social', 'social', { contactsAdded: valid.length });
      awardBadge(userId, 'first_connection');
      markModuleActivated('social');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not save contacts', err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    router.replace('/(tabs)/social');
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Caption style={{ color: c.social, letterSpacing: 1.5 }}>DAY 7 · SOCIAL</Caption>
            <Heading style={styles.title}>Who are your people?</Heading>
            <Body style={styles.subtitle}>
              List the few people you actually want to stay close to. Names live on this device — never sent anywhere.
            </Body>
          </Animated.View>

          {Platform.OS !== 'web' ? (
            <Pressable
              onPress={importFromPhone}
              disabled={importing}
              style={({ pressed }) => [
                styles.importBtn,
                {
                  backgroundColor: pressed ? c.card : c.surface,
                  borderColor: c.border,
                  opacity: importing ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="phone-portrait" size={18} color={c.social} />
              <Body style={{ color: c.textPrimary, flex: 1 }}>
                {importing ? 'Loading…' : 'Import 5 from phone'}
              </Body>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </Pressable>
          ) : null}

          <View style={styles.form}>
            {drafts.map((d, idx) => (
              <Card key={d.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Label color={c.textMuted}>PERSON {idx + 1}</Label>
                  {drafts.length > 1 ? (
                    <Pressable onPress={() => removeDraft(d.id)} hitSlop={8}>
                      <Ionicons name="close" size={18} color={c.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                <Input
                  value={d.name}
                  onChangeText={(name) => updateDraft(d.id, { name })}
                  placeholder="Name (e.g. Priya)"
                />
                <View style={styles.tierGrid}>
                  {RELATIONSHIP_TIERS.map((t) => {
                    const active = t === d.relationshipType;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => updateDraft(d.id, { relationshipType: t })}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? c.socialLight : c.surface,
                            borderColor: active ? c.social : c.border,
                          },
                        ]}
                      >
                        <Caption style={{ color: active ? c.social : c.textSecondary }}>
                          {RELATIONSHIP_META[t].label}
                        </Caption>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ))}
            <Pressable
              onPress={addBlankRow}
              style={({ pressed }) => [
                styles.addRow,
                {
                  borderColor: pressed ? c.social : c.border,
                  backgroundColor: pressed ? c.socialLight : 'transparent',
                },
              ]}
            >
              <Ionicons name="add" size={18} color={c.social} />
              <Body style={{ color: c.social }}>Add another</Body>
            </Pressable>

            <Button title="Save & open Social" onPress={handleContinue} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  back: { alignSelf: 'flex-start', paddingTop: spacing.sm },
  title: { fontSize: fontSizes.hero, marginTop: spacing.xs, color: c.textPrimary, fontFamily: fonts.display },
  subtitle: { color: c.textSecondary, marginTop: spacing.xs },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  form: { gap: spacing.sm, marginTop: spacing.md },
  row: { gap: spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
