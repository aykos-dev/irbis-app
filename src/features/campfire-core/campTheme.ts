import { palette, themeColors, type ColorScheme } from '../../shared/constants/colors';

/**
 * Campfire is always dark (design.md dark tokens), whatever the system scheme. Wrap campfire UI in
 * `<ThemeProvider scheme={campScheme}>` so shared components pick the dark tokens too.
 */
export const campScheme: ColorScheme = 'dark';

export const campColors = themeColors[campScheme];

export type GameId =
  | 'imposter'
  | 'mafia'
  | 'whoami'
  | 'rather'
  | 'xo'
  | 'croc'
  | 'geocore';

/** Geocore blue, its wide hub card and the card's meta line (canvas GeoHubSheet). */
export const geocoreColors = {
  brand: '#1F74C7',
  card: '#173452',
  meta: '#B8D4F0',
} as const;

/** Game icon tile colours (canvas CampHub). */
export const gameColors: Record<GameId, string> = {
  imposter: palette.purple,
  mafia: palette.red700,
  whoami: palette.teal,
  rather: palette.orange,
  xo: palette.sky,
  croc: palette.pine,
  geocore: geocoreColors.brand,
};

/** Geocore game tiles (canvas GeoHubSheet / GeoLobby): background and glyph colour per mode. */
export const geoModeColors = {
  findCountry: { bg: geocoreColors.brand, ink: palette.white },
  capitalToCountry: { bg: palette.purple, ink: palette.white },
  countryToCapital: { bg: palette.teal, ink: palette.white },
  cityDistance: { bg: palette.orange, ink: palette.onOrange },
} as const;

/** Geocore hub tile, sheet rows and lobby sub-pills (canvas GeoHubSheet / GeoLobby). */
export const geocoreSizes = {
  tileIcon: 64,
  tileGlyph: 38,
  sheetIcon: 48,
  sheetHeadGlyph: 28,
  rowGlyph: 26,
  rowMinHeight: 76,
  chevron: 22,
  subIcon: 30,
  subGlyph: 18,
  /** Board glyph stroke (`.st`, 24-unit viewBox). */
  glyphStroke: 2.2,
} as const;

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
  graticule: '#1D4258',
  land: '#3B5A50',
  /** Country borders are drawn in the ocean colour. */
  border: '#163447',
  selected: palette.purple,
  onSelected: palette.white,
  answer: palette.orange,
  microDot: '#3B5A50',
  microRing: '#8CC8FF',
  pinFill: palette.orange,
  pinStroke: palette.onOrange,
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
  /** Board map box (358 pt square). */
  board: 358,
  borderStroke: 0.6,
  graticuleStroke: 0.5,
  selectedStroke: 1.2,
  /** Initial view: Central Asia. */
  initialLng: 60,
  initialLat: 30,
  /** Web Mercator latitude limit (MapLibre). */
  maxLat: 85.0511,
  /** MapLibre world width at zoom 0 (pt) and its lowest zoom. */
  tileSize: 512,
  mapMinZoom: 0,
  /** Zoom levels above the fitted world (8× ≈ 2^3). */
  zoomRange: 3,
  /** Microstate dot `minZoom` levels considered (0–8). */
  microMaxZoom: 8,
  focusMs: 600,
  zoomButton: 44,
  zoomGlyph: 18,
  zoomStroke: 3,
  zoomBorder: 2,
  zoomEdge: 4,
  /** Microstate dots (map circle layer): a dot shows from the first zoom where it is at least
   * `microGap` from every dot already shown. A tap within `microSnap` of a shown dot picks it, even
   * over land; off non-microstate land, within `microHit`. */
  microDot: 14,
  microRing: 2,
  microGap: 18,
  microHit: 22,
  microSnap: 10,
  /** The screen-reader-only microstate buttons are clipped to this (pt). */
  a11yClip: 1,
  pinWidth: 28,
  pinHeight: 38,
  pinStroke: 1.5,
  markerDot: 18,
  markerBorder: 3,
  answerStar: 22,
  labelOpacity: 0.86,
  chipRadius: 9,
  /** Graticule: a line every 10°. */
  graticuleStep: 10,
} as const;

/** Geocore round, reveal and final screens (canvas GeoRound / GeoRoundCity / GeoReveal / GeoFinal). */
export const geoScreenColors = {
  /** Prompt card: blue for the country modes, orange for City distance. */
  prompt: { bg: geocoreColors.brand, ink: palette.white },
  promptCity: { bg: palette.orange, ink: palette.onOrange },
  ring: geocoreColors.brand,
  warning: palette.orange,
  track: campColors.line,
  /** My standings / final row. */
  mine: geocoreColors.card,
  mineEdge: geocoreColors.brand,
  gain: palette.pine,
  /** Negative round points (drop-a-pin games). */
  loss: palette.red700,
  /** Round points of exactly 0. */
  even: campColors.muted,
  /** Podium steps by place. */
  step: { 1: palette.gold, 2: palette.stone, 3: '#C98B4E' },
  onStep: { 1: palette.onGold, 2: palette.white, 3: palette.white },
} as const;

export const geoScreenSizes = {
  ring: 56,
  ringStroke: 5,
  /** The ring and seconds turn the warning colour from here. */
  warnFromSec: 5,
  tickMs: 250,
  rowAvatar: 36,
  seatRing: 3,
  podiumAvatar: 48,
  /** Tied seats on a step overlap by this much. */
  podiumOverlap: 16,
  step: { 1: 104, 2: 80, 3: 60 },
  /** Reveal zoom on the answer: country modes, point modes. */
  zoomCountry: 4,
  zoomPoint: 2,
} as const;
