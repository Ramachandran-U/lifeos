import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
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
  const c = useColors();
  return (
    <View style={styles.container}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <TextInput
        style={[
          {
            backgroundColor: c.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: error ? c.error : c.border,
            paddingHorizontal: spacing.md,
            paddingVertical: 14,
            fontFamily: fonts.body,
            fontSize: fontSizes.md,
            color: c.textPrimary,
          },
          style,
        ]}
        placeholderTextColor={c.textMuted}
        selectionColor={c.primary}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      <View style={styles.footer}>
        {error ? <Caption color={c.error}>{error}</Caption> : <View />}
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
