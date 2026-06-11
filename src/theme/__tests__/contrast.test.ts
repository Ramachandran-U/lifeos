// Changing any threshold or pinned hex here requires founder sign-off in the PR description.
/**
 * The contrast lock (Ink + Signal, Cluster 3 §A.6) — the AA guarantee.
 *
 * Implements WCAG 2.1 relative-luminance contrast, alpha-composites rgba
 * tokens onto their declared surfaces, and asserts ≥ 4.5:1 for every pair in
 * the TEXT_ON_SURFACE matrix — in BOTH palettes. Also pins exact hex equality
 * for the load-bearing tokens so "soften it 10%" is a deliberate, founder-
 * gated test edit instead of a drive-by (dilution trap 5).
 */

import { darkColors, lightColors, type AppColors } from '../colors';

type RGB = { r: number; g: number; b: number; a: number };

function parse(color: string): RGB {
  const hex = color.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const v = parseInt(hex[1], 16);
    return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff, a: 1 };
  }
  const rgba = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  }
  throw new Error(`unparseable color: ${color}`);
}

/** Alpha-composite fg over an OPAQUE bg. */
function composite(fg: RGB, bg: RGB): RGB {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: RGB): number {
  return 0.2126 * channelLum(c.r) + 0.7152 * channelLum(c.g) + 0.0722 * channelLum(c.b);
}

/** WCAG contrast of fg text over bg surface (fg composited if translucent). */
function contrast(fgColor: string, bgColor: string, ground: string): number {
  // A translucent surface composes onto the theme ground first.
  const bg = composite(parse(bgColor), parse(ground));
  const fg = composite(parse(fgColor), bg);
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const AA = 4.5;
const DOMAINS = ['goal', 'health', 'finance', 'career', 'social', 'polymath'] as const;
const BADGE_FILL = '#FFB300'; // badge FILLS are gold in both modes (§A.5)

function runMatrix(name: string, c: AppColors) {
  const ground = c.background;

  describe(`${name} palette — TEXT_ON_SURFACE matrix ≥ ${AA}:1`, () => {
    // textPrimary | textSecondary | textMuted × background | card | surfaceAlt
    for (const text of ['textPrimary', 'textSecondary', 'textMuted'] as const) {
      for (const surface of ['background', 'card', 'surfaceAlt'] as const) {
        it(`${text} on ${surface}`, () => {
          expect(contrast(c[text], c[surface], ground)).toBeGreaterThanOrEqual(AA);
        });
      }
    }

    // all six *Text × background | card | own *Dim
    for (const d of DOMAINS) {
      const text = c[`${d}Text`];
      for (const surface of ['background', 'card'] as const) {
        it(`${d}Text on ${surface}`, () => {
          expect(contrast(text, c[surface], ground)).toBeGreaterThanOrEqual(AA);
        });
      }
      it(`${d}Text on ${d}Dim`, () => {
        expect(contrast(text, c[`${d}Dim`], ground)).toBeGreaterThanOrEqual(AA);
      });
    }

    // inkOnColor × six hues + primary + badge fill
    for (const d of DOMAINS) {
      it(`inkOnColor on ${d}`, () => {
        expect(contrast(c.inkOnColor, c[d], ground)).toBeGreaterThanOrEqual(AA);
      });
    }
    it('inkOnColor on primary (dark fill)', () => {
      // inkOnColor is the on-accent ink; on the DARK primary fill it must clear
      // AA (the light primary uses onPrimary white — asserted below).
      expect(contrast(darkColors.inkOnColor, darkColors.primary, darkColors.background)).toBeGreaterThanOrEqual(AA);
    });
    it('inkOnColor on badge fill #FFB300', () => {
      expect(contrast(c.inkOnColor, BADGE_FILL, ground)).toBeGreaterThanOrEqual(AA);
    });

    // onPrimary × primary | error
    it('onPrimary on primary', () => {
      expect(contrast(c.onPrimary, c.primary, ground)).toBeGreaterThanOrEqual(AA);
    });
    it('onPrimary on error', () => {
      expect(contrast(c.onPrimary, c.error, ground)).toBeGreaterThanOrEqual(AA);
    });

    // error | warning | success | xp | streak | badge × background | card
    for (const sem of ['error', 'warning', 'success', 'xp', 'streak', 'badge'] as const) {
      for (const surface of ['background', 'card'] as const) {
        it(`${sem} on ${surface}`, () => {
          expect(contrast(c[sem], c[surface], ground)).toBeGreaterThanOrEqual(AA);
        });
      }
    }
  });
}

runMatrix('dark', darkColors);
runMatrix('light', lightColors);

describe('pinned hexes — a palette change is a deliberate test edit, not a drive-by', () => {
  it('the six domain hues, ground, card, primary, and inkOnColor are exact', () => {
    expect(darkColors.goal).toBe('#FF7733');
    expect(darkColors.health).toBe('#00D68F');
    expect(darkColors.finance).toBe('#FFB300');
    expect(darkColors.career).toBe('#4D9FFF');
    expect(darkColors.social).toBe('#FF5C97');
    expect(darkColors.polymath).toBe('#1FC8FF');
    expect(darkColors.background).toBe('#000000');
    expect(darkColors.card).toBe('#101014');
    expect(darkColors.primary).toBe('#8B7CFF');
    expect(darkColors.inkOnColor).toBe('#0B0B0D');
  });

  it('domain hues are mode-independent (light palette shares the six fills)', () => {
    for (const d of DOMAINS) {
      expect(lightColors[d]).toBe(darkColors[d]);
    }
  });
});
