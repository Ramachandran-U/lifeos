import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button3D } from '@/components/ui/Button3D';
import { Body } from '@/components/ui/Typography';
import { AuroraAnimatedBackground } from '@/components/shared/AuroraAnimatedBackground';

export default function WelcomeScreen() {
  const router = useRouter();
  const c = useColors();

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <AuroraAnimatedBackground />
      <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.Text entering={FadeIn.duration(800)} style={[styles.logo, { color: c.primary }]}>
          LifeOS
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Body style={[styles.tagline, { color: c.textSecondary }]}>Your Digital Life Architect</Body>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.description}>
          <Body style={[styles.descText, { color: c.textMuted }]}>
            One system that understands every dimension of your life and turns it into a liveable daily structure.
          </Body>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.bottom}>
        <Button3D
          title="Let's build your life plan"
          onPress={() => router.push('/(onboarding)/day1-vision')}
          fullWidth
        />
      </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: fontSizes.hero,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSizes.xl,
    textAlign: 'center',
  },
  description: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  descText: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
