import 'expo-crypto';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from '@/theme/typography';
import { initDatabase } from '@/db';
import { getUser, setWebSession, ensureLocalUserFromAuth } from '@/db/queries/users';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore, type DomainId } from '@/store/useUserStore';
import { resolveGuardRedirect } from '@/utils/routeGuard';
import { AchievementToast } from '@/components/shared/AchievementToast';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LevelUpOverlay } from '@/components/gamification/LevelUpOverlay';
import { RewardOrchestrator } from '@/components/gamification/RewardOrchestrator';
import { useGameStore } from '@/store/useGameStore';
import { useFlagStore } from '@/store/useFlagStore';
import { usePromptStore } from '@/store/usePromptStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Module-level run-once guard for boot init. Without it, React StrictMode (dev)
// + remounts fire init() more than once. Today's init is idempotent (flag/prompt
// fetches are staleness-guarded), so this is future-proofing against a real
// double-spend if warmup/analytics ever land in init(). (BUG-008)
let didBootInit = false;

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { userId, onboardingStage, name, setUser } = useUserStore();
  const setPrimaryDomains = useUserStore((s) => s.setPrimaryDomains);
  const markModuleActivated = useUserStore((s) => s.markModuleActivated);
  const pendingLevelUp = useGameStore((s) => s.pendingLevelUp);
  const dismissLevelUp = useGameStore((s) => s.dismissLevelUp);

  useEffect(() => {
    async function init() {
      if (didBootInit) {
        setDbReady(true);
        return;
      }
      didBootInit = true;
      await initDatabase();

      // Hydrate local user row from any persisted Supabase session so existing
      // SQLite-backed queries stay the source of truth across the app.
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (authUser?.email) {
        await ensureLocalUserFromAuth({
          userId: authUser.id,
          email: authUser.email,
          name:
            (authUser.user_metadata?.name as string | undefined) ||
            authUser.email.split('@')[0],
        });
        setWebSession(authUser.id);
      }

      const user = getUser();
      if (user) {
        setUser(user.id, user.name, user.email, user.onboardingStage);
        const parseList = (v: unknown): string[] => {
          if (Array.isArray(v)) return v as string[];
          if (typeof v === 'string' && v) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
          return [];
        };
        const domains = parseList((user as { primaryDomains?: unknown }).primaryDomains);
        const activated = parseList((user as { activatedModules?: unknown }).activatedModules);
        const VALID: DomainId[] = ['goals', 'health', 'finance', 'career', 'social', 'polymath'];
        const isDomain = (s: string): s is DomainId => (VALID as string[]).includes(s);
        setPrimaryDomains(domains.filter(isDomain));
        activated.filter(isDomain).forEach(markModuleActivated);
      }
      // Fetch admin-portal-managed feature flags. Non-blocking — fallback
      // values cover the case where the worker is unreachable.
      useFlagStore.getState().fetchFlags().catch(() => {});
      usePromptStore.getState().fetchPrompts().catch(() => {});

      setDbReady(true);
    }
    init();

    // Only act on an EXPLICIT sign-out. The INITIAL_SESSION event fires once
    // with null on every boot for users without a Supabase session (e.g.
    // legacy email/password accounts or seeded E2E users), and we don't
    // want that to wipe the local user store.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setWebSession(null);
        useUserStore.getState().reset();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [setUser, setPrimaryDomains, markModuleActivated]);

  useEffect(() => {
    if (!fontsLoaded || !dbReady) return;
    SplashScreen.hideAsync();

    // Pure, unit-tested guard (see src/utils/routeGuard.ts). Adding a new
    // post-onboarding full-screen route means updating that file's allowlist.
    const redirect = resolveGuardRedirect({
      userId,
      onboardingStage,
      seg0: ((segments as string[])[0] ?? ''),
      seg1: ((segments as string[])[1] ?? ''),
    });
    if (redirect) router.replace(redirect);
  }, [fontsLoaded, dbReady, userId, onboardingStage, segments, router]);

  if (!fontsLoaded || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <ErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0D0D0D' },
              animation: 'fade',
            }}
          />
        </ErrorBoundary>
        <RewardOrchestrator />
        <AchievementToast />
        <LevelUpOverlay level={pendingLevelUp} userName={name ?? undefined} onClose={dismissLevelUp} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
