import { useLocale } from '../hooks/useLocale';
import { t } from '../i18n';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';

type Props = {
  /** Screen root id; tabs share `empty.coming-soon` (only the focused one is on screen). */
  testID?: string;
  title?: string;
};

/**
 * The approved waiver (auth spec, Q6): Path, Explore, Lessons and Community show this until
 * their feature ships. Each feature replaces its tab's content.
 */
export function ComingSoon({ testID = 'empty.coming-soon', title }: Props) {
  useLocale();
  return (
    <Screen testID={`${testID}.screen`} bottomInset={false}>
      <EmptyState
        testID={testID}
        mascot="sleepy"
        mascotLabel={t('nav.comingSoon.mascot')}
        title={title ?? t('nav.comingSoon.title')}
        body={t('nav.comingSoon.body')}
      />
    </Screen>
  );
}
