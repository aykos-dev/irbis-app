import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { PathChestDto, PathNodeDto } from '../../../shared/api/generated/model';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import type { Locale } from '../../../shared/i18n';
import { CANVAS_WIDTH, nodeSize, slot, swapCard, trailHeight, trailLine, trailPath } from '../pathLayout';
import { nodeChip, placeName } from '../pathText';
import { swapDismissStore } from '../swapDismissStore';
import type { PathDeps } from '../types';
import { ChestNode } from './ChestNode';
import { NodePopover } from './NodePopover';
import { PathNode } from './PathNode';
import { SwapCard } from './SwapCard';

type Props = {
  month: string;
  nodes: PathNodeDto[];
  chest: PathChestDto | null;
  locale: Locale;
  placeType: PathDeps['placeType'];
  onOpenPlace: (placeId: string) => void;
};

/** A not-now node with a smart swap the user has not kept the plan for (AC3). */
function swapOf(node: PathNodeDto, month: string) {
  if (node.status !== 'not_now' || !node.swap || node.done || swapDismissStore.has(month, node.position)) {
    return null;
  }
  return node.swap;
}

/**
 * The winding path (AC2): dotted line, the place nodes top → bottom, then the chest. A smart swap
 * card sits under its not-now node (AC3) and pushes the slots below it down by its height.
 */
export function PathTrail({ month, nodes, chest, locale, placeType, onOpenPlace }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(CANVAS_WIDTH);
  const [selected, setSelected] = useState<number | null>(null);
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  // "Keep plan" writes the store; this re-renders so the card goes away.
  const [, setKeptCount] = useState(0);
  const ordered = [...nodes].sort((a, b) => a.position - b.position);
  const slots = ordered.length + (chest ? 1 : 0);
  const scaleX = width / CANVAS_WIDTH;

  const swaps = ordered.map(node => swapOf(node, month));
  const shifts: number[] = [];
  let shift = 0;
  for (let i = 0; i < slots; i += 1) {
    const above = ordered[i - 1];
    if (above && swaps[i - 1]) {
      shift += (cardHeights[above.position] ?? swapCard.estimate) + swapCard.gap * 2;
    }
    shifts.push(shift);
  }
  const height = trailHeight(slots) + shift;
  const yOf = (index: number) => slot(index)[1] + (shifts[index] ?? 0);

  const keep = (position: number) => {
    swapDismissStore.add(month, position);
    setKeptCount(count => count + 1);
  };
  const measure = (position: number, cardHeight: number) =>
    setCardHeights(current => (current[position] === cardHeight ? current : { ...current, [position]: cardHeight }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const open = ordered.find(node => node.position === selected);
  const openIndex = open ? ordered.indexOf(open) : -1;

  return (
    <View testID="path.trail" onLayout={onLayout} style={[layout.root, { height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={trailPath(slots, scaleX, shifts)}
          stroke={colors.line}
          strokeWidth={trailLine.width}
          strokeLinecap="round"
          strokeDasharray={trailLine.dash}
          fill="none"
        />
      </Svg>
      {ordered.map((node, index) => {
        const [cx] = slot(index);
        const cy = yOf(index);
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
      {ordered.map((node, index) => {
        const swap = swaps[index];
        return swap ? (
          <SwapCard
            key={`swap.${node.place.id}`}
            swap={swap}
            position={node.position}
            originalName={placeName(node.place.name, locale)}
            locale={locale}
            placeType={placeType}
            top={yOf(index) + nodeSize.ring / 2 + swapCard.gap}
            onSeePlace={onOpenPlace}
            onKeep={keep}
            onHeight={measure}
          />
        ) : null;
      })}
      {chest ? (
        <ChestNode
          chest={chest}
          month={month}
          x={slot(ordered.length)[0] * scaleX}
          y={yOf(ordered.length)}
          canvasX={slot(ordered.length)[0]}
        />
      ) : null}
      {open ? (
        <View style={StyleSheet.absoluteFill}>
          <NodePopover
            name={placeName(open.place.name, locale)}
            chip={nodeChip(open, locale)}
            x={slot(openIndex)[0] * scaleX}
            y={yOf(openIndex)}
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
