import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  themeColors,
  type ColorScheme,
  type ThemeColors,
} from '../constants/colors';
import { storage } from '../storage';

/**
 * Light/dark tokens. M0 follows the system scheme; Settings → Appearance (Light / Dark / Auto)
 * arrives with the profile feature.
 */
type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  appearance: AppearancePreference;
  setAppearance: (appearance: AppearancePreference) => void;
};

export type AppearancePreference = 'light' | 'dark' | 'auto';

function storedAppearance(): AppearancePreference {
  const value = storage.getString('prefs.colorScheme');
  return value === 'light' || value === 'dark' ? value : 'auto';
}

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  /** Pins a subtree to one scheme regardless of the system (Campfire is always dark). */
  scheme?: ColorScheme;
};

export function ThemeProvider({
  children,
  scheme: forced,
}: ThemeProviderProps) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] =
    useState<AppearancePreference>(storedAppearance);
  const preferred =
    appearance === 'auto' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  const scheme: ColorScheme = forced ?? preferred;
  const setAppearance = (next: AppearancePreference) => {
    setAppearanceState(next);
    storage.setString('prefs.colorScheme', next);
  };
  const value = useMemo(
    () => ({ scheme, colors: themeColors[scheme], appearance, setAppearance }),
    [scheme, appearance],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
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
