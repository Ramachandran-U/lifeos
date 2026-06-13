import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { haptic } from '@/utils/haptics';
import { isEnabled } from '@/config/flags';
import { useMotionScale } from '@/theme/motion';
import { tabTransition } from '@/navigation/transitions';
import { VoiceCompanion } from '@/components/shared/VoiceCompanion';

type TabIcon = {
  name: keyof typeof Ionicons.glyphMap;
  activeColor: string;
};

function getTabConfig(c: ReturnType<typeof useColors>): Record<string, TabIcon> {
  return {
    // Violet voice ruling (2026-06-14): violet is never a selection state.
    // Domain tabs keep their meaningful hues; neutral tabs select in ink.
    index:   { name: 'home',           activeColor: c.textPrimary },
    life:    { name: 'grid',           activeColor: c.textPrimary },
    explore: { name: 'compass',        activeColor: c.polymath    },
    rewards: { name: 'trophy',         activeColor: c.xp          },
    profile: { name: 'person-circle',  activeColor: c.textPrimary },
  };
}

export default function TabLayout() {
  const c = useColors();
  const tabConfig = getTabConfig(c);
  const motionScale = useMotionScale();
  // M1: subtle lateral shift between tabs (flag-gated; 'none' on reduce-motion).
  const transition = tabTransition({ enabled: isEnabled('motionTransitions'), motionScale });

  return (
    // Wrap so the persistent voice companion can overlay the tab navigator and
    // survive tab switches (the layout doesn't remount; the screens inside do).
    <View style={{ flex: 1 }}>
    <Tabs
      // M0 haptic gap-fill: tab switches are meaningful navigation, so they
      // get a selection tick (no-op on web; flag-gated for safe rollout).
      screenListeners={{
        tabPress: () => {
          if (isEnabled('motionPolish')) haptic.selection();
        },
      }}
      screenOptions={({ route }) => {
        const config = tabConfig[route.name] ?? { name: 'ellipse' as const, activeColor: c.textPrimary };
        return {
          ...transition,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            borderTopWidth: 1,
            height: 88,
            paddingBottom: 24,
            paddingTop: 8,
          },
          tabBarActiveTintColor: config.activeColor,
          tabBarInactiveTintColor: c.textMuted,
          tabBarLabelStyle: {
            fontFamily: fonts.bodyMedium,
            fontSize: fontSizes.xs,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.name} size={size} color={color} />
          ),
        };
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Today'   }} />
      <Tabs.Screen name="life"    options={{ title: 'Life'    }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/* Routable but hidden from tab bar — accessed via Life hub. */}
      <Tabs.Screen name="goals"   options={{ href: null }} />
      <Tabs.Screen name="health"  options={{ href: null }} />
      <Tabs.Screen name="finance" options={{ href: null }} />
      <Tabs.Screen name="career"  options={{ href: null }} />
      <Tabs.Screen name="social"  options={{ href: null }} />
    </Tabs>
    <VoiceCompanion />
    </View>
  );
}
