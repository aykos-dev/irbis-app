import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  /** "{name} is alerted at {time}" text, already formatted; null without a contact. */
  alertLine: string | null;
};

/** Auto-alert toggle (AC6), on by default, with who is alerted when. */
export function AlertSwitch({ value, onChange, alertLine }: Props) {
  const { colors } = useTheme();
  return (
    <View style={layout.wrap}>
      <View style={layout.row}>
        <AppText variant="body" tone="ink" style={layout.label}>
          {t('trip.alertSwitch')}
        </AppText>
        <Switch
          testID="trip.alert-switch"
          accessibilityLabel={t('trip.alertSwitch')}
          value={value}
          onValueChange={next => {
            haptics.selection();
            onChange(next);
          }}
          trackColor={{ true: colors.teal700, false: colors.line }}
        />
      </View>
      {value && alertLine ? (
        <AppText testID="trip.alert-at" variant="small">
          {alertLine}
        </AppText>
      ) : null}
      {value ? null : (
        <AppText testID="trip.alert-at" variant="small">
          {t('trip.alertOff')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[8] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  label: { flex: 1 },
});
