import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { t } from '../../../shared/i18n';

type Props = { closing: boolean; onClose: () => void; onDismiss: () => void };

/** "How the path is built" (AC6): what the path picks and what the rings mean. */
export function HowBuiltSheet({ closing, onClose, onDismiss }: Props) {
  return (
    <Sheet testID="path.info.sheet" accessibilityLabel={t('path.info.title')} closing={closing} onDismiss={onDismiss}>
      <AppText variant="h2" accessibilityRole="header">
        {t('path.info.title')}
      </AppText>
      <AppText variant="body">{t('path.info.body')}</AppText>
      <AppButton testID="path.info.close" label={t('common.close')} variant="white" onPress={onClose} />
    </Sheet>
  );
}
