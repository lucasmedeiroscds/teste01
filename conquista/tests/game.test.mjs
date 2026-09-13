import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdjacency, createTiles } from '../src/board.js';
import { act, createGame, publicState, tributeOf } from '../src/game.js';

// rng deterministico: devolve os valores de dado pedidos, na ordem.
const seq = (values) => {
  let i = 0;
  return () => {
    const v = values[Math.min(i++, values.length - 1)];
    return (v - 0.5) / 6;
  };
};
const newGame = () => createGame([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }]);
const landIndex = (s, id) => s.tiles.findIndex((t) => t.id === id);

test('tabuleiro tem 28 casas, 24 territorios e adjacencia simetrica', () => {
  const tiles = createTiles();
  assert.equal(tiles.length, 28);
  assert.equal(tiles.filter((t) => t.type === 'land').length, 24);
  const adj = createAdjacency(tiles);
  for (const [from, set] of adj) {
    for (const to of set) {
      assert.ok(adj.get(to).has(from), `adjacencia nao simetrica entre ${from} e ${to}`);
      assert.notEqual(from, to);
    }
  }
});

test('so o jogador da vez pode agir', () => {
  const s = newGame();
  assert.equal(act(s, 'b', { type: 'roll' }, seq([1, 1])).ok, false);
  assert.equal(act(s, 'a', { type: 'roll' }, seq([2, 3])).ok, true);
});

test('comprar territorio livre desconta dinheiro e registra o dono', () => {
  const s = newGame();
  act(s, 'a', { type: 'roll' }, seq([2, 3])); // 5 casas -> Colombia
  assert.equal(s.pending.kind, 'buy');
  const tile = s.tiles[s.pending.tileId];
  const before = s.players[0].money;
  assert.equal(act(s, 'a', { type: 'buy' }).ok, true);
  assert.equal(tile.ownerId, 'a');
  assert.equal(tile.troops, 1);
  assert.equal(s.players[0].money, before - tile.price);
});

test('cair em territorio inimigo cobra tributo e transfere o dinheiro', () => {
  const s = newGame();
  const idx = 5;
  s.tiles[idx].ownerId = 'b';
  s.tiles[idx].troops = 2;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(s.pending.kind, 'enemy');
  const tribute = tributeOf(s, s.tiles[idx]);
  const [ana, bia] = s.players;
  const anaBefore = ana.money;
  const biaBefore = bia.money;
  assert.equal(act(s, 'a', { type: 'tribute' }).ok, true);
  assert.equal(ana.money, anaBefore - tribute);
  assert.equal(bia.money, biaBefore + tribute);
});

test('nao da para encerrar o turno com invasao pendente', () => {
  const s = newGame();
  s.tiles[5].ownerId = 'b';
  s.tiles[5].troops = 1;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(act(s, 'a', { type: 'endTurn' }).ok, false);
  assert.equal(act(s, 'a', { type: 'skip' }).ok, false);
});

test('ataque vitorioso conquista o territorio e move tropas', () => {
  const s = newGame();
  const target = 5;
  const from = 4; // vizinho no anel
  s.tiles[from].ownerId = 'a';
  s.tiles[from].troops = 5;
  s.tiles[target].ownerId = 'b';
  s.tiles[target].troops = 1;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(s.pending.kind, 'enemy');
  // atacante tira 6,6,6 e defensor 1
  const res = act(s, 'a', { type: 'attack', from }, seq([6, 6, 6, 1]));
  assert.equal(res.ok, true);
  assert.equal(s.tiles[target].ownerId, 'a');
  assert.ok(s.tiles[target].troops >= 1);
  assert.equal(s.tiles[from].troops + s.tiles[target].troops, 5);
  assert.equal(s.pending, null); // conquistou: nao paga tributo
});

test('ataque perdedor mantem o dono e custa tropas ao atacante', () => {
  const s = newGame();
  const target = 5;
  const from = 4;
  s.tiles[from].ownerId = 'a';
  s.tiles[from].troops = 4;
  s.tiles[target].ownerId = 'b';
  s.tiles[target].troops = 3;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  act(s, 'a', { type: 'attack', from }, seq([1, 1, 1, 6, 6]));
  assert.equal(s.tiles[target].ownerId, 'b');
  assert.equal(s.tiles[from].troops, 2);
  assert.equal(s.pending.kind, 'enemy'); // ainda precisa pagar o tributo
});

test('atacar exige fronteira e duas tropas na origem', () => {
  const s = newGame();
  s.tiles[5].ownerId = 'b';
  s.tiles[5].troops = 2;
  s.tiles[4].ownerId = 'a';
  s.tiles[4].troops = 1;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(act(s, 'a', { type: 'attack', from: 4 }).ok, false); // so 1 tropa
  s.tiles[4].troops = 3;
  const distante = s.tiles.findIndex((t) => t.id === 'australia');
  s.tiles[distante].ownerId = 'a';
  s.tiles[distante].troops = 5;
  assert.equal(act(s, 'a', { type: 'attack', from: distante }).ok, false); // sem fronteira
  assert.equal(act(s, 'a', { type: 'attack', from: 4 }, seq([6, 6, 6, 1, 1])).ok, true);
});

test('posicionar reserva consome tropas e recrutar consome dinheiro', () => {
  const s = newGame();
  const idx = landIndex(s, 'brasil');
  s.tiles[idx].ownerId = 'a';
  s.tiles[idx].troops = 1;
  act(s, 'a', { type: 'roll' }, seq([1, 2]));
  const reserve = s.players[0].reserve;
  assert.equal(act(s, 'a', { type: 'deploy', tileId: idx, count: 3 }).ok, true);
  assert.equal(s.players[0].reserve, reserve - 3);
  assert.equal(s.tiles[idx].troops, 4);
  assert.equal(act(s, 'a', { type: 'deploy', tileId: idx, count: 999 }).ok, false);
  const money = s.players[0].money;
  assert.equal(act(s, 'a', { type: 'recruit', count: 2 }).ok, true);
  assert.equal(s.players[0].money, money - 2 * s.config.recruitCost);
});

test('fortaleza aumenta o tributo e tem limite de 3', () => {
  const s = newGame();
  const idx = 5;
  s.tiles[idx].ownerId = 'a';
  s.tiles[idx].troops = 1;
  s.players[0].money = 5000;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(s.pending.kind, 'own');
  const antes = tributeOf(s, s.tiles[idx]);
  act(s, 'a', { type: 'fortify' });
  assert.ok(tributeOf(s, s.tiles[idx]) > antes);
  act(s, 'a', { type: 'fortify' });
  act(s, 'a', { type: 'fortify' });
  assert.equal(s.tiles[idx].forts, 3);
  assert.equal(act(s, 'a', { type: 'fortify' }).ok, false);
});

test('falencia entrega os territorios ao credor e encerra a partida', () => {
  const s = newGame();
  const idx = 5;
  s.tiles[idx].ownerId = 'b';
  s.tiles[idx].troops = 9;
  s.tiles[idx].forts = 3;
  const outro = landIndex(s, 'japao');
  s.tiles[outro].ownerId = 'a';
  s.tiles[outro].troops = 2;
  s.players[0].money = 10;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  act(s, 'a', { type: 'tribute' });
  assert.equal(s.players[0].alive, false);
  assert.equal(s.tiles[outro].ownerId, 'b');
  assert.equal(s.winner.id, 'b');
  assert.equal(s.phase, 'ended');
});

test('dominar 15 territorios vence a partida', () => {
  const s = newGame();
  for (let i = 0; i < 14; i++) {
    const t = s.tiles.filter((x) => x.type === 'land')[i];
    t.ownerId = 'a';
    t.troops = 1;
  }
  const livre = s.tiles.find((t) => t.type === 'land' && !t.ownerId);
  s.players[0].money = 5000;
  s.players[0].pos = livre.index - 5;
  act(s, 'a', { type: 'roll' }, seq([2, 3]));
  assert.equal(s.pending.kind, 'buy');
  act(s, 'a', { type: 'buy' });
  assert.equal(s.winner.id, 'a');
});

test('dupla joga de novo e o turno passa ao proximo jogador', () => {
  const s = newGame();
  act(s, 'a', { type: 'roll' }, seq([3, 3]));
  act(s, 'a', { type: 'skip' });
  act(s, 'a', { type: 'endTurn' });
  assert.equal(s.phase, 'roll');
  assert.equal(s.players[s.turn].id, 'a'); // dupla: joga outra vez
  act(s, 'a', { type: 'roll' }, seq([2, 5]));
  act(s, 'a', { type: 'skip' });
  act(s, 'a', { type: 'endTurn' });
  assert.equal(s.players[s.turn].id, 'b');
});

test('inicio de turno paga renda e bonus de continente', () => {
  const s = newGame();
  for (const t of s.tiles.filter((x) => x.cont === 'oc')) {
    t.ownerId = 'b';
    t.troops = 1;
  }
  const bia = s.players[1];
  const money = bia.money;
  const reserve = bia.reserve;
  act(s, 'a', { type: 'roll' }, seq([2, 5]));
  act(s, 'a', { type: 'skip' });
  act(s, 'a', { type: 'endTurn' });
  assert.ok(bia.money > money + 100, 'recebeu renda + bonus do continente');
  assert.ok(bia.reserve > reserve + 3);
});

test('publicState e serializavel e esconde nada essencial', () => {
  const s = newGame();
  const view = publicState(s);
  assert.equal(JSON.parse(JSON.stringify(view)).tiles.length, 28);
  assert.equal(view.players.length, 2);
  assert.ok(Array.isArray(view.adjacency['1']));
});
