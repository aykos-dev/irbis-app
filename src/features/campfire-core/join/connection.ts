import TcpSocket from 'react-native-tcp-socket';

type Connection = ReturnType<typeof TcpSocket.createConnection>;
type ConnectOptions = Parameters<typeof TcpSocket.createConnection>[0];

export type CampConnection = {
  socket: Connection;
  /** Destroys the socket once the native connect attempt has settled (never while it waits in the queue). */
  close: () => void;
};

/**
 * A TCP connection whose close waits for the native connect attempt.
 *
 * `react-native-tcp-socket` queues connect tasks on two executor threads; destroying an id before its
 * connect task has run throws `No socket with id N` on that thread and kills the app (CORE-2). When the
 * connect has not finished yet, the destroy is deferred to its callback.
 */
export function connectCamp(
  options: ConnectOptions,
  onConnect: (socket: Connection) => void,
): CampConnection {
  let settled = false;
  let closePending = false;
  let created: Connection | null = null;
  const settle = () => {
    settled = true;
    if (closePending && created && !created.destroyed) {
      created.destroy();
    }
  };
  created = TcpSocket.createConnection(options, () => {
    settle();
    if (closePending || !created) {
      return;
    }
    onConnect(created);
  });
  created.once('error', settle);
  created.once('close', settle);
  const socket = created;

  return {
    socket,
    close: () => {
      if (!settled) {
        closePending = true;
        return;
      }
      if (!socket.destroyed) {
        socket.destroy();
      }
    },
  };
}
