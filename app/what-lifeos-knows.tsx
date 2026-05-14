import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { getUserProfile, upsertUserProfile } from '@/db/queries/userProfile';
import { markSlotsUserVerified } from '@/ai/profileMerge';
import { refreshInferredPreferences } from '@/ai/profileLearning';
import type {
  UserProfile,
  PrimaryDomain,
  Chronotype,
  ProfileSlotConfidence,
} from '@/ai/types';
import { ROUTINE_CONFIDENCE_THRESHOLD } from '@/ai/types';

const CHRONOTYPES: Array<{ id: Chronotype; label: string }> = [
  { id: 'lark', label: 'Morning person' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'owl', label: 'Night owl' },
];

const TONES: Array<{ id: NonNullable<UserProfile['communication']['tone']>; label: string }> = [
  { id: 'direct', label: 'Direct' },
  { id: 'warm', label: 'Warm' },
  { id: 'playful', label: 'Playful' },
  { id: 'clinical', label: 'Clinical' },
];

const DOMAIN_OPTIONS: Array<{ id: PrimaryDomain; label: string }> = [
  { id: 'goals', label: 'Goals' },
  { id: 'health', label: 'Health' },
  { id: 'finance', label: 'Finance' },
  { id: 'career', label: 'Career' },
  { id: 'social', label: 'Social' },
  { id: 'polymath', label: 'Curiosity' },
];

export default function WhatLifeOSKnowsScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const p = await getUserProfile(userId);
      setProfile(p);
      setLoading(false);
    })();
  }, [userId]);

  const save = useCallback(
    async (next: UserProfile, slots: Array<keyof Omit<ProfileSlotConfidence, 'overall'>>) => {
      if (!userId) return;
      const verified = markSlotsUserVerified(next, slots);
      setProfile(verified);
      setSaving(true);
      try {
        await upsertUserProfile(userId, verified);
        // Schedule edits MUST mirror onto the user row — the routine planner,
        // the notifications scheduler, and the day1-routine editor all read
        // user.wakeTime/sleepTime/workStartTime/workEndTime, not the profile.
        // Without this mirror, editing wake time here silently fails to
        // affect routine generation.
        if (slots.includes('schedule')) {
          const userUpdate: Parameters<typeof updateUser>[1] = {};
          if (verified.schedule.wakeTime) userUpdate.wakeTime = verified.schedule.wakeTime;
          if (verified.schedule.sleepTime) userUpdate.sleepTime = verified.schedule.sleepTime;
          if (verified.schedule.workStartTime) userUpdate.workStartTime = verified.schedule.workStartTime;
          if (verified.schedule.workEndTime) userUpdate.workEndTime = verified.schedule.workEndTime;
          if (Object.keys(userUpdate).length > 0) updateUser(userId, userUpdate);
        }
        if (Platform.OS !== 'web') Haptics.selectionAsync();
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <AuroraBackground />
        <Caption style={styles.empty}>Loading…</Caption>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.root}>
        <AuroraBackground />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Body style={{ color: c.textSecondary }}>← Back</Body>
          </Pressable>
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="sparkles-outline" size={48} color={c.textMuted} />
          <Body style={{ color: c.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
            I don't know you yet
          </Body>
          <Caption style={{ color: c.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
            Finish the conversational onboarding and I'll start a profile here. You can edit anything I learn.
          </Caption>
        </View>
      </SafeAreaView>
    );
  }

  const pct = Math.round(profile.confidence.overall * 100);
  const routineUnlocked = profile.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD;

  return (
    <SafeAreaView style={styles.root}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Body style={{ color: c.textSecondary }}>← Back</Body>
          </Pressable>
          <Caption style={{ color: saving ? c.textSecondary : c.textMuted }}>
            {saving ? 'Saving…' : 'Auto-saved'}
          </Caption>
        </View>

        <Heading style={styles.title}>What LifeOS knows</Heading>
        <Body style={styles.subtitle}>
          Everything I use to plan your day. Edit anything — saves instantly.
        </Body>

        <Card style={styles.overallCard}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.5 }}>OVERALL</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Heading style={{ color: c.textPrimary, fontSize: fontSizes.xxl }}>{pct}%</Heading>
            <Caption style={{ color: c.textMuted }}>known about you</Caption>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: c.primary }]} />
          </View>
          <Caption style={{ color: routineUnlocked ? c.success : c.warning, marginTop: spacing.xs }}>
            {routineUnlocked
              ? '✓ Routine generation unlocked'
              : `${Math.max(0, Math.round((ROUTINE_CONFIDENCE_THRESHOLD - profile.confidence.overall) * 100))}% more to unlock routine generation`}
          </Caption>
        </Card>

        {/* --- Identity --- */}
        <SectionCard title="Identity" confidence={profile.confidence.identity} c={c}>
          <FieldText
            label="First name"
            value={profile.identity.firstName ?? ''}
            onChange={(v) =>
              save({ ...profile, identity: { ...profile.identity, firstName: v || null } }, ['identity'])
            }
            c={c}
          />
          <FieldText
            label="Season of life"
            value={profile.identity.seasonOfLife ?? ''}
            placeholder="e.g. New dad, career switcher"
            onChange={(v) =>
              save(
                { ...profile, identity: { ...profile.identity, seasonOfLife: v || null } },
                ['identity'],
              )
            }
            c={c}
            multiline
          />
        </SectionCard>

        {/* --- Vision --- */}
        <SectionCard title="Vision" confidence={profile.confidence.vision} c={c}>
          <FieldText
            label="In your own words"
            value={profile.vision.statement ?? ''}
            placeholder="What do you want in the next 90 days?"
            onChange={(v) =>
              save({ ...profile, vision: { ...profile.vision, statement: v || null } }, ['vision'])
            }
            c={c}
            multiline
          />
          <ChipList
            label="Top goals"
            items={profile.vision.topGoals}
            placeholder="Add a goal"
            max={5}
            onChange={(items) =>
              save({ ...profile, vision: { ...profile.vision, topGoals: items } }, ['vision'])
            }
            c={c}
          />
        </SectionCard>

        {/* --- Schedule --- */}
        <SectionCard title="Schedule" confidence={profile.confidence.schedule} c={c}>
          <View style={styles.row2}>
            <FieldText
              label="Wake"
              value={profile.schedule.wakeTime ?? ''}
              placeholder="07:00"
              onChange={(v) =>
                save({ ...profile, schedule: { ...profile.schedule, wakeTime: v || null } }, ['schedule'])
              }
              c={c}
              compact
            />
            <FieldText
              label="Sleep"
              value={profile.schedule.sleepTime ?? ''}
              placeholder="23:00"
              onChange={(v) =>
                save({ ...profile, schedule: { ...profile.schedule, sleepTime: v || null } }, ['schedule'])
              }
              c={c}
              compact
            />
          </View>
          <View style={styles.row2}>
            <FieldText
              label="Work start"
              value={profile.schedule.workStartTime ?? ''}
              placeholder="09:30"
              onChange={(v) =>
                save(
                  { ...profile, schedule: { ...profile.schedule, workStartTime: v || null } },
                  ['schedule'],
                )
              }
              c={c}
              compact
            />
            <FieldText
              label="Work end"
              value={profile.schedule.workEndTime ?? ''}
              placeholder="18:30"
              onChange={(v) =>
                save(
                  { ...profile, schedule: { ...profile.schedule, workEndTime: v || null } },
                  ['schedule'],
                )
              }
              c={c}
              compact
            />
          </View>
          {profile.schedule.fixedBlocks.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              <Label style={{ color: c.textMuted, letterSpacing: 1.2 }}>FIXED BLOCKS</Label>
              {profile.schedule.fixedBlocks.map((b, i) => (
                <View key={i} style={styles.fixedRow}>
                  <Body style={{ color: c.textPrimary }}>
                    {b.label} · {b.startTime}–{b.endTime}
                  </Body>
                  <Caption style={{ color: c.textMuted }}>{b.kind}</Caption>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>

        {/* --- Energy & focus --- */}
        <SectionCard title="Energy & focus" confidence={profile.confidence.chronotype} c={c}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.2 }}>CHRONOTYPE</Label>
          <View style={styles.chipRow}>
            {CHRONOTYPES.map((opt) => {
              const active = profile.chronotype === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => save({ ...profile, chronotype: opt.id }, ['chronotype'])}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? c.primary + '33' : c.surface,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}
                >
                  <Caption
                    style={{
                      color: active ? c.textPrimary : c.textSecondary,
                      fontFamily: active ? fonts.bodyMedium : fonts.body,
                    }}
                  >
                    {opt.label}
                  </Caption>
                </Pressable>
              );
            })}
          </View>

          <Label style={{ color: c.textMuted, letterSpacing: 1.2, marginTop: spacing.md }}>
            PRIMARY DOMAINS · pick up to 3
          </Label>
          <View style={styles.chipRow}>
            {DOMAIN_OPTIONS.map((opt) => {
              const active = profile.primaryDomains.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    const next = active
                      ? profile.primaryDomains.filter((d) => d !== opt.id)
                      : profile.primaryDomains.length >= 3
                      ? profile.primaryDomains
                      : [...profile.primaryDomains, opt.id];
                    save({ ...profile, primaryDomains: next }, ['primaryDomains']);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? c.primary + '33' : c.surface,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}
                >
                  <Caption
                    style={{
                      color: active ? c.textPrimary : c.textSecondary,
                      fontFamily: active ? fonts.bodyMedium : fonts.body,
                    }}
                  >
                    {opt.label}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        {/* --- Habits --- */}
        <SectionCard title="Habits" confidence={profile.confidence.habits} c={c}>
          <ChipList
            label="Currently holding"
            items={profile.habits.current}
            placeholder="e.g. 6am wake, morning walk"
            onChange={(items) =>
              save({ ...profile, habits: { ...profile.habits, current: items } }, ['habits'])
            }
            c={c}
          />
          <ChipList
            label="Want to build"
            items={profile.habits.aspirational}
            placeholder="e.g. journal, gym 3x/wk"
            onChange={(items) =>
              save({ ...profile, habits: { ...profile.habits, aspirational: items } }, ['habits'])
            }
            c={c}
          />
        </SectionCard>

        {/* --- Constraints + struggles --- */}
        <SectionCard title="Constraints" confidence={profile.confidence.constraints} c={c}>
          <ChipList
            label="Hard limits"
            items={profile.constraints}
            placeholder="e.g. No screens after 9pm"
            onChange={(items) => save({ ...profile, constraints: items }, ['constraints'])}
            c={c}
          />
          <ChipList
            label="Where I keep tripping"
            items={profile.struggles}
            placeholder="e.g. Afternoon energy crash"
            onChange={(items) => save({ ...profile, struggles: items }, ['habits'])}
            c={c}
          />
        </SectionCard>

        {/* --- Communication --- */}
        <SectionCard title="How I should talk to you" confidence={0.9} c={c}>
          <View style={styles.chipRow}>
            {TONES.map((opt) => {
              const active = profile.communication.tone === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() =>
                    save(
                      {
                        ...profile,
                        communication: { ...profile.communication, tone: opt.id },
                      },
                      ['identity'],
                    )
                  }
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? c.primary + '33' : c.surface,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}
                >
                  <Caption
                    style={{
                      color: active ? c.textPrimary : c.textSecondary,
                      fontFamily: active ? fonts.bodyMedium : fonts.body,
                    }}
                  >
                    {opt.label}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <InferredPrefsCard
          profile={profile}
          c={c}
          onRefresh={async () => {
            if (!userId) return;
            setSaving(true);
            try {
              await refreshInferredPreferences(userId, true);
              const next = await getUserProfile(userId);
              if (next) setProfile(next);
            } finally {
              setSaving(false);
            }
          }}
        />

        <Caption style={styles.footer}>
          Source: {profile.source} · Last updated{' '}
          {new Date(profile.lastUpdated).toLocaleString()}
        </Caption>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Helpers ---

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${period}`;
}

function InferredPrefsCard({
  profile,
  c,
  onRefresh,
}: {
  profile: UserProfile;
  c: AppColors;
  onRefresh: () => void | Promise<void>;
}) {
  const styles = makeStyles(c);
  const ip = profile.inferredPreferences;
  const lastIso = ip.lastInferredAt ?? null;
  const lastLabel = lastIso ? new Date(lastIso).toLocaleDateString() : 'never';
  const hasAny =
    ip.productiveHours.length > 0 ||
    ip.preferredBlockMinutes !== null ||
    ip.droppedHabits.length > 0 ||
    ip.preferredRestDays.length > 0;

  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name="analytics-outline" size={18} color={c.primary} />
        <Body style={styles.sectionTitle}>What I've learned from your behaviour</Body>
      </View>
      <Caption style={{ color: c.textMuted, marginTop: 4 }}>
        Updated weekly from what you actually complete and skip. Last run: {lastLabel}.
      </Caption>

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        {ip.productiveHours.length > 0 ? (
          <InferRow
            label="Most productive at"
            value={ip.productiveHours.map(formatHour).join(' · ')}
            c={c}
          />
        ) : null}
        {ip.preferredBlockMinutes !== null ? (
          <InferRow
            label="Comfortable block length"
            value={`~${ip.preferredBlockMinutes} min`}
            c={c}
          />
        ) : null}
        {ip.preferredRestDays.length > 0 ? (
          <InferRow
            label="Lightest days"
            value={ip.preferredRestDays.map((d) => DOW_LABELS[d]).join(' · ')}
            c={c}
          />
        ) : null}
        {ip.droppedHabits.length > 0 ? (
          <InferRow
            label="Keep dropping"
            value={ip.droppedHabits.slice(0, 3).join(' · ')}
            c={c}
          />
        ) : null}
        {!hasAny ? (
          <Caption style={{ color: c.textMuted }}>
            Not enough data yet. Complete or skip a few more blocks and check back next week.
          </Caption>
        ) : null}
      </View>

      <Pressable
        onPress={() => onRefresh()}
        style={[styles.refreshBtn, { borderColor: c.primary }]}
      >
        <Ionicons name="refresh" size={14} color={c.primary} />
        <Caption style={{ color: c.primary, fontFamily: fonts.bodyMedium }}>Recompute now</Caption>
      </Pressable>
    </Card>
  );
}

function InferRow({ label, value, c }: { label: string; value: string; c: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Caption style={{ color: c.textSecondary }}>{label}</Caption>
      <Caption style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium }}>{value}</Caption>
    </View>
  );
}

function SectionCard({
  title,
  confidence,
  children,
  c,
}: {
  title: string;
  confidence: number;
  children: React.ReactNode;
  c: AppColors;
}) {
  const styles = makeStyles(c);
  const dotColor = confidence >= 0.7 ? c.success : confidence >= 0.4 ? c.warning : c.textMuted;
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Body style={styles.sectionTitle}>{title}</Body>
        <Caption style={{ color: c.textMuted, marginLeft: 'auto' }}>
          {Math.round(confidence * 100)}%
        </Caption>
      </View>
      <View style={{ gap: spacing.md, marginTop: spacing.sm }}>{children}</View>
    </Card>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  c,
  multiline,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  c: AppColors;
  multiline?: boolean;
  compact?: boolean;
}) {
  const styles = makeStyles(c);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <View style={compact ? { flex: 1 } : undefined}>
      <Label style={{ color: c.textMuted, letterSpacing: 1.2, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Label>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => {
          if (draft !== value) onChange(draft.trim());
        }}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        style={[styles.textInput, multiline && { minHeight: 60 }]}
      />
    </View>
  );
}

function ChipList({
  label,
  items,
  onChange,
  placeholder,
  max,
  c,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  c: AppColors;
}) {
  const styles = makeStyles(c);
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.map((i) => i.toLowerCase()).includes(v.toLowerCase())) return;
    if (max && items.length >= max) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <View>
      <Label style={{ color: c.textMuted, letterSpacing: 1.2, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Label>
      {items.length > 0 ? (
        <View style={styles.chipRow}>
          {items.map((item, i) => (
            <Pressable
              key={`${item}-${i}`}
              onPress={() => onChange(items.filter((_, idx) => idx !== i))}
              style={[styles.chip, { borderColor: c.primary, backgroundColor: c.primary + '22' }]}
            >
              <Caption style={{ color: c.textPrimary }}>{item}</Caption>
              <Caption style={{ color: c.textMuted, marginLeft: 6 }}>×</Caption>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.chipAddRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder ?? 'Add…'}
          placeholderTextColor={c.textMuted}
          returnKeyType="done"
          style={[styles.textInput, { flex: 1 }]}
        />
        <Pressable onPress={add} style={[styles.addBtn, { backgroundColor: c.primary }]}>
          <Caption style={{ color: '#fff', fontFamily: fonts.bodyMedium }}>Add</Caption>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: { color: c.textPrimary, marginTop: spacing.sm },
    subtitle: { color: c.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
    overallCard: { gap: spacing.xs },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    progressFill: { height: '100%' },
    section: { gap: spacing.xs },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontFamily: fonts.heading, fontSize: fontSizes.md, color: c.textPrimary },
    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      color: c.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
    },
    row2: { flexDirection: 'row', gap: spacing.sm },
    fixedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipAddRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    addBtn: {
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: spacing.xxl },
    emptyWrap: { paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl, alignItems: 'center' },
    footer: { color: c.textMuted, textAlign: 'center', marginTop: spacing.md },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      marginTop: spacing.md,
    },
  });
