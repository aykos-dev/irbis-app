import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useLeaguesCurrent } from '../../../shared/api/generated/leagues/leagues';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { formatElevation } from '../../../shared/utils/units';
import { leagueArt } from '../leagueArt';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LeagueEntryCard({
  testID,
}: {
  testID: 'path.league' | 'profile.league' | 'summit.league';
}) {
  const navigation = useNavigation<Nav>();
  const { status } = useAuth();
  const styles = useStyles();
  const query = useLeaguesCurrent({
    query: { enabled: status === 'signedIn' },
  });
  if (status !== 'signedIn') return null;
  const tier = query.data?.tier;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('leagues.open')}
      onPress={() => navigation.navigate('Leagues')}
      style={[styles.card, layout.card]}
    >
      {tier ? (
        <Image
          source={leagueArt[tier]}
          style={layout.art}
          accessibilityLabel={t(`leagues.tiers.${tier}.name`)}
        />
      ) : null}
      <View style={layout.copy}>
        <AppText variant="h3">
          {tier
            ? t('leagues.card.ranked', {
                tier: t(`leagues.tiers.${tier}.name`),
                rank: query.data?.rank ?? '–',
              })
            : t('leagues.card.unranked')}
        </AppText>
        <AppText variant="small" tone="muted">
          {tier
            ? t('leagues.card.elevation', {
                elevation: formatElevation(query.data?.elevationM ?? 0),
              })
            : t('leagues.card.join')}
        </AppText>
      </View>
    </Pressable>
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
