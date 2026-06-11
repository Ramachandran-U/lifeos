import { Text } from '@/components/ui/Text';
import { useColors } from '@/theme/colors';

/**
 * The single rendering component for every single-line cold-start starter
 * string (cold_start_v1, spec §3.1). Color is hard-bound to the theme's
 * textSecondary — there is intentionally NO color prop, which makes demotion
 * to the AA-failing muted token structurally impossible (dilution trap #2).
 */
interface StarterLineProps {
  children: string;
  variant?: 'body' | 'caption' | 'micro';
}

export function StarterLine({ children, variant = 'body' }: StarterLineProps) {
  const c = useColors();
  return (
    <Text variant={variant} color={c.textSecondary}>
      {children}
    </Text>
  );
}
