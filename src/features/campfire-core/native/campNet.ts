import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import {
  NativeModules,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';
import { z } from 'zod';

/**
 * Typed wrapper of the Android `CampNet` native module (android/app/.../campnet): local-only
 * hotspot and the phone's Wi-Fi address. The only caller of `NativeModules.CampNet`.
 */
const hotspotSchema = z.object({
  ssid: z.string().min(1),
  password: z.string(),
  ip: z.string().min(1),
});
export type HotspotInfo = z.infer<typeof hotspotSchema>;

type NativeCampNet = {
  startHotspot: () => Promise<unknown>;
  stopHotspot: () => Promise<unknown>;
  getWifiIp: () => Promise<unknown>;
};

function isNativeCampNet(value: unknown): value is NativeCampNet {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startHotspot' in value &&
    'stopHotspot' in value &&
    'getWifiIp' in value
  );
}

class CampNetUnavailableError extends Error {
  constructor() {
    super('CampNet native module is not available on this platform');
    this.name = 'CampNetUnavailableError';
  }
}

function native(): NativeCampNet {
  const module: unknown = NativeModules.CampNet;
  if (!isNativeCampNet(module)) {
    throw new CampNetUnavailableError();
  }
  return module;
}

const API_NEARBY_WIFI = 33;

/** Android 13+: Nearby Wi-Fi devices; older: fine location (what local-only hotspot needs). */
async function requestHotspotPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const permission: Permission =
    Number(Platform.Version) >= API_NEARBY_WIFI
      ? PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
      : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function startHotspot(): Promise<HotspotInfo> {
  return hotspotSchema.parse(await native().startHotspot());
}

async function stopHotspot(): Promise<void> {
  if (isNativeCampNet(NativeModules.CampNet)) {
    await native().stopHotspot();
  }
}

/** IPv4 of the Wi-Fi network the phone is on, or null when it is not on Wi-Fi. */
async function getWifiIp(): Promise<string | null> {
  if (!isNativeCampNet(NativeModules.CampNet)) {
    return null;
  }
  const ip = z
    .string()
    .min(1)
    .nullable()
    .safeParse(await native().getWifiIp());
  return ip.success ? ip.data : null;
}

/** The Wi-Fi network name when the OS shares it, else null. */
async function getWifiName(): Promise<string | null> {
  const state = await NetInfo.fetch();
  if (state.type !== NetInfoStateType.wifi) {
    return null;
  }
  const ssid = state.details.ssid;
  return ssid && ssid !== '<unknown ssid>' ? ssid : null;
}

export const campNet = {
  requestHotspotPermission,
  startHotspot,
  stopHotspot,
  getWifiIp,
  getWifiName,
};
