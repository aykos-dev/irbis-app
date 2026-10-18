import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList, RootStackScreenProps } from '../../../app/navigation/types';
import { useGrantLink } from '../hooks/useGrantLink';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { Screen } from '../../../shared/components/Screen';
import { appConfig } from '../../../shared/constants/config';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';

const ROW_ICON = 22;

/**
 * Dev and staging tools (AC7, AC10). Registered in the root stack only outside production, so a
 * production build has no route, no row and no deep link to it. Opened by the QA grant link, it
 * runs the level grant (levels AC8).
 */
export function DebugScreen({ route }: RootStackScreenProps<'Debug'>) {
  useGrantLink(route.params);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const requireAccount = useRequireAccount('progress');
  const [ran, setRan] = useState(0);

  return (
    <Screen testID="debug.screen" scroll>
      <View style={styles.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('debug.title')}
        </AppText>
        <AppText variant="small">{t('debug.env', { env: appConfig.appEnv })}</AppText>
      </View>
      <ListCard>
        <ListRow
          first
          testID="debug.api-status"
          label={t('debug.apiStatus')}
          icon={<Icon name="info" color={colors.muted} size={ROW_ICON} />}
          onPress={() => navigation.navigate('Status')}
        />
        <ListRow
          testID="debug.open-gate"
          label={t('debug.openGate')}
          icon={<Icon name="person" color={colors.muted} size={ROW_ICON} />}
          onPress={() => requireAccount(() => setRan(count => count + 1))}
        />
      </ListCard>
      <AppText variant="small" testID="debug.gate-ran" accessibilityLiveRegion="polite">
        {t('debug.gateRan', { count: ran })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing[24], gap: spacing[4] },
});
