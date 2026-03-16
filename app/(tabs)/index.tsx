import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Heading, Body } from '@/components/ui/Typography';

export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Heading>Good morning</Heading>
        <Body style={styles.subtitle}>Your day at a glance</Body>
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
    paddingTop: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
