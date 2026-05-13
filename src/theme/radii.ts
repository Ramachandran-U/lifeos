// Aurora Refined corner geometry. One curve, five sizes.
// pill > card > control > tile > hairline. Use these tokens — never hardcode.

export const radii = {
  pill: 999,
  card: 22,
  control: 14,
  tile: 10,
  hairline: 4,
} as const;

export type Radius = keyof typeof radii;
