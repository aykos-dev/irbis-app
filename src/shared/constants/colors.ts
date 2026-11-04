/**
 * Colour tokens. Mirrors irbis-docs/design/design.md (Colour) verbatim — the only file in the app
 * where raw hex may appear. Add new values to design.md first.
 */

/** Core palette — identical in light and dark. */
export const palette = {
  teal: '#1CB0A8',
  teal700: '#0C807A',
  teal700Edge: '#075B56',
  tealIconEdge: '#0E8A83',
  tealTint: '#E3F7F5',
  orange: '#FF9F1C',
  orangeEdge: '#CC7A00',
  onOrange: '#3A2200',
  orangeTint: '#FFF1DA',
  sky: '#4CA9FF',
  purple: '#7B61FF',
  pine: '#3DAA5C',
  stone: '#8A979C',
  red: '#FF4B4B',
  red700: '#D93636',
  red700Edge: '#A12121',
  gold: '#FFC800',
  goldEdge: '#D9A500',
  onGold: '#6E4E00',
  white: '#FFFFFF',
} as const;

/** Surfaces and text, per scheme. */
const lightSurfaces = {
  bg: '#F7F7F2',
  card: '#FFFFFF',
  line: '#E5E5DC',
  ink: '#1F2A2E',
  body: '#3C4A4F',
  muted: '#5E6E74',
  soft: '#EEF0E8',
  navActiveBg: '#E3F7F5',
  navActiveBorder: '#1CB0A8',
  navActiveFg: '#0C807A',
  disabledBg: '#E5E5DC',
  disabledFg: '#6B787D',
} as const;

/**
 * Dark values. `body`, `soft` and `disabled*` are marked "derived — confirm" in design.md and have
 * no dark value there yet; until confirmed they reuse the nearest confirmed dark tokens
 * (body → ink, soft → line, disabled → line / muted).
 */
const darkSurfaces: Record<keyof typeof lightSurfaces, string> = {
  bg: '#131D22',
  card: '#1C2A30',
  line: '#2B3B42',
  ink: '#F1F5F4',
  body: '#F1F5F4',
  muted: '#9AA8AD',
  soft: '#2B3B42',
  navActiveBg: '#123B3A',
  navActiveBorder: '#1CB0A8',
  navActiveFg: '#5FD6CE',
  disabledBg: '#2B3B42',
  disabledFg: '#9AA8AD',
};

/** Condition status — always colour + icon + label. */
export const conditionColors = {
  go: { chipBg: '#DFF6E7', chipFg: '#1B6B3E', ring: '#3DAA5C' },
  caution: { chipBg: '#FFF1BF', chipFg: '#6E4E00', ring: '#FFC800' },
  notNow: { chipBg: '#FFE1E1', chipFg: '#B32424', ring: '#FF4B4B' },
  seasonalLock: { chipBg: '#ECEEEF', chipFg: '#56646A', ring: '#AEB8BC', node: '#C9D1D4' },
} as const;

export const placeTypeColors = {
  peak: '#1CB0A8',
  lake: '#4CA9FF',
  cave: '#7B61FF',
  camping: '#3DAA5C',
  trail: '#FF9F1C',
  /** Placeholder (owner Q8, STATUS known issue) — not in design.md yet. */
  waterfall: '#2BA3C4',
  /** Placeholder (owner Q8, STATUS known issue) — not in design.md yet. */
  canyon: '#D9733F',
} as const;

export const levelColors = {
  1: { color: '#58B368', edge: '#3E8E4D', tint: '#E4F5E7', text: '#2D6E3A' },
  2: { color: '#C98B4E', edge: '#A06A33', tint: '#F7EADB', text: '#7A4E1F' },
  3: { color: '#F2802E', edge: '#C9601A', tint: '#FFE9D9', text: '#9A4510' },
  4: { color: '#1CB0A8', edge: '#0E8A83', tint: '#DDF5F3', text: '#0C6E69' },
  5: { color: '#4C7BD9', edge: '#335FB8', tint: '#E3ECFB', text: '#2A4F9A' },
  6: { color: '#7B61FF', edge: '#5B42DB', tint: '#ECE8FF', text: '#4B33C4' },
  7: { color: '#E5A800', edge: '#B88600', tint: '#FFF6D6', text: '#7A5800' },
} as const;

export const difficultyBootColor = '#7A4E2D';

/**
 * Level-screen requirement rows (canvas Level, brief levels-3): icon tile and bar fill per row.
 * `checkInsTile` is not in design.md yet.
 */
export const levelRequirementColors = {
  xpTile: palette.gold,
  xpBar: palette.gold,
  lessonsTile: palette.red700,
  lessonsBar: palette.teal,
  checkInsTile: '#8C5A33',
  checkInsBar: levelColors[3].color,
  spotsTile: palette.pine,
  spotsBar: palette.pine,
} as const;

/**
 * LevelUp screen (canvas LevelUp, brief levels-4): teal backdrop, sunburst rays, flash and glow,
 * the yellow headline and boots, the gold Continue button and the four confetti rects.
 * `bg` and `headline` are not in design.md yet.
 */
export const levelUpColors = {
  bg: '#0B6F6A',
  headline: '#FFD95A',
  boots: '#FFD95A',
  ray: palette.white,
  flash: palette.white,
  glow: palette.white,
  card: palette.white,
  continue: palette.gold,
  continueEdge: palette.goldEdge,
  onContinue: palette.onGold,
  path: palette.white,
  confetti: [palette.gold, palette.orange, palette.sky, palette.red],
} as const;

export const mascotColors = {
  fur: '#EDF0F3',
  rosettes: '#8E99A6',
  backpack: '#FF9F1C',
  moodExcited: '#E3F7F5',
  moodProud: '#FFF1DA',
  moodWorried: '#E2F0FF',
  moodSleepy: '#EEEAFF',
  moodSadButCute: '#F0F1F2',
} as const;

/**
 * Monthly path (irbis-docs/design/media/weekly-path/LAYOUT.md). Dark ring tints are brighter
 * variants of `conditionColors.*.ring` for the dark bg (derived — confirm in design.md); the
 * caution badge glyph and chest wood are canvas values not in design.md yet.
 */
export const pathColors = {
  ringDark: { go: '#5CC97B', caution: '#FFD43B', notNow: '#FF7070', seasonalLock: '#C3CCD0' },
  badge: { go: palette.pine, caution: palette.gold, notNow: palette.red700 },
  badgeGlyph: { go: palette.white, caution: '#5C4000', notNow: palette.white },
  chestTile: palette.orange,
  chestEdge: palette.orangeEdge,
  chestBody: '#8C5A33',
  chestLid: '#A86B3C',
  chestBand: palette.gold,
  bolt: palette.gold,
  rain: palette.sky,
  /** Done node (gold core, star, edge) and its chip per scheme. */
  done: palette.gold,
  doneEdge: palette.goldEdge,
  doneStar: '#7A5800',
  doneChip: { light: { bg: '#FFF6D6', fg: '#7A5800' }, dark: { bg: '#3D3310', fg: '#FFD95A' } },
  /** Smart swap card border and its caption / icon. */
  swapBorder: palette.sky,
  swapAccent: '#1F74C7',
  coin: palette.gold,
  coinEdge: palette.goldEdge,
  sparkle: palette.gold,
} as const;

/** Streak glyphs (streaks AC6): lit flame, explorer boot, weather-shield badge. Unlit flame uses theme `stone`. */
export const streakColors = {
  flame: palette.orange,
  boot: '#8C5A33',
  shield: '#1F74C7',
} as const;

/** Path node drop shadow (design.md Shape: `rgba(0,0,0,.18)`). */
export const shadowColor = '#000000';

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof palette & Record<keyof typeof lightSurfaces, string>;

export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: { ...palette, ...lightSurfaces },
  dark: { ...palette, ...darkSurfaces },
};
