import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PathSwapDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { StatusChip } from '../../../shared/components/StatusChip';
import { palette, pathColors } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { formatNumber } from '../../../shared/utils/format';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { swapCard } from '../pathLayout';
import { placeName } from '../pathText';
import type { PathDeps } from '../types';
import { TypeGlyph } from './PathNode';

const MINUS = '−';
const KEEP_FLEX = 1;
const SEE_FLEX = 1.4;

type Props = {
  swap: PathSwapDto;
  position: number;
  originalName: string;
  locale: Locale;
  placeType: PathDeps['placeType'];
  top: number;
  onSeePlace: (placeId: string) => void;
  onKeep: (position: number) => void;
  onHeight: (position: number, height: number) => void;
};

/** "+1,100" / "−200": the swap's elevation against the original, always signed. */
function signedElevation(diff: number, locale: Locale): string {
  const sign = diff < 0 ? MINUS : '+';
  return `${sign}${formatNumber(Math.abs(diff), locale)}`;
}

function formatKm(km: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km);
}

function SwapIcon() {
  return (
    <Svg width={swapCard.icon} height={swapCard.icon} viewBox="0 0 24 24">
      <Path
        d="M4 8h13l-3-3M20 16H7l3 3"
        stroke={pathColors.swapAccent}
        strokeWidth={swapCard.iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Smart swap under a not-now node (AC3): a go place nearby, See place or Keep plan. */
export function SwapCard({
  swap,
  position,
  originalName,
  locale,
  placeType,
  top,
  onSeePlace,
  onKeep,
  onHeight,
}: Props) {
  const styles = useStyles();
  const name = placeName(swap.place.name, locale);
  const type = placeType(swap.place.type);
  const day = t(`path.days.${swap.day}`);

  useEffect(() => {
    qaLog('path_swap_shown', { position });
  }, [position]);

  const keep = () => {
    haptics.tap();
    qaLog('path_swap_kept', { position });
    onKeep(position);
  };

  const onLayout = (event: LayoutChangeEvent) => onHeight(position, event.nativeEvent.layout.height);

  return (
    <View testID="path.swap.card" onLayout={onLayout} style={[styles.card, layout.position, { top }]}>
      <View style={layout.head}>
        <SwapIcon />
        <AppText variant="caption" style={layout.caption}>
          {t('path.swap.badge')}
        </AppText>
      </View>
      <View style={layout.body}>
        <View style={[layout.tile, { backgroundColor: type.color }]} importantForAccessibility="no-hide-descendants">
          <TypeGlyph glyph={type.glyph} color={palette.white} size={swapCard.glyph} />
        </View>
        <View style={layout.text}>
          <AppText variant="h3">{t('path.swap.title', { name })}</AppText>
          <AppText variant="small">
            {t('path.swap.body', {
              elev: signedElevation(swap.elevationDiffM, locale),
              km: formatKm(swap.distanceFromOriginalKm, locale),
              original: originalName,
              day,
            })}
          </AppText>
          <StatusChip
            testID={`path.swap.${position}.status`}
            variant="go"
            label={t('path.status.go', { day })}
          />
        </View>
      </View>
      <View style={layout.buttons}>
        <View style={layout.keep}>
          <AppButton testID="path.swap.keep" label={t('path.swap.keep')} variant="white" onPress={keep} />
        </View>
        <View style={layout.see}>
          <AppButton testID="path.swap.see" label={t('path.swap.see')} onPress={() => onSeePlace(swap.place.id)} />
        </View>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  position: { position: 'absolute', left: 0, right: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  caption: { color: pathColors.swapAccent, textTransform: 'uppercase' },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  tile: {
    width: swapCard.tile,
    height: swapCard.tile,
    borderRadius: radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing[4] },
  buttons: { flexDirection: 'row', gap: spacing[10] },
  keep: { flex: KEEP_FLEX },
  see: { flex: SEE_FLEX },
});

const useStyles = createThemedStyles(c => ({
  card: {
    padding: spacing[14],
    gap: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: pathColors.swapBorder,
    backgroundColor: c.card,
  },
}));
