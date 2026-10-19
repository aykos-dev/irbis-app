/**
 * Test doubles for the Campfire network libraries (registered in jest.setup.js):
 * `react-native-tcp-socket` (an in-memory server; tests connect fake clients) and
 * `react-native-zeroconf` (records publish / unpublish).
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

  setEncoding(): this {
    return this;
  }

  write(data: string): boolean {
    this.written.push(data);
    return true;
  }

  destroy(): this {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('close', false);
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

export const fakeNet = {
  servers: [] as FakeServer[],
  failListen: false,
  published: [] as { name: string; type: string; port: number; txt: unknown }[],
  unpublished: [] as string[],
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
  },
};

export const tcpSocketModule = {
  __esModule: true,
  default: {
    createServer: (onConnection: (socket: FakeSocket) => void) => {
      const server = new FakeServer(onConnection);
      fakeNet.servers.push(server);
      return server;
    },
    Socket: FakeSocket,
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
}

export const zeroconfModule = { __esModule: true, default: FakeZeroconf };
