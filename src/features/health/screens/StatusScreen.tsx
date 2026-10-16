import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Screen } from '../../../shared/components/Screen';
import { appConfig } from '../../../shared/constants/config';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { getLocale, t } from '../../../shared/i18n';
import { formatTime } from '../../../shared/utils/format';
import { HealthCard } from '../components/HealthCard';
import { useHealthStatus } from '../hooks/useHealthStatus';

type Props = RootStackScreenProps<'Status'>;

/** M0 initial route (features/health.md AC3): API + database reachability, four data states. */
export function StatusScreen(_props: Props) {
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { data, error, isError, dataUpdatedAt, refetch } = useHealthStatus();
  const [pulling, setPulling] = useState(false);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  const onRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const showError = isError && !data;
  const stale = !!data && (!isOnline || isError);
  const checkedAt = data ? formatTime(new Date(dataUpdatedAt), getLocale()) : null;

  return (
    <Screen
      testID="health.screen"
      scroll
      refreshControl={
        <RefreshControl
          accessibilityLabel={t('health.refresh')}
          refreshing={pulling}
          onRefresh={onRefresh}
          tintColor={colors.teal700}
          colors={[colors.teal700]}
          progressBackgroundColor={colors.card}
        />
      }
    >
      <View style={styles.header}>
        <AppText variant="caption">{t('common.appName')}</AppText>
        <AppText variant="h1" accessibilityRole="header">
          {t('health.title')}
        </AppText>
      </View>
      {showError ? (
        <ErrorState
          testID="health.error"
          retryTestID="health.retry"
          title={t('health.errorTitle')}
          error={error}
          onRetry={onRetry}
        />
      ) : (
        <HealthCard result={data} checkedAt={checkedAt} stale={stale} />
      )}
      <AppText variant="small" testID="health.environment">
        {t('common.environment', { env: appConfig.appEnv })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing[24],
    gap: spacing[4],
  },
});
