import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts } from '@/theme/typography';
import { track } from '@/utils/telemetry';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    track('ui_crash', {
      error: error.message,
      stack: info.componentStack,
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.panel}>
          <Caption style={styles.eyebrow}>LIFEOS</Caption>
          <Heading style={styles.title}>Something went sideways.</Heading>
          <Body style={styles.body}>
            This screen hit an unexpected error. You can retry, and if telemetry is enabled we have logged a crash report.
          </Body>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Body style={styles.buttonText}>Try again</Body>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.heading,
  },
  title: {
    color: colors.textPrimary,
  },
  body: {
    color: colors.textSecondary,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.background,
    fontFamily: fonts.heading,
  },
});
