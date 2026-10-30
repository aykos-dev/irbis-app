import { Image, StyleSheet, View } from 'react-native';

import type { BadgeDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import type { Locale } from '../../../shared/i18n';
import { badgeArt } from '../badgeArt';

type Props = {
  badge: BadgeDto;
  locale: Locale;
  selected: boolean;
  selectable: boolean;
  onPress: () => void;
};

export function BadgeTile({
  badge,
  locale,
  selected,
  selectable,
  onPress,
}: Props) {
  const themed = useStyles();
  const { colors } = useTheme();
  const earned = badge.earnedAt !== null;
  const source = badge.art ? badgeArt[badge.art] : undefined;
  const progress = Math.min(badge.progress, badge.target);

  return (
    <Pressable
      testID={`badges.item-${badge.key}`}
      accessibilityRole={selectable ? 'checkbox' : undefined}
      accessibilityState={
        selectable ? { checked: selected } : { disabled: true }
      }
      accessibilityLabel={`${badge.title[locale]}. ${badge.description[locale]}`}
      onPress={selectable ? onPress : undefined}
      style={[
        layout.tile,
        themed.tile,
        selected ? themed.selected : null,
        !earned ? layout.locked : null,
      ]}
    >
      <View style={[layout.artFrame, themed.artFrame]}>
        {source ? (
          <Image
            source={source}
            style={layout.art}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[layout.fallback, themed.fallback]}>
            <Icon
              name={earned ? 'star' : 'lock'}
              color={earned ? colors.teal700 : colors.muted}
              size={32}
            />
          </View>
        )}
        {selected ? (
          <View style={layout.check}>
            <Icon
              name="checkCircle"
              color={colors.pine}
              accent={colors.white}
              size={24}
            />
          </View>
        ) : null}
      </View>
      <AppText variant="chip" numberOfLines={2} style={layout.centered}>
        {badge.title[locale]}
      </AppText>
      <AppText
        variant="caption"
        tone="muted"
        numberOfLines={3}
        style={layout.centered}
      >
        {badge.description[locale]}
      </AppText>
      <AppText variant="small" tone={earned ? 'ink' : 'muted'}>
        {earned ? 'Earned' : `${progress} / ${badge.target}`}
      </AppText>
      {!earned ? (
        <View style={[layout.track, themed.track]}>
          <View
            style={[
              layout.fill,
              themed.fill,
              { width: `${(progress / badge.target) * 100}%` },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const layout = StyleSheet.create({
  tile: {
    width: '48%',
    minHeight: 250,
    alignItems: 'center',
    gap: spacing[6],
    padding: spacing[12],
  },
  locked: { opacity: 0.78 },
  artFrame: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: 96, height: 96 },
  fallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { position: 'absolute', right: 0, bottom: 2 },
  centered: { textAlign: 'center' },
  track: { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

const useStyles = createThemedStyles(c => ({
  tile: {
    backgroundColor: c.card,
    borderColor: c.line,
    borderWidth: borders.card,
    borderRadius: radii.tile,
  },
  selected: { borderColor: c.teal, borderWidth: 2 },
  artFrame: { backgroundColor: c.bg },
  fallback: { backgroundColor: c.soft },
  track: { backgroundColor: c.line },
  fill: { backgroundColor: c.teal },
}));
