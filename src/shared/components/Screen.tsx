import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, spacing } from '../constants/spacing';
import { createThemedStyles, useTheme } from '../contexts/theme';
import { OfflineBanner } from './OfflineBanner';

type Props = {
  children: ReactNode;
  testID: string;
  /** Scrollable content; insets go on the content container so it scrolls under the edges. */
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Persistent offline banner at the top (engineering-standards §11). */
  showOfflineBanner?: boolean;
};

/**
 * Every screen's root: background token, status-bar style, safe-area padding on all four edges
 * (never hardcoded constants) and the offline banner.
 */
export function Screen({
  children,
  testID,
  scroll = false,
  refreshControl,
  showOfflineBanner = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const styles = useStyles();

  const insetPadding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom || spacing[20],
    paddingStart: screenPadding + insets.left,
    paddingEnd: screenPadding + insets.right,
  };

  return (
    <View testID={testID} style={styles.root}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {scroll ? (
        <ScrollView
          style={layout.fill}
          contentContainerStyle={[layout.content, insetPadding]}
          refreshControl={refreshControl}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {showOfflineBanner && <OfflineBanner />}
          {children}
        </ScrollView>
      ) : (
        <View style={[layout.fill, layout.content, insetPadding]}>
          {showOfflineBanner && <OfflineBanner />}
          {children}
        </View>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing[16],
  },
});

const useStyles = createThemedStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
}));
