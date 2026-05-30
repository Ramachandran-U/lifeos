import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Label, Caption } from './Typography';
import { RotatingPlaceholder } from './RotatingPlaceholder';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
  /**
   * Opt-in animated placeholder. When provided (and the field is empty), these
   * hints cross-fade in place instead of the static `placeholder`. Best on
   * open-ended/intent fields (search, chat) — leave form fields on `placeholder`.
   */
  rotatingPlaceholders?: string[];
}

export function Input({ label, error, showCharCount, maxLength, value, style, rotatingPlaceholders, placeholder, ...props }: InputProps) {
  const c = useColors();
  const rotating = (rotatingPlaceholders?.length ?? 0) > 0;
  const isEmpty = !(value && value.length > 0);
  return (
    <View style={styles.container}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <View>
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
          placeholder={rotating ? undefined : placeholder}
          placeholderTextColor={c.textMuted}
          selectionColor={c.primary}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {rotating ? (
          <RotatingPlaceholder
            phrases={rotatingPlaceholders as string[]}
            active={isEmpty}
            color={c.textMuted}
            style={styles.rotating}
          />
        ) : null}
      </View>
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
  // Aligns the animated overlay with where the native placeholder text sits:
  // horizontal = paddingHorizontal (spacing.md), vertical = paddingVertical (14).
  rotating: {
    left: spacing.md,
    top: 14,
  },
});
