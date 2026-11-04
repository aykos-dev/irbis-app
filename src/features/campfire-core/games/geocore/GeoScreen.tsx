import { useEffect } from 'react';

import { sounds } from '../../../../shared/sounds/sounds';
import type { GeoPoint, GeoPublic, RosterPlayer } from '../../protocol/codec';
import { GeoFinal } from './GeoFinal';
import { GeoReveal, type GeoHostControls } from './GeoReveal';
import { GeoRound } from './GeoRound';

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

/** Geocore on a dealt phone, host included: the question, the reveal or the final. */
export function GeoScreen({ info, selfSeatId, roster, onGuess, host }: Props) {
  useEffect(() => {
    void sounds.load();
  }, []);

  switch (info.phase) {
    case 'question':
      return <GeoRound info={info} selfSeatId={selfSeatId} onGuess={onGuess} />;
    case 'reveal':
      return <GeoReveal info={info} selfSeatId={selfSeatId} roster={roster} host={host} />;
    default:
      return <GeoFinal info={info} selfSeatId={selfSeatId} roster={roster} host={host} />;
  }
}
