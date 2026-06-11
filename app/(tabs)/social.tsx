import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useColors } from '@/theme/colors';
import { MOTION_BUDGET, useMotionScale, useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useFlagStore } from '@/store/useFlagStore';
import { useHeroSnoozeStore } from '@/store/useHeroSnoozeStore';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import {
  getContactsByUser,
  computeOverdue,
  computeSocialScore,
  upcomingBirthdays,
  RELATIONSHIP_META,
  RELATIONSHIP_TIERS,
  type Contact,
  type RelationshipType,
} from '@/db/queries/social';
import { ReconnectHero } from '@/components/modules/social/ReconnectHero';
import { SocialHealthRow } from '@/components/modules/social/SocialHealthRow';
import { ContactRow } from '@/components/modules/social/ContactRow';
import { AddContactSheet } from '@/components/modules/social/AddContactSheet';
import { ContactsImportCard } from '@/components/modules/social/ContactsImportCard';
import { UpcomingBirthdaysCard } from '@/components/modules/social/UpcomingBirthdaysCard';
import { SocialScreenLegacy } from '@/screens/legacy/SocialScreen.legacy';
import { refreshSocialOverdueBody } from '@/hooks/useNotifications';

// Ink + Signal §3.0.1: the route branches exactly once on module_hierarchy_v1.
// Flag off → the byte-identical legacy tree; flag on → the recomposed
// hero-first tree below. The legacy file is deleted (not edited) when the flag
// graduates — see docs/PARKED_ITEMS.md §13.
export default function SocialScreen() {
  const hierarchyV1 = useFlagStore((s) => s.isEnabled('module_hierarchy_v1'));
  if (!hierarchyV1) return <SocialScreenLegacy />;
  return <SocialScreenV1 />;
}

// §3.4 — the answer on Social is a person, not a score.
function SocialScreenV1() {
  useScreenTracking('social');
  const c = useColors();
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const awardBadge = useGameStore((s) => s.awardBadge);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  // §3.0.6 motion contract: one hero-budget entry, tight stagger on the
  // supporting cast, all durations scaled so reduce-motion lands in one frame.
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

  // §3.4 snooze: `Not today` hides the hero slot until the next LOCAL day.
  // The next overdue contact is NOT promoted — the slot is simply absent and
  // the supporting cast is unchanged (the hero's contact stays excluded).
  const socialSnoozedOn = useHeroSnoozeStore((s) => s.snoozed['social']);
  const heroSnoozed = socialSnoozedOn === format(new Date(), 'yyyy-MM-dd');

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
    contacts.forEach((ct) => (computeOverdue(ct).isOverdue ? overdueList.push(ct) : inCadence.push(ct)));
    // Sort overdue by most-overdue first.
    overdueList.sort((a, b) => computeOverdue(b).daysSinceContact! - computeOverdue(a).daysSinceContact!);
    const tiers: Record<RelationshipType, Contact[]> = {
      inner_circle: [], close_friend: [], family: [], mentor: [], colleague: [], acquaintance: [],
    };
    inCadence.forEach((ct) => {
      const t = ct.relationshipType as RelationshipType;
      if (tiers[t]) tiers[t].push(ct);
    });
    return {
      score: computeSocialScore(contacts),
      overdue: overdueList,
      byTier: tiers,
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

  // §3.4 hero inputs: the head of the most-overdue sort is THE answer; the
  // remaining overdue list feeds `Reach out` (the hero's contact is excluded
  // there even while snoozed — "Not today" never demotes someone into a list).
  const heroContact = overdue[0] ?? null;
  const heroDaysSince = heroContact ? computeOverdue(heroContact).daysSinceContact : null;
  const remainingOverdue = overdue.slice(1);
  const inCadenceCount = contacts.length - overdue.length;
  const hasUpcomingBirthdays = useMemo(
    () => upcomingBirthdays(contacts).length > 0,
    [contacts],
  );

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

          {/* THE hero slot — always mounted (AC1); empty for the day when snoozed (§3.4). */}
          <View testID="social-hero">
            {!heroSnoozed && (
              <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
                <ReconnectHero
                  contact={heroContact}
                  daysSince={heroDaysSince}
                  inCadenceCount={inCadenceCount}
                  onOpen={(id) => router.push({ pathname: '/contact/[id]', params: { id } })}
                  onAdd={() => setAddOpen(true)}
                />
              </Animated.View>
            )}
          </View>

          {/* ─── Coming up — birthday rows, only when one exists (§3.4 item 2) ─── */}
          {hasUpcomingBirthdays && (
            <Animated.View
              entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Coming up</SectionTitle>
              <UpcomingBirthdaysCard
                contacts={contacts}
                onPress={(ct) => router.push({ pathname: '/contact/[id]', params: { id: ct.id } })}
              />
            </Animated.View>
          )}

          {/* ─── Social health stat row — null at 0 (§3.4 item 3 / AC8) ─── */}
          <SocialHealthRow score={score} />

          {/* ─── Reach out — remaining overdue, hero's contact excluded (§3.4 item 4) ─── */}
          {remainingOverdue.length > 0 && (
            <Animated.View
              entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Reach out</SectionTitle>
              <View style={styles.list}>
                {remainingOverdue.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    onPress={() => router.push({ pathname: '/contact/[id]', params: { id: contact.id } })}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* ─── Tier sections (§3.4 item 5) ─── */}
          {RELATIONSHIP_TIERS.map((tier, i) => {
            const list = byTier[tier];
            if (list.length === 0) return null;
            return (
              <Animated.View
                key={tier}
                entering={FadeIn.delay(stagger(2 + i, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
              >
                <SectionTitle>{RELATIONSHIP_META[tier].label}</SectionTitle>
                <View style={styles.list}>
                  {list.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onPress={() => router.push({ pathname: '/contact/[id]', params: { id: contact.id } })}
                    />
                  ))}
                </View>
              </Animated.View>
            );
          })}

          {/* ─── Connections — always the LAST section; web-only row (§3.4 item 6) ─── */}
          {Platform.OS === 'web' && userId && (
            <View>
              <SectionTitle>Connections</SectionTitle>
              <ContactsImportCard
                presentation="row"
                userId={userId}
                existingNames={contacts.map((ct) => ct.name)}
                onImported={handleCreated}
              />
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
          </View>
        </ScrollView>

        {/* FAB unchanged (§3.4 item 7). */}
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a contact"
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
    gap: spacing.md,
  },
  list: { gap: spacing.xs },
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
