import { StyleSheet, View } from 'react-native';

import { useMeBuddySummary } from '../../../shared/api/generated/buddies/buddies';
import { useUsersGetBuddySummary } from '../../../shared/api/generated/profile/profile';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { formatScore } from '../labels';
import type { Trait } from './StarRow';

const TRAITS: readonly Trait[] = ['reliable', 'safety', 'company'];
const STAR = 16;

type Props = {
  /** Someone else's profile; omitted for your own. */
  username?: string;
  testID: string;
};

/**
 * Profile "Rated by trip buddies" (buddies AC8): trait averages with one decimal and the number of rated
 * trips, from the buddy-summary endpoints; the API sends ratings only from 3 raters, else the empty line.
 */
export function BuddyRatings({ username, testID }: Props) {
  const locale = useLocale();
  const { colors } = useTheme();
  const mine = useMeBuddySummary({ query: { enabled: username === undefined } });
  const theirs = useUsersGetBuddySummary(username ?? '', { query: { enabled: username !== undefined } });
  const ratings = (username === undefined ? mine : theirs).data?.ratings ?? null;

  return (
    <View testID={testID} style={layout.section}>
      <AppText variant="h3">{t('buddies.ratings.title')}</AppText>
      {ratings ? (
        <>
          {TRAITS.map(trait => (
            <View key={trait} testID={`${testID}-${trait}`} style={layout.row}>
              <AppText variant="body" style={layout.label}>
                {t(`buddies.rate.${trait}`)}
              </AppText>
              <Icon name="star" color={colors.gold} size={STAR} />
              <AppText variant="h3">{formatScore(ratings[trait], locale)}</AppText>
            </View>
          ))}
          <AppText testID={`${testID}-trips`} variant="small" tone="muted">
            {t('buddies.ratings.trips', { count: ratings.trips })}
          </AppText>
        </>
      ) : (
        <AppText variant="small" tone="muted">
          {t('buddies.ratings.empty')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[8], paddingVertical: spacing[8] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  label: { flex: 1 },
});
