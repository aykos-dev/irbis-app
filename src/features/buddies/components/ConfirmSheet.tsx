import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

type Props = {
  testID: string;
  title: string;
  body: string;
  confirmLabel: string;
  loading: boolean;
  /** Return true to close the sheet. */
  onConfirm: () => Promise<boolean>;
  onDismiss: () => void;
};

/** Remove-buddy confirmation. */
export function ConfirmSheet({ testID, title, body, confirmLabel, loading, onConfirm, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);
  return (
    <Sheet testID={testID} accessibilityLabel={title} closing={closing} onDismiss={onDismiss}>
      <View style={layout.wrap}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body">{body}</AppText>
        <AppButton
          testID={`${testID}-confirm`}
          variant="danger"
          label={confirmLabel}
          loading={loading}
          onPress={() => {
            void onConfirm().then(done => done && setClosing(true));
          }}
        />
        <AppButton testID={`${testID}-keep`} variant="white" label={t('buddies.remove.keep')} onPress={() => setClosing(true)} />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[16] },
});
