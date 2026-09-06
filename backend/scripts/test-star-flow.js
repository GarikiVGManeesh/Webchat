/**
 * End-to-end test for the Starred Messages feature.
 *
 * Run with the backend server already running on port 5000:
 *   node backend/scripts/test-star-flow.js
 *
 * Covers:
 *  1. Star a message (no MongoDB updatedAt conflict)
 *  2. Duplicate star stays idempotent
 *  3. Star persists (GET /messages/starred, refresh-equivalent)
 *  4. Unstar removes the star, original message intact
 *  5. Per-user isolation (user B's star doesn't leak to user A)
 *  6. Deleted message handling (per-user delete keeps others' stars;
 *     hard delete leaves no dangling references)
 *  7. Non-participant cannot star another conversation's message
 *  8. Unauthenticated star attempt rejected
 *  9. Clear Chat hard delete cleans up starred references
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
  } catch {
    // non-JSON response (e.g. empty body)
  }
  return { status: res.status, data: body };
}

async function main() {
  // === Setup: two fresh users, one chat, two messages ===
  const suA = await api('post', '/auth/signup', {
    data: {
      name: `Star Tester A ${STAMP}`,
      email: `starA${STAMP}@test.local`,
      password: 'Password123!',
      username: `startesta${STAMP}`,
    },
  });
  const suB = await api('post', '/auth/signup', {
    data: {
      name: `Star Tester B ${STAMP}`,
      email: `starB${STAMP}@test.local`,
      password: 'Password123!',
      username: `startestb${STAMP}`,
    },
  });

  let tokenA = suA.data?.token;
  let tokenB = suB.data?.token;

  // Some setups require email verification before login — fall back to login.
  if (!tokenA) {
    const li = await api('post', '/auth/login', {
      data: { email: `starA${STAMP}@test.local`, password: 'Password123!' },
    });
    tokenA = li.data?.token;
  }
  if (!tokenB) {
    const li = await api('post', '/auth/login', {
      data: { email: `starB${STAMP}@test.local`, password: 'Password123!' },
    });
    tokenB = li.data?.token;
  }

  check('Setup: users created & logged in', !!tokenA && !!tokenB);
  if (!tokenA || !tokenB) return finish();

  const meA = await api('get', '/auth/me', { token: tokenA });
  const meB = await api('get', '/auth/me', { token: tokenB });
  const idA = meA.data?.user?._id;
  const idB = meB.data?.user?._id;

  // B sends a friend request, A accepts (the app's contact model)
  await api('post', `/users/friend-request/${idA}`, { token: tokenB });
  await api('get', '/users/requests', { token: tokenA });
  await api('put', `/users/friend-request/${idB}/accept`, { token: tokenA });

  const chatRes = await api('post', '/chats', { token: tokenA, data: { userId: idB } });
  const chatId = chatRes.data?.chat?._id;
  check('Setup: chat created', !!chatId, `chatId=${chatId || 'none'}`);
  if (!chatId) return finish();

  const m1 = await api('post', '/messages', {
    token: tokenA,
    data: { chatId, content: `Star me once ${STAMP}` },
  });
  const m2 = await api('post', '/messages', {
    token: tokenB,
    data: { chatId, content: `Star me twice ${STAMP}` },
  });
  const msgId1 = m1.data?.message?._id;
  const msgId2 = m2.data?.message?._id;
  check('Setup: two messages sent', !!msgId1 && !!msgId2);

  // === 1. Star works without the updatedAt conflict ===
  const s1 = await api('put', `/messages/${msgId1}/star`, { token: tokenA });
  check(
    '1. Star message succeeds (no updatedAt conflict)',
    s1.status === 200 && s1.data?.success === true,
    `status=${s1.status} ${s1.data?.message || ''}`
  );

  // === 2. Duplicate star is idempotent ===
  const s2 = await api('put', `/messages/${msgId1}/star`, { token: tokenA });
  check(
    '2. Re-star same message is idempotent (still 200)',
    s2.status === 200 && s2.data?.success === true,
    `status=${s2.status} ${s2.data?.message || ''}`
  );

  // === 3. Star persists ===
  const list1 = await api('get', '/messages/starred', { token: tokenA });
  const found1 = (list1.data?.starredMessages || []).some(
    (i) => i.message?._id === msgId1
  );
  check('3. Starred message appears in starred list', found1, `count=${list1.data?.count}`);

  // Also verify the per-message flag used by the chat UI
  const page = await api('get', `/messages/${chatId}`, { token: tokenA });
  const flagged = (page.data?.messages || []).some(
    (m) => m._id === msgId1 && m.starred === true
  );
  check('3b. Message carries starred=true in chat fetch', flagged);

  // === 4. Unstar removes the star; message untouched ===
  const u1 = await api('delete', `/messages/${msgId1}/star`, { token: tokenA });
  check('4. Unstar succeeds', u1.status === 200 && u1.data?.starred === false);

  const list2 = await api('get', '/messages/starred', { token: tokenA });
  const gone = !(list2.data?.starredMessages || []).some(
    (i) => i.message?._id === msgId1
  );
  check('4b. Starred list empty again after unstar', gone, `count=${list2.data?.count}`);

  const stillThere = await api('get', `/messages/${chatId}`, { token: tokenA });
  const originalIntact = (stillThere.data?.messages || []).some(
    (m) => m._id === msgId1
  );
  check('4c. Original message NOT deleted by unstar', originalIntact);

  // === 5. Per-user isolation ===
  const sb = await api('put', `/messages/${msgId2}/star`, { token: tokenB });
  check('5. User B can star own message', sb.status === 200);

  const listB = await api('get', '/messages/starred', { token: tokenB });
  const bHasOwn = (listB.data?.starredMessages || []).some(
    (i) => i.message?._id === msgId2
  );
  const listA = await api('get', '/messages/starred', { token: tokenA });
  const aDoesNotSeeB = !(listA.data?.starredMessages || []).some(
    (i) => i.message?._id === msgId2
  );
  check('5b. User B sees own star', bHasOwn);
  check('5c. User A does NOT see User B\u2019s star', aDoesNotSeeB, `A count=${listA.data?.count}, B count=${listB.data?.count}`);

  // === 7. Non-participant cannot star (before any deletions) ===
  const suC = await api('post', '/auth/signup', {
    data: {
      name: `Star Outsider ${STAMP}`,
      email: `starC${STAMP}@test.local`,
      password: 'Password123!',
      username: `startestc${STAMP}`,
    },
  });
  let tokenC = suC.data?.token;
  if (!tokenC) {
    const li = await api('post', '/auth/login', {
      data: { email: `starC${STAMP}@test.local`, password: 'Password123!' },
    });
    tokenC = li.data?.token;
  }
  if (tokenC) {
    const outsider = await api('put', `/messages/${msgId2}/star`, { token: tokenC });
    check(
      '7. Non-participant star attempt rejected (403)',
      outsider.status === 403,
      `status=${outsider.status}`
    );
  } else {
    check('7. Non-participant star attempt rejected (403)', false, 'outsider signup failed');
  }

  // === 6. Deleted message handling ===
  // B stars A's message, then A deletes it FOR THEMSELVES (deletedFor semantics):
  // the message stays visible to B, so B's star legitimately remains — while
  // A's own star row is dropped and A's list stays clean.
  const scross = await api('put', `/messages/${msgId1}/star`, { token: tokenB });
  check('6. Cross-star (B stars A\u2019s message) ok', scross.status === 200, `status=${scross.status}`);

  const del = await api('delete', `/messages/${msgId1}`, { token: tokenA });
  check('6b. Sender deletes own message', del.status === 200, `status=${del.status}`);

  const listB2 = await api('get', '/messages/starred', { token: tokenB });
  const bKeepsView =
    listB2.status === 200 &&
    (listB2.data?.starredMessages || []).some((i) => i.message?._id === msgId1);
  check('6c. Deleted-for-sender message stays visible to B (star kept, no crash)', bKeepsView, `B count=${listB2.data?.count}`);

  const listA2 = await api('get', '/messages/starred', { token: tokenA });
  const aClean = !(listA2.data?.starredMessages || []).some(
    (i) => i.message?._id === msgId1
  );
  check('6d. Deleted-for-self message gone from A\u2019s starred list', aClean, `A count=${listA2.data?.count}`);

  // === 9. Hard-deleted messages (Clear Chat) are handled gracefully ===
  const clear = await api('delete', `/chats/${chatId}/clear`, { token: tokenA });
  check('9. Clear chat (hard delete) succeeds', clear.status === 200, `status=${clear.status}`);

  const listB3 = await api('get', '/messages/starred', { token: tokenB });
  const bFullyClean =
    listB3.status === 200 &&
    !(listB3.data?.starredMessages || []).some(
      (i) => i.message?._id === msgId1 || i.message?._id === msgId2
    );
  check('9b. No dangling starred references after hard delete', bFullyClean, `B count=${listB3.data?.count}`);

  // === Auth guard ===
  const noauth = await api('put', `/messages/${msgId2}/star`, {});
  check('8. Star without auth rejected (401)', noauth.status === 401, `status=${noauth.status}`);

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n==============================');
  console.log(`RESULT: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((r) => console.log(`  - ${r.name}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Test crashed:', e.message);
  process.exit(1);
});
