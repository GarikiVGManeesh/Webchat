/**
 * End-to-end test for Custom Notifications Per Chat.
 * Run with backend on :5000 — node backend/scripts/test-notification-settings.js
 *
 * Covers: default 'all', set 'mentions'/'muted', timed mute, invalid input,
 * per-user privacy (B never sees A's settings), participant authz,
 * message delivery unaffected by muting, persistence across re-fetch.
 */

const BASE = 'http://localhost:5000/api';
const STAMP = Date.now();

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};

async function api(method, url, { token, data } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, data: body };
}

async function main() {
  // === Setup: two users, friendship, chat, message ===
  const mk = async (n, email) => {
    const su = await api('post', '/auth/signup', {
      data: { name: n, email, password: 'Password123!' },
    });
    let token = su.data?.token;
    if (!token) {
      const li = await api('post', '/auth/login', { data: { email, password: 'Password123!' } });
      token = li.data?.token;
    }
    const me = await api('get', '/auth/me', { token });
    return { token, id: me.data?.user?._id, username: me.data?.user?.username };
  };

  const A = await mk(`NotifA ${STAMP}`, `notifA${STAMP}@test.local`);
  const B = await mk(`NotifB ${STAMP}`, `notifB${STAMP}@test.local`);
  check('Setup: users created', !!A.token && !!B.token);
  if (!A.token || !B.token) return finish();

  await api('post', `/users/friend-request/${A.id}`, { token: B.token });
  await api('put', `/users/friend-request/${B.id}/accept`, { token: A.token });

  const chatRes = await api('post', '/chats', { token: A.token, data: { userId: B.id } });
  const chatId = chatRes.data?.chat?._id;
  check('Setup: chat created', !!chatId);
  if (!chatId) return finish();

  const msg = await api('post', '/messages', {
    token: A.token,
    data: { chatId, content: `hello there ${STAMP}` },
  });
  check('Setup: message sent', msg.status === 201);

  // === 1. Default settings ===
  let r = await api('get', `/chats/${chatId}/notification-settings`, { token: A.token });
  check('1. Default mode is "all"', r.status === 200 && r.data.notification?.mode === 'all');

  // === 2. Set mentions-only for A ===
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'mentions' },
  });
  check('2. Set "mentions" succeeds', r.status === 200 && r.data.notification?.mode === 'mentions');
  r = await api('get', `/chats/${chatId}/notification-settings`, { token: A.token });
  check('2b. "mentions" persists (refresh-equivalent)', r.data.notification?.mode === 'mentions');

  // === 3. Set timed mute (1 hour) ===
  const oneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'muted', muteUntil: oneHour },
  });
  check(
    '3. Timed mute (1h) succeeds with muteUntil echoed',
    r.status === 200 && r.data.notification?.mode === 'muted' && !!r.data.notification?.muteUntil
  );

  // === 4. Switch to indefinite mute ===
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'muted', muteUntil: null },
  });
  check(
    '4. Indefinite mute: muteUntil cleared',
    r.status === 200 && r.data.notification?.mode === 'muted' && r.data.notification?.muteUntil === null
  );

  // === 5. Back to all ===
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'all' },
  });
  check('5. Back to "all"', r.status === 200 && r.data.notification?.mode === 'all');
  r = await api('get', `/chats/${chatId}/notification-settings`, { token: A.token });
  check('5b. "all" persists', r.data.notification?.mode === 'all' && r.data.notification?.isMuted === false);

  // === 6. Mute does NOT block message delivery ===
  await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'muted', muteUntil: oneHour },
  });
  r = await api('post', '/messages', { token: B.token, data: { chatId, content: 'while muted' } });
  check('6. Messages still delivered while muted', r.status === 201);
  const page = await api('get', `/messages/${chatId}`, { token: A.token });
  check(
    '6b. Muted chat still shows messages',
    (page.data?.messages || []).some((m) => m.content === 'while muted')
  );

  // === 7. Validation ===
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'sometimes' },
  });
  check('7. Invalid mode rejected (400)', r.status === 400);
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'muted', muteUntil: 'not-a-date' },
  });
  check('7b. Invalid muteUntil rejected (400)', r.status === 400);
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: A.token,
    data: { mode: 'muted', muteUntil: new Date(Date.now() - 1000).toISOString() },
  });
  check('7c. Past muteUntil rejected (400)', r.status === 400);

  // === 8. Privacy & authz ===
  const outsider = await mk(`NotifOut ${STAMP}`, `notifO${STAMP}@test.local`);
  r = await api('get', `/chats/${chatId}/notification-settings`, { token: outsider.token });
  check('8. Non-participant GET rejected (403)', r.status === 403);
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: outsider.token,
    data: { mode: 'muted' },
  });
  check('8b. Non-participant PUT rejected (403)', r.status === 403);
  r = await api('get', `/chats/${chatId}/notification-settings`, {});
  check('8c. Unauthenticated rejected (401)', r.status === 401);

  // B's settings are independent — B mutes for themselves only.
  r = await api('put', `/chats/${chatId}/notification-settings`, {
    token: B.token,
    data: { mode: 'muted', muteUntil: null },
  });
  check('8d. B can mute for themselves', r.status === 200 && r.data.notification?.mode === 'muted');
  r = await api('get', `/chats/${chatId}/notification-settings`, { token: A.token });
  check(
    '8e. A\u2019s settings unaffected by B\u2019s change (still muted 1h for A)',
    r.data.notification?.mode === 'muted' && !!r.data.notification?.muteUntil
  );

  // Chat list payload must never leak the OTHER user's settings rows.
  const listA = await api('get', '/chats', { token: A.token });
  const chatA = (listA.data?.chats || []).find((c) => c._id === chatId);
  const rowsA = chatA?.notificationSettings || [];
  check(
    '8f. Chat list exposes only the viewer\u2019s settings row',
    rowsA.length <= 1 && rowsA.every((s) => (s.user?._id || s.user) === A.id),
    `rows=${rowsA.length}`
  );
  const listB = await api('get', '/chats', { token: B.token });
  const chatB = (listB.data?.chats || []).find((c) => c._id === chatId);
  const rowsB = chatB?.notificationSettings || [];
  check(
    '8g. B sees only B\u2019s row',
    rowsB.length <= 1 && rowsB.every((s) => (s.user?._id || s.user) === B.id),
    `rows=${rowsB.length}`
  );

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n==============================');
  console.log(`RESULT: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((r) => console.log(`  - ${r.name}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Test crashed:', e.message);
  process.exit(1);
});
