import { Linking, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { useCheckIn, type CheckInTarget } from '../hooks/useCheckIn';

/**
 * "Check in" (AC4) for the Place and active trip screens, for guests too (AC6: no log-in prompt;
 * the queue sync creates their demo account). Shows the locating state and the inline feedback.
 */
export function CheckInButton(target: CheckInTarget) {
  const { busy, tooFar, message, permissionDenied, checkIn } = useCheckIn(target);
  return (
    <View style={layout.root}>
      <AppButton
        testID="checkin.button"
        label={busy ? t('checkin.locating') : t('checkin.button')}
        accessibilityLabel={t('checkin.button')}
        loading={busy}
        onPress={checkIn}
      />
      {tooFar ? (
        <AppText testID="checkin.too-far" variant="small" accessibilityRole="alert" style={layout.center}>
          {tooFar}
        </AppText>
      ) : null}
      {message ? (
        <AppText testID="checkin.message" variant="small" accessibilityRole="alert" style={layout.center}>
          {message}
        </AppText>
      ) : null}
      {permissionDenied ? (
        <View testID="checkin.permission" style={layout.row} accessibilityRole="alert">
          <AppText variant="small" style={layout.fill}>
            {t('checkin.permission')}
          </AppText>
          <Pressable
            testID="checkin.settings"
            accessibilityRole="button"
            accessibilityLabel={t('checkin.settings')}
            onPress={() => void Linking.openSettings()}
          >
            <AppText variant="button" tone="teal700">
              {t('checkin.settings')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[8] },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  fill: { flex: 1 },
});
