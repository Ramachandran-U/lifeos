// Aurora motion tokens — see DESIGN_DOC.md
// Use `SPRING.standard` for tap/press interactions, `SPRING.soft` for large overlays,
// and `TIMING.*` for non-physical transitions (opacity, progress bars).

export const SPRING = {
  standard: { stiffness: 180, damping: 22 },
  soft:     { stiffness: 120, damping: 18 },
  snappy:   { stiffness: 260, damping: 24 },
} as const;

export const TIMING = {
  fast:    150,
  normal:  300,
  slow:    600,
} as const;
