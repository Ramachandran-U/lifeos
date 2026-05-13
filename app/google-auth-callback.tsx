import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { supabase } from '@/integrations/supabase/client';
import { ensureLocalUserFromAuth, getUserByEmail, setWebSession } from '@/db/queries/users';
import { useUserStore } from '@/store/useUserStore';

type Status = 'working' | 'ok' | 'error';

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const c = useColors();
  const setUser = useUserStore((s) => s.setUser);
  const [status, setStatus] = useState<Status>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setStatus('error');
      setError('Google sign-in is only supported on web right now.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // supabase-js consumes the URL hash on load (detectSessionInUrl: true).
        // Poll briefly for the session to appear, then proceed.
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; i < 20 && !session; i++) {
          await new Promise((r) => setTimeout(r, 100));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!session?.user) throw new Error('No Supabase session after Google sign-in.');

        const email = session.user.email ?? '';
        const name =
          (session.user.user_metadata?.name as string | undefined) ||
          (session.user.user_metadata?.full_name as string | undefined) ||
          email.split('@')[0];

        await ensureLocalUserFromAuth({ userId: session.user.id, email, name });
        setWebSession(session.user.id);
        const local = getUserByEmail(email);
        const stage = local?.onboardingStage ?? 0;
        setUser(session.user.id, name, email, stage);

        if (cancelled) return;
        setStatus('ok');
        const dest = stage === 0 ? '/welcome-intent' : '/(tabs)';
        setTimeout(() => router.replace(dest), 400);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.container}>
        {status === 'working' && (
          <>
            <LoadingDots />
            <Heading style={[styles.title, { color: c.textPrimary }]}>Signing you in with Google…</Heading>
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
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  title: { textAlign: 'center' },
});
