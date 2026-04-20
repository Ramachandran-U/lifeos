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
    index:   { name: 'home',     activeColor: c.primary   },
    goals:   { name: 'flag',     activeColor: c.goal      },
    health:  { name: 'heart',    activeColor: c.health    },
    finance: { name: 'wallet',   activeColor: c.finance   },
    career:  { name: 'briefcase',activeColor: c.career    },
    explore: { name: 'compass',  activeColor: c.polymath  },
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
      <Tabs.Screen name="goals"   options={{ title: 'Goals'   }} />
      <Tabs.Screen name="health"  options={{ title: 'Health'  }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance' }} />
      <Tabs.Screen name="career"  options={{ title: 'Career'  }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
    </Tabs>
  );
}
