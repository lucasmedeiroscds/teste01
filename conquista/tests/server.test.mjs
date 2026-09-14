import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as client } from 'socket.io-client';
import { server } from '../server.js';

const connect = (port) => client(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
const emit = (sock, event, payload) =>
  new Promise((resolve) => sock.emit(event, payload, resolve));

test('fluxo completo de sala: criar, entrar, iniciar e jogar', async (t) => {
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const host = connect(port);
  const guest = connect(port);
  t.after(() => { host.close(); guest.close(); server.close(); });

  const created = await emit(host, 'createRoom', { name: 'Ana' });
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-Z0-9]{4}$/);

  assert.equal((await emit(guest, 'joinRoom', { code: 'ZZZZ', name: 'Bia' })).ok, false);
  assert.equal((await emit(guest, 'joinRoom', { code: created.code, name: 'Bia' })).ok, true);

  // Cada jogador escolhe sua classe antes do inicio.
  assert.equal((await emit(guest, 'setClass', { cls: 'religiosa' })).ok, true);
  assert.equal((await emit(guest, 'setClass', { cls: 'astronauta' })).ok, false);
  assert.equal((await emit(host, 'setClass', { cls: 'politico' })).ok, true);

  // Convidado nao pode iniciar; anfitriao pode.
  assert.equal((await emit(guest, 'start')).ok, false);
  const roomPromise = once(host, 'room');
  assert.equal((await emit(host, 'start')).ok, true);
  let view = (await roomPromise)[0];
  while (!view.game) view = (await once(host, 'room'))[0];
  assert.equal(view.status, 'playing');
  assert.equal(view.game.players.length, 2);
  assert.equal(view.game.countries.length, 60);
  assert.deepEqual(view.game.players.map((p) => p.cls).sort(), ['politico', 'religiosa']);
  assert.equal(view.game.players.filter((p) => p.lands === 1).length, 2, 'cada um comeca com um pais');

  // Apenas o jogador da vez consegue rolar os dados.
  const currentId = view.game.currentId;
  const hostId = view.members[0].id;
  const [turnSock, otherSock] = currentId === hostId ? [host, guest] : [guest, host];
  assert.equal((await emit(otherSock, 'action', { type: 'roll' })).ok, false);
  assert.equal((await emit(turnSock, 'action', { type: 'roll' })).ok, true);

  const after = (await emit(turnSock, 'action', { type: 'roll' }));
  assert.equal(after.ok, false, 'nao rola duas vezes na mesma fase');
});

test('reconexao devolve o jogador para a mesma sala', async (t) => {
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const host = connect(port);
  t.after(() => { host.close(); server.close(); });

  const joinedPromise = once(host, 'joined');
  await emit(host, 'createRoom', { name: 'Ana' });
  const joined = (await joinedPromise)[0];
  host.close();

  const again = connect(port);
  t.after(() => again.close());
  const res = await emit(again, 'rejoin', { code: joined.code, playerId: joined.playerId, token: joined.token });
  assert.equal(res.ok, true);
  const bad = await emit(again, 'rejoin', { code: joined.code, playerId: joined.playerId, token: 'errado' });
  assert.equal(bad.ok, false);
});

test('partida solo: um humano mais bots, e os bots jogam sozinhos', async (t) => {
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const host = connect(port);
  t.after(() => { host.close(); server.close(); });

  // Guarda sempre o ultimo estado recebido (o servidor manda um pacote por jogador).
  let ultimo = null;
  host.on('room', (v) => { ultimo = v; });

  const criada = await emit(host, 'createRoom', { name: 'Ana' });
  assert.equal(criada.ok, true);
  // Sozinho e sem bots nao da para comecar.
  assert.equal((await emit(host, 'start')).ok, false);
  assert.equal((await emit(host, 'setBots', { count: 2 })).ok, true);
  assert.equal((await emit(host, 'start')).ok, true);

  const espera = async (condicao, ms = 15_000) => {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      if (ultimo && condicao(ultimo)) return ultimo;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };

  const view = await espera((v) => v.game);
  assert.ok(view, 'a partida comecou');
  assert.equal(view.game.players.length, 3, 'um humano e dois bots');
  assert.equal(view.botIds.length, 2);
  assert.equal(view.game.players.filter((p) => view.botIds.includes(p.id)).length, 2);

  // O humano encerra o turno; dali em diante os bots jogam sozinhos.
  const meuId = view.game.players.find((p) => !view.botIds.includes(p.id)).id;
  if (view.game.currentId === meuId) {
    await emit(host, 'action', { type: 'roll' });
    await emit(host, 'action', { type: 'stop' });
    if (ultimo.game.pending?.kind === 'enemy') await emit(host, 'action', { type: 'tribute' });
    else await emit(host, 'action', { type: 'skip' });
    await emit(host, 'action', { type: 'endTurn' });
  }
  const linhas = ultimo.game.log.length;
  const mexeu = await espera((v) => v.game.log.length > linhas + 1);
  assert.ok(mexeu, 'os bots jogaram sem intervencao humana');
});
