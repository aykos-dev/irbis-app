import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { useMePendingRatings } from '../../../shared/api/generated/buddies/buddies';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { localName } from '../labels';

/**
 * Home "Rate your trip buddies · <place>" (buddies AC7): one row per open trip with someone left to rate.
 * Signed-in only; nothing pending (or the request failed) → not rendered.
 */
export function HomeRateCard() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const query = useMePendingRatings({ query: { enabled: signedIn } });
  const navigation = useNavigation();
  const locale = useLocale();
  const { colors } = useTheme();
  const styles = useStyles();
  const items = query.data?.items.filter(item => item.unrated > 0) ?? [];

  if (!signedIn || items.length === 0) {
    return null;
  }
  return (
    <View testID="home.rate-card" style={[layout.card, styles.card]}>
      {items.map(item => {
        const title = t('buddies.homeCard.title', { place: localName(item.placeName, locale) });
        const body = t('buddies.homeCard.body', { count: item.unrated });
        return (
          <Pressable
            key={item.groupTripId}
            testID={`home.rate-card-${item.groupTripId}`}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${body}`}
            style={layout.row}
            onPress={() => navigation.navigate('RateBuddies', { groupTripId: item.groupTripId })}
          >
            <Icon name="star" color={colors.gold} />
            <View style={layout.copy}>
              <AppText variant="h3">{title}</AppText>
              <AppText variant="small" tone="muted">
                {body}
              </AppText>
            </View>
            <Icon name="chevron" color={colors.stone} size={spacing[18]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const layout = StyleSheet.create({
  card: { borderRadius: radii.card, borderWidth: borders.card, padding: spacing[16], gap: spacing[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  copy: { flex: 1, gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
