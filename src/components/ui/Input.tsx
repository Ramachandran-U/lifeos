import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Label, Caption } from './Typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
}

export function Input({ label, error, showCharCount, maxLength, value, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : undefined, style]}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      <View style={styles.footer}>
        {error ? <Caption color={colors.error}>{error}</Caption> : <View />}
        {showCharCount && maxLength ? (
          <Caption>{(value?.length ?? 0)}/{maxLength}</Caption>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
