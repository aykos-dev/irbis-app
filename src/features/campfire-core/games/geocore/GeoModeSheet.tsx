import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import { Sheet } from '../../../../shared/components/Sheet';
import { borders, radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, geocoreColors, geocoreSizes, geoModeColors } from '../../campTheme';
import { geoModeList } from './geoGame';
import { ChevronGlyph, CloseGlyph, GeocoreGlyph, GeoModeGlyph } from './GeoGlyphs';
import type { GeoMode } from './scoring';

type Props = {
  onPick: (mode: GeoMode) => void;
  onDismiss: () => void;
};

/** Geocore games (canvas GeoHubSheet, AC1): the four modes; a tap hosts that one. */
export function GeoModeSheet({ onPick, onDismiss }: Props) {
  const styles = useStyles();
  const [closing, setClosing] = useState(false);
  const title = t('camp.games.geocore');
  return (
    <Sheet testID="geo.sheet" accessibilityLabel={title} closing={closing} onDismiss={onDismiss}>
      <View style={layout.section}>
        <View style={layout.row}>
          <View style={[layout.icon, layout.brand]}>
            <GeocoreGlyph size={geocoreSizes.sheetHeadGlyph} />
          </View>
          <View style={layout.flex}>
            <AppText variant="h1" accessibilityRole="header">
              {title}
            </AppText>
            <AppText variant="small">{t('camp.geo.sheetLine')}</AppText>
          </View>
          <Pressable
            testID="geo.sheet.close"
            accessibilityLabel={t('common.close')}
            onPress={() => setClosing(true)}
            style={layout.close}
          >
            <CloseGlyph size={sizes.icon} color={campColors.muted} />
          </Pressable>
        </View>
        {geoModeList.map(mode => {
          const name = t(`camp.geo.mode.${mode}`);
          const line = t(`camp.geo.line.${mode}`);
          return (
            <Pressable
              key={mode}
              testID={`geo.sheet.${mode}`}
              accessibilityLabel={`${name}, ${line}`}
              onPress={() => {
                haptics.tap();
                onPick(mode);
              }}
              style={[layout.row, layout.option, styles.option]}
            >
              <View style={[layout.icon, { backgroundColor: geoModeColors[mode].bg }]}>
                <GeoModeGlyph mode={mode} size={geocoreSizes.rowGlyph} />
              </View>
              <View style={layout.flex}>
                <AppText variant="h3">{name}</AppText>
                <AppText variant="small">{line}</AppText>
              </View>
              <ChevronGlyph size={geocoreSizes.chevron} color={campColors.muted} />
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[14] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  flex: { flex: 1, gap: spacing[4] },
  icon: {
    width: geocoreSizes.sheetIcon,
    height: geocoreSizes.sheetIcon,
    borderRadius: radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { backgroundColor: geocoreColors.brand },
  close: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: geocoreSizes.rowMinHeight,
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
});

const useStyles = createThemedStyles(c => ({
  option: { backgroundColor: c.card, borderColor: c.line },
}));
