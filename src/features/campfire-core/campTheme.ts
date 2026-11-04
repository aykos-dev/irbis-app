import { palette, themeColors, type ColorScheme } from '../../shared/constants/colors';

/**
 * Campfire is always dark (design.md dark tokens), whatever the system scheme. Wrap campfire UI in
 * `<ThemeProvider scheme={campScheme}>` so shared components pick the dark tokens too.
 */
export const campScheme: ColorScheme = 'dark';

export const campColors = themeColors[campScheme];

export type GameId = 'imposter' | 'mafia' | 'whoami' | 'rather' | 'xo' | 'croc';

/** Game icon tile colours (canvas CampHub). */
export const gameColors: Record<GameId, string> = {
  imposter: palette.purple,
  mafia: palette.red700,
  whoami: palette.teal,
  rather: palette.orange,
  xo: palette.sky,
  croc: palette.pine,
};

/** CampHub sizes from the canvas. */
export const campSizes = {
  gameIcon: 50,
  gameGlyph: 26,
  animalChip: 52,
  heroHeight: 180,
  heroArt: 84,
  /** iPhone hotspot guide picture (342×180). */
  guideArtRatio: 342 / 180,
} as const;

/** Lobby sizes from the canvas (CampLobby). */
export const lobbySizes = {
  qr: 200,
  codeFont: 40,
  seat: 64,
  seatArtRatio: 0.8,
  /** Reconnecting seats are drawn at half opacity. */
  dimmed: 0.5,
} as const;

/** Join screen sizes from the canvas (CampJoin). */
export const joinSizes = {
  cameraWidth: 342,
  cameraHeight: 300,
  /** Viewfinder corner arm length and stroke. */
  corner: 44,
  cornerStroke: 4,
  codeBox: 60,
  codeDigits: 4,
} as const;

/** Party-game secret cards (canvas ImpReveal / ImpImposter). */
export const secretSizes = {
  cardMinHeight: 260,
  mascot: 56,
  /** Lake art behind the word, dimmed so the word reads. */
  backdropOpacity: 0.35,
} as const;

/** Who am I / Would you rather boards (canvas WhoAmI / WYR). */
export const partySizes = {
  rowAvatar: 44,
  voterAvatar: 32,
  avatarArtRatio: 0.8,
  barHeight: 12,
  /** Vote bars grow from 0 to their share on reveal. */
  revealMs: 600,
} as const;

/** Mafia role colours (design/media/campfire-mafia/MEDIA.md), behind each role glyph. */
export const mafiaRoleColors = {
  boss: '#8F1F1F',
  mafia: palette.red700,
  detective: '#1F74C7',
  doctor: '#2E8B57',
  maniac: '#6A4FE8',
  lover: '#C93A6B',
  bodyguard: palette.teal700,
  sniper: '#B5651D',
  journalist: '#8A6D1F',
  immortal: '#4E7D8C',
  civilian: '#5E6E74',
} as const;

/** Mafia setup rows (canvas MafSetup), role card and narrator list (MafRole / MafHost). */
export const mafiaSizes = {
  roleTile: 40,
  roleGlyph: 22,
  stepper: 36,
  /** Role card art under "You are" (MafRole). */
  cardArtWidth: 144,
  cardArtHeight: 192,
  chipGlyph: 14,
  rowAvatar: 40,
  /** Game over: players who are out are drawn dimmed. */
  outOpacity: 0.6,
  confettiWidth: 10,
  confettiHeight: 16,
  confettiRadius: 2,
  /** Confetti falls this far, fading out, within `confettiMs`. */
  confettiFall: 120,
  confettiMs: 1500,
} as const;

/** Game-over confetti rects: colour, start position (fraction of the width) and tilt. */
export const mafiaConfetti = [
  { color: palette.gold, left: '10%', rotate: '-18deg' },
  { color: palette.orange, left: '30%', rotate: '24deg' },
  { color: palette.sky, left: '50%', rotate: '38deg' },
  { color: palette.red, left: '70%', rotate: '-30deg' },
  { color: palette.teal, left: '88%', rotate: '12deg' },
] as const;

/** X and O marks and the winning line (campfire-xo). */
export const xoColors = {
  x: palette.teal,
  o: palette.orange,
  line: palette.gold,
} as const;

/** X and O board (campfire-xo AC2, AC3): marks draw in `markMs`; cells stay ≥ 44 pt. */
export const xoSizes = {
  board: 312,
  /** SVG units: the board is drawn in a 300 × 300 box, each mark in a 100 × 100 cell. */
  boardBox: 300,
  cellBox: 100,
  gridStroke: 4,
  markStroke: 10,
  lineStroke: 12,
  headerMark: 18,
  scoreAvatar: 40,
  markMs: 200,
} as const;

/** Crocodile turn timer (canvas CrocRun): ring, seconds and the last-seconds warning. */
export const crocSizes = {
  ring: 168,
  ringStroke: 12,
  /** The ring and seconds turn `crocColors.warning` from here down. */
  warnFromSec: 10,
  /** A light haptic on each of the last seconds. */
  hapticFromSec: 5,
  /** Seconds are re-read this often from the local deadline. */
  tickMs: 250,
} as const;

export const crocColors = {
  ring: palette.pine,
  warning: palette.orange,
  track: campColors.line,
} as const;

/** GeoCore globe (canvas GeoRound / GeoRoundCity / GeoReveal). */
export const geoColors = {
  ocean: '#163447',
  rim: '#2B5670',
  graticule: '#1D4258',
  land: '#3B5A50',
  /** Country borders are drawn in the ocean colour. */
  border: '#163447',
  selected: palette.purple,
  selectedEdge: '#4330B0',
  onSelected: palette.white,
  answer: palette.orange,
  microDot: '#3B5A50',
  microRing: '#8CC8FF',
  pinFill: palette.orange,
  pinStroke: palette.onOrange,
  pinShadow: '#000000',
  /** Reveal pin dot border and label chip. */
  markerEdge: campColors.bg,
  labelChip: campColors.bg,
  labelText: campColors.ink,
} as const;

/** Reveal pin colour per seat (`colorIndex`, cycled). */
export const geoSeatColors = [
  palette.orange,
  palette.teal,
  '#8CC8FF',
  '#E04F8A',
  '#B8A8FF',
  '#7BE0A2',
  palette.gold,
  '#FF8A8A',
  palette.sky,
  palette.pine,
  '#F2802E',
  '#C98B4E',
  '#5FD6CE',
  '#D9733F',
  palette.purple,
] as const;

export const geoSizes = {
  /** Board globe box (358 pt square, radius 172). */
  board: 358,
  radiusRatio: 172 / 358,
  rimOpacity: 0.35,
  rimStroke: 4,
  graticuleStroke: 0.5,
  borderStroke: 0.6,
  selectedStroke: 1.2,
  /** Initial view: Central Asia. */
  initialLng: 60,
  initialLat: 30,
  maxLat: 85,
  minZoom: 1,
  maxZoom: 8,
  zoomStep: 1.6,
  /** While a drag is active the full projection is rebuilt at most this often. */
  dragFps: 15,
  /** A tap fails once the finger travels further than this. */
  tapSlop: 10,
  focusMs: 600,
  zoomButton: 44,
  zoomGlyph: 18,
  zoomStroke: 3,
  zoomBorder: 2,
  zoomEdge: 4,
  microButton: 44,
  microDot: 14,
  microRing: 2,
  pinWidth: 28,
  pinHeight: 38,
  pinStroke: 1.5,
  pinShadowOpacity: 0.35,
  markerDot: 18,
  markerBorder: 3,
  answerStar: 22,
  labelOpacity: 0.86,
  chipRadius: 9,
  chipEdge: 2,
  /** The name chip is centred in a row this wide under the country centre. */
  chipRowWidth: 220,
  focusFps: 30,
} as const;
