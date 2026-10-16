/**
 * Shape and spacing tokens. Mirrors irbis-docs/design/design.md (Shape and spacing, Motion).
 */

/** Spacing scale (px), keyed by value: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 28 · 32 · 44 · 48 · 56. */
export const spacing = {
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  32: 32,
  44: 44,
  48: 48,
  56: 56,
} as const;

/** Screen side padding (design: 22–24). */
export const screenPadding = spacing[22];

export const radii = {
  button: 16,
  tile: 16,
  card: 20,
  sheet: 24,
  largeCard: 24,
  pill: 999,
} as const;

export const borders = {
  card: 2,
  /** Card and button bottom edge ("4 px bottom shadow"). */
  edge: 4,
  /** Condition ring stroke. */
  ring: 5,
} as const;

export const sizes = {
  buttonMinHeight: 54,
  buttonPaddingVertical: 8,
  buttonPaddingHorizontal: 20,
  chipHeight: 28,
  chipPaddingHorizontal: 10,
  placeTypeDot: 44,
  pathNode: 64,
  conditionRing: 72,
  conditionNode: 54,
  icon: 20,
  iconStroke: 2.5,
  touchTarget: 44,
} as const;

/** Path node drop shadow: 5 px, rgba(0,0,0,.18). */
export const elevation = {
  node: { offsetY: 5, opacity: 0.18, radius: 5, androidElevation: 5 },
} as const;

/** Motion (design.md Motion + engineering-standards §1). */
export const motion = {
  press: 150,
  enter: 250,
  exit: 200,
  layout: 300,
  pressScale: 0.97,
  pressOpacity: 0.9,
  /** Button press-down distance — equals the bottom edge. */
  pressDepth: 4,
  listStagger: 30,
} as const;
