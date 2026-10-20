import type { LessonIcon } from '../../shared/api/generated/model';
import { palette, type ColorScheme } from '../../shared/constants/colors';

/**
 * Lessons colours from the canvas (irbis-docs/design/media/lessons/LAYOUT.md). Existing tokens are
 * reused; the rest are not in design.md yet.
 */
export const glyphColors: Record<LessonIcon, string> = {
  compass: palette.teal,
  leaf: palette.pine,
  padlock: palette.orange,
  cloud: palette.sky,
  paw: '#8C5A33',
  'first-aid': palette.red700,
  mountain: '#F2802E',
  waves: palette.sky,
  avalanche: '#6B8FB3',
  bolt: palette.orange,
};

/** Goal ring: progress orange on a light-orange track (dark: a deep amber track). */
export const goalRingColors: Record<ColorScheme, { track: string; progress: string }> = {
  light: { track: '#FFE6C2', progress: palette.orange },
  dark: { track: '#4A3A1F', progress: palette.orange },
};

export const heartColor = palette.red;
export const doneRingColor = palette.gold;

/** ~15 % of a `#RRGGBB` tier colour for its card header; other formats fall back to no tint. */
export function tierTint(colour: string): string | undefined {
  return /^#[0-9a-fA-F]{6}$/.test(colour) ? `${colour}26` : undefined;
}

/**
 * Quiz option and answer-sheet colours (LAYOUT.md § Quiz). Per state: background / border / text.
 * `correct*` and `wrong*` values are not in design.md yet.
 */
export const quizColors = {
  picked: { bg: palette.tealTint, border: palette.teal, text: '#0B5B57' },
  correct: { bg: '#DFF6E7', border: '#2E8B57', text: '#154F2E' },
  wrong: { bg: '#FFE1E1', border: palette.red700, text: '#8F1F1F' },
  correctSheet: { bg: '#DFF6E7', mark: '#237A4A', title: '#154F2E', body: '#154F2E' },
  wrongSheet: { bg: '#FFE1E1', mark: palette.red700, title: '#8F1F1F', body: '#6B1717' },
  progressFill: palette.teal,
  /** Inset bottom shadow rgba(0,0,0,.12). */
  progressFillEdge: '#0000001F',
  progressTrack: '#E5E5DC',
  close: palette.stone,
  brokenHeart: palette.white,
  onMark: palette.white,
} as const;

/** Lesson-complete burst: rays around the companion. */
export const burstColors = [palette.gold, palette.orange, palette.sky, palette.red, palette.teal, palette.pine] as const;
