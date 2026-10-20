import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { PathChestDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { pathColors } from '../../../shared/constants/colors';
import { radii, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { CANVAS_WIDTH, chestSize, nodeSize } from '../pathLayout';

type Props = { chest: PathChestDto; x: number; y: number; canvasX: number };

/** The monthly chest at the end of the path (static in this slice): closed chest + progress. */
export function ChestNode({ chest, x, y, canvasX }: Props) {
  const progress = t('path.chest.progress', { done: chest.done, required: chest.required });
  const labelRight = canvasX < CANVAS_WIDTH / 2;
  const halfW = chestSize.width / 2;
  return (
    <>
      <View
        testID="path.chest"
        accessible
        accessibilityRole="image"
        accessibilityLabel={progress}
        style={[layout.tile, { left: x - halfW, top: y - chestSize.height / 2 }]}
      >
        <Svg width={chestSize.glyphWidth} height={chestSize.glyphHeight} viewBox="0 0 48 40">
          <Rect x="4" y="14" width="40" height="24" rx="5" fill={pathColors.chestBody} />
          <Path d="M4 18 Q4 4 24 4 Q44 4 44 18Z" fill={pathColors.chestLid} />
          <Rect x="4" y="16" width="40" height="5" fill={pathColors.chestBand} />
          <Rect x="20" y="14" width="8" height="12" rx="2" fill={pathColors.chestBand} />
        </Svg>
      </View>
      <View
        style={[
          layout.label,
          { top: y - chestSize.height / 2 + spacing[8] },
          labelRight
            ? { left: x + halfW + nodeSize.labelGap }
            : { left: x - halfW - nodeSize.labelGap - nodeSize.labelWidth },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant="small" style={labelRight ? null : layout.textEnd}>
          {progress}
        </AppText>
      </View>
    </>
  );
}

const layout = StyleSheet.create({
  tile: {
    position: 'absolute',
    width: chestSize.width,
    height: chestSize.height,
    borderRadius: radii.card,
    backgroundColor: pathColors.chestTile,
    borderBottomWidth: chestSize.edge,
    borderBottomColor: pathColors.chestEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { position: 'absolute', width: nodeSize.labelWidth },
  textEnd: { textAlign: 'right' },
});
