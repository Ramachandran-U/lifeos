import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

type TabIcon = {
  name: keyof typeof Ionicons.glyphMap;
  activeColor: string;
};

function getTabConfig(c: ReturnType<typeof useColors>): Record<string, TabIcon> {
  return {
    index:   { name: 'home',           activeColor: c.primary  },
    life:    { name: 'apps',           activeColor: c.primary  },
    explore: { name: 'compass',        activeColor: c.polymath },
    rewards: { name: 'trophy',         activeColor: c.xp       },
    profile: { name: 'person-circle',  activeColor: c.primary  },
  };
}

export default function TabLayout() {
  const c = useColors();
  const tabConfig = getTabConfig(c);

  return (
    <Tabs
      screenOptions={({ route }) => {
        const config = tabConfig[route.name] ?? { name: 'ellipse' as const, activeColor: c.primary };
        return {
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
    </Tabs>
  );
}
