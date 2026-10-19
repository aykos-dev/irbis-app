import { useCallback, useEffect, useRef, useState } from 'react';
import DeviceInfo from 'react-native-device-info';

import { qaLog } from '../../../shared/utils/qaLog';
import type { GameSettings, GameState } from '../games/gameReducer';
import type { PartyGame } from '../games/packs';
import { campNet } from '../native/campNet';
import { hostsWithGuide } from '../native/hostPlatform';
import { initialProfile, readProfile } from '../playerProfile';
import { CAMP_PORT, type RosterPlayer } from '../protocol/codec';
import { buildJoinUrl } from '../protocol/qr';
import { createHostServer, type HostServer } from './hostServer';
import {
  clearHostRoom,
  loadHostGame,
  loadHostRoom,
  saveHostRoom,
} from './hostRoomStore';
import {
  createRoom,
  resumeRoom,
  toRoster,
  type RoomState,
} from './roomReducer';

export type HostNetwork =
  | { mode: 'hotspot'; ip: string; ssid: string; password: string }
  | { mode: 'wifi'; ip: string; name: string }
  /** iPhone host: Personal Hotspot (`hotspot`) or Wi-Fi the user turned on; QR has no Wi-Fi. */
  | { mode: 'ios'; ip: string; hotspot: boolean; name: string };

export type HostRoom =
  | { phase: 'starting' }
  | { phase: 'error'; permissionDenied: boolean }
  | {
      phase: 'ready';
      network: HostNetwork;
      room: RoomState;
      joinUrl: string;
      game: GameState | null;
    };

/**
 * The host's running game for the game screen, which sits on top of the lobby that owns the room
 * (`useSyncExternalStore`). `end` sends everyone back to the lobby.
 */
let hostGameState: GameState | null = null;
let hostGameRoster: RosterPlayer[] = [];
let hostGameServer: HostServer | null = null;
const hostGameListeners = new Set<() => void>();

function publishHostGame(
  game: GameState | null,
  room: RoomState | null,
  server: HostServer | null,
) {
  hostGameState = game;
  hostGameRoster = room ? toRoster(room) : [];
  hostGameServer = server;
  hostGameListeners.forEach(listener => listener());
}

export const hostGame = {
  getSnapshot: (): GameState | null => hostGameState,
  /** Names for the game screen (same `subscribe`). */
  getRoster: (): RosterPlayer[] => hostGameRoster,
  subscribe: (listener: () => void) => {
    hostGameListeners.add(listener);
    return () => {
      hostGameListeners.delete(listener);
    };
  },
  end: (): void => hostGameServer?.endGame(),
  reveal: (): void => hostGameServer?.reveal(),
  newRound: (): void => hostGameServer?.newRound(),
};

/** Random 4-digit room code, 1000–9999. */
function randomCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

type Opened =
  { network: HostNetwork } | { network: null; permissionDenied: boolean };

/** iPhone (AC4): Personal Hotspot, else Wi-Fi; the guide already asked the user to turn it on. */
async function openIosNetwork(): Promise<Opened> {
  const address = await campNet.getIosHostAddress();
  if (!address) {
    return { network: null, permissionDenied: false };
  }
  const name = address.hotspot
    ? await DeviceInfo.getDeviceName()
    : (await campNet.getWifiName()) ?? address.ip;
  return {
    network: { mode: 'ios', ip: address.ip, hotspot: address.hotspot, name },
  };
}

/** Hotspot first (AC4); denied or failed → the Wi-Fi the phone is on; neither → null. */
async function openNetwork(): Promise<Opened> {
  if (hostsWithGuide()) {
    return openIosNetwork();
  }
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

function hostedMode(network: HostNetwork): 'hotspot' | 'wifi' {
  if (network.mode === 'ios') {
    return network.hotspot ? 'hotspot' : 'wifi';
  }
  return network.mode;
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
      const savedGame = saved ? loadHostGame() : null;
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
        network: network.mode === 'hotspot' ? network.ssid : network.name,
        game: savedGame,
        onChange: (next, game) => {
          if (live.current) {
            live.current.room = next;
          }
          if (!next.closed) {
            saveHostRoom(next, Date.now(), game);
          }
          publishHostGame(game, next, server);
          setState({
            phase: 'ready',
            network,
            room: next,
            joinUrl: url,
            game,
          });
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
      saveHostRoom(room, Date.now(), savedGame);
      publishHostGame(savedGame, room, server);
      setState({
        phase: 'ready',
        network,
        room,
        joinUrl: url,
        game: savedGame,
      });
      if (saved) {
        qaLog('camp_room_resumed', { seats: room.seats.length });
      } else {
        qaLog('camp_room_hosted', { mode: hostedMode(network) });
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
      publishHostGame(null, null, null);
    };
  }, [resume, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);

  const remove = useCallback((seatId: string) => {
    live.current?.server.remove(seatId);
  }, []);

  const startGame = useCallback((game: PartyGame, settings: GameSettings) => {
    live.current?.server.startGame(game, settings);
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

  return { state, retry, remove, close, startGame };
}
