import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Heading, Body } from '@/components/ui/Typography';

export default function Day1VisionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Heading>What's your vision?</Heading>
        <Body style={styles.subtitle}>Tell us about the life you want to build</Body>
      </View>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
