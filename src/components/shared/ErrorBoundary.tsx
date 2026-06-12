import { Component, type ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { track, EVENTS } from '@/utils/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Class component because React still requires class components for
// componentDidCatch / getDerivedStateFromError. Wraps the root Stack so any
// uncaught render error in the app gets a fallback UI + a telemetry breadcrumb,
// rather than silently unmounting the whole tree.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    track(EVENTS.uiCrash, {
      message: error.message,
      stack: error.stack?.slice(0, 2000),
      componentStack: info.componentStack?.slice(0, 2000) ?? null,
    });
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const c = useColors();
  const styles = makeStyles(c);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={56} color={c.error} />
        <Heading style={[styles.title, { color: c.textPrimary }]}>Something went wrong</Heading>
        <Caption style={{ color: c.textMuted, textAlign: 'center' }}>
          The screen hit an unexpected error. The crash has been logged so we can fix it.
        </Caption>
        <Body style={[styles.message, { color: c.textSecondary }]} numberOfLines={4}>
          {error.message || 'Unknown error'}
        </Body>
        <Pressable onPress={onReset} style={[styles.button, { backgroundColor: c.textPrimary }]}>
          <Body style={styles.buttonText}>Try again</Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    title: { textAlign: 'center' },
    message: { textAlign: 'center', maxWidth: 480 },
    button: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xl,
      borderRadius: 16,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.inkOnColor,
      fontFamily: fonts.heading,
      fontSize: fontSizes.md,
    },
  });
