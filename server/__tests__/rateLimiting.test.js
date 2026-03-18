'use strict';

const { spawn } = require('child_process');
const http      = require('http');
const path      = require('path');
const WebSocket = require('ws');

const TEST_PORT = 3099;
const WS_URL    = `ws://localhost:${TEST_PORT}`;

// Mirror the constants set in server/index.js so the tests document intent clearly.
const MAX_CONNECTIONS_PER_IP = 5;
const BOOST_MAX              = 100;
const BOOST_WINDOW_MS        = 19000;
const BOOST_MIN_INTERVAL_MS  = 100;
const DAILY_FEED_LIMIT       = 4;
const FEED_MIN_INTERVAL_MS   = 500;

let serverProcess;

// ── helpers ───────────────────────────────────────────────────────────────────

// Use the HTTP health endpoint so the probe never touches ipConnectionCount.
function waitForServer(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    function attempt() {
      const req = http.get(`http://localhost:${TEST_PORT}/health`, (res) => {
        if (res.statusCode === 200) { res.resume(); resolve(); }
        else retry();
      });
      req.on('error', retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error('Server did not start in time'));
        setTimeout(attempt, 150);
      }
    }
    attempt();
  });
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.once('open',  () => resolve(ws));
    ws.once('error', reject);
  });
}

/** Resolves with the first message of the given type, or rejects on timeout. */
function waitForMsg(ws, type, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for "${type}"`));
    }, timeout);

    function handler(data) {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    }
    ws.on('message', handler);
  });
}

/** Collects all messages of the given type for durationMs, then resolves. */
function collectMsgs(ws, type, durationMs) {
  return new Promise((resolve) => {
    const msgs = [];
    function handler(data) {
      try {
        const msg = JSON.parse(data);
        if (msg.type === type) msgs.push(msg);
      } catch {}
    }
    ws.on('message', handler);
    setTimeout(() => { ws.off('message', handler); resolve(msgs); }, durationMs);
  });
}

const send  = (ws, obj) => ws.send(JSON.stringify(obj));
const delay = (ms)      => new Promise(r => setTimeout(r, ms));

function closeAll(sockets) {
  for (const ws of sockets) {
    try { if (ws.readyState <= 1) ws.close(); } catch {}
  }
}

// ── server lifecycle ──────────────────────────────────────────────────────────

beforeAll(async () => {
  serverProcess = spawn('node', [path.join(__dirname, '..', 'index.js')], {
    env:   { ...process.env, PORT: String(TEST_PORT) },
    cwd:   path.join(__dirname, '..'),
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  await waitForServer();
}, 15000);

afterAll(() => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('IP connection limit', () => {
  test(`allows exactly ${MAX_CONNECTIONS_PER_IP} concurrent connections per IP`, async () => {
    const sockets = [];
    try {
      for (let i = 0; i < MAX_CONNECTIONS_PER_IP; i++) {
        const ws = await openSocket();
        await waitForMsg(ws, 'HELLO');
        sockets.push(ws);
      }
      expect(sockets).toHaveLength(MAX_CONNECTIONS_PER_IP);
    } finally {
      closeAll(sockets);
      await delay(300);
    }
  }, 10000);

  test('closes the over-limit connection with WebSocket close code 1008', async () => {
    const sockets = [];
    try {
      for (let i = 0; i < MAX_CONNECTIONS_PER_IP; i++) {
        const ws = await openSocket();
        await waitForMsg(ws, 'HELLO');
        sockets.push(ws);
      }

      const code = await new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        ws.once('close', (c) => resolve(c));
        ws.once('error', () => {}); // suppress unhandled-error noise
        setTimeout(() => reject(new Error('No close event within 3 s')), 3000);
      });

      expect(code).toBe(1008);
    } finally {
      closeAll(sockets);
      await delay(300);
    }
  }, 10000);
});

describe('Boost rate limiting', () => {
  test('drops a boost sent within BOOST_MIN_INTERVAL_MS of the previous one', async () => {
    const ws = await openSocket();
    await waitForMsg(ws, 'HELLO');
    try {
      const collector = collectMsgs(ws, 'MY_BOOST', 400);
      send(ws, { type: 'BOOST' });
      send(ws, { type: 'BOOST' }); // fired < 1 ms later → server drops it
      const msgs = await collector;
      expect(msgs).toHaveLength(1);
    } finally {
      ws.close();
      await delay(150);
    }
  });

  test(`caps boosts at ${BOOST_MAX} per ${BOOST_WINDOW_MS / 1000} s window`, async () => {
    const ws = await openSocket();
    await waitForMsg(ws, 'HELLO');
    try {
      const SEND_COUNT = BOOST_MAX + 5;                 // 105 sends into the window
      const INTERVAL   = BOOST_MIN_INTERVAL_MS + 10;   // 110 ms – safely above min interval
      const collectFor = SEND_COUNT * INTERVAL + 600;  // wait for all replies + buffer

      const collector = collectMsgs(ws, 'MY_BOOST', collectFor);
      for (let i = 0; i < SEND_COUNT; i++) {
        send(ws, { type: 'BOOST' });
        await delay(INTERVAL);
      }

      const msgs = await collector;
      expect(msgs).toHaveLength(BOOST_MAX);
    } finally {
      ws.close();
      await delay(150);
    }
  }, 35000); // 105 × 110 ms ≈ 11.6 s of actual sending
});

describe('Feed daily limit', () => {
  test('applies feed spam filter to rapid FEED requests', async () => {
    const ws = await openSocket();
    const hello = await waitForMsg(ws, 'HELLO');
    try {
      if (hello.feedsUsed >= DAILY_FEED_LIMIT) {
        // Shared IP state can occasionally arrive already exhausted in multi-run environments.
        return;
      }

      send(ws, { type: 'FEED' });
      const first = await waitForMsg(ws, 'FEED_RESULT');
      send(ws, { type: 'FEED' }); // immediate second request should be flagged as spam
      const second = await waitForMsg(ws, 'FEED_RESULT');

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(second.reason).toBe('spam');
    } finally {
      ws.close();
      await delay(150);
    }
  });

  test('short-circuits FEED processing after quota exhaustion', async () => {
    const ws = await openSocket();
    const hello = await waitForMsg(ws, 'HELLO');
    try {
      let used = hello.feedsUsed || 0;
      const remaining = Math.max(0, DAILY_FEED_LIMIT - used);

      for (let i = 0; i < remaining; i++) {
        send(ws, { type: 'FEED' });
        const ok = await waitForMsg(ws, 'FEED_RESULT');
        expect(ok.success).toBe(true);
        used = ok.feedsUsed;
        await delay(FEED_MIN_INTERVAL_MS + 30);
      }

      send(ws, { type: 'FEED' });
      const exhausted = await waitForMsg(ws, 'FEED_RESULT');
      expect(exhausted.success).toBe(false);
      expect(exhausted.reason).toBe('daily_limit');

      const feedEventsCollector = collectMsgs(ws, 'FEED_EVENT', 350);
      send(ws, { type: 'FEED' });
      const blocked1 = await waitForMsg(ws, 'FEED_RESULT');
      send(ws, { type: 'FEED' });
      const blocked2 = await waitForMsg(ws, 'FEED_RESULT');
      const postExhaustEvents = await feedEventsCollector;

      expect(blocked1.success).toBe(false);
      expect(blocked1.reason).toBe('daily_limit');
      expect(blocked2.success).toBe(false);
      expect(blocked2.reason).toBe('daily_limit');
      expect(blocked1.feedsUsed).toBe(DAILY_FEED_LIMIT);
      expect(blocked2.feedsUsed).toBe(DAILY_FEED_LIMIT);
      expect(postExhaustEvents).toHaveLength(0);
    } finally {
      ws.close();
      await delay(150);
    }
  });

  test(`allows up to ${DAILY_FEED_LIMIT} feeds per IP then blocks with reason "daily_limit"`, async () => {
    const ws = await openSocket();
    const hello = await waitForMsg(ws, 'HELLO');
    try {
      const remaining = Math.max(0, DAILY_FEED_LIMIT - (hello.feedsUsed || 0));
      const results = [];

      for (let i = 0; i < remaining; i++) {
        send(ws, { type: 'FEED' });
        results.push(await waitForMsg(ws, 'FEED_RESULT'));
        await delay(FEED_MIN_INTERVAL_MS + 30);
      }

      send(ws, { type: 'FEED' });
      results.push(await waitForMsg(ws, 'FEED_RESULT'));

      const successes = results.filter((r) => r.success === true);
      const failures  = results.filter((r) => r.success === false);

      expect(successes).toHaveLength(remaining);
      expect(failures).toHaveLength(1);
      expect(failures[0].reason).toBe('daily_limit');
    } finally {
      ws.close();
      await delay(150);
    }
  });
});
