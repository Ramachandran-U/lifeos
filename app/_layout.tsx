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
import { getUser, setWebSession } from '@/db/queries/users';
import { useUserStore, ONBOARDING_COMPLETE, type DomainId } from '@/store/useUserStore';
import { AchievementToast } from '@/components/shared/AchievementToast';
import { LevelUpOverlay } from '@/components/gamification/LevelUpOverlay';
import { useGameStore } from '@/store/useGameStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
      await initDatabase();
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
      setDbReady(true);
    }
    init();
  }, [setUser]);

  useEffect(() => {
    if (!fontsLoaded || !dbReady) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inTabs = segments[0] === '(tabs)';
    const inWelcomeIntent = segments[0] === 'welcome-intent';
    const inGoogleCallback = segments[0] === 'google-auth-callback';
    const inReflect = segments[0] === 'evening-reflect';

    if (!userId) {
      if (!inAuth && !inGoogleCallback) router.replace('/(auth)/sign-in');
    } else if (onboardingStage === 0) {
      // New flow: stage 0 = no intent captured → short welcome screen
      if (!inWelcomeIntent && !inOnboarding) router.replace('/welcome-intent');
    } else if (onboardingStage < ONBOARDING_COMPLETE) {
      // Legacy flow: existing users mid-onboarding keep the old screens
      if (!inOnboarding) router.replace('/(onboarding)/day1-vision');
    } else {
      if (!inTabs && !inReflect) router.replace('/(tabs)');
    }
  }, [fontsLoaded, dbReady, userId, onboardingStage, segments, router]);

  if (!fontsLoaded || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0D0D0D' },
            animation: 'fade',
          }}
        />
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
