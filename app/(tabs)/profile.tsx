import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { useUserStore } from '@/store/useUserStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useGameStore } from '@/store/useGameStore';
import { getUser } from '@/db/queries/users';
import { getUsageStats, type UsageRange, type UsageStats } from '@/db/queries/behaviour';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { signOutEverything } from '@/utils/signOut';

const MODULE_LABELS: Record<string, string> = {
  today: 'Today',
  goals: 'Goals',
  health: 'Health',
  finance: 'Finance',
  career: 'Career',
  explore: 'Explore',
  rewards: 'Rewards',
  profile: 'Profile',
  life: 'Life hub',
};

const EVENT_LABELS: Record<string, string> = {
  block_completed: 'Routine blocks completed',
  goal_completed: 'Goals completed',
  weight_logged: 'Weight logged',
  food_logged: 'Meals logged',
  workout_logged: 'Workouts logged',
  search_query: 'Searches',
  reflection_saved: 'Reflections saved',
};

function Avatar({ name, size, c }: { name: string; size: number; c: ReturnType<typeof useColors> }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Body style={{ color: '#FFF', fontFamily: fonts.heading, fontSize: size * 0.4 }}>
        {initials || '?'}
      </Body>
    </View>
  );
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  c: ReturnType<typeof useColors>;
  onPress?: () => void;
  right?: React.ReactNode;
  labelColor?: string;
  iconColor?: string;
}

function Row({ icon, label, c, onPress, right, labelColor, iconColor }: RowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? c.surfaceAlt : 'transparent' },
      ]}
      onPress={onPress}
      disabled={!onPress && !right}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={iconColor ?? c.textSecondary} />
        <Body style={{ color: labelColor ?? c.textPrimary, fontSize: fontSizes.md }}>{label}</Body>
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={c.textMuted} /> : null)}
    </Pressable>
  );
}

export default function ProfileScreen() {
  useScreenTracking('profile');
  const c = useColors();
  const router = useRouter();
  const { name, email } = useUserStore();
  const { mode, toggle } = useThemeStore();
  const totalXP = useGameStore((s) => s.totalXP);
  const streaks = useGameStore((s) => s.streaks);

  const [range, setRange] = useState<UsageRange>('day');
  const [stats, setStats] = useState<UsageStats | null>(null);

  const refresh = useCallback(() => {
    setStats(getUsageStats(range));
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const user = useMemo(() => getUser(), []);
  const memberSince = user?.installDate
    ? (() => {
        try {
          return format(parseISO(user.installDate), 'MMM d, yyyy');
        } catch {
          return null;
        }
      })()
    : null;

  const topModules = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byModule)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [stats]);

  const longestStreak = useMemo(() => {
    return Object.values(streaks).reduce((max, s) => (s.count > max ? s.count : max), 0);
  }, [streaks]);

  const handleLogout = async () => {
    await signOutEverything();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar name={name || 'User'} size={72} c={c} />
          <Heading style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
            {name || 'Your Name'}
          </Heading>
          <Caption style={{ color: c.textMuted }} numberOfLines={1}>{email || ''}</Caption>
          {memberSince && (
            <Caption style={{ color: c.textMuted, marginTop: spacing.xs }}>
              Member since {memberSince}
            </Caption>
          )}
        </View>

        {/* Usage card */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Label style={{ color: c.textMuted, letterSpacing: 1.5 }}>USAGE</Label>
            <View style={[styles.segment, { borderColor: c.border }]}>
              {(['day', 'week'] as UsageRange[]).map((r) => {
                const active = range === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRange(r)}
                    style={[
                      styles.segmentBtn,
                      { backgroundColor: active ? c.primary : 'transparent' },
                    ]}
                  >
                    <Caption
                      style={{
                        color: active ? '#FFF' : c.textSecondary,
                        fontFamily: fonts.bodyMedium,
                      }}
                    >
                      {r === 'day' ? 'Today' : 'This week'}
                    </Caption>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Heading style={[styles.statValue, { color: c.textPrimary }]}>
                {stats?.totalMinutes ?? 0}
              </Heading>
              <Caption style={{ color: c.textMuted }}>min active</Caption>
            </View>
            <View style={styles.statBlock}>
              <Heading style={[styles.statValue, { color: c.xp }]}>{totalXP}</Heading>
              <Caption style={{ color: c.textMuted }}>total XP</Caption>
            </View>
            <View style={styles.statBlock}>
              <Heading style={[styles.statValue, { color: c.streak }]}>{longestStreak}</Heading>
              <Caption style={{ color: c.textMuted }}>longest streak</Caption>
            </View>
          </View>

          {stats && stats.buckets.some((v) => v > 0) ? (
            <View style={styles.sparkWrap}>
              <Sparkline values={stats.buckets} color={c.primary} height={48} />
              <View style={styles.sparkLabels}>
                <Caption style={{ color: c.textMuted }}>
                  {range === 'day' ? '12am' : 'Mon'}
                </Caption>
                <Caption style={{ color: c.textMuted }}>
                  {range === 'day' ? '11pm' : 'Sun'}
                </Caption>
              </View>
            </View>
          ) : (
            <Caption style={{ color: c.textMuted, marginTop: spacing.md }}>
              No activity tracked yet — open a tab to get started.
            </Caption>
          )}

          {topModules.length > 0 && (
            <View style={styles.topModules}>
              <Label style={{ color: c.textMuted, letterSpacing: 1.2, marginBottom: spacing.xs }}>
                TOP MODULES
              </Label>
              {topModules.map(([mod, mins]) => (
                <View key={mod} style={styles.topRow}>
                  <Body style={{ color: c.textPrimary }}>{MODULE_LABELS[mod] ?? mod}</Body>
                  <Caption style={{ color: c.textMuted }}>{mins} min</Caption>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Activity summary */}
        {stats && stats.topEvents.length > 0 && (
          <Card style={styles.card}>
            <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm }}>
              ACTIVITY
            </Label>
            {stats.topEvents.map((e) => (
              <View key={e.type} style={styles.topRow}>
                <Body style={{ color: c.textPrimary }}>{EVENT_LABELS[e.type] ?? e.type}</Body>
                <Caption style={{ color: c.textMuted }}>{e.count}</Caption>
              </View>
            ))}
          </Card>
        )}

        {stats && stats.searches.length > 0 && (
          <Card style={styles.card}>
            <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm }}>
              RECENT SEARCHES
            </Label>
            {stats.searches.map((s, i) => (
              <View key={`${s.when}-${i}`} style={styles.topRow}>
                <Body style={{ color: c.textPrimary }} numberOfLines={1}>{s.query}</Body>
                <Caption style={{ color: c.textMuted }}>{s.scope}</Caption>
              </View>
            ))}
          </Card>
        )}

        {/* What LifeOS knows */}
        <Card style={styles.card}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs }}>
            YOUR PROFILE
          </Label>
          <Row
            icon="sparkles-outline"
            label="What LifeOS knows about you"
            c={c}
            onPress={() => router.push('/what-lifeos-knows')}
          />
        </Card>

        {/* Settings */}
        <Card style={styles.card}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs }}>
            SETTINGS
          </Label>
          <Row
            icon="moon-outline"
            label="Dark mode"
            c={c}
            right={
              <Switch
                value={mode === 'dark'}
                onValueChange={toggle}
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor="#FFF"
              />
            }
          />
          <Row icon="notifications-outline" label="Notifications" c={c} onPress={() => {}} />
          <Row icon="lock-closed-outline" label="Privacy" c={c} onPress={() => {}} />
        </Card>

        <Card style={styles.card}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs }}>
            HELP
          </Label>
          <Row icon="book-outline" label="How LifeOS works" c={c} onPress={() => {}} />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            c={c}
            onPress={() => Linking.openURL('mailto:support@lifeos.app')}
          />
          <Row icon="shield-checkmark-outline" label="Terms & Privacy" c={c} onPress={() => {}} />
        </Card>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: pressed ? c.error : 'transparent',
              borderColor: c.error,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={c.error} />
          <Body style={{ color: c.error, fontFamily: fonts.bodyMedium }}>Log out</Body>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  name: {
    marginTop: spacing.sm,
  },
  card: {
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: fontSizes.xxl,
  },
  sparkWrap: {
    marginTop: spacing.md,
    gap: 4,
  },
  sparkLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topModules: {
    marginTop: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
