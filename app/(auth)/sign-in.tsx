import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { ensureLocalUserFromAuth, getUserByEmail, setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';
import { signInWithEmail, signInWithApple, startGoogleSupabaseOAuth } from '@/integrations/supabase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const c = useColors();
  const styles = makeStyles(c);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await startGoogleSupabaseOAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Google sign-in.');
    }
  };

  const handleSignIn = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInWithEmail(trimmedEmail, password);
      await ensureLocalUserFromAuth(result);
      const localUser = getUserByEmail(result.email) ?? null;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWebSession(result.userId);
      setUser(
        result.userId,
        result.name,
        result.email,
        localUser?.onboardingStage ?? 0,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (/invalid login|invalid credentials/i.test(msg)) {
        setError('Incorrect email or password.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    try {
      const result = await signInWithApple();
      await ensureLocalUserFromAuth(result);
      const localUser = getUserByEmail(result.email) ?? null;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWebSession(result.userId);
      setUser(
        result.userId,
        result.name,
        result.email,
        localUser?.onboardingStage ?? 0,
      );
    } catch (e) {
      if (
        e instanceof Error &&
        'code' in e &&
        (e as { code?: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Apple sign-in failed.');
    }
  };

  return (
    <View style={styles.container}>
      <InkCanvas />
      <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.Text entering={FadeIn.duration(800)} style={styles.logo}>
            LifeOS
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Heading style={styles.title}>Welcome back</Heading>
            <Body style={styles.subtitle}>Sign in to continue building your life.</Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={[styles.form, styles.glassCard]}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
            />

            {error ? <Body style={styles.errorText}>{error}</Body> : null}

            <Button
              title={loading ? 'Signing in…' : 'Sign in'}
              onPress={handleSignIn}
              disabled={loading}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Caption style={styles.dividerText}>or</Caption>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.googleBtn} onPress={handleGoogleSignIn}>
              <Ionicons name="logo-google" size={18} color={c.textPrimary} />
              <Body style={styles.googleBtnLabel}>Continue with Google</Body>
            </Pressable>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={16}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}

            <View style={styles.registerRow}>
              <Caption style={styles.registerPrompt}>Don't have an account? </Caption>
              <Pressable onPress={() => router.push('/(auth)/sign-up')}>
                <Caption style={styles.registerLink}>Create one</Caption>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  glassCard: {
    backgroundColor: colors.background + 'B3', // 70% bg over the aurora
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        } as unknown as object)
      : {}),
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxxl,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  registerPrompt: {
    color: colors.textMuted,
  },
  registerLink: {
    color: colors.primary,
    fontFamily: fonts.bodyMedium,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  googleBtnLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMedium,
  },
  appleBtn: {
    width: '100%',
    minHeight: 56,
  },
});
