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
import { AuroraAnimatedBackground } from '@/components/shared/AuroraAnimatedBackground';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { ensureLocalUserFromAuth, setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';
import { signUpWithEmail, signInWithApple, startGoogleSupabaseOAuth } from '@/integrations/supabase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const c = useColors();
  const styles = makeStyles(c);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleRegister = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUpWithEmail(trimmedEmail, password, trimmedName);
      await ensureLocalUserFromAuth(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWebSession(result.userId);
      setUser(result.userId, result.name, result.email, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (/already registered|user already exists/i.test(msg)) {
        setError('An account with this email already exists. Please sign in.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    setError('');
    try {
      const result = await signInWithApple();
      await ensureLocalUserFromAuth(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWebSession(result.userId);
      setUser(result.userId, result.name, result.email, 0);
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
      <AuroraAnimatedBackground />
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
            <Heading style={styles.title}>Create your account</Heading>
            <Body style={styles.subtitle}>
              Your data stays on your device. We never see your information.
            </Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={[styles.form, styles.glassCard]}>
            <Input
              label="Your name"
              placeholder="Alex"
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              autoCapitalize="words"
            />

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
              placeholder="At least 8 characters"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
            />

            <Input
              label="Confirm password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
              secureTextEntry
            />

            {error ? <Body style={styles.errorText}>{error}</Body> : null}

            <Button
              title={loading ? 'Creating account…' : 'Create account'}
              onPress={handleRegister}
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
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={16}
                style={styles.appleBtn}
                onPress={handleAppleSignUp}
              />
            )}

            <View style={styles.signInRow}>
              <Caption style={styles.signInPrompt}>Already have an account? </Caption>
              <Pressable onPress={() => router.back()}>
                <Caption style={styles.signInLink}>Sign in</Caption>
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
    backgroundColor: colors.background + 'B3',
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
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  signInPrompt: {
    color: colors.textMuted,
  },
  signInLink: {
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
