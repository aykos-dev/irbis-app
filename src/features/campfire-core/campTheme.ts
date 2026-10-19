import { palette, themeColors, type ColorScheme } from '../../shared/constants/colors';

/**
 * Campfire is always dark (design.md dark tokens), whatever the system scheme. Wrap campfire UI in
 * `<ThemeProvider scheme={campScheme}>` so shared components pick the dark tokens too.
 */
export const campScheme: ColorScheme = 'dark';

export const campColors = themeColors[campScheme];

export type GameId = 'imposter' | 'mafia' | 'whoami' | 'rather';

/** Game icon tile colours (canvas CampHub). */
export const gameColors: Record<GameId, string> = {
  imposter: palette.purple,
  mafia: palette.red700,
  whoami: palette.teal,
  rather: palette.orange,
};

/** CampHub sizes from the canvas. */
export const campSizes = {
  gameIcon: 50,
  gameGlyph: 26,
  animalChip: 52,
  heroHeight: 180,
  heroArt: 84,
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
