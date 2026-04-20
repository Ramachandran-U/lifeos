import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { createUser, getUserByEmail } from '@/db/queries/users';
import { generateSalt, hashPassword } from '@/utils/auth';
import { useUserStore } from '@/store/useUserStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const router = useRouter();
  const { setUser } = useUserStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const existing = getUserByEmail(trimmedEmail);
      if (existing) {
        setError('An account with this email already exists. Please sign in.');
        return;
      }

      const salt = await generateSalt();
      const hash = await hashPassword(password, salt);
      const userId = await createUser({
        email: trimmedEmail,
        passwordHash: hash,
        passwordSalt: salt,
        name: trimmedName,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUser(userId, trimmedName, trimmedEmail, 0);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.form}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});
