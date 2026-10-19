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
