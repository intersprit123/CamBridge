import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

type Role = 'host' | 'viewer';
type Room = { code: string; host: WebSocket; viewer: WebSocket | null; createdAt: number };
type ClientInfo = { roomCode: string; role: Role };

const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cambridge-signaling', time: new Date().toISOString() }));
app.get('/api/info', (_req, res) => {
  const ips: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) ips.push(item.address);
  }
  res.json({ port: Number(process.env.PORT || 8787), addresses: [...new Set(ips)] });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, ClientInfo>();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function send(ws: WebSocket | null | undefined, message: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}
function makeCode() {
  let code = '';
  do {
    const bytes = randomBytes(8);
    code = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  } while (rooms.has(code));
  return code;
}
function removeClient(ws: WebSocket) {
  const info = clients.get(ws);
  clients.delete(ws);
  if (!info) return;
  const room = rooms.get(info.roomCode);
  if (!room) return;
  if (info.role === 'host' && room.host === ws) {
    send(room.viewer, { type: 'host-disconnected' });
    if (room.viewer) clients.delete(room.viewer);
    rooms.delete(room.code);
  } else if (info.role === 'viewer' && room.viewer === ws) {
    room.viewer = null;
    send(room.host, { type: 'peer-left' });
  }
}
function fail(ws: WebSocket, message: string) { send(ws, { type: 'error', message }); }

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let message: any;
    try { message = JSON.parse(data.toString()); }
    catch { fail(ws, 'Message must be valid JSON.'); return; }
    if (!message || typeof message.type !== 'string') { fail(ws, 'Invalid message.'); return; }

    if (message.type === 'create-room') {
      if (clients.has(ws)) { fail(ws, 'This socket already belongs to a room.'); return; }
      const code = makeCode();
      rooms.set(code, { code, host: ws, viewer: null, createdAt: Date.now() });
      clients.set(ws, { roomCode: code, role: 'host' });
      send(ws, { type: 'room-created', code });
      return;
    }
    if (message.type === 'join-room') {
      const code = String(message.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) { fail(ws, 'Room not found. Check the code and make sure camera sharing is still running.'); return; }
      if (room.viewer?.readyState === WebSocket.OPEN) { fail(ws, 'This room already has a controller connected.'); return; }
      if (clients.has(ws)) { fail(ws, 'This socket already belongs to a room.'); return; }
      room.viewer = ws;
      clients.set(ws, { roomCode: code, role: 'viewer' });
      send(ws, { type: 'joined', code });
      send(room.host, { type: 'peer-joined' });
      return;
    }

    const info = clients.get(ws);
    if (!info) { fail(ws, 'Create or join a room first.'); return; }
    const room = rooms.get(info.roomCode);
    if (!room) { fail(ws, 'Room has expired.'); return; }
    const peer = info.role === 'host' ? room.viewer : room.host;

    if (message.type === 'signal') {
      if (!message.payload || typeof message.payload.kind !== 'string') { fail(ws, 'Invalid WebRTC signal.'); return; }
      send(peer, { type: 'signal', payload: message.payload });
    } else if (message.type === 'control') {
      if (info.role !== 'viewer') { fail(ws, 'Only the paired controller can send camera controls.'); return; }
      if (!['zoom', 'torch', 'exposureCompensation', 'focusMode'].includes(String(message.name))) { fail(ws, 'That camera control is not allowed.'); return; }
      send(room.host, { type: 'remote-control', name: message.name, value: message.value });
    } else if (message.type === 'capabilities') {
      if (info.role !== 'host') { fail(ws, 'Only the camera host can publish capabilities.'); return; }
      send(room.viewer, { type: 'capabilities', capabilities: message.capabilities || {} });
    } else if (message.type === 'leave-room') {
      removeClient(ws);
    } else if (message.type === 'control-result') {
      if (info.role !== 'host') { fail(ws, 'Only the camera host can report control results.'); return; }
      send(room.viewer, { type: 'control-result', name: message.name, ok: Boolean(message.ok), error: message.error });
    } else if (message.type === 'ping') {
      send(ws, { type: 'pong', at: Date.now() });
    } else {
      fail(ws, 'Unsupported message type.');
    }
  });
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
});

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff || room.host.readyState === WebSocket.CLOSED) {
      send(room.viewer, { type: 'host-disconnected' });
      rooms.delete(code);
      clients.delete(room.host);
      if (room.viewer) clients.delete(room.viewer);
    }
  }
}, 60_000).unref();

const port = Number(process.env.PORT || 8787);
server.listen(port, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flatMap((items) => (items || [])
    .filter((item) => item.family === 'IPv4' && !item.internal).map((item) => item.address));
  console.log('CamBridge signaling server on port ' + port);
  for (const ip of ips) console.log('  ws://' + ip + ':' + port);
  console.log('Health endpoint: http://127.0.0.1:' + port + '/api/health');
});
