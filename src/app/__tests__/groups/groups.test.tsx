import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  openTab,
  renderApp,
  sessionBody,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';

let http: HttpStub;
const publicGroup = {
  id: '00000000-0000-4000-8000-000000000041',
  slug: 'first-trails-beginners',
  name: 'First Trails — beginners',
  description: 'A welcoming group for first hikes.',
  visibility: 'public',
  avatarUrl: null,
  color: '#58B368',
  memberCount: 12,
  viewerMembership: null,
};

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

it('shows public groups to a guest and silently creates a demo account when joining', async () => {
  http.reply('/v1/groups',
    { status: 200, body: { yours: [], invitations: [], discover: [publicGroup] } },
    { status: 200, body: { yours: [{ ...publicGroup, memberCount: 13, viewerMembership: { role: 'member', status: 'active', joinedAt: '2026-11-04T10:00:00.000Z' } }], invitations: [], discover: [] } },
  );
  http.reply('/v1/auth/demo', { status: 201, body: sessionBody({ isDemo: true }) });
  http.reply(`/v1/groups/${publicGroup.id}/join`, { status: 201, body: { status: 'joined' } });

  await renderApp();
  await openTab('community');
  await fireEvent.press(screen.getByTestId('community.segment.groups'));
  expect(await screen.findByTestId(`groups.group-${publicGroup.id}`)).toHaveTextContent(/First Trails/);

  await fireEvent.press(screen.getByTestId(`groups.join-${publicGroup.id}`));
  await waitFor(() => expect(http.callsTo('/v1/auth/demo')).toHaveLength(1));
  await waitFor(() => expect(http.callsTo(`/v1/groups/${publicGroup.id}/join`)).toHaveLength(1));
  expect(await screen.findByTestId('app.toast')).toHaveTextContent('Joined');
});

