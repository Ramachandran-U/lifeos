import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from '@/theme/typography';
import { initDatabase } from '@/db';
import { getUser } from '@/db/queries/users';
import { useUserStore, ONBOARDING_COMPLETE } from '@/store/useUserStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { userId, onboardingStage, setUser } = useUserStore();

  useEffect(() => {
    async function init() {
      await initDatabase();
      const user = getUser();
      if (user) {
        setUser(user.id, user.name, user.onboardingStage);
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

    if (!userId) {
      if (!inAuth) router.replace('/(auth)/welcome');
    } else if (onboardingStage < ONBOARDING_COMPLETE) {
      if (!inOnboarding) router.replace('/(onboarding)/day1-vision');
    } else {
      if (!inTabs) router.replace('/(tabs)');
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
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
