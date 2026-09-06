/**
 * End-to-end test for Group Chat.
 * Run with backend on :5000 — node backend/scripts/test-group-chat.js
 *
 * Covers: creation (name/members), send/receive for all members, admin
 * permissions (add/remove/promote/demote), last-admin protections, member
 * removal live effects, leave group, non-member authorization, individual
 * chat isolation, per-user notification settings in groups, persistence.
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
  try { body = await res.json(); } catch {}
  return { status: res.status, data: body };
}

async function mkUser(n) {
  const email = `grp${n}${STAMP}@test.local`;
  const su = await api('post', '/auth/signup', {
    data: { name: `Group User ${n}`, email, password: 'Password123!' },
  });
  let token = su.data?.token;
  if (!token) {
    const li = await api('post', '/auth/login', { data: { email, password: 'Password123!' } });
    token = li.data?.token;
  }
  const me = await api('get', '/auth/me', { token });
  return { token, id: me.data?.user?._id, name: me.data?.user?.name };
}

async function main() {
  // === Setup: 4 users, all friends with admin ===
  const A = await mkUser('A'); // admin
  const B = await mkUser('B');
  const C = await mkUser('C');
  const D = await mkUser('D'); // outsider
  check('Setup: 4 users created', !!(A.id && B.id && C.id && D.id));
  if (!A.id) return finish();

  for (const u of [B, C, D]) {
    await api('post', `/users/friend-request/${A.id}`, { token: u.token });
    await api('put', `/users/friend-request/${u.id}/accept`, { token: A.token });
  }

  // === 1. Create group (A admin, B & C members) ===
  let r = await api('post', '/chats/group', {
    token: A.token,
    data: { name: `Test Squad ${STAMP}`, participants: [B.id, C.id], description: 'E2E test group' },
  });
  const g = r.data?.chat;
  const groupId = g?._id;
  check('1. Group created with 3 members', r.status === 201 && g?.isGroup === true && g?.participants?.length === 3);
  check('1b. Creator is admin', (g?.groupAdmin || []).some((a) => (a._id || a) === A.id));

  // === 2. Security: non-member cannot read or write ===
  r = await api('get', `/chats/${groupId}`, { token: D.token });
  check('2. Non-member cannot open group (403)', r.status === 403);
  r = await api('post', '/messages', { token: D.token, data: { chatId: groupId, content: 'intrude' } });
  check('2b. Non-member cannot post (403)', r.status === 403);

  // === 3. Member messaging ===
  r = await api('post', '/messages', { token: A.token, data: { chatId: groupId, content: 'hello group' } });
  check('3. Admin sends message', r.status === 201);
  r = await api('post', '/messages', { token: B.token, data: { chatId: groupId, content: 'hi from B' } });
  check('3b. Member B sends message', r.status === 201);
  r = await api('get', `/messages/${groupId}`, { token: C.token });
  const contents = (r.data?.messages || []).map((m) => m.content);
  check('3c. Member C sees all messages', contents.includes('hello group') && contents.includes('hi from B'));

  // === 4. Member permissions ===
  r = await api('put', `/chats/group/${groupId}/add`, { token: B.token, data: { userId: D.id } });
  check('4. Member cannot add (403)', r.status === 403);
  r = await api('put', `/chats/group/${groupId}/remove`, { token: B.token, data: { userId: C.id } });
  check('4b. Member cannot remove (403)', r.status === 403);
  r = await api('put', `/chats/group/${groupId}/promote`, { token: B.token, data: { userId: B.id } });
  check('4c. Member cannot promote (403)', r.status === 403);
  r = await api('put', `/chats/group/${groupId}/update`, { token: B.token, data: { name: 'Hacked' } });
  check('4d. Member cannot rename (403)', r.status === 403);

  // === 5. Admin actions ===
  r = await api('put', `/chats/group/${groupId}/add`, { token: A.token, data: { userId: D.id } });
  check('5. Admin adds D', r.status === 200 && (r.data?.chat?.participants || []).length === 4);
  r = await api('put', `/chats/group/${groupId}/promote`, { token: A.token, data: { userId: B.id } });
  check('5b. Admin promotes B', r.status === 200 && (r.data?.chat?.groupAdmin || []).some((a) => (a._id || a) === B.id));
  r = await api('put', `/chats/group/${groupId}/update`, { token: A.token, data: { name: 'Renamed Squad' } });
  check('5c. Admin renames group', r.status === 200 && r.data?.chat?.groupName === 'Renamed Squad');
  r = await api('put', `/chats/group/${groupId}/demote`, { token: A.token, data: { userId: B.id } });
  check('5d. Admin demotes B', r.status === 200 && !(r.data?.chat?.groupAdmin || []).some((a) => (a._id || a) === B.id));

  // Demote protections
  r = await api('put', `/chats/group/${groupId}/demote`, { token: A.token, data: { userId: A.id } });
  check('5e. Cannot demote last admin (400)', r.status === 400);

  // Remove protections
  r = await api('put', `/chats/group/${groupId}/remove`, { token: A.token, data: { userId: A.id } });
  check('5f. Admin cannot remove self (400)', r.status === 400);
  r = await api('put', `/chats/group/${groupId}/remove`, { token: A.token, data: { userId: '000000000000000000000000' } });
  check('5g. Removing non-member rejected (400)', r.status === 400);

  // === 6. Removed member loses access ===
  r = await api('put', `/chats/group/${groupId}/remove`, { token: A.token, data: { userId: D.id } });
  check('6. Admin removes D', r.status === 200 && (r.data?.chat?.participants || []).length === 3);
  r = await api('get', `/messages/${groupId}`, { token: D.token });
  check('6b. Removed member cannot read (403)', r.status === 403);
  r = await api('get', '/chats', { token: D.token });
  check('6c. Removed group gone from D\u2019s list', !(r.data?.chats || []).some((c) => c._id === groupId));

  // === 7. Group notifications respect per-user settings ===
  r = await api('put', `/chats/${groupId}/notification-settings`, {
    token: C.token, data: { mode: 'muted', muteUntil: null },
  });
  check('7. Member C mutes the group', r.status === 200 && r.data.notification?.mode === 'muted');
  r = await api('post', '/messages', { token: A.token, data: { chatId: groupId, content: 'while C muted' } });
  check('7b. Message still delivered to muted member', r.status === 201);
  r = await api('get', `/messages/${groupId}`, { token: C.token });
  check('7c. Muted member still receives messages', (r.data?.messages || []).some((m) => m.content === 'while C muted'));
  r = await api('get', `/chats/${groupId}/notification-settings`, { token: B.token });
  check('7d. B\u2019s settings unaffected by C\u2019s mute', r.data.notification?.mode === 'all');

  // === 8. Persistence (refresh/relogin equivalent) ===
  r = await api('get', '/chats', { token: B.token });
  const gB = (r.data?.chats || []).find((c) => c._id === groupId);
  check('8. Group persists in member list with settings', !!gB && gB.isGroup === true);

  // === 9. Leave group (member) ===
  r = await api('put', `/chats/group/${groupId}/leave`, { token: C.token });
  check('9. Member leaves group', r.status === 200);
  r = await api('get', `/messages/${groupId}`, { token: C.token });
  check('9b. Left member loses access (403)', r.status === 403);

  // === 10. Last admin handover on leave ===
  r = await api('put', `/chats/group/${groupId}/leave`, { token: A.token });
  check('10. Admin leaves', r.status === 200);
  r = await api('get', `/chats/${groupId}`, { token: B.token });
  const adminsAfter = r.data?.chat?.groupAdmin || [];
  check(
    '10b. Remaining member auto-promoted to admin',
    r.status === 200 && adminsAfter.some((a) => (a._id || a) === B.id) && adminsAfter.length >= 1
  );

  // === 11. Individual chat isolation ===
  r = await api('post', '/chats', { token: A.token, data: { userId: B.id } });
  const dmId = r.data?.chat?._id;
  check('11. Individual chat still works', r.status === 201 && r.data?.chat?.isGroup === false);
  r = await api('post', '/messages', { token: A.token, data: { chatId: dmId, content: 'dm still fine' } });
  check('11b. Individual message still works', r.status === 201);

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
