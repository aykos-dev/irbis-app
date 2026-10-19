import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import {
  NativeModules,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';
import { z } from 'zod';

/**
 * Typed wrapper of the `CampNet` native module: on Android (android/app/.../campnet) the
 * local-only hotspot and the Wi-Fi address; on iOS (ios/Irbis/CampNet) only the addresses of
 * Personal Hotspot and Wi-Fi, since iOS can't start a hotspot. The only caller of its methods.
 */
const hotspotSchema = z.object({
  ssid: z.string().min(1),
  password: z.string(),
  ip: z.string().min(1),
});
export type HotspotInfo = z.infer<typeof hotspotSchema>;

/** iOS resolves `{ ip, iface }` (`bridge100` = Personal Hotspot, `en0` = Wi-Fi); Android a string. */
const addressSchema = z.object({ ip: z.string().min(1), iface: z.string() });
const ipSchema = z
  .union([z.string().min(1), addressSchema.transform(address => address.ip)])
  .nullable();

/** Where an iPhone host serves the room: Personal Hotspot when it is on, else Wi-Fi. */
export type IosHostAddress = { ip: string; hotspot: boolean };

type NativeCampNet = {
  startHotspot: () => Promise<unknown>;
  stopHotspot: () => Promise<unknown>;
  getWifiIp: () => Promise<unknown>;
  /** iOS only. */
  getHotspotIp?: () => Promise<unknown>;
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
  const ip = ipSchema.safeParse(await native().getWifiIp());
  return ip.success ? ip.data : null;
}

/** iOS: IPv4 of Personal Hotspot (`bridge100`) when it is on, else null. Android: always null. */
async function getHotspotIp(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !isNativeCampNet(NativeModules.CampNet)) {
    return null;
  }
  const module = native();
  if (!module.getHotspotIp) {
    return null;
  }
  const ip = ipSchema.safeParse(await module.getHotspotIp());
  return ip.success ? ip.data : null;
}

/** iOS host (AC4): Personal Hotspot first, then Wi-Fi; null when neither is on. */
async function getIosHostAddress(): Promise<IosHostAddress | null> {
  const hotspotIp = await getHotspotIp();
  if (hotspotIp) {
    return { ip: hotspotIp, hotspot: true };
  }
  const wifiIp = await getWifiIp();
  return wifiIp ? { ip: wifiIp, hotspot: false } : null;
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
  getHotspotIp,
  getIosHostAddress,
  getWifiName,
};
