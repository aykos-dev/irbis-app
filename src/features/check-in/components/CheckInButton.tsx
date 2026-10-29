import { Linking, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { t } from '../../../shared/i18n';
import { useCheckIn, type CheckInTarget } from '../hooks/useCheckIn';

/**
 * "Check in" (AC4) for the Place and active trip screens; signed-in users only for now (guests
 * come with the demo account). Shows the locating state and the inline feedback under the button.
 */
export function CheckInButton(props: CheckInTarget) {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return null;
  }
  return <SignedInCheckIn {...props} />;
}

function SignedInCheckIn(target: CheckInTarget) {
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
