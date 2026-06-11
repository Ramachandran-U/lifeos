import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { PressableScale } from './PressableScale';
import { LoadingDots } from './LoadingDots';
import { Body, Label, Caption } from './Typography';

interface ConnectRowProps {
  icon: keyof typeof Ionicons.glyphMap; // Ionicons name at size 18 — committed per row in §3.0.3
  title: string; // "Connect YouTube"
  caption: string; // one line, value + trust: "Turns subscriptions into interests · read-only"
  actionLabel: string; // "Connect" | "Import" | "Sync now"
  accent: string; // domain color token, e.g. c.polymath
  onPress: () => void;
  testID: string; // "connect-row-{provider}" — required, not optional
  status?: string; // connected meta, replaces caption: "Synced 2h ago · 14 new"
  loading?: boolean; // swaps actionLabel for LoadingDots
  error?: string; // rendered as a Caption in c.error directly under the row
}

// The one compact connect/import surface (Ink + Signal §3.0.3): a plain
// hairline-topped row under a `Connections` SectionTitle at the BOTTOM of a
// screen. No Card background, no corner radius, no left accent border — and
// deliberately NO `style` prop: the chrome is internal and closed (Dilution
// trap 3), so a caller cannot re-card it or promote it above content.
export function ConnectRow({
  icon,
  title,
  caption,
  actionLabel,
  accent,
  onPress,
  testID,
  status,
  loading,
  error,
}: ConnectRowProps) {
  const c = useColors();

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onPress();
  };

  return (
    <View>
      <PressableScale
        onPress={handlePress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.row, { borderTopColor: c.border }]}
      >
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <View style={styles.copy}>
          <Body style={[styles.title, { color: c.textPrimary }]}>{title}</Body>
          <Caption style={{ color: c.textMuted }} numberOfLines={1}>
            {status ?? caption}
          </Caption>
        </View>
        {/* The accent appears at full saturation — color is meaning, never a tint. */}
        {loading ? <LoadingDots color={accent} size={6} /> : <Label color={accent}>{actionLabel}</Label>}
      </PressableScale>
      {error ? <Caption style={{ color: c.error }}>{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  iconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyMedium },
});
