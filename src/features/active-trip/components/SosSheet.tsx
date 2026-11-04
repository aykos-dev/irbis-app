import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { toast } from '../../../shared/components/toastBus';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import type { SosOutcome } from '../hooks/useSos';

type Props = { outcome: SosOutcome; onDismiss: () => void };

/** After SOS (AC7): who got it (or "tap Send" for the SMS app), the rescue call when known, Close. */
export function SosSheet({ outcome, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);
  const text = outcome.via === 'server' ? t('active.sos.sent', { name: outcome.name }) : t('active.sos.tapSend');
  const { callNumber } = outcome;
  return (
    <Sheet testID="sos.sheet" accessibilityLabel={text} closing={closing} onDismiss={onDismiss}>
      <View style={layout.text}>
        <AppText variant="h2" accessibilityRole="header">
          {text}
        </AppText>
      </View>
      {callNumber ? (
        <AppButton
          testID="sos.call"
          variant="danger"
          label={t('active.sos.call', { number: callNumber })}
          onPress={() =>
            Linking.openURL(`tel:${callNumber}`).catch(() => {
              haptics.error();
              toast.show({ variant: 'error', message: t('errors.generic') });
            })
          }
        />
      ) : null}
      <AppButton testID="sos.close" variant="white" label={t('active.sos.close')} onPress={() => setClosing(true)} />
    </Sheet>
  );
}

const layout = StyleSheet.create({
  text: { gap: spacing[8] },
});
