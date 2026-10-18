import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Polygon, Rect } from 'react-native-svg';

import { levelMeta, type FrameShape } from './levelMeta';

/** Canvas Companions frame: outer 210, inner 184, art 160, 6 px dark drop shadow. */
const OUTER = 210;
const INNER_RATIO = 184 / OUTER;
const ART_RATIO = 160 / OUTER;
const SHADOW_RATIO = 6 / OUTER;

type Props = {
  level: number;
  /** Outer frame size in px. */
  size?: number;
  /** Rendered centred in the frame; receives the art size. */
  children: (artSize: number) => ReactNode;
  testID?: string;
};

function Shape({ shape, side, offset, y, fill }: {
  shape: FrameShape;
  side: number;
  offset: number;
  y: number;
  fill: string;
}) {
  if (shape.kind === 'circle') {
    return <Circle cx={offset + side / 2} cy={y + side / 2} r={side / 2} fill={fill} />;
  }
  if (shape.kind === 'rounded') {
    const r = side * shape.radius;
    return <Rect x={offset} y={y} width={side} height={side} rx={r} ry={r} fill={fill} />;
  }
  const points = shape.points.map(([px, py]) => `${offset + px * side},${y + py * side}`).join(' ');
  return <Polygon points={points} fill={fill} />;
}

/** The level's frame shape in its colour, a tinted inner shape and the art on top (AC5, AC6). */
export function LevelFrame({ level, size = OUTER, children, testID }: Props) {
  const meta = levelMeta(level);
  const inner = size * INNER_RATIO;
  const inset = (size - inner) / 2;
  const shadow = size * SHADOW_RATIO;
  const art = size * ART_RATIO;

  return (
    <View testID={testID} style={{ width: size, height: size + shadow }}>
      <Svg width={size} height={size + shadow} style={StyleSheet.absoluteFill}>
        <G>
          <Shape shape={meta.shape} side={size} offset={0} y={shadow} fill={meta.dark} />
          <Shape shape={meta.shape} side={size} offset={0} y={0} fill={meta.color} />
          <Shape shape={meta.shape} side={inner} offset={inset} y={inset} fill={meta.tint} />
        </G>
      </Svg>
      <View style={[layout.art, { width: size, height: size }]}>{children(art)}</View>
    </View>
  );
}

const layout = StyleSheet.create({
  art: { position: 'absolute', top: 0, start: 0, alignItems: 'center', justifyContent: 'center' },
});
