import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { Checkbox } from '../../../../shared/components/Checkbox';
import { Pressable } from '../../../../shared/components/Pressable';
import { palette } from '../../../../shared/constants/colors';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import {
  CROC_DEFAULT_SEC,
  crocDurations,
  playerRange,
  type CrocSettings,
} from '../gameReducer';
import { crocPacks, localized } from '../packs';

type Props = {
  /** Connected seats, host included (the host plays too). */
  players: number;
  onStart: (settings: CrocSettings) => void;
};

/** Why Start is disabled, or null (AC1): 3+ players incl. the host, at least one pack. */
export function crocStartBlocked(players: number, packs: number): string | null {
  const { min, max } = playerRange.croc;
  if (players < min) {
    return t('camp.croc.needThree');
  }
  if (players > max) {
    return t('camp.game.max', { n: max });
  }
  return packs === 0 ? t('camp.croc.needPack') : null;
}

/** Crocodile lobby settings (AC1): turn time chips, word packs (all ticked, never none), Start. */
export function CrocSetup({ players, onStart }: Props) {
  const styles = useStyles();
  const [durationSec, setDurationSec] = useState<number>(CROC_DEFAULT_SEC);
  const [packs, setPacks] = useState(() => crocPacks.map(pack => pack.id));
  const blocked = crocStartBlocked(players, packs.length);

  const toggle = (packId: string, checked: boolean) => {
    if (checked) {
      setPacks(current => [...current, packId]);
      return;
    }
    // The last ticked pack stays ticked: Crocodile needs words.
    if (packs.length <= 1) {
      haptics.warning();
      return;
    }
    setPacks(current => current.filter(id => id !== packId));
  };

  return (
    <View testID="croc.settings" style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.croc.timer')}
      </AppText>
      <View style={layout.chips} accessibilityRole="radiogroup">
        {crocDurations.map(sec => {
          const selected = sec === durationSec;
          const label = t('camp.croc.seconds', { n: sec });
          return (
            <Pressable
              key={sec}
              testID={`croc.settings.timer.${sec}`}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                setDurationSec(sec);
              }}
              style={[layout.pill, styles.pill, selected && layout.selected]}
            >
              <AppText variant="chip">{label}</AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="h3" accessibilityRole="header">
        {t('camp.croc.packs')}
      </AppText>
      {crocPacks.map(pack => (
        <Checkbox
          key={pack.id}
          testID={`croc.settings.pack.${pack.id}`}
          label={`${localized(pack.name)} · ${t('camp.game.words', { count: pack.items.length })}`}
          checked={packs.includes(pack.id)}
          onChange={checked => toggle(pack.id, checked)}
        />
      ))}

      <AppButton
        testID="camp.lobby.start"
        label={t('camp.game.start', { game: t('camp.game.name.croc') })}
        variant="secondary"
        disabled={blocked !== null}
        onPress={() => {
          haptics.success();
          onStart({ durationSec, packs });
        }}
      />
      {blocked ? (
        <AppText
          testID="camp.lobby.start-reason"
          variant="small"
          style={layout.center}
        >
          {blocked}
        </AppText>
      ) : null}
      <AppText variant="small" tone="muted" style={layout.center}>
        {t('camp.game.youPlayToo')}
      </AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  pill: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[6],
    borderRadius: radii.pill,
    borderWidth: borders.card,
  },
  selected: { borderColor: palette.purple },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  pill: { backgroundColor: c.card, borderColor: c.line },
}));
