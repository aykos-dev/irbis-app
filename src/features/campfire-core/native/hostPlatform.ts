import { NativeModules, Platform } from 'react-native';

/**
 * iPhone hosts turn on Personal Hotspot themselves and come back (AC4): true on iOS when the
 * iOS `CampNet` module (the one with `getHotspotIp`) is linked. Android starts the hotspot itself.
 */
export function hostsWithGuide(): boolean {
  const module: unknown = NativeModules.CampNet;
  return (
    Platform.OS === 'ios' &&
    typeof module === 'object' &&
    module !== null &&
    'getHotspotIp' in module
  );
}
