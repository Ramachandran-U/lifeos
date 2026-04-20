import { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { useThemeStore } from '@/store/useThemeStore';
import { setWebSession } from '@/db/queries/users';

const SIDEBAR_WIDTH = 300;
const ANIM_DURATION = 260;

interface ProfileSidebarProps {
  visible: boolean;
  onClose: () => void;
}

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
      <Body
        style={{
          color: '#FFF',
          fontFamily: fonts.heading,
          fontSize: size * 0.38,
        }}
      >
        {initials || '?'}
      </Body>
    </View>
  );
}

export function ProfileSidebar({ visible, onClose }: ProfileSidebarProps) {
  const c = useColors();
  const router = useRouter();
  const { name, email, reset } = useUserStore();
  const { mode, toggle } = useThemeStore();

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.out(Easing.cubic) });
      overlayOpacity.value = withTiming(1, { duration: ANIM_DURATION });
    } else {
      translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: ANIM_DURATION, easing: Easing.in(Easing.cubic) });
      overlayOpacity.value = withTiming(0, { duration: ANIM_DURATION });
    }
  }, [visible, translateX, overlayOpacity]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

  const handleLogout = () => {
    setWebSession(null);
    reset();
    onClose();
    router.replace('/(auth)/sign-in');
  };

  if (!visible && translateX.value === -SIDEBAR_WIDTH) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, { backgroundColor: c.overlay }, overlayStyle]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sidebar panel */}
      <Animated.View
        style={[
          styles.sidebar,
          { backgroundColor: c.sidebarBg, borderRightColor: c.sidebarBorder },
          sidebarStyle,
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>

          {/* Profile section */}
          <View style={styles.profileSection}>
            <Avatar name={name || 'User'} size={64} c={c} />
            <Body
              style={[styles.profileName, { color: c.textPrimary }]}
              numberOfLines={1}
            >
              {name || 'Your Name'}
            </Body>
            <Caption style={{ color: c.textMuted }} numberOfLines={1}>
              {email || ''}
            </Caption>
          </View>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Settings section */}
          <Label style={[styles.sectionLabel, { color: c.textMuted }]}>
            SETTINGS
          </Label>

          <SidebarRow
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

          <SidebarRow
            icon="notifications-outline"
            label="Notifications"
            c={c}
            onPress={() => {}}
          />

          <SidebarRow
            icon="lock-closed-outline"
            label="Privacy"
            c={c}
            onPress={() => {}}
          />

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Help section */}
          <Label style={[styles.sectionLabel, { color: c.textMuted }]}>
            HELP
          </Label>

          <SidebarRow
            icon="book-outline"
            label="How LifeOS works"
            c={c}
            onPress={() => {}}
          />

          <SidebarRow
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            c={c}
            onPress={() => Linking.openURL('mailto:support@lifeos.app')}
          />

          <SidebarRow
            icon="shield-checkmark-outline"
            label="Terms & Privacy"
            c={c}
            onPress={() => {}}
          />

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Logout */}
          <SidebarRow
            icon="log-out-outline"
            label="Log out"
            c={c}
            labelColor={c.error}
            iconColor={c.error}
            onPress={handleLogout}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  c: ReturnType<typeof useColors>;
  onPress?: () => void;
  right?: React.ReactNode;
  labelColor?: string;
  iconColor?: string;
}

function SidebarRow({ icon, label, c, onPress, right, labelColor, iconColor }: RowProps) {
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
        <Body style={[styles.rowLabel, { color: labelColor ?? c.textPrimary }]}>
          {label}
        </Body>
      </View>
      {right ?? (
        onPress
          ? <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          : null
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  scroll: {
    paddingTop: 56,
    paddingBottom: spacing.xxxl,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.md,
    padding: spacing.xs,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  profileName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: spacing.sm,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: fontSizes.md,
  },
});
