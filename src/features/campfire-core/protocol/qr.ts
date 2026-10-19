import { PROTOCOL_VERSION } from './codec';

const PREFIX = 'irbis-camp://join?';

/** What a QR carries. Wi-Fi fields only when the app created the hotspot (Android). */
export type JoinInfo = {
  code: string;
  ip: string;
  port: number;
  wifi?: { ssid: string; password: string };
};

/** `irbis-camp://join?v=1&code=4821&ip=<host ip>&port=47821[&ssid=..&pw=..]` */
export function buildJoinUrl(info: JoinInfo): string {
  const params: [string, string][] = [
    ['v', String(PROTOCOL_VERSION)],
    ['code', info.code],
    ['ip', info.ip],
    ['port', String(info.port)],
  ];
  if (info.wifi) {
    params.push(['ssid', info.wifi.ssid], ['pw', info.wifi.password]);
  }
  return (
    PREFIX +
    params
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
  );
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** The join info in a scanned QR, or null when it is not a v1 Irbis Campfire link. */
export function parseJoinUrl(url: string): JoinInfo | null {
  if (!url.startsWith(PREFIX)) {
    return null;
  }
  const params = new Map<string, string>();
  for (const pair of url.slice(PREFIX.length).split('&')) {
    const at = pair.indexOf('=');
    const value = at > 0 ? safeDecode(pair.slice(at + 1)) : null;
    if (value === null) {
      return null;
    }
    params.set(pair.slice(0, at), value);
  }
  const code = params.get('code') ?? '';
  const ip = params.get('ip') ?? '';
  const port = Number(params.get('port'));
  if (
    params.get('v') !== String(PROTOCOL_VERSION) ||
    !/^\d{4}$/.test(code) ||
    !ip ||
    !Number.isInteger(port)
  ) {
    return null;
  }
  const ssid = params.get('ssid');
  const password = params.get('pw');
  return {
    code,
    ip,
    port,
    ...(ssid && password !== undefined ? { wifi: { ssid, password } } : {}),
  };
}
