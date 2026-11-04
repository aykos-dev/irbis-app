import { clearSosContact } from './hooks/useSos';
import { clearTrack } from './trackStore';
import { clearQueue } from './waypointQueue';

/** After any check-out (screen or Home card): the track, waypoint queue and SOS contact leave the device. */
export function clearTripDevice(): void {
  clearTrack();
  clearQueue();
  clearSosContact();
}
