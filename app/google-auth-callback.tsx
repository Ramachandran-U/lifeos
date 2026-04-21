import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { handleGoogleAuthCallback } from '@/integrations/googleAuth/oauth';
import { fetchGoogleProfile } from '@/integrations/googleAuth/client';
import { upsertGoogleUser, getUserByEmail, setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';

export default function GoogleAuthCallbackScreen() {
  const c = useColors();
  const router = useRouter();
  const { setUser } = useUserStore();
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setStatus('error');
      setError('Google sign-in is only supported on web right now.');
      return;
    }

    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setStatus('error');
      setError('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errParam = params.get('error');
    if (errParam) { setStatus('error'); setError(errParam); return; }
    if (!code) { setStatus('error'); setError('No authorization code returned by Google.'); return; }

    (async () => {
      try {
        await handleGoogleAuthCallback(code, clientId);
        const profile = await fetchGoogleProfile(clientId);
        const userId = await upsertGoogleUser({ email: profile.email, name: profile.name });
        setWebSession(userId);
        const user = getUserByEmail(profile.email);
        if (user) setUser(user.id, user.name, user.email, user.onboardingStage);
        setStatus('ok');
        setTimeout(() => router.replace('/(tabs)'), 400);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [router, setUser]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.container}>
        {status === 'working' && (
          <>
            <LoadingDots />
            <Heading style={[styles.title, { color: c.textPrimary }]}>Signing you in with Google...</Heading>
            <Caption style={{ color: c.textMuted }}>Finishing the handshake.</Caption>
          </>
        )}
        {status === 'ok' && (
          <>
            <Ionicons name="checkmark-circle" size={56} color={c.success} />
            <Heading style={[styles.title, { color: c.textPrimary }]}>Signed in</Heading>
            <Caption style={{ color: c.textMuted }}>Redirecting…</Caption>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="alert-circle" size={56} color={c.error} />
            <Heading style={[styles.title, { color: c.textPrimary }]}>Sign-in failed</Heading>
            <Body style={{ color: c.textSecondary, textAlign: 'center' }}>{error}</Body>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  title: { textAlign: 'center' },
});
