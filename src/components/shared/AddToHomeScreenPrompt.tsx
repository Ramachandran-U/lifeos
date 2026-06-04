import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts } from '@/theme/typography';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { useAddToHomeScreen } from '@/hooks/useAddToHomeScreen';

/**
 * Web-only in-app prompt nudging testers to install LifeOS to their home screen.
 * iOS Safari shows no install UI and Android's hides behind the ⋮ menu, so this
 * spells out the steps (and offers Android's one-tap install when Chrome exposes
 * it). The platform/standalone/dismissed gating lives in useAddToHomeScreen,
 * which only yields a variant on a supported web browser — so on native (and
 * when already installed, unsupported, or dismissed) `variant` is null here.
 */
export function AddToHomeScreenPrompt() {
  const c = useColors();
  const styles = makeStyles(c);
  const { variant, canInstall, install, dismiss } = useAddToHomeScreen();

  if (!variant) return null;

  const message =
    variant === 'ios'
      ? 'Tap the Share icon, then “Add to Home Screen”.'
      : canInstall
        ? 'Install LifeOS for a full-screen, app-like experience.'
        : 'Open the ⋮ menu, then “Install app” / “Add to Home screen”.';

  return (
    <View style={styles.wrap} accessibilityRole="alert" pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="phone-portrait-outline" size={22} color={c.primary} />
        <View style={styles.text}>
          <Label color={c.primary}>INSTALL LIFEOS</Label>
          <Body style={{ color: c.textPrimary }}>{message}</Body>
        </View>
        {variant === 'android' && canInstall ? (
          <Pressable
            onPress={install}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: pressed ? c.primary + 'cc' : c.primary },
            ]}
          >
            <Caption style={styles.ctaText}>Install</Caption>
          </Pressable>
        ) : null}
        <Pressable onPress={dismiss} hitSlop={10} style={styles.close} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      zIndex: 50,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    cta: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: 10,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      color: '#FFFFFF',
      fontFamily: fonts.heading,
    },
    close: {
      padding: spacing.xs,
    },
  });
