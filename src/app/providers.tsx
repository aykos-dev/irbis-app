import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '../shared/api/query';
import { ToastProvider } from '../shared/components/Toast';
import { AuthProvider } from '../shared/contexts/auth';
import { ThemeProvider } from '../shared/contexts/theme';
import { wireFocusManager } from '../shared/hooks/useAppState';
import { wireOnlineManager } from '../shared/hooks/useNetworkStatus';

type Props = {
  children: ReactNode;
  /** Tests pass a fresh client; the app creates one per launch. */
  queryClient?: QueryClient;
  /** Tests pass fixed insets; the app measures them. */
  initialMetrics?: Metrics | null;
};

/**
 * Provider hierarchy in the order documented in docs/architecture.md. The navigation container
 * is the innermost layer and lives in App.tsx.
 */
export function Providers({ children, queryClient, initialMetrics }: Props) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  useEffect(() => {
    wireOnlineManager();
    return wireFocusManager();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <KeyboardProvider>
          <QueryClientProvider client={client}>
            <AuthProvider>
              <ThemeProvider>
                <BottomSheetModalProvider>
                  <ToastProvider>{children}</ToastProvider>
                </BottomSheetModalProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
