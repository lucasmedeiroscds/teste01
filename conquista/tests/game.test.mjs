import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_COUNTRIES } from '../src/map.js';
import { COUNTRIES, incomeForRank } from '../src/countries.js';
import { CLASSES, act, createGame, incomeOf, neighborsOf, netWorth, publicState, taxFor, tributeOf } from '../src/game.js';

// rng deterministico: devolve os valores de dado pedidos, na ordem.
const seq = (values) => {
  let i = 0;
  return () => {
    const v = values[Math.min(i++, values.length - 1)];
    return (v - 0.5) / 6;
  };
};
const fixedRng = (v) => () => v;

const newGame = (opts = {}, rng = fixedRng(0.01)) => createGame(
  [{ id: 'a', name: 'Ana', cls: 'empresario' }, { id: 'b', name: 'Bia', cls: 'politico' }],
  opts,
  rng,
);
const country = (s, id) => s.countries.find((c) => c.id === id);
const give = (s, id, playerId, troops = 1) => {
  const c = country(s, id);
  c.ownerId = playerId;
  c.troops = troops;
  return c;
};
/** Passa a vez do jogador atual sem interferir no tabuleiro. */
const passTurn = (s, rng = seq([1])) => {
  const id = s.players[s.turn].id;
  act(s, id, { type: 'roll' }, rng);
  act(s, id, { type: 'stop' });
  if (s.pending?.kind === 'enemy') act(s, id, { type: 'tribute' });
  else act(s, id, { type: 'skip' });
  act(s, id, { type: 'endTurn' });
};

test('mapa tem 60 paises conectados e vizinhanca simetrica', () => {
  assert.equal(MAP_COUNTRIES.length, 60);
  assert.equal(COUNTRIES.length, 60);
  const ids = new Set(MAP_COUNTRIES.map((c) => c.id));
  for (const c of MAP_COUNTRIES) {
    assert.ok(c.neighbors.length >= 1, `${c.id} sem vizinhos`);
    for (const n of c.neighbors) {
      assert.ok(ids.has(n), `vizinho desconhecido: ${n}`);
      assert.ok(MAP_COUNTRIES.find((x) => x.id === n).neighbors.includes(c.id), `assimetria ${c.id}-${n}`);
    }
    assert.ok(c.path.startsWith('M'), `${c.id} sem geometria`);
  }
});

test('renda por rodada segue o ranking de produtividade (400 a 100)', () => {
  assert.equal(incomeForRank(1), 400);
  assert.equal(incomeForRank(60), 100);
  const first = MAP_COUNTRIES.find((c) => c.rank === 1);
  const last = MAP_COUNTRIES.find((c) => c.rank === 60);
  assert.equal(first.income, 400);
  assert.equal(last.income, 100);
  for (const c of MAP_COUNTRIES) {
    assert.ok(c.income >= 100 && c.income <= 400, `${c.id} fora da escala`);
  }
});

test('cada jogador comeca com um pais proprio e diferente', () => {
  const s = newGame({}, Math.random);
  const homes = s.players.map((p) => p.pos);
  assert.equal(new Set(homes).size, s.players.length);
  for (const p of s.players) {
    const home = country(s, p.pos);
    assert.equal(home.ownerId, p.id);
    assert.ok(home.troops > 0);
    assert.equal(incomeOf(s, p.id), home.income);
  }
});

test('so o jogador da vez pode agir e o movimento respeita as fronteiras', () => {
  const s = newGame();
  assert.equal(act(s, 'b', { type: 'roll' }).ok, false);
  assert.equal(act(s, 'a', { type: 'roll' }, seq([3])).ok, true);
  assert.equal(s.moves, 3);
  const longe = s.countries.find((c) => !neighborsOf(s.players[0].pos).includes(c.id) && c.id !== s.players[0].pos);
  assert.equal(act(s, 'a', { type: 'move', to: longe.id }).ok, false);
  const vizinho = neighborsOf(s.players[0].pos)[0];
  assert.equal(act(s, 'a', { type: 'move', to: vizinho }).ok, true);
  assert.equal(s.players[0].pos, vizinho);
  assert.equal(s.moves, 2);
});

test('parar em pais livre permite comprar; o ouro e descontado', () => {
  const s = newGame();
  act(s, 'a', { type: 'roll' }, seq([2]));
  const alvo = neighborsOf(s.players[0].pos).find((id) => !country(s, id).ownerId);
  act(s, 'a', { type: 'move', to: alvo });
  act(s, 'a', { type: 'stop' });
  assert.equal(s.pending.kind, 'buy');
  const c = country(s, alvo);
  const antes = s.players[0].gold;
  s.players[0].gold = c.price;
  assert.equal(act(s, 'a', { type: 'buy' }).ok, true);
  assert.equal(c.ownerId, 'a');
  assert.equal(s.players[0].gold, 0);
  assert.ok(antes > 0);
  assert.equal(incomeOf(s, 'a'), country(s, s.players[0].homeId).income + c.income);
});

test('industrias custam, rendem e tem limite por pais', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  s.players[0].gold = 10_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  const rendaAntes = incomeOf(s, 'a');
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'small' }).ok, true);
  assert.equal(incomeOf(s, 'a'), rendaAntes + 35);
  assert.equal(s.players[0].gold, 10_000 - 230);
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'large' }).ok, true);
  assert.equal(incomeOf(s, 'a'), rendaAntes + 35 + 75);
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'large' }).ok, true);
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'large' }).ok, false, 'limite de industrias grandes');
  const alheio = s.countries.find((c) => c.ownerId === 'b');
  assert.equal(act(s, 'a', { type: 'build', countryId: alheio.id, size: 'small' }).ok, false);
});

test('parar em pais inimigo cobra tributo (industrias e tropas somam)', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  const alvoId = neighborsOf(home.id)[0];
  const alvo = give(s, alvoId, 'b', 3);
  alvo.small = 1;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'move', to: alvoId });
  assert.equal(s.pending.kind, 'enemy');
  const tributo = tributeOf(s, alvo);
  assert.equal(tributo, Math.round(alvo.income / 4 + 30 + 3 * 10));
  const [ana, bia] = s.players;
  const ouroAna = ana.gold;
  const ouroBia = bia.gold;
  assert.equal(act(s, 'a', { type: 'endTurn' }).ok, false, 'precisa resolver antes de encerrar');
  assert.equal(act(s, 'a', { type: 'tribute' }).ok, true);
  assert.equal(ana.gold, ouroAna - tributo);
  assert.equal(bia.gold, ouroBia + tributo);
});

test('guerra: vitoria toma o pais com as industrias, derrota custa tropas', () => {
  const s = newGame();
  const home = give(s, s.players[0].homeId, 'a', 6);
  const alvoId = neighborsOf(home.id)[0];
  const alvo = give(s, alvoId, 'b', 1);
  alvo.large = 1;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'move', to: alvoId });
  assert.equal(act(s, 'a', { type: 'attack', from: home.id }, seq([6, 6, 6, 1])).ok, true);
  assert.equal(alvo.ownerId, 'a');
  assert.equal(alvo.large, 1, 'industrias vao junto com o pais');
  assert.equal(home.troops + alvo.troops, 6);
  assert.equal(s.pending, null);

  const s2 = newGame();
  const base = give(s2, s2.players[0].homeId, 'a', 4);
  const inimigoId = neighborsOf(base.id)[0];
  give(s2, inimigoId, 'b', 3);
  act(s2, 'a', { type: 'roll' }, seq([1]));
  act(s2, 'a', { type: 'move', to: inimigoId });
  act(s2, 'a', { type: 'attack', from: base.id }, seq([1, 1, 1, 6, 6]));
  assert.equal(country(s2, inimigoId).ownerId, 'b');
  assert.equal(base.troops, 2);
  assert.equal(s2.pending.kind, 'enemy', 'ainda deve o tributo');
});

test('emprestimo: so a partir da rodada 5, teto de 600 e um por vez', () => {
  const s = newGame();
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(act(s, 'a', { type: 'loan', amount: 300 }).ok, false, 'cedo demais');
  s.round = 5;
  const antes = s.players[0].gold;
  assert.equal(act(s, 'a', { type: 'loan', amount: 5000 }).ok, true);
  assert.equal(s.players[0].gold, antes + 600, 'teto de 600');
  assert.equal(s.players[0].loan.debt, 720, '20% de juros na contratacao');
  assert.equal(act(s, 'a', { type: 'loan', amount: 100 }).ok, false, 'ja tem emprestimo aberto');
  s.players[0].gold = 1000;
  assert.equal(act(s, 'a', { type: 'repay', amount: 720 }).ok, true);
  assert.equal(s.players[0].loan, null);
  assert.equal(act(s, 'a', { type: 'loan', amount: 100 }).ok, true, 'quitou, pode pegar outro');
});

test('inflacao tira 2% do caixa de todos a cada 2 rodadas', () => {
  const s = newGame();
  for (const p of s.players) p.gold = 1000;
  const rendaA = incomeOf(s, 'a');
  const rendaB = incomeOf(s, 'b');
  passTurn(s); // Ana
  passTurn(s); // Bia -> comeca a rodada 2, inflacao
  assert.equal(s.round, 2);
  // Ana: 1000 -2% -> 980, mais a renda do inicio do turno dela.
  assert.equal(s.players[0].gold, 980 + rendaA);
  assert.equal(s.players[1].gold, Math.round((1000 + rendaB) * 0.98));
});

test('imposto do banco cobra 20% na rodada 13 e o empresario paga 10% a menos', () => {
  const s = newGame();
  s.round = 12;
  s.turn = 1; // proximo passe fecha a rodada 12 e abre a 13
  for (const p of s.players) p.gold = 1000;
  assert.equal(taxFor(s, s.players[0], 200), 180, 'Lavei, sumi: empresario paga 10% menos');
  assert.equal(taxFor(s, s.players[1], 200), 200);
  passTurn(s);
  assert.equal(s.round, 13);
  const rendaA = incomeOf(s, 'a');
  // Rodada 13 e impar: nao tem inflacao, so o imposto. Ana (empresaria) paga 18% em vez de 20%.
  assert.equal(s.players[0].gold, 1000 - 180 + rendaA, 'empresario paga 18%');
  assert.equal(s.players[1].gold, 1000 - 200, 'os demais pagam 20%');
});

test('Meu pedaco paga 10% do patrimonio do politico a cada 4 rodadas', () => {
  const s = newGame();
  s.round = 3;
  s.turn = 1;
  const bia = s.players[1];
  bia.gold = 1000;
  const esperado = Math.round(netWorth(s, bia) * 0.1);
  passTurn(s);
  assert.equal(s.round, 4);
  assert.ok(esperado > 0);
  assert.ok(bia.gold > 1000, 'politico recebeu o proprio pedaco');
});

test('Dizimo recolhe 10% do patrimonio dos adversarios a cada 8 rodadas', () => {
  const s = createGame(
    [{ id: 'a', name: 'Ana', cls: 'religiosa' }, { id: 'b', name: 'Bia', cls: 'empresario' }],
    {},
    fixedRng(0.01),
  );
  s.round = 7;
  s.turn = 1;
  const [ana, bia] = s.players;
  bia.gold = 2000;
  const ouroAna = ana.gold;
  passTurn(s);
  assert.equal(s.round, 8);
  // A rodada 8 tem inflacao (2%) e dizimo (10% do patrimonio, tirado do caixa).
  const inflacao = Math.round(2000 * 0.02);
  const dizimo = 2000 - inflacao - bia.gold;
  assert.ok(dizimo > 0, 'a empresaria pagou o dizimo');
  assert.equal(ana.gold, ouroAna - Math.round(ouroAna * 0.02) + dizimo + incomeOf(s, 'a'));
});

test('dominar 20 paises vence a partida', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  const alvoId = neighborsOf(home.id).find((id) => !country(s, id).ownerId);
  const livres = s.countries.filter((c) => !c.ownerId && c.id !== alvoId).slice(0, 18);
  for (const c of livres) { c.ownerId = 'a'; c.troops = 1; }
  s.players[0].gold = 5000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'move', to: alvoId });
  act(s, 'a', { type: 'buy' });
  assert.equal(s.winner?.id, 'a');
  assert.equal(s.phase, 'ended');
});

test('publicState e serializavel e traz classes, renda e divida', () => {
  const s = newGame();
  s.round = 5;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'loan', amount: 200 });
  const view = JSON.parse(JSON.stringify(publicState(s)));
  assert.equal(view.countries.length, 60);
  assert.equal(view.players[0].className, CLASSES.empresario.name);
  assert.equal(view.players[0].ability, 'Lavei, sumi');
  assert.equal(view.players[0].loan.debt, 240);
  assert.ok(view.players[0].income > 0);
});

test('da para atacar qualquer fronteira sua durante o turno, sem precisar desembarcar', () => {
  const s = newGame();
  const base = give(s, s.players[0].homeId, 'a', 8);
  const alvoId = neighborsOf(base.id)[0];
  const alvo = give(s, alvoId, 'b', 1);
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(s.pending, null, 'ainda nao desembarcou em lugar nenhum');
  assert.equal(act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([6, 6, 6, 1])).ok, true);
  assert.equal(alvo.ownerId, 'a');
  // fora do turno continua proibido
  assert.equal(act(s, 'b', { type: 'attack', from: alvoId, to: base.id }).ok, false);
});

test('teto de industrias por pais soma pequenas e grandes', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  s.players[0].gold = 50_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'small' }).ok, true);
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'small' }).ok, true);
  assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'small' }).ok, true);
  assert.equal(home.small + home.large, s.config.maxFactoriesPerCountry);
  const bloqueada = act(s, 'a', { type: 'build', countryId: home.id, size: 'large' });
  assert.equal(bloqueada.ok, false);
  assert.match(bloqueada.error, /teto por pais/);
  // O ganho maximo de um pais fica limitado a 3 industrias (185 com 1 pequena + 2 grandes).
  const outro = s.countries.find((c) => !c.ownerId);
  outro.ownerId = 'a';
  outro.troops = 1;
  act(s, 'a', { type: 'build', countryId: outro.id, size: 'large' });
  act(s, 'a', { type: 'build', countryId: outro.id, size: 'large' });
  act(s, 'a', { type: 'build', countryId: outro.id, size: 'small' });
  assert.equal(act(s, 'a', { type: 'build', countryId: outro.id, size: 'small' }).ok, false);
  assert.equal(incomeOf(s, 'a') - home.income - outro.income, 3 * 35 + 2 * 75 + 35);
});
