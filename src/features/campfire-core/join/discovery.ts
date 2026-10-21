import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import Zeroconf, { type Service } from 'react-native-zeroconf';

import { campNet } from '../native/campNet';
import {
  CAMP_PORT,
  createLineBuffer,
  decodeHost,
  encode,
} from '../protocol/codec';
import { SERVICE_TYPE } from '../room/hostServer';
import { connectCamp } from './connection';

/** Bonjour / NSD gets this long before the subnet scan starts. */
export const ZEROCONF_WINDOW_MS = 3000;
/** The whole search gives up after this long: `not_found`. */
export const DISCOVERY_TIMEOUT_MS = 8000;
/** One subnet probe waits this long for an answer. */
export const PROBE_TIMEOUT_MS = 400;
/** The native connect is capped too, so timed-out probes do not sit in the socket queue for seconds. */
export const PROBE_CONNECT_TIMEOUT_MS = PROBE_TIMEOUT_MS;
/** Subnet probes in flight at once. */
export const SCAN_PARALLEL = 32;

/** A room that answered a probe for its code. */
export type FoundRoom = {
  code: string;
  host: string;
  port: number;
  /** Seats taken, host included. */
  players: number;
  /** Network name the host is on (hotspot SSID or Wi-Fi name). */
  network: string;
};

export type ProbeResult =
  | { kind: 'found'; room: FoundRoom }
  | { kind: 'version' }
  | { kind: 'miss' };

export type DiscoveryResult =
  | { kind: 'found'; room: FoundRoom }
  | { kind: 'version' }
  | { kind: 'not_found' };

/** Android: sockets go over Wi-Fi even when a no-internet hotspot is not the default network. */
export function connectOptions(host: string, port: number) {
  return {
    host,
    port,
    ...(Platform.OS === 'android' ? { interface: 'wifi' as const } : {}),
  };
}

/** Asks `host:port` whether room `code` is there, without taking a seat. */
export function probeHost(
  host: string,
  port: number,
  code: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  return new Promise(resolve => {
    let done = false;
    const split = createLineBuffer();
    const connection = connectCamp(
      {
        ...connectOptions(host, port),
        connectTimeout: PROBE_CONNECT_TIMEOUT_MS,
      },
      socket => {
        if (done) {
          connection.close();
          return;
        }
        socket.write(encode({ type: 'probe', code }));
      },
    );
    const { socket } = connection;
    const finish = (result: ProbeResult) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      // A connect still queued on a native thread is destroyed by `connectCamp` when it settles.
      connection.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ kind: 'miss' }), timeoutMs);
    socket.on('data', data => {
      for (const line of split(data.toString())) {
        const decoded = decodeHost(line);
        if (!decoded.ok) {
          if (decoded.reason === 'version') {
            finish({ kind: 'version' });
          }
          continue;
        }
        const message = decoded.message;
        if (message.type === 'probeOk') {
          finish({
            kind: 'found',
            room: {
              code,
              host,
              port,
              players: message.players,
              network: message.network,
            },
          });
        } else if (message.type === 'rejected') {
          finish(
            message.reason === 'version' ? { kind: 'version' } : { kind: 'miss' },
          );
        }
      }
    });
    socket.on('error', () => finish({ kind: 'miss' }));
    socket.on('close', () => finish({ kind: 'miss' }));
  });
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

/** A controller that also aborts when `parent` does. */
function linkedController(parent: AbortSignal): AbortController {
  const controller = new AbortController();
  if (parent.aborted) {
    controller.abort();
  } else {
    parent.addEventListener('abort', () => controller.abort());
  }
  return controller;
}

function serviceAddress(service: Service): string | undefined {
  return service.ipv4?.[0] ?? service.addresses?.[0];
}

/** The first Bonjour / NSD service advertising room `code` within the window, else null. */
function zeroconfLookup(
  code: string,
  signal: AbortSignal,
): Promise<{ host: string; port: number } | null> {
  return new Promise(resolve => {
    const zeroconf = new Zeroconf();
    const window = linkedController(signal);
    let settled = false;
    const finish = (hit: { host: string; port: number } | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.abort();
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
      resolve(hit);
    };
    zeroconf.on('resolved', service => {
      const host = serviceAddress(service);
      if (service.txt?.code === code && host) {
        finish({ host, port: service.port });
      }
    });
    // A scan error (no Local Network access, NSD busy) just leaves the subnet scan to find it.
    zeroconf.on('error', () => undefined);
    zeroconf.scan({ type: SERVICE_TYPE, protocol: 'tcp', domain: 'local.' });
    wait(ZEROCONF_WINDOW_MS, window.signal).then(() => finish(null));
  });
}

/** This phone's IPv4 on the Wi-Fi it is on, or null. */
async function ownWifiIp(): Promise<string | null> {
  const state = await NetInfo.fetch();
  if (state.type === NetInfoStateType.wifi && state.details.ipAddress) {
    return state.details.ipAddress;
  }
  return campNet.getWifiIp();
}

/** Every other address of the phone's /24, probed `SCAN_PARALLEL` at a time. */
async function scanSubnet(
  code: string,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const own = await ownWifiIp();
  const match = own ? /^(\d+\.\d+\.\d+)\.(\d+)$/.exec(own) : null;
  if (!match) {
    return { kind: 'miss' };
  }
  const [, prefix, last] = match;
  const queue = Array.from({ length: 254 }, (_, index) => index + 1)
    .filter(host => String(host) !== last)
    .map(host => `${prefix}.${host}`);
  let found: ProbeResult = { kind: 'miss' };
  const worker = async () => {
    while (!signal.aborted && found.kind === 'miss') {
      const host = queue.shift();
      if (!host) {
        return;
      }
      const result = await probeHost(host, CAMP_PORT, code, PROBE_TIMEOUT_MS);
      if (found.kind === 'miss' && result.kind !== 'miss') {
        found = result;
      }
    }
  };
  await Promise.all(Array.from({ length: SCAN_PARALLEL }, worker));
  return found;
}

/**
 * Finds room `code` on the local network (AC5): Bonjour / NSD for 3 s; nothing there → probe the
 * phone's /24 on :47821; `not_found` once 8 s have passed. Aborting `signal` ends it early.
 */
export async function discoverRoom(
  code: string,
  signal: AbortSignal,
): Promise<DiscoveryResult> {
  const deadline = linkedController(signal);
  const stop = deadline.signal;
  const timer = setTimeout(() => deadline.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const hit = await zeroconfLookup(code, stop);
    if (hit) {
      const probed = await probeHost(hit.host, hit.port, code, PROBE_TIMEOUT_MS);
      if (probed.kind !== 'miss') {
        return probed;
      }
    }
    if (stop.aborted) {
      return { kind: 'not_found' };
    }
    const scanned = await scanSubnet(code, stop);
    return scanned.kind === 'miss' ? { kind: 'not_found' } : scanned;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A scanned QR names the host: probe it until it answers or 8 s pass (a phone that just joined
 * the hotspot can take a moment before the host is reachable).
 */
export async function findRoomAt(
  host: string,
  port: number,
  code: string,
  signal: AbortSignal,
): Promise<DiscoveryResult> {
  const deadline = linkedController(signal);
  const timer = setTimeout(() => deadline.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    while (!deadline.signal.aborted) {
      const probed = await probeHost(host, port, code, PROBE_TIMEOUT_MS);
      if (probed.kind !== 'miss') {
        return probed;
      }
      await wait(PROBE_TIMEOUT_MS, deadline.signal);
    }
    return { kind: 'not_found' };
  } finally {
    clearTimeout(timer);
  }
}
