'use strict';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age':       '86400',
};

const json = (body, status = 200) => ({
  statusCode: status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const sessions  = new Map(); // id → { username, color, room, lastSeen, seq }
const messages  = new Map(); // room → [{ id, username, color, text, type, ts, seq }]
const msgSeq    = new Map(); // room → globalSeq counter

const COLORS = ['#4fc3ff','#a0d8ff','#82d4ff','#7eb8ff','#64b5f6',
                '#4dd0e1','#80cbc4','#a5d6a7','#fff176','#ffb74d','#ef9a9a','#f48fb1'];
const MAX_HISTORY = 120;
const SESSION_TTL = 5 * 60 * 1000; // 5 min idle = disconnected

function getRoomMsgs(room) {
  if (!messages.has(room)) messages.set(room, []);
  return messages.get(room);
}

function addMsg(room, msg) {
  const seq = (msgSeq.get(room) || 0) + 1;
  msgSeq.set(room, seq);
  msg.seq = seq;
  msg.ts  = msg.ts || Date.now();
  const list = getRoomMsgs(room);
  list.push(msg);
  if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
  return msg;
}

function getRoomUsers(room) {
  const now = Date.now();
  const users = [];
  for (const [id, s] of sessions) {
    if (s.room === room && now - s.lastSeen < SESSION_TTL) {
      users.push({ id, username: s.username, color: s.color });
    }
  }
  return users;
}

function pruneStale() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > SESSION_TTL) {

      addMsg(s.room, { type: 'system', text: `${s.username} left`, id: 'sys' });
      sessions.delete(id);
    }
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  pruneStale();
  const p      = event.queryStringParameters || {};
  const action = p.action || '';
  const id     = p.id || '';

  if (action === 'connect') {
    const newId   = randomId();
    const color   = COLORS[Math.floor(Math.random() * COLORS.length)];
    const username = 'Nebula_' + newId.slice(0, 4).toUpperCase();
    const room    = 'general';
    sessions.set(newId, { username, color, room, lastSeen: Date.now(), seq: 0 });
    const sysMsg = addMsg(room, { type:'system', text:`${username} joined #${room}`, id:'sys' });
    return json({ id: newId, username, color, room,
      history: getRoomMsgs(room).slice(-60),
      users:   getRoomUsers(room),
      seq:     msgSeq.get(room) || 0,
    });
  }

  if (action === 'rooms') {
    const roomCounts = new Map();
    for (const [, s] of sessions) {
      if (Date.now() - s.lastSeen < SESSION_TTL)
        roomCounts.set(s.room, (roomCounts.get(s.room) || 0) + 1);
    }

    for (const r of ['general','gaming','blueNebula','vms','dev']) {
      if (!roomCounts.has(r)) roomCounts.set(r, 0);
    }
    return json({ rooms: [...roomCounts.entries()].map(([name, count]) => ({ name, count })) });
  }

  const session = id ? sessions.get(id) : null;
  if (!session && !['connect','rooms'].includes(action)) {
    return json({ error: 'Unknown session — reconnect' }, 404);
  }
  if (session) session.lastSeen = Date.now();

  if (action === 'poll' && event.httpMethod === 'GET') {
    const clientSeq = parseInt(p.seq || '0');
    const room      = session.room;
    const allMsgs   = getRoomMsgs(room);
    const newMsgs   = allMsgs.filter(m => (m.seq || 0) > clientSeq);
    return json({
      messages: newMsgs,
      users:    getRoomUsers(room),
      seq:      msgSeq.get(room) || 0,
      room,
    });
  }

  if (action === 'send' && event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const text = (body.text || '').slice(0, 500).trim();
    if (!text) return json({ error: 'Empty message' }, 400);
    const msg = addMsg(session.room, {
      type: 'chat', id, username: session.username,
      color: session.color, text,
    });
    return json({ ok: true, seq: msg.seq });
  }

  if (action === 'rename' && event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const newName = (body.username || '').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,20);
    if (!newName) return json({ error: 'Invalid name' }, 400);
    const old = session.username;
    session.username = newName;
    addMsg(session.room, { type:'system', text:`${old} is now ${newName}`, id:'sys' });
    return json({ ok: true, username: newName });
  }

  if (action === 'join' && event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const newRoom = (body.room || 'general').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,32) || 'general';
    const oldRoom = session.room;
    if (newRoom !== oldRoom) {
      addMsg(oldRoom, { type:'system', text:`${session.username} left #${oldRoom}`, id:'sys' });
      session.room = newRoom;
      addMsg(newRoom, { type:'system', text:`${session.username} joined #${newRoom}`, id:'sys' });
    }
    return json({
      ok: true, room: newRoom,
      history: getRoomMsgs(newRoom).slice(-60),
      users:   getRoomUsers(newRoom),
      seq:     msgSeq.get(newRoom) || 0,
    });
  }

  if (action === 'leave') {
    addMsg(session.room, { type:'system', text:`${session.username} left`, id:'sys' });
    sessions.delete(id);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
};