import { levelColors } from '../../constants/colors';

/**
 * Per-level visuals and copy keys (canvas Companions, brief levels-3). Pure: no React, no i18n.
 * Polygon points are fractions of the frame's box, copied from the canvas `clip-path` values.
 */
export type FrameShape =
  | { kind: 'circle' }
  | { kind: 'rounded'; radius: number }
  | { kind: 'polygon'; points: readonly (readonly [number, number])[] };

export type LevelNumber = keyof typeof levelColors;

export type LevelMeta = {
  level: LevelNumber;
  shape: FrameShape;
  color: string;
  dark: string;
  tint: string;
  text: string;
  /** `places.levels.<n>` — the level name (Wanderer … Snow Legend). */
  nameKey: string;
  animalKey: string;
  traitKey: string;
  unlockKey: string;
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 7;

/** "50% 0,100% 12%" → [[0.5, 0], [1, 0.12]]. */
function polygon(spec: string): FrameShape {
  const points = spec.split(',').map(pair => {
    const [x = '0', y = '0'] = pair.trim().split(/\s+/);
    return [parseFloat(x) / 100, parseFloat(y) / 100] as const;
  });
  return { kind: 'polygon', points };
}

/** Rounded square: corner 44 of a 184 px inner frame. */
const ROUNDED_RATIO = 44 / 184;

const shapes: Record<LevelNumber, FrameShape> = {
  1: { kind: 'circle' },
  2: { kind: 'rounded', radius: ROUNDED_RATIO },
  3: polygon('50% 0,100% 12%,100% 58%,50% 100%,0 58%,0 12%'),
  4: polygon('25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%'),
  5: polygon('30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%'),
  6: polygon('50% 0,94% 20%,100% 62%,50% 100%,0 62%,6% 20%'),
  7: polygon(
    '50% 0%,61.1% 8.5%,75% 6.7%,80.4% 19.6%,93.3% 25%,91.5% 38.9%,100% 50%,91.5% 61.1%,93.3% 75%,' +
      '80.4% 80.4%,75% 93.3%,61.1% 91.5%,50% 100%,38.9% 91.5%,25% 93.3%,19.6% 80.4%,6.7% 75%,' +
      '8.5% 61.1%,0% 50%,8.5% 38.9%,6.7% 25%,19.6% 19.6%,25% 6.7%,38.9% 8.5%',
  ),
};

/** Clamps any number from the API into 1…7. */
export function toLevel(level: number): LevelNumber {
  const rounded = Math.round(Number.isFinite(level) ? level : MIN_LEVEL);
  return Math.min(Math.max(rounded, MIN_LEVEL), MAX_LEVEL) as LevelNumber;
}

export function levelMeta(level: number): LevelMeta {
  const n = toLevel(level);
  const tone = levelColors[n];
  return {
    level: n,
    shape: shapes[n],
    color: tone.color,
    dark: tone.edge,
    tint: tone.tint,
    text: tone.text,
    nameKey: `places.levels.${n}`,
    animalKey: `levels.animal.${n}`,
    traitKey: `levels.trait.${n}`,
    unlockKey: `levels.unlock.${n}`,
  };
}
