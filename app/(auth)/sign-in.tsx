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
import { getUserByEmail, setWebSession } from '@/db/queries/users';
import { verifyPassword } from '@/utils/auth';
import { useUserStore } from '@/store/useUserStore';

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useUserStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const user = getUserByEmail(trimmedEmail);
      if (!user) {
        setError('No account found with that email. Please register first.');
        return;
      }

      const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
      if (!valid) {
        setError('Incorrect password. Please try again.');
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWebSession(user.id);
      setUser(user.id, user.name, user.email, user.onboardingStage);
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
            <Heading style={styles.title}>Welcome back</Heading>
            <Body style={styles.subtitle}>Sign in to continue building your life.</Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.form}>
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
});
