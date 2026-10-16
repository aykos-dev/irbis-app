import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { themeColors, type ColorScheme, type ThemeColors } from '../constants/colors';

/**
 * Light/dark tokens. M0 follows the system scheme; Settings → Appearance (Light / Dark / Auto)
 * arrives with the profile feature.
 */
type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({ scheme, colors: themeColors[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return theme;
}

/**
 * Themed `StyleSheet.create` at module scope: both schemes are built once when the module loads,
 * and the returned hook picks the active one.
 *
 *   const useStyles = createThemedStyles(c => ({ root: { backgroundColor: c.bg } }));
 *   const styles = useStyles();
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function createThemedStyles<T extends NamedStyles>(
  factory: (colors: ThemeColors) => T,
): () => T {
  const sheets: Record<ColorScheme, T> = {
    light: StyleSheet.create(factory(themeColors.light)),
    dark: StyleSheet.create(factory(themeColors.dark)),
  };
  return function useThemedStyles() {
    return sheets[useTheme().scheme];
  };
}
