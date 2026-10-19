import { createElement, useState } from 'react';
import { View } from 'react-native';

/**
 * Test doubles for the Campfire native libraries (registered in jest.setup.js):
 * `react-native-tcp-socket` (an in-memory server; tests connect fake clients, and app clients
 * dial fake hosts by IP), `react-native-zeroconf` (records publish / unpublish, scans
 * `fakeNet.services`), `react-native-vision-camera` (`fakeCamera`) and
 * `react-native-wifi-reborn` (`fakeWifi`).
 */
type Listener = (...args: unknown[]) => void;

class Emitter {
  private listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.listeners.set(
        event,
        (this.listeners.get(event) ?? []).filter(item => item !== wrapped),
      );
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]): void {
    (this.listeners.get(event) ?? [])
      .slice()
      .forEach(listener => listener(...args));
  }
}

/** One client connection as the host server sees it. */
export class FakeSocket extends Emitter {
  written: string[] = [];
  destroyed = false;
  /** The other end when an app client dialled a fake host (see `createConnection`). */
  peer: FakeSocket | null = null;

  setEncoding(): this {
    return this;
  }

  write(data: string): boolean {
    this.written.push(data);
    if (this.peer && !this.peer.destroyed) {
      this.peer.emit('data', data);
    }
    return true;
  }

  destroy(): this {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('close', false);
      if (this.peer && !this.peer.destroyed) {
        this.peer.destroy();
      }
    }
    return this;
  }

  /** Client → host: one NDJSON line. */
  send(message: Record<string, unknown>): void {
    this.emit('data', `${JSON.stringify(message)}\n`);
  }

  /** Host → client messages so far. */
  received(): { type: string; [key: string]: unknown }[] {
    return this.written
      .join('')
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  }

  /** The client went away without a goodbye. */
  drop(): void {
    this.destroyed = true;
    this.emit('close', true);
  }
}

export class FakeServer extends Emitter {
  /** Server ends of app clients that dialled this server. */
  links: FakeSocket[] = [];
  listening = false;
  closed = false;
  port: number | null = null;

  constructor(private readonly onConnection: (socket: FakeSocket) => void) {
    super();
  }

  listen(options: { port: number }, callback?: () => void): this {
    if (fakeNet.failListen) {
      this.emit('error', new Error('EADDRINUSE'));
      return this;
    }
    this.listening = true;
    this.port = options.port;
    callback?.();
    return this;
  }

  close(): this {
    this.closed = true;
    this.listening = false;
    return this;
  }

  /** A new client connects. */
  connect(): FakeSocket {
    const socket = new FakeSocket();
    this.onConnection(socket);
    return socket;
  }
}

type FakeService = {
  name: string;
  type: string;
  port: number;
  ipv4: string[];
  addresses: string[];
  txt: Record<string, string>;
};

export const fakeNet = {
  servers: [] as FakeServer[],
  failListen: false,
  published: [] as { name: string; type: string; port: number; txt: unknown }[],
  unpublished: [] as string[],
  /** Fake hosts app clients can dial, by IP. Unknown IPs refuse at once. */
  hosts: {} as Record<string, FakeServer>,
  /** Unknown IPs never answer (the dial hangs until the app gives up) instead of refusing. */
  silent: false,
  /** Every dial an app client made. */
  dials: [] as { host: string; port: number }[],
  /** Services a zeroconf scan finds. */
  services: [] as FakeService[],
  scans: [] as string[],
  /** Makes `server` reachable at `ip`. */
  serve(ip: string, server: FakeServer): void {
    fakeNet.hosts[ip] = server;
  },
  /** Cuts every live link to the host at `ip` (Wi-Fi gone): both ends see `close`. */
  cut(ip: string): void {
    const server = fakeNet.hosts[ip];
    delete fakeNet.hosts[ip];
    server?.links.forEach(remote => {
      const client = remote.peer;
      remote.peer = null;
      remote.drop();
      if (client && !client.destroyed) {
        client.peer = null;
        client.drop();
      }
    });
  },
  /** The server the app started last. */
  server(): FakeServer {
    const last = fakeNet.servers[fakeNet.servers.length - 1];
    if (!last) {
      throw new Error('No TCP server was started');
    }
    return last;
  },
  reset(): void {
    fakeNet.servers = [];
    fakeNet.failListen = false;
    fakeNet.published = [];
    fakeNet.unpublished = [];
    fakeNet.hosts = {};
    fakeNet.silent = false;
    fakeNet.dials = [];
    fakeNet.services = [];
    fakeNet.scans = [];
  },
};

/** An app client dials `host:port`: linked to the fake host's server, refused, or left hanging. */
function createConnection(
  options: { host?: string; port: number },
  onConnect: () => void,
): FakeSocket {
  const client = new FakeSocket();
  const host = options.host ?? '';
  fakeNet.dials.push({ host, port: options.port });
  Promise.resolve().then(() => {
    if (client.destroyed) {
      return;
    }
    const server = fakeNet.hosts[host];
    if (!server || !server.listening || server.port !== options.port) {
      if (!server && fakeNet.silent) {
        return;
      }
      client.emit('error', new Error('ECONNREFUSED'));
      client.destroy();
      return;
    }
    const remote = server.connect();
    remote.peer = client;
    client.peer = remote;
    server.links.push(remote);
    onConnect();
  });
  return client;
}

export const tcpSocketModule = {
  __esModule: true,
  default: {
    createServer: (onConnection: (socket: FakeSocket) => void) => {
      const server = new FakeServer(onConnection);
      fakeNet.servers.push(server);
      return server;
    },
    Socket: FakeSocket,
    createConnection,
  },
};

class FakeZeroconf extends Emitter {
  publishService(
    type: string,
    _protocol: string,
    _domain: string,
    name: string,
    port: number,
    txt: unknown,
  ): void {
    fakeNet.published.push({ name, type, port, txt });
  }

  unpublishService(name: string): void {
    fakeNet.unpublished.push(name);
  }

  scan(options: { type: string }): void {
    fakeNet.scans.push(options.type);
    Promise.resolve().then(() =>
      fakeNet.services
        .filter(service => service.type === options.type)
        .forEach(service => this.emit('resolved', service)),
    );
  }

  stop(): void {
    return undefined;
  }

  removeDeviceListeners(): void {
    return undefined;
  }
}

export const zeroconfModule = { __esModule: true, default: FakeZeroconf };

/** `react-native-vision-camera`: permission state and the QR scanner the screen registered. */
type FakeCodeScanner = {
  codeTypes: string[];
  onCodeScanned: (codes: { type: string; value?: string }[], frame: unknown) => void;
};

export const fakeCamera = {
  status: 'granted' as 'granted' | 'denied' | 'not-determined' | 'restricted',
  /** What the OS answers when the app asks. */
  grantOnRequest: true,
  requests: 0,
  scanner: null as FakeCodeScanner | null,
  /** The camera sees a QR code with `value`. */
  scan(value: string): void {
    fakeCamera.scanner?.onCodeScanned([{ type: 'qr', value }], { width: 1, height: 1 });
  },
  reset(): void {
    fakeCamera.status = 'granted';
    fakeCamera.grantOnRequest = true;
    fakeCamera.requests = 0;
    fakeCamera.scanner = null;
  },
};

function FakeCamera(props: { testID?: string; style?: unknown; codeScanner?: FakeCodeScanner }) {
  fakeCamera.scanner = props.codeScanner ?? null;
  return createElement(View, { testID: props.testID });
}

export const visionCameraModule = {
  __esModule: true,
  Camera: Object.assign(FakeCamera, {
    getCameraPermissionStatus: () => fakeCamera.status,
  }),
  useCameraDevice: () => ({ id: 'back', position: 'back' }),
  useCodeScanner: (scanner: FakeCodeScanner) => scanner,
  useCameraPermission: () => {
    const [granted, setGranted] = useState(fakeCamera.status === 'granted');
    return {
      hasPermission: granted,
      requestPermission: async () => {
        fakeCamera.requests += 1;
        fakeCamera.status = fakeCamera.grantOnRequest ? 'granted' : 'denied';
        setGranted(fakeCamera.grantOnRequest);
        return fakeCamera.grantOnRequest;
      },
    };
  },
};

/** `react-native-wifi-reborn`: joins recorded, failure on demand. */
export const fakeWifi = {
  /** Each join, with how many TCP dials the app had made before it. */
  joins: [] as { ssid: string; password: string; dialsBefore: number }[],
  fail: false,
  reset(): void {
    fakeWifi.joins = [];
    fakeWifi.fail = false;
  },
};

export const wifiModule = {
  __esModule: true,
  default: {
    connectToProtectedSSID: async (ssid: string, password: string) => {
      fakeWifi.joins.push({ ssid, password, dialsBefore: fakeNet.dials.length });
      if (fakeWifi.fail) {
        throw new Error('unableToConnect');
      }
    },
  },
};
