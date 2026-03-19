#!/usr/bin/env node
/**
 * boost_farmer.js — Termux-compatible boost-farming script for The Wanderer
 *
 * Opens NUM_SOCKETS WebSocket connections and sends BOOST messages as fast as
 * the server allows (one every ~110 ms per socket, max 50 per 10-second window).
 *
 * Usage:
 *   node boost_farmer.js [SERVER_URL] [NUM_SOCKETS]
 *
 *   SERVER_URL  WebSocket URL of the server  (default: ws://localhost:3001)
 *   NUM_SOCKETS Number of parallel sockets   (default: 5)
 *
 * Requirements (Termux one-time setup):
 *   pkg install nodejs
 *   npm install ws   # run inside this scripts/ directory, or pass --prefix
 *
 * Example:
 *   node boost_farmer.js wss://your-server.example.com 5
 */

"use strict";

const WebSocket = require("ws");

// ── Configuration ─────────────────────────────────────────────────────────────
const SERVER_URL  = process.argv[2] || "ws://localhost:3001";
const NUM_SOCKETS = Math.max(1, parseInt(process.argv[3] ?? "5", 10) || 5);

// Mirror the server-side limits so the client stays in sync
const BOOST_MIN_INTERVAL_MS = 110;  // server requires > 100 ms
const BOOST_MAX_PER_WINDOW  = 50;   // server allows 50 per 10-second window
const BOOST_WINDOW_MS       = 10000;
const SESSION_BOOST_CAP     = 9000; // per-socket session cap on the server
const RECONNECT_DELAY_MS    = 3000;
const STATS_INTERVAL_MS     = 5000;

// ── Per-socket state ───────────────────────────────────────────────────────────
const sockets = [];

function createSocket(id) {
  const sock = {
    id,
    ws:              null,
    connected:       false,
    totalSent:       0,       // BOOST messages sent (may be rate-limited server-side)
    totalAccepted:   0,       // MY_BOOST responses received
    totalCapped:     0,       // BOOST_CAPPED responses received
    windowStart:     Date.now(),
    windowCount:     0,
    reconnectTimer:  null,
    boostTimer:      null,
  };
  sockets[id] = sock;
  connect(sock);
  return sock;
}

function connect(sock) {
  clearTimeout(sock.reconnectTimer);

  let ws;
  try {
    ws = new WebSocket(SERVER_URL);
  } catch (err) {
    console.error(`[socket ${sock.id}] Could not create WebSocket: ${err.message}`);
    scheduleReconnect(sock);
    return;
  }

  sock.ws        = ws;
  sock.connected = false;

  ws.on("open", () => {
    sock.connected   = true;
    sock.windowStart = Date.now();
    sock.windowCount = 0;
    scheduleBurst(sock);
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "MY_BOOST")     sock.totalAccepted++;
      if (msg.type === "BOOST_CAPPED") sock.totalCapped++;
    } catch (_) { /* ignore malformed frames */ }
  });

  ws.on("close", () => {
    sock.connected = false;
    clearTimeout(sock.boostTimer);
    scheduleReconnect(sock);
  });

  ws.on("error", () => {
    // errors are followed by a close event; nothing extra needed
  });
}

function scheduleReconnect(sock) {
  sock.reconnectTimer = setTimeout(() => connect(sock), RECONNECT_DELAY_MS);
}

/**
 * Send one BOOST and schedule the next one, respecting:
 *   - The per-socket session cap (stop forever once reached)
 *   - The 10-second window cap (pause until the window resets)
 *   - The minimum interval between sends
 */
function scheduleBurst(sock) {
  if (sock.totalSent >= SESSION_BOOST_CAP) {
    console.log(`[socket ${sock.id}] Session cap reached (${SESSION_BOOST_CAP}). Socket done.`);
    return;
  }

  // Reset window counter when the window expires
  const now = Date.now();
  if (now - sock.windowStart > BOOST_WINDOW_MS) {
    sock.windowStart = now;
    sock.windowCount = 0;
  }

  if (sock.windowCount >= BOOST_MAX_PER_WINDOW) {
    // Window is full — wait until it resets
    const wait = BOOST_WINDOW_MS - (now - sock.windowStart) + 10;
    sock.boostTimer = setTimeout(() => scheduleBurst(sock), Math.max(wait, 10));
    return;
  }

  // Send a boost
  if (sock.ws?.readyState === WebSocket.OPEN) {
    sock.ws.send(JSON.stringify({ type: "BOOST" }));
    sock.totalSent++;
    sock.windowCount++;
  }

  // Schedule next boost
  sock.boostTimer = setTimeout(() => scheduleBurst(sock), BOOST_MIN_INTERVAL_MS);
}

// ── Stats printer ──────────────────────────────────────────────────────────────
let statsStart = Date.now();
let lastAccepted = 0;

function printStats() {
  const elapsed    = ((Date.now() - statsStart) / 1000).toFixed(0);
  const totalSent  = sockets.reduce((s, c) => s + c.totalSent,     0);
  const accepted   = sockets.reduce((s, c) => s + c.totalAccepted, 0);
  const capped     = sockets.reduce((s, c) => s + c.totalCapped,   0);
  const connected  = sockets.filter(c => c.connected).length;
  const rate       = ((accepted - lastAccepted) / (STATS_INTERVAL_MS / 1000)).toFixed(1);
  lastAccepted     = accepted;

  const lines = [
    `\n┌─ Wanderer Boost Farmer ─ ${new Date().toLocaleTimeString()} (${elapsed}s running)`,
    `│  Server   : ${SERVER_URL}`,
    `│  Sockets  : ${connected}/${NUM_SOCKETS} connected`,
    `│  Sent     : ${totalSent}  │  Accepted: ${accepted}  │  Capped: ${capped}`,
    `│  Rate     : ${rate} boosts/s (last ${STATS_INTERVAL_MS / 1000}s)`,
    `└${"─".repeat(55)}`,
  ];

  sockets.forEach((s) => {
    lines.push(
      `  socket ${s.id}: sent=${s.totalSent.toString().padStart(5)}  ` +
      `accepted=${s.totalAccepted.toString().padStart(5)}  ` +
      `${s.connected ? "● connected" : "○ reconnecting…"}`
    );
  });

  console.log(lines.join("\n"));
}

// ── Entry point ────────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════╗
║   Wanderer Boost Farmer  (Termux ready)  ║
╚══════════════════════════════════════════╝
  Server  : ${SERVER_URL}
  Sockets : ${NUM_SOCKETS}
  Max rate: ~${Math.floor((1000 / BOOST_MIN_INTERVAL_MS) * NUM_SOCKETS)} boosts/s
  Press Ctrl-C to stop.
`);

for (let i = 0; i < NUM_SOCKETS; i++) createSocket(i);

setInterval(printStats, STATS_INTERVAL_MS);

process.on("SIGINT", () => {
  printStats();
  console.log("\nStopping…");
  sockets.forEach((s) => {
    clearTimeout(s.boostTimer);
    clearTimeout(s.reconnectTimer);
    s.ws?.close();
  });
  process.exit(0);
});
