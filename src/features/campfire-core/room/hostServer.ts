import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';

import { qaLog } from '../../../shared/utils/qaLog';
import { uuidV4 } from '../../../shared/utils/uuid';
import {
  CAMP_PORT,
  createLineBuffer,
  decodeClient,
  encode,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
  type OutgoingHostMessage,
} from '../protocol/codec';
import {
  roomReducer,
  toRoster,
  type RoomAction,
  type RoomOutcome,
  type RoomState,
} from './roomReducer';

/** Bonjour / NSD service the join screen looks for (TXT `code`). */
export const SERVICE_TYPE = 'irbiscamp';

type TcpServer = ReturnType<typeof TcpSocket.createServer>;
type TcpConnection = InstanceType<typeof TcpSocket.Socket>;

type Conn = {
  id: string;
  socket: TcpConnection;
  lastSeen: number;
  seated: boolean;
};

export type HostServer = {
  /** Listens on :47821 and publishes the room over zeroconf. */
  start: () => Promise<void>;
  /** Host removes a player: `removed`, socket closed, seat freed. */
  remove: (seatId: string) => void;
  /** Host closes the room: `closed` to everyone, then everything stops. */
  close: () => void;
  /** Stops listening and drops every socket (unmount); the room stays as it was. */
  stop: () => void;
};

type Options = {
  room: RoomState;
  onChange: (room: RoomState) => void;
  now?: () => number;
};

/** The socket layer around `roomReducer`: feeds it events and carries out each outcome. */
export function createHostServer({
  room,
  onChange,
  now = Date.now,
}: Options): HostServer {
  let state = room;
  let server: TcpServer | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  const conns = new Map<string, Conn>();
  const zeroconf = new Zeroconf();
  const serviceName = `irbis-${room.code}`;

  const send = (conn: Conn, message: OutgoingHostMessage) => {
    conn.socket.write(encode(message));
  };

  const hangUp = (conn: Conn) => {
    conns.delete(conn.id);
    conn.socket.destroy();
  };

  const broadcastRoster = () => {
    const players = toRoster(state);
    conns.forEach(conn => {
      if (conn.seated) {
        send(conn, { type: 'roster', players });
      }
    });
  };

  const apply = (action: RoomAction): RoomOutcome => {
    const result = roomReducer(state, action);
    if (result.state !== state) {
      state = result.state;
      onChange(state);
      if (!state.closed) {
        broadcastRoster();
      }
    }
    return result.outcome;
  };

  const freed = (outcome: RoomOutcome, message: OutgoingHostMessage | null) => {
    if (outcome.kind !== 'freed' || !outcome.connId) {
      return;
    }
    const conn = conns.get(outcome.connId);
    if (conn) {
      if (message) {
        send(conn, message);
      }
      hangUp(conn);
    }
  };

  const drop = (conn: Conn) => {
    if (conns.get(conn.id) !== conn) {
      return;
    }
    conns.delete(conn.id);
    apply({ type: 'disconnect', connId: conn.id });
  };

  const onLine = (conn: Conn, line: string) => {
    const decoded = decodeClient(line);
    if (!decoded.ok) {
      if (decoded.reason === 'version') {
        send(conn, { type: 'rejected', reason: 'version' });
        hangUp(conn);
      }
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'ping':
        send(conn, { type: 'pong' });
        return;
      case 'leave':
        freed(apply({ type: 'leave', connId: conn.id }), null);
        return;
      case 'hello': {
        const outcome = apply({
          type: 'hello',
          connId: conn.id,
          hello: message,
          seatToken: uuidV4(),
        });
        if (outcome.kind === 'rejected') {
          send(conn, { type: 'rejected', reason: outcome.reason });
          hangUp(conn);
        } else if (outcome.kind === 'welcome') {
          const replaced = outcome.replacedConnId
            ? conns.get(outcome.replacedConnId)
            : undefined;
          if (replaced) {
            hangUp(replaced);
          }
          conn.seated = true;
          send(conn, {
            type: 'welcome',
            seatId: outcome.seatId,
            seatToken: outcome.seatToken,
            room: { code: state.code },
          });
          send(conn, { type: 'roster', players: toRoster(state) });
          qaLog('camp_player_joined', {
            seats: state.seats.length,
            rejoin: outcome.rejoin,
          });
        }
        return;
      }
    }
  };

  const onConnection = (socket: TcpConnection) => {
    const conn: Conn = { id: uuidV4(), socket, lastSeen: now(), seated: false };
    const split = createLineBuffer();
    conns.set(conn.id, conn);
    socket.setEncoding('utf8');
    socket.on('data', data => {
      conn.lastSeen = now();
      for (const line of split(data.toString())) {
        if (conns.get(conn.id) !== conn) {
          return;
        }
        onLine(conn, line);
      }
    });
    socket.on('close', () => drop(conn));
    socket.on('error', () => drop(conn));
  };

  const checkSilence = () => {
    const time = now();
    Array.from(conns.values()).forEach(conn => {
      if (time - conn.lastSeen > SILENCE_TIMEOUT_MS) {
        conn.socket.destroy();
        drop(conn);
      }
    });
  };

  const stop = () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    Array.from(conns.values()).forEach(hangUp);
    server?.close();
    server = null;
    zeroconf.unpublishService(serviceName);
  };

  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        const listening = TcpSocket.createServer(onConnection);
        server = listening;
        listening.once('error', reject);
        listening.listen({ port: CAMP_PORT, host: '0.0.0.0' }, () => {
          ticker = setInterval(checkSilence, PING_INTERVAL_MS);
          zeroconf.publishService(
            SERVICE_TYPE,
            'tcp',
            'local.',
            serviceName,
            CAMP_PORT,
            { code: state.code },
          );
          resolve();
        });
      }),
    remove: seatId => {
      const outcome = apply({ type: 'remove', seatId });
      if (outcome.kind === 'freed') {
        freed(outcome, { type: 'removed' });
        qaLog('camp_player_removed', { seats: state.seats.length });
      }
    },
    close: () => {
      apply({ type: 'close' });
      conns.forEach(conn => send(conn, { type: 'closed' }));
      stop();
    },
    stop,
  };
}
