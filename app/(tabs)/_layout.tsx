import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

type TabIcon = {
  name: keyof typeof Ionicons.glyphMap;
  activeColor: string;
};

const tabConfig: Record<string, TabIcon> = {
  index: { name: 'home', activeColor: colors.primary },
  goals: { name: 'flag', activeColor: colors.goal },
  health: { name: 'heart', activeColor: colors.health },
  career: { name: 'briefcase', activeColor: colors.career },
  explore: { name: 'compass', activeColor: colors.polymath },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const config = tabConfig[route.name] ?? { name: 'ellipse' as const, activeColor: colors.primary };
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: config.activeColor,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.name} size={size} color={color} />
          ),
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="health" options={{ title: 'Health' }} />
      <Tabs.Screen name="career" options={{ title: 'Career' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 88,
    paddingBottom: 24,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
});
