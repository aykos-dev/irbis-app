/**
 * Monthly path geometry (irbis-docs/design/media/weekly-path/LAYOUT.md), in canvas px on a
 * 390-wide frame. Node x positions scale with the trail width; y stays as drawn.
 */
export const CANVAS_WIDTH = 390;

/** Node centres n1, n2, n3, then the chest; more slots continue the zig-zag. */
const SLOTS: readonly (readonly [number, number])[] = [
  [150, 70],
  [260, 195],
  [140, 320],
  [210, 450],
];
const EXTRA_X: readonly number[] = [260, 140];
const SLOT_STEP_Y = 125;
const CURVE_PULL_Y = 70;
const TRAIL_BOTTOM = 70;

export const nodeSize = {
  ring: 96,
  ringBorder: 7,
  lockBorder: 6,
  core: 72,
  glyph: 34,
  lockGlyph: 32,
  badge: 30,
  badgeBorder: 3,
  badgeGlyph: 16,
  badgeInset: -2,
  edge: 6,
  labelGap: 12,
  labelWidth: 136,
  labelTop: 14,
  notNowCoreOpacity: 0.55,
} as const;

export const trailLine = { width: 10, dash: '2 18' } as const;

export const chestSize = { width: 88, height: 76, glyphWidth: 54, glyphHeight: 46, edge: 6 } as const;

export const headerSize = { avatar: 44, avatarBorder: 3, avatarArtOffset: 6, info: 40, bolt: 24 } as const;

export const mascotSize = { worried: 72, swayDeg: 4, swayMs: 1400, rainMs: 900, dropFall: 18 } as const;

export const popoverSize = { width: 220, gap: 8 } as const;

export const bounce = { peak: 1.1, upMs: 120 } as const;

/** Done node: no ring border, gold core with a star (LAYOUT.md Done). */
export const doneSize = { ring: 76, core: 70, star: 34, edge: 6, chipIcon: 14 } as const;

/** Coin shower when a node turns done (≤ 1.2 s). */
export const coinShower = { count: 6, size: 14, spreadX: 34, rise: 46, fall: 70, ms: 1100 } as const;

/** Smart swap card under a not-now node; `estimate` until the card has been measured. */
export const swapCard = { gap: 20, estimate: 210, tile: 72, glyph: 34, icon: 22, iconStroke: 2.6 } as const;

/** Chest lid open (tilt + lift) and the locked shake. */
export const chestMotion = {
  lidDeg: -24,
  lidLift: -10,
  lidMs: 450,
  sparkles: 4,
  sparkle: 8,
  sparkleSpread: 40,
  shakeX: 6,
  shakeMs: 60,
} as const;

/** Centre of slot `index` in canvas px. */
export function slot(index: number): readonly [number, number] {
  const drawn = SLOTS[index];
  if (drawn) {
    return drawn;
  }
  const last = SLOTS[SLOTS.length - 1] ?? [CANVAS_WIDTH / 2, 0];
  const extra = index - SLOTS.length;
  return [EXTRA_X[extra % EXTRA_X.length] ?? last[0], last[1] + SLOT_STEP_Y * (extra + 1)];
}

/** The dotted trail through slots 0…count-1 (cubic curves, as on the canvas); `shifts` pushes slots down. */
export function trailPath(count: number, scaleX: number, shifts: readonly number[] = []): string {
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const [x, drawnY] = slot(i);
    const y = drawnY + (shifts[i] ?? 0);
    if (i === 0) {
      d = `M${x * scaleX} ${y}`;
      continue;
    }
    const [px, drawnPy] = slot(i - 1);
    const py = drawnPy + (shifts[i - 1] ?? 0);
    d += ` C${px * scaleX} ${py + CURVE_PULL_Y} ${x * scaleX} ${y - CURVE_PULL_Y} ${x * scaleX} ${y}`;
  }
  return d;
}

/** Trail height for `count` slots. */
export function trailHeight(count: number): number {
  return slot(Math.max(count - 1, 0))[1] + TRAIL_BOTTOM;
}
