import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';
import { Sparkline } from '@/components/ui/Sparkline';
import { useUserStore } from '@/store/useUserStore';
import {
  usePreferencesStore,
  type DensityMode,
  type MotionIntensity,
  type GamificationVisibility,
} from '@/store/usePreferencesStore';
import { useGameStore } from '@/store/useGameStore';
import { useFlagStore } from '@/store/useFlagStore';
import { getUser } from '@/db/queries/users';
import { getUsageStats, type UsageRange, type UsageStats } from '@/db/queries/behaviour';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { signOutEverything } from '@/utils/signOut';
import { formatDuration } from '@/utils/duration';
import { isEnabled } from '@/config/flags';
import { AvatarEditSheet } from '@/components/modules/profile/AvatarEditSheet';
import { StarterLine } from '@/components/shared/StarterLine';
import { STARTER_COPY } from '@/constants/starterCopy';

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

function Avatar({
  name,
  size,
  c,
  uri,
}: {
  name: string;
  size: number;
  c: ReturnType<typeof useColors>;
  uri?: string | null;
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }}
      />
    );
  }
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

interface SegmentedPickerProps<T extends string> {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  c: ReturnType<typeof useColors>;
}

function SegmentedPicker<T extends string>({ value, options, onChange, c }: SegmentedPickerProps<T>) {
  return (
    <View style={[styles.segmentLarge, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentLargeBtn,
              active && { backgroundColor: c.primary },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <AuroraText
              variant="caption"
              color={active ? '#FFF' : c.textSecondary}
              style={{ fontFamily: active ? fonts.bodyMedium : fonts.body }}
            >
              {opt.label}
            </AuroraText>
            {opt.hint ? (
              <AuroraText variant="micro" color={active ? '#FFF' : c.textMuted}>
                {opt.hint}
              </AuroraText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
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
  const avatarUri = useUserStore((s) => s.avatarUri);
  const avatarGenEnabled = isEnabled('profileAvatarGen');
  // The Activity/history screen reads the mutation log, so it's only useful when
  // the log is on (default). Ties visibility to data availability — no new flag.
  const activityEnabled = useFlagStore((s) => s.isEnabled('mutation_log_enabled'));
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const themeMode = usePreferencesStore((s) => s.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const motionIntensity = usePreferencesStore((s) => s.motionIntensity);
  const setMotionIntensity = usePreferencesStore((s) => s.setMotionIntensity);
  const gamification = usePreferencesStore((s) => s.gamification);
  const setGamification = usePreferencesStore((s) => s.setGamification);
  const totalXP = useGameStore((s) => s.totalXP);
  const streaks = useGameStore((s) => s.streaks);
  const loadGame = useGameStore((s) => s.loadFromDB);

  const [range, setRange] = useState<UsageRange>('day');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const refresh = useCallback(() => {
    setStats(getUsageStats(range));
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const user = useMemo(() => getUser(), []);

  // The game store hydrates only via loadFromDB (no persist middleware) —
  // Today and Rewards already call it on mount. Without this, a direct
  // /profile load reads default zeros and the USAGE card lies about XP.
  useEffect(() => {
    if (user?.id) loadGame(user.id);
  }, [user?.id, loadGame]);
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

  const coldStart = useFlagStore((s) => s.isEnabled('cold_start_v1'));
  // §3.4: a zero is never data — until the first stat exists, the USAGE card
  // renders the action that creates it instead of a wall of display-type 0s.
  const usageEmpty = (stats?.totalMinutes ?? 0) === 0 && totalXP === 0 && longestStreak === 0;
  const showUsageStarter = usageEmpty && coldStart;

  const handleLogout = async () => {
    await signOutEverything();
    router.replace('/(auth)/sign-in');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {avatarGenEnabled ? (
            <Pressable
              onPress={() => setAvatarSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile avatar"
            >
              <Avatar name={name || 'User'} size={72} c={c} uri={avatarUri} />
              <View style={[styles.avatarBadge, { backgroundColor: c.primary, borderColor: c.background }]}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            </Pressable>
          ) : (
            <Avatar name={name || 'User'} size={72} c={c} uri={avatarUri} />
          )}
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
            {!showUsageStarter && (
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
            )}
          </View>

          {showUsageStarter ? (
            // §3.4: one starter line in place of the stats row, the dead
            // segmented control, and the sparkline. No CTA — Profile is a
            // settings surface; Rewards and Today carry the action.
            <StarterLine>{STARTER_COPY.profileUsage}</StarterLine>
          ) : (
          <>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              {/* §3.4: a never-nonzero slot renders an em-dash, not "0 min". */}
              {coldStart && (stats?.totalMinutes ?? 0) === 0 ? (
                <Heading style={[styles.statValue, { color: c.textSecondary }]}>—</Heading>
              ) : (
                <Heading style={[styles.statValue, { color: c.textPrimary }]}>
                  {formatDuration(stats?.totalMinutes ?? 0)}
                </Heading>
              )}
              <Caption style={{ color: c.textMuted }}>active</Caption>
            </View>
            <View style={styles.statBlock}>
              {coldStart && totalXP === 0 ? (
                <Heading style={[styles.statValue, { color: c.textSecondary }]}>—</Heading>
              ) : (
                <Heading style={[styles.statValue, { color: c.xp }]}>{totalXP}</Heading>
              )}
              <Caption style={{ color: c.textMuted }}>total XP</Caption>
            </View>
            <View style={styles.statBlock}>
              {coldStart && longestStreak === 0 ? (
                <Heading style={[styles.statValue, { color: c.textSecondary }]}>—</Heading>
              ) : (
                <Heading style={[styles.statValue, { color: c.streak }]}>{longestStreak}</Heading>
              )}
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
          ) : null}
          </>
          )}

          {topModules.length > 0 && (
            <View style={styles.topModules}>
              <Label style={{ color: c.textMuted, letterSpacing: 1.2, marginBottom: spacing.xs }}>
                TOP MODULES
              </Label>
              {topModules.map(([mod, mins]) => (
                <View key={mod} style={styles.topRow}>
                  <Body style={{ color: c.textPrimary }}>{MODULE_LABELS[mod] ?? mod}</Body>
                  <Caption style={{ color: c.textMuted }}>{formatDuration(mins)}</Caption>
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
          <Row
            icon="bulb-outline"
            label="What LifeOS remembers"
            c={c}
            onPress={() => router.push('/what-lifeos-remembers')}
          />
          {activityEnabled ? (
            <Row
              icon="time-outline"
              label="Activity & history"
              c={c}
              onPress={() => router.push('/activity')}
            />
          ) : null}
        </Card>

        {/* Appearance — Aurora preferences (collapsed by default) */}
        <GlassCard style={styles.card}>
          <Pressable
            onPress={() => setAppearanceOpen((v) => !v)}
            style={styles.collapseHeader}
            accessibilityRole="button"
            accessibilityHint={appearanceOpen ? 'Collapse appearance settings' : 'Expand appearance settings'}
          >
            <SectionLabel>APPEARANCE</SectionLabel>
            <View style={{ flex: 1 }} />
            <Ionicons
              name={appearanceOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={c.textMuted}
            />
          </Pressable>

          {appearanceOpen && (
          <>
          <View style={styles.prefBlock}>
            <View style={styles.prefHeader}>
              <Ionicons name="moon-outline" size={18} color={c.textSecondary} />
              <AuroraText variant="bodyLg">Theme</AuroraText>
              <View style={{ flex: 1 }} />
              <Switch
                value={themeMode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor="#FFF"
              />
            </View>
            <AuroraText variant="caption" muted>
              Dark mode is the shipping experience. Light mode is a 1:1 token swap.
            </AuroraText>
          </View>

          <View style={styles.prefBlock}>
            <View style={styles.prefHeader}>
              <Ionicons name="resize-outline" size={18} color={c.textSecondary} />
              <AuroraText variant="bodyLg">Density</AuroraText>
            </View>
            <SegmentedPicker<DensityMode>
              value={density}
              onChange={setDensity}
              c={c}
              options={[
                { value: 'compact', label: 'Compact', hint: '×0.85' },
                { value: 'cozy', label: 'Cozy', hint: '×1.0' },
                { value: 'spacious', label: 'Spacious', hint: '×1.18' },
              ]}
            />
            <AuroraText variant="caption" muted>
              {density === 'compact'
                ? 'Pro mode — more above the fold.'
                : density === 'spacious'
                ? 'Headspace mode — more breathing room.'
                : 'The shipping default.'}
            </AuroraText>
          </View>

          <View style={styles.prefBlock}>
            <View style={styles.prefHeader}>
              <Ionicons name="pulse-outline" size={18} color={c.textSecondary} />
              <AuroraText variant="bodyLg">Motion</AuroraText>
            </View>
            <SegmentedPicker<MotionIntensity>
              value={motionIntensity}
              onChange={setMotionIntensity}
              c={c}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'normal', label: 'Normal' },
                { value: 'bold', label: 'Bold' },
              ]}
            />
            <AuroraText variant="caption" muted>
              Honors your system reduce-motion setting automatically.
            </AuroraText>
          </View>

          <View style={styles.prefBlock}>
            <View style={styles.prefHeader}>
              <Ionicons name="trophy-outline" size={18} color={c.textSecondary} />
              <AuroraText variant="bodyLg">Gamification</AuroraText>
            </View>
            <SegmentedPicker<GamificationVisibility>
              value={gamification}
              onChange={setGamification}
              c={c}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'off', label: 'Off' },
              ]}
            />
            <AuroraText variant="caption" muted>
              Streaks, XP and rewards. Off hides all gamification surfaces.
            </AuroraText>
          </View>
          </>
          )}
        </GlassCard>

        <Card style={styles.card}>
          <SectionLabel>SETTINGS</SectionLabel>
          <Row
            icon="options-outline"
            label="Priorities & focus"
            c={c}
            onPress={() => router.push('/edit-priorities')}
          />
          <Row
            icon="notifications-outline"
            label="Notifications"
            c={c}
            onPress={() => router.push('/notifications-settings')}
          />
          <Row
            icon="lock-closed-outline"
            label="Privacy & data residency"
            c={c}
            onPress={() => router.push('/data-residency')}
          />
        </Card>

        <Card style={styles.card}>
          <Label style={{ color: c.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs }}>
            HELP
          </Label>
          <Row
            icon="book-outline"
            label="How LifeOS works"
            c={c}
            onPress={() => router.push('/how-it-works')}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            c={c}
            onPress={() => router.push('/feedback')}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Terms & Privacy"
            c={c}
            onPress={() => router.push('/terms-privacy')}
          />
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

      {avatarGenEnabled && (
        <AvatarEditSheet visible={avatarSheetOpen} onClose={() => setAvatarSheetOpen(false)} />
      )}
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
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  segmentLarge: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.control,
    padding: 3,
    gap: 3,
  },
  segmentLargeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radii.tile,
    alignItems: 'center',
    gap: 2,
  },
  prefBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
