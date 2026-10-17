import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useMemo } from 'react';

import { useTheme } from '../shared/contexts/theme';
import { AuthGateHost } from './AuthGateHost';
import { linking } from './navigation/linking';
import { navigationRef } from './navigation/navigationRef';
import { RootNavigator } from './navigation/RootNavigator';
import { Providers } from './providers';

/** Navigation container + root stack, themed from tokens. Exported for integration tests. */
export function AppNavigation() {
  const { scheme, colors } = useTheme();
  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.teal700,
        background: colors.bg,
        card: colors.card,
        text: colors.ink,
        border: colors.line,
        notification: colors.red700,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navigationTheme}>
      <RootNavigator />
      <AuthGateHost />
    </NavigationContainer>
  );
}

export function App() {
  return (
    <Providers>
      <AppNavigation />
    </Providers>
  );
}
