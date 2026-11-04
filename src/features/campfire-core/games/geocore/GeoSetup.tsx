import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, geocoreColors, geocoreSizes, geoModeColors } from '../../campTheme';
import { GEO_ROUNDS } from '../../protocol/codec';
import { GEO_QUESTION_MS, geoModeList, geoRange } from './geoGame';
import { GeoModeGlyph } from './GeoGlyphs';
import type { GeoMode } from './scoring';

const pointsKey: Record<GeoMode, string> = {
  findCountry: 'camp.geo.points.country',
  capitalToCountry: 'camp.geo.points.country',
  countryToCapital: 'camp.geo.points.capital',
  cityDistance: 'camp.geo.points.city',
};

type Props = {
  /** Connected seats, host included (the host plays too; solo works). */
  players: number;
  mode: GeoMode;
  onMode: (mode: GeoMode) => void;
  onStart: (mode: GeoMode) => void;
};

/** Geocore lobby settings (canvas GeoLobby, AC2): the four games, fixed rules, Start for 1–15. */
export function GeoSetup({ players, mode, onMode, onStart }: Props) {
  const styles = useStyles();
  const ready = players >= geoRange.min && players <= geoRange.max;
  const name = t(`camp.geo.mode.${mode}`);
  return (
    <View testID="geo.settings" style={layout.section}>
      <View style={layout.grid} accessibilityRole="radiogroup">
        {geoModeList.map(item => {
          const selected = item === mode;
          const label = t(`camp.geo.mode.${item}`);
          return (
            <Pressable
              key={item}
              testID={`camp.lobby.geo.${item}`}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                onMode(item);
              }}
              style={[layout.sub, styles.sub, selected && layout.selected]}
            >
              <View style={[layout.subIcon, { backgroundColor: geoModeColors[item].bg }]}>
                <GeoModeGlyph mode={item} size={geocoreSizes.subGlyph} />
              </View>
              <AppText variant="chip" style={layout.flex}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={[layout.card, styles.card]}>
        <Row label={t('camp.geo.rounds')} value={String(GEO_ROUNDS)} />
        <Row
          label={t('camp.geo.timePerRound')}
          value={t('camp.geo.seconds', { n: GEO_QUESTION_MS / 1000 })}
        />
        <Row label={t('camp.geo.points.label')} line={t(pointsKey[mode])} last />
      </View>

      <AppButton
        testID="camp.lobby.start"
        label={t('camp.geo.start', { game: name })}
        variant="secondary"
        disabled={!ready}
        onPress={() => {
          haptics.success();
          onStart(mode);
        }}
      />
      {players > geoRange.max ? (
        <AppText testID="camp.lobby.start-reason" variant="small" style={layout.center}>
          {t('camp.game.max', { n: geoRange.max })}
        </AppText>
      ) : null}
      <AppText variant="small" tone="muted" style={layout.center}>
        {t('camp.geo.solo')}
      </AppText>
    </View>
  );
}

function Row({
  label,
  value,
  line,
  last = false,
}: {
  label: string;
  value?: string;
  line?: string;
  last?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={[label, value, line].filter(Boolean).join(', ')}
      style={[layout.row, !last && layout.divider]}
    >
      <View style={layout.flex}>
        <AppText variant="h3">{label}</AppText>
        {line ? <AppText variant="small">{line}</AppText> : null}
      </View>
      {value ? <AppText variant="h3">{value}</AppText> : null}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  sub: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
    borderRadius: radii.tile,
    borderWidth: borders.card,
  },
  selected: { borderColor: geocoreColors.brand },
  subIcon: {
    width: geocoreSizes.subIcon,
    height: geocoreSizes.subIcon,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: spacing[4] },
  card: {
    paddingHorizontal: spacing[14],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  divider: { borderBottomWidth: borders.card, borderBottomColor: campColors.soft },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  sub: { backgroundColor: c.card, borderColor: c.line },
  card: { backgroundColor: c.card, borderColor: c.line },
}));
