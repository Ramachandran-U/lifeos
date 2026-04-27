import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';

type Status = 'working' | 'ok' | 'error';

interface OAuthCallbackViewProps {
  /** Copy shown while the handshake is running. */
  workingTitle: string;
  /** Copy shown after success, before the redirect timer fires. */
  okTitle: string;
  okSubtitle: string;
  errorTitle: string;
  /** Web-only feature gate copy if hit on native. */
  nativeUnsupportedMsg: string;
  /** Runs the token exchange once the OAuth code is in hand. */
  exchange: (code: string, clientId: string) => Promise<void>;
  /**
   * Optional follow-up after `exchange` resolves (e.g. fetch profile,
   * upsert user). Receives the same clientId.
   */
  onSuccess?: (clientId: string) => Promise<void> | void;
  /** Where to send the user once we are done. */
  redirectTo: () => Promise<string> | string;
  /** Delay in ms before navigating after success. Default 500. */
  redirectDelayMs?: number;
  router: { replace: (href: string) => void };
}

export function OAuthCallbackView({
  workingTitle,
  okTitle,
  okSubtitle,
  errorTitle,
  nativeUnsupportedMsg,
  exchange,
  onSuccess,
  redirectTo,
  redirectDelayMs = 500,
  router,
}: OAuthCallbackViewProps) {
  const c = useColors();
  const [status, setStatus] = useState<Status>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setStatus('error');
      setError(nativeUnsupportedMsg);
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

    let cancelled = false;
    (async () => {
      try {
        await exchange(code, clientId);
        if (onSuccess) await onSuccess(clientId);
        if (cancelled) return;
        setStatus('ok');
        const dest = await redirectTo();
        setTimeout(() => router.replace(dest), redirectDelayMs);
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
            <Heading style={[styles.title, { color: c.textPrimary }]}>{workingTitle}</Heading>
            <Caption style={{ color: c.textMuted }}>Finishing the handshake.</Caption>
          </>
        )}
        {status === 'ok' && (
          <>
            <Ionicons name="checkmark-circle" size={56} color={c.success} />
            <Heading style={[styles.title, { color: c.textPrimary }]}>{okTitle}</Heading>
            <Caption style={{ color: c.textMuted }}>{okSubtitle}</Caption>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="alert-circle" size={56} color={c.error} />
            <Heading style={[styles.title, { color: c.textPrimary }]}>{errorTitle}</Heading>
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
