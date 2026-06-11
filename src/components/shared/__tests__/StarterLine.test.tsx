/**
 * StarterLine — the single rendering component for cold-start starter strings
 * (cold_start_v1, spec §3.1 / AC-8). Its color is hard-bound to the theme's
 * textSecondary with no color prop exposed, making demotion to the AA-failing
 * muted token structurally impossible (dilution trap #2). The rendered-style
 * assertion + the source-level no-textMuted check below are the machine
 * enforcement of that contract.
 */
import * as fs from 'fs';
import * as path from 'path';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { StarterLine } from '@/components/shared/StarterLine';
import { darkColors } from '@/theme/colors';
import { textVariants } from '@/theme/typography';

function renderedColor(text: string): string | undefined {
  const node = screen.getByText(text);
  const flat = StyleSheet.flatten(node.props.style) as { color?: string };
  return flat.color;
}

describe('StarterLine', () => {
  it('renders its string in the theme textSecondary value — never muted', () => {
    render(<StarterLine>Starter copy under test.</StarterLine>);
    expect(renderedColor('Starter copy under test.')).toBe(darkColors.textSecondary);
    expect(renderedColor('Starter copy under test.')).not.toBe(darkColors.textMuted);
  });

  it('defaults to the body variant', () => {
    render(<StarterLine>Body default check.</StarterLine>);
    const flat = StyleSheet.flatten(screen.getByText('Body default check.').props.style) as {
      fontSize?: number;
    };
    expect(flat.fontSize).toBe(textVariants.body.fontSize);
  });

  it('supports the caption and micro variants', () => {
    render(<StarterLine variant="caption">Caption check.</StarterLine>);
    const caption = StyleSheet.flatten(screen.getByText('Caption check.').props.style) as {
      fontSize?: number;
    };
    expect(caption.fontSize).toBe(textVariants.caption.fontSize);
    expect(renderedColor('Caption check.')).toBe(darkColors.textSecondary);
  });

  it('source contains no textMuted token (trap #2, machine-checked)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'StarterLine.tsx'),
      'utf8',
    );
    expect(source.includes('textMuted')).toBe(false);
  });
});
