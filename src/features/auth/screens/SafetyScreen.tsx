import type { RootStackScreenProps } from '../../../app/navigation/types';
import { ComingSoon } from '../../../shared/components/ComingSoon';
import { t } from '../../../shared/i18n';

/** Safety & SOS opens its empty state until `safety-center` ships (AC2). */
export function SafetyScreen(_props: RootStackScreenProps<'Safety'>) {
  return <ComingSoon testID="empty.safety" title={t('nav.safetyTitle')} />;
}
