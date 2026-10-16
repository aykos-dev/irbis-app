import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { AppText } from '../../../shared/components/AppText';
import { IrbisMascot } from '../../../shared/components/IrbisMascot';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { borders, motion, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { typography } from '../../../shared/constants/typography';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import type { HealthResult } from '../hooks/useHealthStatus';

const entering = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));

type Props = {
  result: HealthResult | undefined;
  checkedAt: string | null;
  stale: boolean;
};

/** Status card: mascot + API chip · DB chip · version. Skeleton-shaped while `result` is absent. */
export function HealthCard({ result, checkedAt, stale }: Props) {
  const styles = useStyles();
  return (
    <View testID="health.status-card" style={[layout.card, styles.card]}>
      <IrbisMascot size={sizes.mascotCard} accessibilityLabel={t('health.mascot')} />
      {result ? (
        <Animated.View entering={entering} style={layout.body}>
          <StatusChip
            testID="health.api-chip"
            variant={result.status === 'ok' ? 'go' : 'notNow'}
            label={t(result.status === 'ok' ? 'health.apiUp' : 'health.apiDegraded')}
          />
          <StatusChip
            testID="health.db-chip"
            variant={result.db === 'up' ? 'go' : 'notNow'}
            label={t(result.db === 'up' ? 'health.dbUp' : 'health.dbDown')}
          />
          <AppText variant="small" testID="health.version">
            {t('health.version', { version: result.version })}
          </AppText>
          {checkedAt ? (
            <AppText variant="small" testID="health.checked-at">
              {t('health.checkedAt', { time: checkedAt })}
            </AppText>
          ) : null}
          {stale ? (
            <AppText variant="small" tone="body" testID="health.stale">
              {t('health.stale')}
            </AppText>
          ) : null}
        </Animated.View>
      ) : (
        <View
          testID="health.skeleton"
          style={layout.body}
          accessible
          accessibilityLabel={t('common.loading')}
        >
          <Skeleton width="70%" height={sizes.chipHeight} radius={radii.pill} />
          <Skeleton width="80%" height={sizes.chipHeight} radius={radii.pill} />
          <Skeleton width="30%" height={typography.small.lineHeight} />
        </View>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    padding: spacing[20],
  },
  body: {
    flex: 1,
    gap: spacing[8],
  },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
