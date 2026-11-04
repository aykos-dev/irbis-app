import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

type Props = {
  contactName: string;
  pending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/** "Back safe?" confirmation before check-out (AC8). */
export function CheckoutSheet({ contactName, pending, disabled, onConfirm, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);
  return (
    <Sheet
      testID="active.checkout.sheet"
      accessibilityLabel={t('active.checkout.confirmTitle')}
      closing={closing}
      onDismiss={onDismiss}
    >
      <View style={layout.text}>
        <AppText variant="h2" accessibilityRole="header">
          {t('active.checkout.confirmTitle')}
        </AppText>
        <AppText variant="body">{t('active.checkout.confirmBody', { name: contactName })}</AppText>
      </View>
      <AppButton
        testID="active.checkout.confirm"
        label={t('active.checkout.confirm')}
        loading={pending}
        disabled={disabled}
        onPress={onConfirm}
      />
      <AppButton
        testID="active.checkout.cancel"
        variant="white"
        label={t('active.checkout.cancel')}
        onPress={() => setClosing(true)}
      />
    </Sheet>
  );
}

const layout = StyleSheet.create({
  text: { gap: spacing[8] },
});
