import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { io } from 'socket.io-client';

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jwtSecret = 'card-details-integration-test-secret';

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
  return port;
}

async function request(baseUrl, token, method, path, body) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const responseText = await response.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = { message: responseText };
  }
  return { status: response.status, body: responseBody };
}

async function waitForServer(baseUrl, child, readOutput) {
  const deadline = Date.now() + 60000;
  let lastError;

  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(`Test server did not start: ${lastError?.message || ''}\n${readOutput()}`);
}

function waitForSocketEvent(socket, name, predicate = () => true, timeout = 8000) {
  return new Promise((resolveEvent, rejectEvent) => {
    const timer = setTimeout(() => {
      socket.off(name, onEvent);
      rejectEvent(new Error(`Timed out waiting for socket event ${name}`));
    }, timeout);

    const onEvent = (payload) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(name, onEvent);
      resolveEvent(payload);
    };

    socket.on(name, onEvent);
  });
}

async function waitForLoggedEvent(events, startIndex, predicate) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const event = events.slice(startIndex).find(predicate);
    if (event) {
      return event;
    }
    await delay(10);
  }
  throw new Error('Timed out waiting for matching board update');
}

async function connectSocket(baseUrl, token) {
  const socket = io(baseUrl, {
    auth: { token },
    reconnection: false,
    timeout: 8000
  });

  await new Promise((resolveConnect, rejectConnect) => {
    const timer = setTimeout(() => rejectConnect(new Error('Socket connection timed out')), 10000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolveConnect();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      rejectConnect(error);
    });
  });

  return socket;
}

async function shutdownChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  const exitPromise = once(child, 'exit');
  child.kill('SIGTERM');
  const exited = await Promise.race([
    exitPromise.then(() => true),
    delay(10000).then(() => false)
  ]);

  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

test('card details REST, socket, persistence, and permissions end to end', async (t) => {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_URL: 'http://localhost:5174',
      JWT_SECRET: jwtSecret,
      USE_MEMORY_DB: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });

  const sockets = [];
  const boardEventLogs = [];

  try {
    await waitForServer(baseUrl, child, () => output);

    const user1Signup = await request(baseUrl, null, 'POST', '/api/auth/signup', {
      name: 'Card Owner',
      email: 'card-owner@example.test',
      password: 'secret123'
    });
    assert.equal(user1Signup.status, 201);
    const user1 = user1Signup.body;

    const user2Signup = await request(baseUrl, null, 'POST', '/api/auth/signup', {
      name: 'Card Member',
      email: 'card-member@example.test',
      password: 'secret123'
    });
    assert.equal(user2Signup.status, 201);
    const user2 = user2Signup.body;

    const boardResult = await request(baseUrl, user1.token, 'POST', '/api/boards', { name: 'Card Details E2E' });
    assert.equal(boardResult.status, 201);
    const boardId = boardResult.body.board._id;

    const listResult = await request(baseUrl, user1.token, 'POST', `/api/boards/${boardId}`, { title: 'Backlog' });
    assert.equal(listResult.status, 201);
    const listId = listResult.body.list._id;

    const cardResult = await request(baseUrl, user1.token, 'POST', `/api/boards/${boardId}/lists/${listId}/cards`, { title: 'Card details' });
    assert.equal(cardResult.status, 201);
    const cardId = cardResult.body.card._id;

    const invitation = await request(baseUrl, user1.token, 'POST', `/api/boards/${boardId}/members`, {
      email: user2.user.email,
      role: 'member'
    });
    assert.equal(invitation.status, 201);

    const outsiderSignup = await request(baseUrl, null, 'POST', '/api/auth/signup', {
      name: 'Outside User',
      email: 'outside-user@example.test',
      password: 'secret123'
    });
    assert.equal(outsiderSignup.status, 201);
    const outsider = outsiderSignup.body;

    const ownerSocket = await connectSocket(baseUrl, user1.token);
    const memberSocket = await connectSocket(baseUrl, user2.token);
    sockets.push(ownerSocket, memberSocket);

    for (const socket of sockets) {
      const log = [];
      socket.on('board:updated', (event) => log.push(event));
      boardEventLogs.push(log);
      const joined = waitForSocketEvent(socket, 'board:joined', (event) => event.boardId === boardId);
      socket.emit('board:join', { boardId });
      await joined;
    }

    const initialBoard = await request(baseUrl, user1.token, 'GET', `/api/boards/${boardId}`);
    assert.equal(initialBoard.status, 200);
    const baselineActivityIds = new Set(initialBoard.body.activities.map((activity) => activity._id));
    const initialSocketEventCounts = boardEventLogs.map((events) => events.length);
    const successfulOperations = [];

    async function successfulCardWrite(action, method, path, body, expectedType, expectedCard) {
      const eventStarts = boardEventLogs.map((events) => events.length);
      const result = await request(baseUrl, user1.token, method, path, body);
      assert.ok(result.status >= 200 && result.status < 300, `${action} returned ${result.status}: ${JSON.stringify(result.body)}`);
      if (expectedCard) {
        assert.deepEqual(expectedCard(result.body), true, `${action} REST response did not contain the expected card state`);
      }

      const receivedEvents = await Promise.all(boardEventLogs.map((events, index) => (
        waitForLoggedEvent(events, eventStarts[index], (event) => (
          event.type === expectedType && String(event.card?._id) === String(cardId)
        ))
      )));
      successfulOperations.push({ action, type: expectedType });
      return { result, receivedEvents };
    }

    async function rejectedWithoutSocketEvent(token, method, path, body, expectedStatus) {
      const eventStarts = boardEventLogs.map((events) => events.length);
      const result = await request(baseUrl, token, method, path, body);
      assert.equal(result.status, expectedStatus, `${method} ${path} returned ${result.status}: ${JSON.stringify(result.body)}`);
      await delay(100);
      boardEventLogs.forEach((events, index) => {
        assert.equal(events.length, eventStarts[index], `${method} ${path} emitted a board update despite rejection`);
      });
      return result;
    }

    const cardPath = `/api/boards/${boardId}/cards/${cardId}`;
    const commentsPath = `${cardPath}/comments`;

    await t.test('1. description update returns the saved value and broadcasts it', async () => {
      const { result, receivedEvents } = await successfulCardWrite(
        'description update', 'PATCH', cardPath, { description: 'A clear description' }, 'card:updated',
        (body) => body.card.description === 'A clear description'
      );
      assert.equal(result.body.card.description, 'A clear description');
      receivedEvents.forEach((event) => assert.equal(event.card.description, 'A clear description'));
    });

    await t.test('2. label add, change, and removal each broadcast the new state', async () => {
      const labelAdded = await successfulCardWrite(
        'label add', 'PATCH', cardPath, { labels: [{ name: 'urgent', color: '#ff0000' }] }, 'card:updated',
        (body) => body.card.labels.some((label) => label.name === 'urgent' && label.color === '#ff0000')
      );
      labelAdded.receivedEvents.forEach((event) => {
        assert.ok(event.card.labels.some((label) => label.name === 'urgent' && label.color === '#ff0000'));
      });

      const labelChanged = await successfulCardWrite(
        'label change', 'PATCH', cardPath, { labels: [{ name: 'blocked', color: '#0000ff' }] }, 'card:updated',
        (body) => body.card.labels.some((label) => label.name === 'blocked' && label.color === '#0000ff')
      );
      labelChanged.receivedEvents.forEach((event) => {
        assert.ok(event.card.labels.some((label) => label.name === 'blocked' && label.color === '#0000ff'));
      });

      const labelRemoved = await successfulCardWrite(
        'label removal', 'PATCH', cardPath, { labels: [] }, 'card:updated',
        (body) => body.card.labels.length === 0
      );
      labelRemoved.receivedEvents.forEach((event) => assert.equal(event.card.labels.length, 0));
    });

    await t.test('3. assignment, unassignment, and non-member assignee validation work', async () => {
      const assigned = await successfulCardWrite(
        'assign board member', 'PATCH', cardPath, { assignees: [user2.user._id] }, 'card:updated',
        (body) => body.card.assignees.map(String).includes(String(user2.user._id))
      );
      assigned.receivedEvents.forEach((event) => {
        assert.ok(event.card.assignees.map(String).includes(String(user2.user._id)));
      });

      const unassigned = await successfulCardWrite(
        'unassign board member', 'PATCH', cardPath, { assignees: [] }, 'card:updated',
        (body) => body.card.assignees.length === 0
      );
      unassigned.receivedEvents.forEach((event) => assert.equal(event.card.assignees.length, 0));

      await rejectedWithoutSocketEvent(user1.token, 'PATCH', cardPath, { assignees: [outsider.user._id] }, 400);
    });

    await t.test('4. due date set, clear, and invalid-date validation work', async () => {
      const dueDate = '2030-05-06T00:00:00.000Z';
      const setDate = await successfulCardWrite(
        'set due date', 'PATCH', cardPath, { dueDate }, 'card:updated',
        (body) => new Date(body.card.dueDate).toISOString() === dueDate
      );
      setDate.receivedEvents.forEach((event) => assert.equal(new Date(event.card.dueDate).toISOString(), dueDate));

      const clearedDate = await successfulCardWrite(
        'clear due date', 'PATCH', cardPath, { dueDate: null }, 'card:updated',
        (body) => body.card.dueDate === null
      );
      clearedDate.receivedEvents.forEach((event) => assert.equal(event.card.dueDate, null));

      await rejectedWithoutSocketEvent(user1.token, 'PATCH', cardPath, { dueDate: 'not-a-date' }, 400);
    });

    await t.test('5. comments are shared, replies work, and blank comments are rejected', async () => {
      const firstComment = await successfulCardWrite(
        'first comment', 'POST', commentsPath, { text: 'First comment' }, 'comment:added',
        (body) => body.card.comments.some((comment) => comment.text === 'First comment')
      );
      firstComment.receivedEvents.forEach((event) => {
        assert.ok(event.card.comments.some((comment) => comment.text === 'First comment'));
      });

      const replyEventStarts = boardEventLogs.map((events) => events.length);
      const reply = await request(baseUrl, user2.token, 'POST', commentsPath, { text: 'Member reply' });
      assert.equal(reply.status, 201);
      assert.ok(reply.body.card.comments.some((comment) => comment.text === 'Member reply'));
      const replyEvents = await Promise.all(boardEventLogs.map((events, index) => (
        waitForLoggedEvent(events, replyEventStarts[index], (event) => (
          event.type === 'comment:added' && String(event.card?._id) === String(cardId)
        ))
      )));
      replyEvents.forEach((event) => assert.ok(event.card.comments.some((comment) => comment.text === 'Member reply')));
      successfulOperations.push({ action: 'member reply', type: 'comment:added' });

      await rejectedWithoutSocketEvent(user1.token, 'POST', commentsPath, { text: '   \n  ' }, 400);
    });

    await t.test('6. REST board read contains every saved card detail change', async () => {
      const finalBoard = await request(baseUrl, user1.token, 'GET', `/api/boards/${boardId}`);
      assert.equal(finalBoard.status, 200);
      const savedCard = finalBoard.body.cards.find((card) => String(card._id) === String(cardId));
      assert.ok(savedCard);
      assert.equal(savedCard.description, 'A clear description');
      assert.deepEqual(savedCard.labels, []);
      assert.deepEqual(savedCard.assignees, []);
      assert.equal(savedCard.dueDate, null);
      assert.deepEqual(savedCard.comments.map((comment) => comment.text), ['First comment', 'Member reply']);
    });

    await t.test('7. successful changes create activity and both sockets receive each board event', async () => {
      assert.equal(successfulOperations.length, 10);
      boardEventLogs.forEach((events, index) => {
        assert.equal(events.length - initialSocketEventCounts[index], successfulOperations.length);
      });

      const finalBoard = await request(baseUrl, user1.token, 'GET', `/api/boards/${boardId}`);
      const newActivities = finalBoard.body.activities.filter((activity) => !baselineActivityIds.has(activity._id));
      assert.equal(newActivities.length, successfulOperations.length);
      assert.equal(newActivities.filter((activity) => activity.action === 'card updated').length, 8);
      assert.equal(newActivities.filter((activity) => activity.action === 'comment added').length, 2);
    });

    await t.test('8. viewer role blocks every card write and emits no rejected event', async () => {
      const roleEventStarts = boardEventLogs.map((events) => events.length);
      const roleChange = await request(baseUrl, user1.token, 'PATCH', `/api/boards/${boardId}/members/${user2.user._id}`, { role: 'viewer' });
      assert.equal(roleChange.status, 200);
      const roleEvents = await Promise.all(boardEventLogs.map((events, index) => (
        waitForLoggedEvent(events, roleEventStarts[index], (event) => event.type === 'member:updated')
      )));
      assert.equal(roleEvents.length, 2);

      const viewerWrites = [
        ['PATCH', cardPath, { description: 'viewer denied' }],
        ['PATCH', cardPath, { labels: [{ name: 'viewer', color: '#000000' }] }],
        ['PATCH', cardPath, { labels: [{ name: 'changed', color: '#ffffff' }] }],
        ['PATCH', cardPath, { labels: [] }],
        ['PATCH', cardPath, { assignees: [user1.user._id] }],
        ['PATCH', cardPath, { assignees: [] }],
        ['PATCH', cardPath, { assignees: [outsider.user._id] }],
        ['PATCH', cardPath, { dueDate: '2031-01-01T00:00:00.000Z' }],
        ['PATCH', cardPath, { dueDate: null }],
        ['PATCH', cardPath, { dueDate: 'invalid-date' }],
        ['POST', commentsPath, { text: 'viewer comment' }],
        ['POST', commentsPath, { text: 'viewer reply' }],
        ['POST', commentsPath, { text: '' }]
      ];

      for (const [method, path, body] of viewerWrites) {
        await rejectedWithoutSocketEvent(user2.token, method, path, body, 403);
      }
    });

    await t.test('9. non-members cannot read, change, or join the board room', async () => {
      const boardRead = await request(baseUrl, outsider.token, 'GET', `/api/boards/${boardId}`);
      assert.equal(boardRead.status, 403);
      await rejectedWithoutSocketEvent(outsider.token, 'PATCH', cardPath, { description: 'outside change' }, 403);
      await rejectedWithoutSocketEvent(outsider.token, 'POST', commentsPath, { text: 'outside comment' }, 403);

      const outsiderSocket = await connectSocket(baseUrl, outsider.token);
      sockets.push(outsiderSocket);
      const outsiderEvents = [];
      const presenceEvents = [];
      outsiderSocket.on('board:updated', (event) => outsiderEvents.push(event));
      outsiderSocket.on('presence:update', (event) => presenceEvents.push(event));
      const deniedJoin = waitForSocketEvent(outsiderSocket, 'board:error', (event) => event.message.includes('not a member'));
      outsiderSocket.emit('board:join', { boardId });
      await deniedJoin;

      const updateStarts = boardEventLogs.map((events) => events.length);
      const ownerWrite = await request(baseUrl, user1.token, 'PATCH', cardPath, { description: 'Room isolation check' });
      assert.equal(ownerWrite.status, 200);
      await Promise.all(boardEventLogs.map((events, index) => (
        waitForLoggedEvent(events, updateStarts[index], (event) => event.type === 'card:updated')
      )));
      await delay(150);
      assert.equal(outsiderEvents.length, 0);
      assert.equal(presenceEvents.some((users) => users.some((user) => String(user._id) === String(outsider.user._id))), false);
    });
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await shutdownChild(child);
  }
});