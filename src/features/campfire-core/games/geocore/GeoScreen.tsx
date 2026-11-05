import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../../../shared/constants/spacing';
import { sounds } from '../../../../shared/sounds/sounds';
import type { GeoPoint, GeoPublic, RosterPlayer } from '../../protocol/codec';
import { GeoFinal } from './GeoFinal';
import {
  GeoRevealBottom,
  GeoRevealTop,
  revealGlobeProps,
  type GeoHostControls,
} from './GeoReveal';
import {
  GeoRoundBottom,
  GeoRoundTop,
  roundGlobeProps,
  useRoundPick,
} from './GeoRound';
import { Globe } from './Globe';

export type { GeoHostControls } from './GeoReveal';

type Props = {
  info: GeoPublic;
  /** A dealt seat (the caller shows the waiting view to phones that joined mid-game). */
  selfSeatId: string;
  roster: RosterPlayer[];
  onGuess: (point: GeoPoint) => void;
  /** The host's buttons; players wait for the host instead. */
  host?: GeoHostControls;
};

/**
 * Geocore on a dealt phone, host included: the question, the reveal or the final. The map sits at
 * one place in the tree for questions and reveals, so a single MapLibre map lives through the whole
 * game; only its props change and the camera eases between views.
 */
export function GeoScreen({ info, selfSeatId, roster, onGuess, host }: Props) {
  const [pick, updatePick] = useRoundPick(info.roundNo);

  useEffect(() => {
    void sounds.load();
  }, []);

  if (info.phase === 'final') {
    return <GeoFinal info={info} selfSeatId={selfSeatId} roster={roster} host={host} />;
  }
  const question = info.phase === 'question';
  const globe = question
    ? roundGlobeProps(info, selfSeatId, pick, updatePick)
    : revealGlobeProps(info, selfSeatId);
  if (!globe) {
    return null;
  }
  return (
    <View testID={question ? undefined : 'geo.reveal'} style={layout.root}>
      {question ? (
        <GeoRoundTop key={`top.q${info.roundNo}`} info={info} selfSeatId={selfSeatId} />
      ) : (
        <GeoRevealTop key={`top.r${info.roundNo}`} info={info} selfSeatId={selfSeatId} />
      )}
      <Globe {...globe} />
      {question ? (
        <GeoRoundBottom
          key={`bottom.q${info.roundNo}`}
          info={info}
          selfSeatId={selfSeatId}
          onGuess={onGuess}
          pick={pick}
          update={updatePick}
        />
      ) : (
        <GeoRevealBottom
          key={`bottom.r${info.roundNo}`}
          info={info}
          selfSeatId={selfSeatId}
          roster={roster}
          host={host}
        />
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
});
