import { StyleSheet, View } from 'react-native';

import type { BuddyCandidateDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { freeLabel, levelName, personName, regionName } from '../labels';
import { Avatar } from './Avatar';

const AVATAR = 60;

type Props = {
  person: BuddyCandidateDto;
  requested: boolean;
  disabled: boolean;
  onOpen: () => void;
  onAdd: () => void;
};

/** One Find buddies card (AC1): companion, name, level · region, rating, tags, free chip, Add buddy. */
export function BuddyCard({ person, requested, disabled, onOpen, onAdd }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const name = personName(person);
  const meta = [levelName(person.level), person.region ? regionName(person.region) : null].filter(Boolean).join(' · ');
  const rating = person.rating ? t('buddies.card.rating', { rating: person.rating.mean.toFixed(1) }) : null;
  const together = person.tripsTogether > 0 ? t('buddies.card.together', { count: person.tripsTogether }) : null;
  const free = freeLabel(person.free);
  const addLabel = t(requested ? 'buddies.card.requested' : 'buddies.card.add');

  return (
    <Pressable
      testID={`buddies.card-${person.userId}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}`}
      onPress={onOpen}
      style={[layout.card, styles.card]}
    >
      <View style={layout.top}>
        <Avatar avatarUrl={person.avatarUrl} level={person.level} size={AVATAR} />
        <View style={layout.copy}>
          <AppText variant="h3" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {meta}
          </AppText>
          {rating || together ? (
            <AppText variant="small" numberOfLines={1}>
              {[rating, together].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
        </View>
        <Pressable
          testID={`buddies.add-${person.userId}`}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          accessibilityState={{ disabled: requested || disabled }}
          disabled={requested || disabled}
          onPress={onAdd}
          style={[layout.add, requested ? styles.addDone : styles.add]}
        >
          <AppText variant="chip" tone={requested ? 'muted' : 'white'}>
            {addLabel}
          </AppText>
        </Pressable>
      </View>
      <View style={layout.tags}>
        {person.verifiedLeader ? (
          <View style={[layout.tag, styles.leader]}>
            <Icon name="shield" color={colors.white} size={spacing[14]} />
            <AppText variant="caption" tone="white">
              {t('buddies.card.leader')}
            </AppText>
          </View>
        ) : null}
        {person.interests.slice(0, 3).map(interest => (
          <View key={interest} style={[layout.tag, styles.tag]}>
            <AppText variant="caption">{t(`onboarding.interests.${interest}`)}</AppText>
          </View>
        ))}
        {free ? (
          <View style={[layout.tag, styles.free]}>
            <AppText variant="caption">{free}</AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  card: { padding: spacing[14], gap: spacing[10], borderRadius: radii.card, borderWidth: borders.card, borderBottomWidth: borders.edge },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  copy: { flex: 1, gap: spacing[4] },
  add: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[6] },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: sizes.chipHeight,
    paddingHorizontal: spacing[8],
    borderRadius: radii.checkbox,
  },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
  add: { backgroundColor: c.teal700 },
  addDone: { backgroundColor: c.soft },
  leader: { backgroundColor: c.teal700 },
  tag: { backgroundColor: c.soft },
  free: { backgroundColor: c.navActiveBg },
}));
