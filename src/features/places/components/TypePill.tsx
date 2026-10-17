import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { PlaceType } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { palette } from '../../../shared/constants/colors';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { placeTypes } from '../placeTypes';

/** Type pill: colour + icon + label (AC7). */
export function TypePill({ type }: { type: PlaceType }) {
  const { color, glyph, labelKey } = placeTypes[type];
  const label = t(labelKey);
  return (
    <View
      testID="place.type"
      accessible
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: color }]}
    >
      {'xml' in glyph ? (
        <SvgXml xml={glyph.xml} width={sizes.icon} height={sizes.icon} color={palette.white} />
      ) : (
        <Icon name={glyph.icon} color={palette.white} />
      )}
      <AppText variant="chip" tone="white">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[6],
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
  },
});
