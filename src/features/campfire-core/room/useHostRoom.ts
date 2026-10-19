import { useCallback, useEffect, useRef, useState } from 'react';

import { qaLog } from '../../../shared/utils/qaLog';
import { campNet } from '../native/campNet';
import { initialProfile, readProfile } from '../playerProfile';
import { CAMP_PORT } from '../protocol/codec';
import { buildJoinUrl } from '../protocol/qr';
import { createHostServer, type HostServer } from './hostServer';
import { clearHostRoom, loadHostRoom, saveHostRoom } from './hostRoomStore';
import { createRoom, resumeRoom, type RoomState } from './roomReducer';

export type HostNetwork =
  | { mode: 'hotspot'; ip: string; ssid: string; password: string }
  | { mode: 'wifi'; ip: string; name: string };

export type HostRoom =
  | { phase: 'starting' }
  | { phase: 'error'; permissionDenied: boolean }
  | { phase: 'ready'; network: HostNetwork; room: RoomState; joinUrl: string };

/** Random 4-digit room code, 1000–9999. */
function randomCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

type Opened =
  { network: HostNetwork } | { network: null; permissionDenied: boolean };

/** Hotspot first (AC4); denied or failed → the Wi-Fi the phone is on; neither → null. */
async function openNetwork(): Promise<Opened> {
  let granted = false;
  try {
    granted = await campNet.requestHotspotPermission();
    if (granted) {
      const hotspot = await campNet.startHotspot();
      return { network: { mode: 'hotspot', ...hotspot } };
    }
  } catch (error) {
    qaLog('camp_hotspot_failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
  }
  const ip = await campNet.getWifiIp();
  if (!ip) {
    return { network: null, permissionDenied: !granted };
  }
  return {
    network: { mode: 'wifi', ip, name: (await campNet.getWifiName()) ?? ip },
  };
}

function stopNetwork(network: HostNetwork): void {
  if (network.mode !== 'hotspot') {
    return;
  }
  campNet.stopHotspot().catch((error: unknown) => {
    qaLog('camp_hotspot_stop_failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
  });
}

function joinUrl(network: HostNetwork, code: string): string {
  return buildJoinUrl({
    code,
    ip: network.ip,
    port: CAMP_PORT,
    ...(network.mode === 'hotspot'
      ? { wifi: { ssid: network.ssid, password: network.password } }
      : {}),
  });
}

/**
 * Runs the hosted room for the lobby: network, room server, saved state (AC4, AC6, AC7).
 * Unmount stops the server and hotspot but keeps the saved room; `close` ends it for everyone.
 */
export function useHostRoom(resume: boolean) {
  const [state, setState] = useState<HostRoom>({ phase: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const live = useRef<{
    server: HostServer;
    network: HostNetwork;
    room: RoomState;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'starting' });

    const run = async () => {
      const opened = await openNetwork();
      if (cancelled) {
        if (opened.network) {
          stopNetwork(opened.network);
        }
        return;
      }
      if (!opened.network) {
        setState({ phase: 'error', permissionDenied: opened.permissionDenied });
        return;
      }
      const network = opened.network;
      const saved = resume ? loadHostRoom() : null;
      const profile = readProfile() ?? initialProfile(null, undefined);
      const room = saved
        ? resumeRoom(saved)
        : createRoom(randomCode(), {
            nickname: profile.nickname,
            avatar: profile.animal,
          });
      const url = joinUrl(network, room.code);
      const server = createHostServer({
        room,
        onChange: next => {
          if (live.current) {
            live.current.room = next;
          }
          if (!next.closed) {
            saveHostRoom(next);
          }
          setState({ phase: 'ready', network, room: next, joinUrl: url });
        },
      });
      try {
        await server.start();
      } catch (error) {
        server.stop();
        stopNetwork(network);
        qaLog('camp_server_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        if (!cancelled) {
          setState({ phase: 'error', permissionDenied: false });
        }
        return;
      }
      if (cancelled) {
        server.stop();
        stopNetwork(network);
        return;
      }
      live.current = { server, network, room };
      saveHostRoom(room);
      setState({ phase: 'ready', network, room, joinUrl: url });
      if (saved) {
        qaLog('camp_room_resumed', { seats: room.seats.length });
      } else {
        qaLog('camp_room_hosted', { mode: network.mode });
      }
    };

    run().catch((error: unknown) => {
      qaLog('camp_host_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      if (!cancelled) {
        setState({ phase: 'error', permissionDenied: false });
      }
    });

    return () => {
      cancelled = true;
      const current = live.current;
      live.current = null;
      if (current) {
        current.server.stop();
        stopNetwork(current.network);
      }
    };
  }, [resume, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);

  const remove = useCallback((seatId: string) => {
    live.current?.server.remove(seatId);
  }, []);

  /** Broadcasts `closed`, stops server, hotspot and zeroconf, forgets the saved room. */
  const close = useCallback(() => {
    const current = live.current;
    live.current = null;
    if (!current) {
      return;
    }
    current.server.close();
    stopNetwork(current.network);
    clearHostRoom();
    qaLog('camp_room_closed', { seats: current.room.seats.length });
  }, []);

  return { state, retry, remove, close };
}
