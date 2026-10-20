import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PathChestDto, PathNodeDto } from '../../../shared/api/generated/model';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import type { Locale } from '../../../shared/i18n';
import { CANVAS_WIDTH, slot, trailHeight, trailLine, trailPath } from '../pathLayout';
import { nodeChip, placeName } from '../pathText';
import type { PathDeps } from '../types';
import { ChestNode } from './ChestNode';
import { NodePopover } from './NodePopover';
import { PathNode } from './PathNode';

type Props = {
  nodes: PathNodeDto[];
  chest: PathChestDto | null;
  locale: Locale;
  placeType: PathDeps['placeType'];
  onOpenPlace: (placeId: string) => void;
};

/** The winding path (AC2): dotted line, the place nodes top → bottom, then the chest. */
export function PathTrail({ nodes, chest, locale, placeType, onOpenPlace }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(CANVAS_WIDTH);
  const [selected, setSelected] = useState<number | null>(null);
  const ordered = [...nodes].sort((a, b) => a.position - b.position);
  const slots = ordered.length + (chest ? 1 : 0);
  const height = trailHeight(slots);
  const scaleX = width / CANVAS_WIDTH;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const open = ordered.find(node => node.position === selected);
  const openIndex = open ? ordered.indexOf(open) : -1;

  return (
    <View testID="path.trail" onLayout={onLayout} style={[layout.root, { height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={trailPath(slots, scaleX)}
          stroke={colors.line}
          strokeWidth={trailLine.width}
          strokeLinecap="round"
          strokeDasharray={trailLine.dash}
          fill="none"
        />
      </Svg>
      {ordered.map((node, index) => {
        const [cx, cy] = slot(index);
        return (
          <PathNode
            key={node.place.id}
            node={node}
            name={placeName(node.place.name, locale)}
            chip={nodeChip(node, locale)}
            x={cx * scaleX}
            y={cy}
            canvasX={cx}
            type={placeType(node.place.type)}
            onPress={pressed => setSelected(pressed.position)}
          />
        );
      })}
      {chest ? (
        <ChestNode
          chest={chest}
          x={slot(ordered.length)[0] * scaleX}
          y={slot(ordered.length)[1]}
          canvasX={slot(ordered.length)[0]}
        />
      ) : null}
      {open ? (
        <View style={StyleSheet.absoluteFill}>
          <NodePopover
            name={placeName(open.place.name, locale)}
            chip={nodeChip(open, locale)}
            x={slot(openIndex)[0] * scaleX}
            y={slot(openIndex)[1]}
            width={width}
            height={height}
            onOpen={() => {
              setSelected(null);
              onOpenPlace(open.place.id);
            }}
            onClose={() => setSelected(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { marginTop: spacing[8] },
});
