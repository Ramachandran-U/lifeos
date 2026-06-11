import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import {
  getContactsByUser,
  computeOverdue,
  computeSocialScore,
  RELATIONSHIP_META,
  RELATIONSHIP_TIERS,
  type Contact,
  type RelationshipType,
} from '@/db/queries/social';
import { SocialScoreCard } from '@/components/modules/social/SocialScoreCard';
import { ContactRow } from '@/components/modules/social/ContactRow';
import { AddContactSheet } from '@/components/modules/social/AddContactSheet';
import { ContactsImportCard } from '@/components/modules/social/ContactsImportCard';
import { UpcomingBirthdaysCard } from '@/components/modules/social/UpcomingBirthdaysCard';
import { refreshSocialOverdueBody } from '@/hooks/useNotifications';

export default function SocialScreen() {
  useScreenTracking('social');
  const c = useColors();
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const awardBadge = useGameStore((s) => s.awardBadge);

  const stagger = useStaggerDelay();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const reload = useCallback(() => {
    if (!userId) return;
    setContacts(getContactsByUser(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const { score, overdue, byTier } = useMemo(() => {
    const overdueList: Contact[] = [];
    const inCadence: Contact[] = [];
    contacts.forEach((c) => (computeOverdue(c).isOverdue ? overdueList.push(c) : inCadence.push(c)));
    // Sort overdue by most-overdue first.
    overdueList.sort((a, b) => computeOverdue(b).daysSinceContact! - computeOverdue(a).daysSinceContact!);
    const byTier: Record<RelationshipType, Contact[]> = {
      inner_circle: [], close_friend: [], family: [], mentor: [], colleague: [], acquaintance: [],
    };
    inCadence.forEach((c) => {
      const t = c.relationshipType as RelationshipType;
      if (byTier[t]) byTier[t].push(c);
    });
    return {
      score: computeSocialScore(contacts),
      overdue: overdueList,
      byTier,
    };
  }, [contacts]);

  useEffect(() => {
    // Keep the 6 PM nudge body in sync with the live overdue count.
    // No-op when the user has the social_overdue notification turned off.
    void refreshSocialOverdueBody(overdue.length);
  }, [overdue.length]);

  const handleCreated = () => {
    if (!userId) return;
    const wasEmpty = contacts.length === 0;
    reload();
    if (wasEmpty) awardBadge(userId, 'first_connection');
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <InkCanvas />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* R1 block — full-bleed, outside the padded inner container. */}
          <ModuleHeader title="Social" domain="social" color={c.social} />
          <View style={styles.scrollInner}>

          <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
            Stay close to people who matter. Names stay on this device.
          </Caption>

          <SocialScoreCard
            score={score}
            totalContacts={contacts.length}
            overdueCount={overdue.length}
          />

          <UpcomingBirthdaysCard
            contacts={contacts}
            onPress={(ct) => router.push({ pathname: '/contact/[id]', params: { id: ct.id } })}
          />

          {userId && (
            <ContactsImportCard
              userId={userId}
              existingNames={contacts.map((ct) => ct.name)}
              onImported={handleCreated}
            />
          )}

          {overdue.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>Overdue</SectionLabel>
              <View style={styles.list}>
                {overdue.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    onPress={() => router.push({ pathname: '/contact/[id]', params: { id: contact.id } })}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {RELATIONSHIP_TIERS.map((tier, i) => {
            const list = byTier[tier];
            if (list.length === 0) return null;
            return (
              <Animated.View key={tier} entering={FadeIn.delay(stagger(i, 70)).duration(360)}>
                <View style={styles.section}>
                  <SectionLabel>{RELATIONSHIP_META[tier].label}</SectionLabel>
                  <View style={styles.list}>
                    {list.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onPress={() => router.push({ pathname: '/contact/[id]', params: { id: contact.id } })}
                      />
                    ))}
                  </View>
                </View>
              </Animated.View>
            );
          })}

          {contacts.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Build your inner orbit"
              caption={"Add the people you actually want to stay close to.\nWe'll quietly tell you when it's been too long."}
              accent={c.social}
            />
          ) : null}

          <View style={{ height: spacing.xxl }} />
          </View>
        </ScrollView>

        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: c.social,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={26} color={c.inkOnColor} />
        </Pressable>
      </SafeAreaView>

      {userId ? (
        <AddContactSheet
          visible={addOpen}
          userId={userId}
          onClose={() => setAddOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingBottom: spacing.xxl,
  },
  scrollInner: {
    paddingHorizontal: spacing.lg,
  },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  list: { gap: spacing.xs },
  empty: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
