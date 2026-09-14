// Servidor autoritativo de "Conquista & Capital".
// Express serve o cliente estatico; Socket.IO cuida das salas e do fluxo do jogo.

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import { Server } from 'socket.io';
import { CLASSES, act, createGame, current, publicState, respondOffer, surrender } from './src/game.js';
import { botNames, botOfferDecision, nextBotAction } from './src/bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 6;
const ROOM_TTL_MS = 1000 * 60 * 60 * 3;
const LOBBY_GRACE_MS = 30_000;
const BOT_DELAY_MS = 700; // ritmo das jogadas dos bots, para dar para acompanhar

const app = express();
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/** @type {Map<string, Room>} */
const rooms = new Map();

const newCode = () => {
  let code;
  do {
    code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  } while (rooms.has(code));
  return code;
};
const token = () => crypto.randomBytes(12).toString('hex');
const cleanName = (n) => String(n || '').trim().slice(0, 14) || 'Comandante';

function createRoom(hostName) {
  const room = {
    code: newCode(),
    createdAt: Date.now(),
    status: 'lobby',
    hostId: null,
    members: new Map(), // playerId -> { id, name, socketId, online }
    botCount: 0,
    botIds: new Set(),
    game: null,
  };
  rooms.set(room.code, room);
  return room;
}

function roomView(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    members: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, cls: m.cls, online: m.online })),
    classes: Object.values(CLASSES),
    botCount: room.botCount,
    botIds: [...room.botIds],
    maxPlayers: MAX_PLAYERS,
    game: room.game ? publicState(room.game, viewerId) : null,
  };
}

// A missao e as cartas de cada um sao segredo, entao cada jogador recebe a sua propria
// versao do estado (nada de mandar o mesmo pacote para a sala inteira).
function broadcast(room) {
  for (const member of room.members.values()) {
    if (member.socketId) io.to(member.socketId).emit('room', roomView(room, member.id));
  }
}

function findRoom(code) {
  return rooms.get(String(code || '').toUpperCase().trim());
}

/**
 * Enquanto a vez for de um bot, ele joga sozinho — uma acao a cada BOT_DELAY_MS, para
 * os humanos conseguirem acompanhar. O laco para assim que a vez volta para alguem.
 */
function scheduleBots(room) {
  if (!room.game || room.game.phase === 'ended' || room.botLoop) return;
  if (!room.botIds.has(current(room.game).id)) return;
  room.botLoop = true;
  const passo = () => {
    if (!rooms.has(room.code) || !room.game || room.game.phase === 'ended') {
      room.botLoop = false;
      return;
    }
    const jogador = current(room.game);
    if (!room.botIds.has(jogador.id)) {
      room.botLoop = false;
      return;
    }
    const resposta = botOfferDecision(room.game, jogador.id);
    if (resposta) {
      respondOffer(room.game, jogador.id, resposta.offerId, resposta.accept);
      broadcast(room);
      setTimeout(passo, BOT_DELAY_MS).unref?.();
      return;
    }
    const acao = nextBotAction(room.game, jogador.id);
    const res = acao ? act(room.game, jogador.id, acao) : { ok: false };
    // Acao invalida nao pode travar a sala: encerra o turno do bot e segue o jogo.
    if (!res.ok) act(room.game, jogador.id, { type: 'endTurn' });
    if (room.game.phase === 'ended') room.status = 'ended';
    broadcast(room);
    setTimeout(passo, BOT_DELAY_MS).unref?.();
  };
  setTimeout(passo, BOT_DELAY_MS).unref?.();
}

io.on('connection', (socket) => {
  let ctx = null; // { code, playerId }

  const attach = (room, member) => {
    ctx = { code: room.code, playerId: member.id };
    member.socketId = socket.id;
    member.online = true;
    socket.join(room.code);
    socket.emit('joined', { code: room.code, playerId: member.id, token: member.token });
    socket.emit('room', roomView(room, member.id));
    broadcast(room);
  };

  socket.on('createRoom', ({ name } = {}, cb) => {
    const room = createRoom(name);
    const member = { id: token(), token: token(), name: cleanName(name), cls: 'empresario', socketId: socket.id, online: true };
    room.members.set(member.id, member);
    room.hostId = member.id;
    attach(room, member);
    cb?.({ ok: true, code: room.code });
  });

  socket.on('joinRoom', ({ code, name } = {}, cb) => {
    const room = findRoom(code);
    if (!room) return cb?.({ ok: false, error: 'Sala nao encontrada.' });
    if (room.status !== 'lobby') return cb?.({ ok: false, error: 'A partida ja comecou.' });
    if (room.members.size >= MAX_PLAYERS) return cb?.({ ok: false, error: 'Sala cheia.' });
    const member = { id: token(), token: token(), name: cleanName(name), cls: 'empresario', socketId: socket.id, online: true };
    room.members.set(member.id, member);
    attach(room, member);
    cb?.({ ok: true, code: room.code });
  });

  socket.on('setClass', ({ cls } = {}, cb) => {
    const room = findRoom(ctx?.code);
    const member = room?.members.get(ctx?.playerId);
    if (!room || !member) return cb?.({ ok: false, error: 'Sala invalida.' });
    if (room.status !== 'lobby') return cb?.({ ok: false, error: 'A partida ja comecou.' });
    if (!CLASSES[cls]) return cb?.({ ok: false, error: 'Classe invalida.' });
    member.cls = cls;
    broadcast(room);
    cb?.({ ok: true });
  });

  socket.on('rejoin', ({ code, playerId, token: tk } = {}, cb) => {
    const room = findRoom(code);
    const member = room?.members.get(playerId);
    if (!room || !member || member.token !== tk) return cb?.({ ok: false, error: 'Nao foi possivel reconectar.' });
    attach(room, member);
    cb?.({ ok: true, code: room.code });
  });

  socket.on('setBots', ({ count } = {}, cb) => {
    const room = findRoom(ctx?.code);
    if (!room) return cb?.({ ok: false, error: 'Sala invalida.' });
    if (room.hostId !== ctx.playerId) return cb?.({ ok: false, error: 'Apenas o anfitriao escolhe os bots.' });
    if (room.status !== 'lobby') return cb?.({ ok: false, error: 'A partida ja comecou.' });
    const max = MAX_PLAYERS - room.members.size;
    room.botCount = Math.max(0, Math.min(max, Math.floor(Number(count) || 0)));
    broadcast(room);
    cb?.({ ok: true, botCount: room.botCount });
  });

  socket.on('start', (_payload, cb) => {
    const room = findRoom(ctx?.code);
    if (!room) return cb?.({ ok: false, error: 'Sala invalida.' });
    if (room.hostId !== ctx.playerId) return cb?.({ ok: false, error: 'Apenas o anfitriao inicia.' });
    if (room.status !== 'lobby') return cb?.({ ok: false, error: 'Partida ja iniciada.' });
    const bots = Math.min(room.botCount, MAX_PLAYERS - room.members.size);
    if (room.members.size + bots < 2) {
      return cb?.({ ok: false, error: 'Sao necessarios ao menos 2 participantes (humanos ou bots).' });
    }
    const humanos = [...room.members.values()].map((m) => ({ id: m.id, name: m.name, cls: m.cls }));
    const classes = Object.keys(CLASSES);
    const nomes = botNames(bots);
    room.botIds = new Set();
    const jogadoresBots = nomes.map((nome, i) => {
      const id = `bot${i + 1}`;
      room.botIds.add(id);
      return { id, name: nome, cls: classes[Math.floor(Math.random() * classes.length)], bot: true };
    });
    room.game = createGame([...humanos, ...jogadoresBots]);
    room.status = 'playing';
    broadcast(room);
    scheduleBots(room);
    cb?.({ ok: true });
  });

  socket.on('action', (action = {}, cb) => {
    const room = findRoom(ctx?.code);
    if (!room?.game) return cb?.({ ok: false, error: 'Partida nao iniciada.' });
    const res = act(room.game, ctx.playerId, action);
    if (room.game.phase === 'ended') room.status = 'ended';
    broadcast(room);
    scheduleBots(room);
    cb?.(res);
  });

  socket.on('surrender', (_payload, cb) => {
    const room = findRoom(ctx?.code);
    if (!room?.game) return cb?.({ ok: false, error: 'Partida nao iniciada.' });
    const res = surrender(room.game, ctx.playerId);
    if (room.game.phase === 'ended') room.status = 'ended';
    broadcast(room);
    scheduleBots(room);
    cb?.(res);
  });

  // O anfitriao pode passar a vez de quem caiu da conexao.
  socket.on('skipOffline', (_payload, cb) => {
    const room = findRoom(ctx?.code);
    if (!room?.game) return cb?.({ ok: false, error: 'Partida nao iniciada.' });
    if (room.hostId !== ctx.playerId) return cb?.({ ok: false, error: 'Apenas o anfitriao pode pular.' });
    const turnPlayer = current(room.game);
    const member = room.members.get(turnPlayer.id);
    if (member?.online) return cb?.({ ok: false, error: 'O jogador da vez esta conectado.' });
    const res = surrender(room.game, turnPlayer.id);
    if (room.game.phase === 'ended') room.status = 'ended';
    broadcast(room);
    scheduleBots(room);
    cb?.(res);
  });

  socket.on('offerResponse', ({ offerId, accept } = {}, cb) => {
    const room = findRoom(ctx?.code);
    if (!room?.game) return cb?.({ ok: false, error: 'Partida nao iniciada.' });
    const res = respondOffer(room.game, ctx.playerId, offerId, !!accept);
    if (room.game.phase === 'ended') room.status = 'ended';
    broadcast(room);
    scheduleBots(room);
    cb?.(res);
  });

  // Fim de partida: o anfitriao decide entre jogar de novo (mesma mesa) ou voltar ao lobby.
  socket.on('restart', (_payload, cb) => {
    const room = findRoom(ctx?.code);
    if (!room) return cb?.({ ok: false, error: 'Sala invalida.' });
    if (room.hostId !== ctx.playerId) return cb?.({ ok: false, error: 'Apenas o anfitriao reinicia.' });
    if (!room.game) return cb?.({ ok: false, error: 'Nenhuma partida para reiniciar.' });
    const humanos = [...room.members.values()].map((m) => ({ id: m.id, name: m.name, cls: m.cls }));
    const classes = Object.keys(CLASSES);
    const bots = [...room.botIds].map((id, i) => ({
      id,
      name: botNames(room.botIds.size)[i] || `Bot ${i + 1}`,
      cls: classes[Math.floor(Math.random() * classes.length)],
      bot: true,
    }));
    room.game = createGame([...humanos, ...bots]);
    room.status = 'playing';
    broadcast(room);
    scheduleBots(room);
    cb?.({ ok: true });
  });

  socket.on('backToLobby', (_payload, cb) => {
    const room = findRoom(ctx?.code);
    if (!room) return cb?.({ ok: false, error: 'Sala invalida.' });
    if (room.hostId !== ctx.playerId) return cb?.({ ok: false, error: 'Apenas o anfitriao volta ao lobby.' });
    room.game = null;
    room.status = 'lobby';
    room.botLoop = false;
    broadcast(room);
    cb?.({ ok: true });
  });

  socket.on('chat', ({ text } = {}) => {
    const room = findRoom(ctx?.code);
    const member = room?.members.get(ctx?.playerId);
    if (!room || !member) return;
    const clean = String(text || '').trim().slice(0, 160);
    if (!clean) return;
    io.to(room.code).emit('chat', { name: member.name, text: clean, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const room = findRoom(ctx?.code);
    const member = room?.members.get(ctx?.playerId);
    if (!room || !member) return;
    member.online = false;
    broadcast(room);
    if (room.status !== 'lobby') return;
    // No lobby damos um tempo para quem recarregou a pagina voltar antes de liberar a vaga.
    setTimeout(() => {
      const still = rooms.get(room.code);
      const m = still?.members.get(member.id);
      if (!still || !m || m.online) return;
      still.members.delete(m.id);
      if (still.hostId === m.id) still.hostId = [...still.members.keys()][0] || null;
      if (!still.members.size) rooms.delete(still.code);
      else broadcast(still);
    }, LOBBY_GRACE_MS).unref();
  });
});

// Limpeza periodica de salas abandonadas.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyOnline = [...room.members.values()].some((m) => m.online);
    if (!anyOnline && now - room.createdAt > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60_000).unref();

// Sobe o servidor apenas quando o arquivo e executado diretamente (os testes usam porta propria).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`\n  Conquista & Capital no ar!\n`);
    console.log(`  Neste computador:  http://localhost:${PORT}`);
    for (const [nome, infos] of Object.entries(os.networkInterfaces())) {
      for (const info of infos || []) {
        if (info.family === 'IPv4' && !info.internal) {
          console.log(`  Na mesma rede:     http://${info.address}:${PORT}  (${nome} — use no celular)`);
        }
      }
    }
    console.log(`\n  Abra em duas abas (ou no celular) para jogar. Ctrl+C encerra.\n`);
  });
}

export { app, server, io };
