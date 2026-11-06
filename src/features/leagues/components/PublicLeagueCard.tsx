import { Image, StyleSheet, View } from 'react-native';
import { useUsersGetLeague } from '../../../shared/api/generated/leagues/leagues';
import { AppText } from '../../../shared/components/AppText';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { formatElevation } from '../../../shared/utils/units';
import { leagueArt } from '../leagueArt';

export function PublicLeagueCard({ username }: { username: string }) {
  const styles = useStyles();
  const query = useUsersGetLeague(username, { query: { retry: false } });
  const tier = query.data?.tier;
  return (
    <View testID="public-profile.league" style={[styles.card, layout.card]}>
      {tier ? (
        <Image
          source={leagueArt[tier]}
          style={layout.art}
          accessibilityLabel={t(`leagues.tiers.${tier}.name`)}
        />
      ) : null}
      <View style={layout.copy}>
        <AppText variant="h3">{t('leagues.title')}</AppText>
        <AppText variant="small" tone="muted">
          {query.data?.ranked && tier
            ? t('leagues.public.ranked', {
                tier: t(`leagues.tiers.${tier}.name`),
                rank: query.data.rank ?? '–',
                elevation: formatElevation(query.data.elevationM),
              })
            : t('leagues.unranked.title')}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[14],
  },
  art: { width: sizes.leagueCrestSmall, height: sizes.leagueCrestSmall },
  copy: { flex: 1, gap: spacing[4] },
});
const useStyles = createThemedStyles(c => ({
  card: {
    backgroundColor: c.card,
    borderColor: c.line,
    borderWidth: borders.card,
    borderRadius: radii.card,
  },
}));
