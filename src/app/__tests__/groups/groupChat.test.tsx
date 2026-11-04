import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { navigationRef } from '../../navigation/navigationRef';
import {
  meBody,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';

class FakeWebSocket {
  static readonly OPEN = 1;
  readonly readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(_url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
  send(_value: string): void {}
  close(): void {}
}

let http: HttpStub;
const groupId = '00000000-0000-4000-8000-000000000041';
const member = meBody({ displayName: 'Guest One', level: 2 });
const group = {
  id: groupId,
  slug: 'chat-hikers',
  name: 'Chat Hikers',
  description: 'Weekend chat',
  visibility: 'public',
  avatarUrl: null,
  color: '#0C807A',
  memberCount: 2,
  unreadCount: 1,
  viewerMembership: { role: 'member', status: 'active', joinedAt: '2026-11-04T10:00:00.000Z', notificationsMuted: false },
  members: [],
  pendingRequests: [],
};
const first = {
  id: '00000000-0000-4000-8000-000000000051',
  groupId,
  kind: 'text',
  author: { id: '00000000-0000-4000-8000-000000000099', username: 'leader', displayName: 'Leader', avatarUrl: null, level: 5, verifiedLeader: true },
  body: 'Meet at 05:30',
  replyTo: null,
  attachments: [],
  reactions: [],
  mentionedUserIds: [],
  readByCount: 0,
  trip: null,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-11-04T10:00:00.000Z',
};

beforeEach(async () => {
  http = await setUpApp();
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeWebSocket });
  await startSignedIn();
  http.reply('/v1/me', { status: 200, body: member });
  http.reply(`/v1/groups/${groupId}`, { status: 200, body: group });
  http.handle(`/v1/groups/${groupId}/messages`, config =>
    config.method === 'post'
      ? {
          status: 201,
          body: {
            ...first,
            id: '00000000-0000-4000-8000-000000000052',
            author: {
              ...first.author,
              id: member.id,
              username: member.username,
              displayName: 'Guest One',
              level: 2,
              verifiedLeader: false,
            },
            body: 'I am in!',
          },
        }
      : { status: 200, body: { items: [first], nextCursor: null } },
  );
  http.reply(`/v1/groups/${groupId}/messages/read`, { status: 201, body: { status: 'read' } });
});
afterEach(async () => {
  await tearDownApp(http);
});

it('renders the leader shield, replies and sends a message', async () => {
  await renderApp();
  navigationRef.navigate('GroupChat', { id: groupId });
  expect(await screen.findByTestId(`group-chat.message-${first.id}`)).toHaveTextContent(/Leader.*🛡.*Meet at 05:30/);
  await fireEvent.press(screen.getByTestId(`group-chat.reply-${first.id}`));
  expect(screen.getByText(/Replying to @leader/)).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId('group-chat.input'), 'I am in!');
  await fireEvent.press(screen.getByTestId('group-chat.send'));
  await waitFor(() =>
    expect(
      http
        .callsTo(`/v1/groups/${groupId}/messages`)
        .filter(call => call.method === 'post'),
    ).toHaveLength(1),
  );
});
