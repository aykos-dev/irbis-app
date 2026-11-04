import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getGroupChatListQueryKey } from '../../../shared/api/generated/group-chat/group-chat';
import { appConfig } from '../../../shared/constants/config';
import { tokenManager } from '../../../shared/api/tokenManager';

type SocketEnvelope = { event: string; data?: unknown };

function envelope(value: unknown): SocketEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.event === 'string' ? { event: record.event, data: record.data } : null;
}

/** Authenticated native WebSocket: live messages, reactions, receipts, typing and presence. */
export function useGroupChatSocket(groupId: string) {
  const client = useQueryClient();
  const socket = useRef<ReturnType<typeof openSocket> | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      const url = `${appConfig.apiUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/v1/groups/chat`;
      const ws = openSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        void tokenManager.getAccessToken().then(token => {
          if (active && token && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'auth', data: { token, groupId } }));
          }
        });
      };
      ws.onmessage = message => {
        try {
          const parsed = envelope(JSON.parse(String(message.data)) as unknown);
          if (!parsed) return;
          if (parsed.event === 'presence' && parsed.data && typeof parsed.data === 'object') {
            const count = (parsed.data as Record<string, unknown>).onlineCount;
            if (typeof count === 'number') setOnlineCount(count);
          } else if (parsed.event === 'typing' && parsed.data && typeof parsed.data === 'object') {
            const data = parsed.data as Record<string, unknown>;
            if (typeof data.userId === 'string' && typeof data.typing === 'boolean') {
              setTypingUserIds(current => data.typing
                ? [...new Set([...current, data.userId as string])]
                : current.filter(id => id !== data.userId));
            }
          } else if (parsed.event.startsWith('message.') || parsed.event === 'reaction.changed' || parsed.event === 'read.changed') {
            void client.invalidateQueries({ queryKey: getGroupChatListQueryKey(groupId) });
          }
        } catch {
          // Ignore malformed frames; the authenticated REST state remains authoritative.
        }
      };
      ws.onclose = () => {
        if (active) retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, [client, groupId]);

  const setTyping = useCallback((typing: boolean) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'typing', data: { groupId, typing } }));
    }
  }, [groupId]);

  return { onlineCount, typingUserIds, setTyping };
}

function openSocket(url: string) {
  return new WebSocket(url);
}
