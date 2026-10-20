import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

type Props = {
  testID: string;
  title: string;
  confirmLabel: string;
  confirmTestID: string;
  cancelTestID: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

/** Campfire "are you sure" sheet: danger action + Cancel (remove player, close room, end game). */
export function ConfirmSheet({
  testID,
  title,
  confirmLabel,
  confirmTestID,
  cancelTestID,
  cancelLabel,
  onConfirm,
  onDismiss,
}: Props) {
  return (
    <Sheet testID={testID} accessibilityLabel={title} onDismiss={onDismiss}>
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        <AppButton
          testID={confirmTestID}
          label={confirmLabel}
          variant="danger"
          onPress={onConfirm}
        />
        <AppButton
          testID={cancelTestID}
          label={cancelLabel ?? t('common.cancel')}
          variant="white"
          onPress={onDismiss}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
});
