import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { appConfig } from '../../../shared/constants/config';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

type Props = RootStackScreenProps<'Status'>;

/**
 * M0 initial route. Shows the build's environment; the live API/database status card
 * (`useHealthCheck`, four data states) is added with the health contract.
 */
export function StatusScreen(_props: Props) {
  const styles = useStyles();
  return (
    <Screen testID="health.screen" scroll>
      <View style={layout.header}>
        <AppText variant="caption">{t('common.appName')}</AppText>
        <AppText variant="h1" accessibilityRole="header">
          {t('common.status.title')}
        </AppText>
      </View>
      <View testID="health.status-card" style={[layout.card, styles.card]}>
        <AppText variant="body">{t('common.status.subtitle')}</AppText>
        <AppText variant="small" testID="health.environment">
          {t('common.environment', { env: appConfig.appEnv })}
        </AppText>
        <AppText variant="small" testID="health.api-url">
          {t('common.apiAddress', { url: appConfig.apiUrl })}
        </AppText>
      </View>
    </Screen>
  );
}

const layout = StyleSheet.create({
  header: {
    paddingTop: spacing[24],
    gap: spacing[4],
  },
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    padding: spacing[20],
    gap: spacing[8],
  },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
