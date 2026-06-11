import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { InkCanvas } from '@/components/shared/InkCanvas';
import {
  computeOverdue,
  getContact,
  getContactsByUser,
  getInteractionsByContact,
  INTERACTION_META,
  logInteraction,
  RELATIONSHIP_META,
  RELATIONSHIP_TIERS,
  softDeleteContact,
  updateContact,
  type Contact,
  type ContactInteraction,
  type InteractionType,
  type RelationshipType,
} from '@/db/queries/social';
import { useAI } from '@/hooks/useAI';
import { generateConversationStarters } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { tickQuestMetric } from '@/store/useQuestStore';
import type { ConversationStarters } from '@/ai/types';

const INTERACTION_TYPES: InteractionType[] = ['call', 'message', 'in_person', 'email', 'other'];

export default function ContactDetailScreen() {
  const c = useColors();
  const stagger = useStaggerDelay();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const userId = useUserStore((s) => s.userId);
  const triggerStreak = useGameStore((s) => s.triggerStreak);
  const awardBadge = useGameStore((s) => s.awardBadge);

  const [contact, setContact] = useState<Contact | undefined>(undefined);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [starters, setStarters] = useState<ConversationStarters | null>(null);
  const { call, loading: aiLoading } = useAI();
  const [editingTier, setEditingTier] = useState(false);
  const [editingCadence, setEditingCadence] = useState(false);
  const [cadenceDraft, setCadenceDraft] = useState('');

  const reload = useCallback(() => {
    if (!id) return;
    setContact(getContact(id));
    setInteractions(getInteractionsByContact(id));
  }, [id]);

  useEffect(reload, [reload]);

  const overdue = useMemo(() => (contact ? computeOverdue(contact) : null), [contact]);

  if (!contact) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <InkCanvas />
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Caption style={{ color: c.textMuted }}>Contact not found.</Caption>
          <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
            <Body style={{ color: c.primary }}>Go back</Body>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const displayName = (contact.nickname?.trim() || contact.name).trim();
  const initial = displayName.charAt(0).toUpperCase() || '?';

  const handleLog = (type: InteractionType) => {
    logInteraction({ contactId: contact.id, type });
    if (userId) {
      triggerStreak(userId, 'social');
      tickQuestMetric(userId, 'social_touch', 1);
      // Inner Orbit: all inner-circle contacts inside their cadence window.
      const all = getContactsByUser(userId);
      const inner = all.filter((c) => c.relationshipType === 'inner_circle');
      if (inner.length > 0 && inner.every((c) => !computeOverdue(c).isOverdue)) {
        awardBadge(userId, 'inner_orbit');
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLogOpen(false);
    reload();
  };

  const handleGetStarters = async () => {
    if (!overdue) return;
    const result = await call(() =>
      generateConversationStarters({
        relationshipType: contact.relationshipType as RelationshipType,
        daysSinceContact: overdue.daysSinceContact ?? 0,
      }),
    );
    if (result) setStarters(result);
  };

  const handleChangeTier = (t: RelationshipType) => {
    updateContact(contact.id, {
      relationshipType: t,
      preferredCadenceDays: RELATIONSHIP_META[t].defaultCadenceDays,
    });
    setEditingTier(false);
    reload();
  };

  const handleSaveCadence = () => {
    const n = parseInt(cadenceDraft, 10);
    if (Number.isNaN(n) || n <= 0 || n > 365) {
      Alert.alert('Invalid cadence', 'Pick a number between 1 and 365 days.');
      return;
    }
    updateContact(contact.id, { preferredCadenceDays: n });
    setEditingCadence(false);
    reload();
  };

  const handleDelete = () => {
    Alert.alert('Delete contact?', `This removes ${displayName} from your Social Hub. Their interactions stay archived locally.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          softDeleteContact(contact.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <InkCanvas />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={c.textMuted} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: c.social + '22', borderColor: c.social + '55' }]}>
              <Body style={[styles.avatarText, { color: c.social }]}>{initial}</Body>
            </View>
            <Heading style={[styles.name, { color: c.textPrimary }]}>{displayName}</Heading>
            <Caption style={{ color: c.textMuted }}>
              {RELATIONSHIP_META[contact.relationshipType as RelationshipType]?.label ?? contact.relationshipType}
              {overdue?.daysSinceContact !== null && overdue ? ` · last contact ${overdue.daysSinceContact}d ago` : ' · no contact yet'}
            </Caption>
            {overdue?.isOverdue ? (
              <View style={[styles.overduePill, { backgroundColor: c.warning + '22', borderColor: c.warning + '55' }]}>
                <Caption style={{ color: c.warning }}>Overdue by {overdue.overdueBy}d</Caption>
              </View>
            ) : null}
          </View>

          <Button title="Log an interaction" onPress={() => setLogOpen(true)} style={{ marginTop: spacing.md }} />

          {/* Settings rows */}
          <View style={styles.section}>
            <SectionLabel>Cadence</SectionLabel>
            <Card>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ color: c.textPrimary }}>Relationship tier</Body>
                  <Caption style={{ color: c.textMuted }}>
                    {RELATIONSHIP_META[contact.relationshipType as RelationshipType]?.label}
                  </Caption>
                </View>
                <Pressable onPress={() => setEditingTier(true)}>
                  <Body style={{ color: c.social }}>Change</Body>
                </Pressable>
              </View>
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Body style={{ color: c.textPrimary }}>Check in every</Body>
                  <Caption style={{ color: c.textMuted }}>{contact.preferredCadenceDays} days</Caption>
                </View>
                <Pressable onPress={() => { setCadenceDraft(String(contact.preferredCadenceDays)); setEditingCadence(true); }}>
                  <Body style={{ color: c.social }}>Edit</Body>
                </Pressable>
              </View>
            </Card>
          </View>

          {/* Conversation starters */}
          <View style={styles.section}>
            <SectionLabel>Conversation starter</SectionLabel>
            <Card moduleColor={c.social}>
              <Caption style={{ color: c.textMuted }}>
                Suggestions based on relationship type and how long it's been. The contact's name is not sent.
              </Caption>
              {aiLoading ? (
                <View style={{ marginTop: spacing.sm }}>
                  <LoadingDots />
                </View>
              ) : starters ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {starters.openers.map((line, i) => (
                    <View key={i} style={[styles.opener, { borderColor: c.border, backgroundColor: c.surface }]}>
                      <Body style={{ color: c.textPrimary }}>{line}</Body>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ marginTop: spacing.sm }}>
                  <Button title="Suggest an opener" onPress={handleGetStarters} />
                </View>
              )}
            </Card>
          </View>

          {/* History */}
          <View style={styles.section}>
            <SectionLabel>History</SectionLabel>
            {interactions.length === 0 ? (
              <Caption style={{ color: c.textMuted }}>No interactions logged yet.</Caption>
            ) : (
              <View style={{ gap: spacing.xs }}>
                {interactions.map((i) => (
                  <View key={i.id} style={[styles.histRow, { backgroundColor: c.card, borderColor: c.border }]}>
                    <Ionicons
                      name={INTERACTION_META[i.type as InteractionType].icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={c.social}
                    />
                    <View style={{ flex: 1 }}>
                      <Body style={{ color: c.textPrimary }}>{INTERACTION_META[i.type as InteractionType].label}</Body>
                      {i.notes ? <Caption style={{ color: c.textMuted }} numberOfLines={2}>{i.notes}</Caption> : null}
                    </View>
                    <Caption style={{ color: c.textMuted }}>{format(new Date(i.date), 'd MMM')}</Caption>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </SafeAreaView>

      {/* Log interaction sheet */}
      <Modal visible={logOpen} transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={() => setLogOpen(false)} />
        <View style={[styles.actionSheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <Heading style={{ color: c.textPrimary, marginBottom: spacing.md }}>How did you connect?</Heading>
          {INTERACTION_TYPES.map((t, i) => (
            <Animated.View key={t} entering={FadeIn.delay(120 + stagger(i, 50)).duration(300)}>
              <Pressable
                onPress={() => handleLog(t)}
                style={({ pressed }) => [
                  styles.actionRow,
                  { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border },
                ]}
              >
                <Ionicons
                  name={INTERACTION_META[t].icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={c.social}
                />
                <Body style={{ color: c.textPrimary }}>{INTERACTION_META[t].label}</Body>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </Modal>

      {/* Tier editor */}
      <Modal visible={editingTier} transparent animationType="fade" onRequestClose={() => setEditingTier(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={() => setEditingTier(false)} />
        <View style={[styles.centerSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Heading style={{ color: c.textPrimary, marginBottom: spacing.md }}>Change tier</Heading>
          {RELATIONSHIP_TIERS.map((t, i) => (
            <Animated.View key={t} entering={FadeIn.delay(120 + stagger(i, 50)).duration(300)}>
              <Pressable
                onPress={() => handleChangeTier(t)}
                style={[styles.actionRow, { borderColor: c.border }]}
              >
                <Body style={{ color: c.textPrimary, flex: 1 }}>{RELATIONSHIP_META[t].label}</Body>
                <Caption style={{ color: c.textMuted }}>every {RELATIONSHIP_META[t].defaultCadenceDays}d</Caption>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </Modal>

      {/* Cadence editor */}
      <Modal visible={editingCadence} transparent animationType="fade" onRequestClose={() => setEditingCadence(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={() => setEditingCadence(false)} />
        <View style={[styles.centerSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Heading style={{ color: c.textPrimary, marginBottom: spacing.md }}>Cadence (days)</Heading>
          <Input
            value={cadenceDraft}
            onChangeText={setCadenceDraft}
            keyboardType="number-pad"
            placeholder="e.g. 14"
          />
          <Button title="Save" onPress={handleSaveCadence} style={{ marginTop: spacing.sm }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  header: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontFamily: fonts.display, fontSize: fontSizes.xxl },
  name: { fontSize: fontSizes.xxl, marginTop: spacing.sm },
  overduePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  divider: { height: 1, marginVertical: spacing.xs },
  opener: { padding: spacing.sm, borderRadius: 12, borderWidth: 1 },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 12, borderWidth: 1,
  },
  overlay: { ...StyleSheet.absoluteFillObject },
  actionSheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 12, borderWidth: 1,
  },
  centerSheet: {
    position: 'absolute',
    left: spacing.lg, right: spacing.lg, top: '25%',
    borderRadius: 20, borderWidth: 1,
    padding: spacing.lg, gap: spacing.xs,
  },
});
