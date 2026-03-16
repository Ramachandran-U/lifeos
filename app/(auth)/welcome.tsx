import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body } from '@/components/ui/Typography';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.Text entering={FadeIn.duration(800)} style={styles.logo}>
          LifeOS
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Body style={styles.tagline}>Your Digital Life Architect</Body>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.description}>
          <Body style={styles.descText}>
            One system that understands every dimension of your life and turns it into a liveable daily structure.
          </Body>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.bottom}>
        <Button
          title="Let's build your life plan"
          onPress={() => router.push('/(onboarding)/day1-vision')}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: fontSizes.xl,
    textAlign: 'center',
  },
  description: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  descText: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
