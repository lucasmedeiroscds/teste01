import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_COUNTRIES } from '../src/map.js';
import { CONTINENTS, COUNTRIES, countriesOfContinent, incomeForRank } from '../src/countries.js';
import { MISSIONS } from '../src/missions.js';
import { EVENT_CARDS } from '../src/cards.js';
import {
  CLASSES, act, applyCard, attackBonus, bankOffer, createGame, incomeOf, marketValue, neighborsOf,
  netWorth, publicState, reinforcementsFor, respondOffer, taxFor, taxRateFor, tributeOf, upkeepOf,
} from '../src/game.js';

// rng deterministico: devolve os valores de dado pedidos, na ordem.
const seq = (values, faces = 6) => {
  let i = 0;
  return () => {
    const v = values[Math.min(i++, values.length - 1)];
    return (v - 0.5) / faces;
  };
};
const fixed = (v) => () => v;

const newGame = (opts = {}, rng = fixed(0.01)) => createGame(
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
const passTurn = (s, rng = seq([1])) => {
  const id = s.players[s.turn].id;
  act(s, id, { type: 'roll' }, rng);
  act(s, id, { type: 'stop' });
  if (s.pending?.kind === 'enemy') act(s, id, { type: 'tribute' });
  else act(s, id, { type: 'skip' });
  act(s, id, { type: 'endTurn' }, rng);
};

test('mapa: 60 paises, continentes completos e vizinhanca simetrica', () => {
  assert.equal(MAP_COUNTRIES.length, 60);
  assert.equal(COUNTRIES.filter((c) => !CONTINENTS[c.cont]).length, 0);
  assert.equal(
    Object.keys(CONTINENTS).reduce((a, k) => a + countriesOfContinent(k).length, 0),
    60,
  );
  const ids = new Set(MAP_COUNTRIES.map((c) => c.id));
  for (const c of MAP_COUNTRIES) {
    for (const n of c.neighbors) {
      assert.ok(ids.has(n));
      assert.ok(MAP_COUNTRIES.find((x) => x.id === n).neighbors.includes(c.id));
    }
  }
});

test('renda por rodada segue o ranking de produtividade (400 a 100)', () => {
  assert.equal(incomeForRank(1), 400);
  assert.equal(incomeForRank(60), 100);
  for (const c of MAP_COUNTRIES) assert.ok(c.income >= 100 && c.income <= 400);
});

test('cada jogador comeca com pais, missao secreta e dois continentes sorteados', () => {
  const s = newGame({}, Math.random);
  assert.equal(new Set(s.players.map((p) => p.pos)).size, s.players.length);
  assert.equal(new Set(s.players.map((p) => p.mission.id)).size, s.players.length);
  for (const p of s.players) {
    assert.equal(country(s, p.pos).ownerId, p.id);
    assert.equal(p.mission.continentes.length, 2);
    const tamanho = p.mission.continentes.reduce((a, k) => a + countriesOfContinent(k).length, 0);
    assert.ok(tamanho >= 8 && tamanho <= 16, `objetivo desbalanceado: ${tamanho} paises`);
  }
});

test('as 50 missoes tem texto e check que roda sem quebrar', () => {
  assert.equal(MISSIONS.length, 50);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, 50);
  const s = newGame();
  // Dando o mundo inteiro para Ana, muitas missoes passam; nenhuma pode lancar erro.
  for (const c of s.countries) { c.ownerId = 'a'; c.troops = 20; c.small = 3; }
  s.players[0].gold = 999_999;
  s.players[0].conquistas = 20;
  s.players[0].eliminados = 5;
  const view = publicState(s, 'a');
  assert.ok(view.players[0].mission);
  let cumpridas = 0;
  for (const m of MISSIONS) {
    assert.ok(m.titulo && m.texto, `missao ${m.id} sem texto`);
    const ctxOk = typeof m.check === 'function';
    assert.ok(ctxOk);
  }
  // roda todos os checks contra um estado real (via a checagem de vitoria)
  for (const m of MISSIONS) {
    s.players[0].mission = { ...s.players[0].mission, id: m.id, titulo: m.titulo, texto: m.texto };
    s.winner = null;
    s.phase = 'action';
    act(s, 'a', { type: 'skip' });
    if (s.winner) cumpridas++;
  }
  assert.ok(cumpridas > 30, `esperava a maioria das missoes cumprida com o mundo todo (${cumpridas})`);
});

test('so o jogador da vez age e o movimento respeita fronteiras', () => {
  const s = newGame();
  assert.equal(act(s, 'b', { type: 'roll' }).ok, false);
  assert.equal(act(s, 'a', { type: 'roll' }, seq([3])).ok, true);
  assert.equal(s.moves, 3);
  const longe = s.countries.find((c) => !neighborsOf(s.players[0].pos).includes(c.id) && c.id !== s.players[0].pos);
  assert.equal(act(s, 'a', { type: 'move', to: longe.id }).ok, false);
  assert.equal(act(s, 'a', { type: 'move', to: neighborsOf(s.players[0].pos)[0] }).ok, true);
});

test('industrias rendem mas cobram 20% de manutencao por rodada', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  s.players[0].gold = 10_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  const liquidoAntes = incomeOf(s, 'a');
  act(s, 'a', { type: 'build', countryId: home.id, size: 'small' });
  assert.equal(upkeepOf(s, 'a'), 7, '20% de 35');
  assert.equal(incomeOf(s, 'a'), liquidoAntes + 35 - 7);
  act(s, 'a', { type: 'build', countryId: home.id, size: 'large' });
  assert.equal(upkeepOf(s, 'a'), 7 + 15);
  assert.equal(incomeOf(s, 'a'), liquidoAntes + 35 + 75 - 22);
});

test('teto de 3 industrias por pais somando pequenas e grandes', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  s.players[0].gold = 50_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  for (let i = 0; i < 3; i++) assert.equal(act(s, 'a', { type: 'build', countryId: home.id, size: 'small' }).ok, true);
  const bloqueada = act(s, 'a', { type: 'build', countryId: home.id, size: 'large' });
  assert.equal(bloqueada.ok, false);
  assert.match(bloqueada.error, /teto por pais/);
});

test('parar em pais inimigo cobra tributo', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  const alvoId = neighborsOf(home.id)[0];
  const alvo = give(s, alvoId, 'b', 3);
  alvo.small = 1;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'move', to: alvoId });
  const tributo = tributeOf(s, alvo);
  assert.equal(tributo, Math.round(alvo.income / 4 + 30 + 3 * 10));
  const [ana, bia] = s.players;
  const ouroAna = ana.gold;
  const ouroBia = bia.gold;
  assert.equal(act(s, 'a', { type: 'endTurn' }).ok, false);
  assert.equal(act(s, 'a', { type: 'tribute' }).ok, true);
  assert.equal(ana.gold, ouroAna - tributo);
  assert.equal(bia.gold, ouroBia + tributo);
});

test('combate: 1d12 de cada lado, maior leva o pais e metade das tropas marcha', () => {
  const s = newGame();
  const base = give(s, s.players[0].homeId, 'a', 8);
  const alvoId = neighborsOf(base.id)[0];
  const alvo = give(s, alvoId, 'b', 6);
  act(s, 'a', { type: 'roll' }, seq([1]));
  // atacante tira 11, defensor 4
  assert.equal(act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([11, 4], 12)).ok, true);
  assert.equal(alvo.ownerId, 'a');
  assert.equal(alvo.troops, 4, 'metade das 8 tropas marchou');
  assert.equal(base.troops, 4);
  assert.equal(s.combat.attDie, 11);
  assert.equal(s.combat.defDie, 4);
});

test('combate: empate defende e o atacante perde uma tropa', () => {
  const s = newGame();
  const base = give(s, s.players[0].homeId, 'a', 5);
  const alvoId = neighborsOf(base.id)[0];
  const alvo = give(s, alvoId, 'b', 2);
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([7, 7], 12));
  assert.equal(alvo.ownerId, 'b');
  assert.equal(base.troops, 4);
  assert.equal(act(s, 'a', { type: 'attack', from: alvoId, to: base.id }).ok, false, 'origem precisa ser sua');
});

test('laranjao soma +1 no dado ao invadir', () => {
  const s = createGame(
    [{ id: 'a', name: 'Ana', cls: 'laranjao' }, { id: 'b', name: 'Bia', cls: 'politico' }],
    {},
    fixed(0.01),
  );
  assert.equal(CLASSES.laranjao.ability, 'Testa de ferro');
  assert.equal(attackBonus(s, s.players[0]), 1);
  assert.equal(attackBonus(s, s.players[1]), 0);
  const base = give(s, s.players[0].homeId, 'a', 4);
  const alvoId = neighborsOf(base.id)[0];
  const alvo = give(s, alvoId, 'b', 3);
  act(s, 'a', { type: 'roll' }, seq([1]));
  // 7+1 = 8 contra 7: o bonus decide
  act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([7, 7], 12));
  assert.equal(alvo.ownerId, 'a');
  assert.equal(s.combat.bonus, 1);
  assert.equal(s.combat.attTotal, 8);
});

test('reforcos no estilo War: paises/2 (minimo 3) + bonus de continente', () => {
  const s = newGame();
  assert.deepEqual(reinforcementsFor(s, 'a'), { base: 3, bonus: 0, total: 3 });
  for (const id of countriesOfContinent('oc')) give(s, id, 'a', 1);
  const oito = s.countries.filter((c) => !c.ownerId).slice(0, 6);
  for (const c of oito) { c.ownerId = 'a'; c.troops = 1; }
  const r = reinforcementsFor(s, 'a');
  assert.equal(r.bonus, CONTINENTS.oc.bonus);
  assert.equal(r.base, Math.max(3, Math.floor((3 + 6 + 1) / 2)));
  assert.equal(r.total, r.base + r.bonus);
});

test('imposto tem aliquota progressiva pelo patrimonio e desconto do empresario', () => {
  const s = newGame();
  const [ana, bia] = s.players;
  ana.gold = 1000;
  bia.gold = 1000;
  assert.equal(taxRateFor(s, ana), 0.1, 'patrimonio pequeno, faixa de 10%');
  assert.equal(taxFor(s, ana), Math.round(1000 * 0.1 * 0.9), 'empresario paga 10% a menos');
  assert.equal(taxFor(s, bia), 100);
  ana.gold = 60_000;
  assert.equal(taxRateFor(s, ana), 0.25, 'patrimonio alto, faixa maior');
  assert.equal(taxFor(s, ana), Math.round(60_000 * 0.25 * 0.9));
  ana.taxFree = true;
  assert.equal(taxFor(s, ana), 0, 'isencao da carta de evento');
});

test('inflacao come 2% do caixa a cada 2 rodadas', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  for (const p of s.players) p.gold = 1000;
  const rendaA = incomeOf(s, 'a');
  passTurn(s);
  passTurn(s);
  assert.equal(s.round, 2);
  assert.equal(s.players[0].gold, 980 + rendaA);
});

test('Dizimo recolhe o patrimonio dos outros na rodada 8', () => {
  const s = createGame(
    [{ id: 'a', name: 'Ana', cls: 'religiosa' }, { id: 'b', name: 'Bia', cls: 'empresario' }],
    { eventWindow: 999 },
    fixed(0.01),
  );
  s.nextEventRound = 999;
  s.round = 7;
  s.turn = 1;
  const [ana, bia] = s.players;
  bia.gold = 2000;
  const ouroAna = ana.gold;
  passTurn(s);
  assert.equal(s.round, 8);
  const inflacao = Math.round(2000 * 0.02);
  const dizimo = 2000 - inflacao - bia.gold;
  assert.ok(dizimo > 0, 'dizimo recolhido');
  assert.equal(ana.gold, ouroAna - Math.round(ouroAna * 0.02) + dizimo + incomeOf(s, 'a'));
});

test('Meu pedaco paga 10% do patrimonio do politico a cada 4 rodadas', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  s.round = 3;
  s.turn = 1;
  const bia = s.players[1]; // politica
  bia.gold = 1000;
  passTurn(s);
  assert.equal(s.round, 4);
  // Na virada da rodada 4 ela leva 2% de inflacao e depois 10% do proprio patrimonio.
  assert.ok(s.log.some((l) => l.text.includes('Meu pedaco')), 'habilidade disparou');
  assert.ok(bia.gold > 980, `esperava ganho acima da inflacao, veio ${bia.gold}`);
});

test('emprestimo: rodada 5, teto 600 e um por vez', () => {
  const s = newGame();
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(act(s, 'a', { type: 'loan', amount: 300 }).ok, false);
  s.round = 5;
  const antes = s.players[0].gold;
  assert.equal(act(s, 'a', { type: 'loan', amount: 5000 }).ok, true);
  assert.equal(s.players[0].gold, antes + 600);
  assert.equal(s.players[0].loan.debt, 780, '30% de juros');
  assert.equal(act(s, 'a', { type: 'loan', amount: 100 }).ok, false);
});

test('quem fica sem nenhum pais e eliminado', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  const base = give(s, s.players[0].homeId, 'a', 6);
  const unicoDaBia = s.countries.find((c) => c.ownerId === 'b');
  unicoDaBia.ownerId = null;
  unicoDaBia.troops = 0;
  const alvoId = neighborsOf(base.id)[0];
  give(s, alvoId, 'b', 1); // agora a Bia so tem esse pais
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([12, 1], 12));
  assert.equal(s.players[1].alive, false, 'perdeu o ultimo pais');
  assert.equal(s.winner?.id, 'a');
});

test('vitoria por missao cumprida', () => {
  const s = newGame({ eventWindow: 999 });
  const missao = MISSIONS.find((m) => m.id === 'm01'); // 16 paises
  s.players[0].mission = { ...s.players[0].mission, id: missao.id, titulo: missao.titulo, texto: missao.texto };
  const livres = s.countries.filter((c) => !c.ownerId).slice(0, 14);
  for (const c of livres) { c.ownerId = 'a'; c.troops = 1; }
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(s.winner, null, '15 paises ainda nao bastam');
  const maisUm = s.countries.find((c) => !c.ownerId);
  maisUm.ownerId = 'a';
  maisUm.troops = 1;
  act(s, 'a', { type: 'skip' });
  assert.equal(s.winner?.id, 'a');
  assert.match(s.winner.reason, /Cumpriu a missao/);
});

test('vitoria por conquistar os dois continentes da carta', () => {
  const s = newGame({ eventWindow: 999 });
  const missaoImpossivel = MISSIONS.find((m) => m.id === 'm47'); // bloco de 9 vizinhos
  s.players[0].mission = {
    id: missaoImpossivel.id,
    titulo: missaoImpossivel.titulo,
    texto: missaoImpossivel.texto,
    continentes: ['na', 'oc'],
  };
  for (const id of [...countriesOfContinent('na'), ...countriesOfContinent('oc')]) give(s, id, 'a', 1);
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'skip' });
  assert.equal(s.winner?.id, 'a');
  assert.match(s.winner.reason, /America do Norte e Oceania/);
});

test('cartas de evento: 40 cartas, sorteio dentro da janela e efeito aplicado', () => {
  assert.equal(EVENT_CARDS.length, 40);
  assert.equal(new Set(EVENT_CARDS.map((c) => c.id)).size, 40);
  for (const c of EVENT_CARDS) assert.ok(c.titulo && c.texto && (c.tipo === 'buff' || c.tipo === 'debuff'));

  const s = newGame({ eventWindow: 999 });
  const ana = s.players[0];
  ana.gold = 1000;
  applyCard(s, ana, EVENT_CARDS.find((c) => c.id === 'e01')); // +600
  assert.equal(ana.gold, 1600);
  applyCard(s, ana, EVENT_CARDS.find((c) => c.id === 'e22')); // -15% do caixa
  assert.equal(ana.gold, 1600 - Math.round(1600 * 0.15));
  ana.loan = { principal: 500, debt: 600, takenAt: 1 };
  applyCard(s, ana, EVENT_CARDS.find((c) => c.id === 'e05')); // perdoa divida
  assert.equal(ana.loan, null);
  applyCard(s, ana, EVENT_CARDS.find((c) => c.id === 'e09')); // +2 no dado por 2 rodadas
  assert.equal(attackBonus(s, ana), 2);
  assert.ok(ana.card.resumo.length > 0);

  // a leva de cartas cai em alguma rodada da janela e atinge todo mundo
  const s2 = newGame({ eventWindow: 3 }, Math.random);
  s2.nextEventRound = 2;
  for (let i = 0; i < 6; i++) passTurn(s2);
  assert.ok(s2.players.every((p) => p.card), 'todos compraram carta');
  assert.ok(s2.nextEventRound > s2.round, 'proxima leva reagendada');
});

test('publicState esconde a missao e a carta dos adversarios', () => {
  const s = newGame();
  applyCard(s, s.players[1], EVENT_CARDS[0]);
  const viewA = JSON.parse(JSON.stringify(publicState(s, 'a')));
  assert.ok(viewA.players[0].mission, 'vejo a minha missao');
  assert.equal(viewA.players[1].mission, null, 'nao vejo a do adversario');
  assert.equal(viewA.players[1].card, null);
  assert.equal(viewA.countries.length, 60);
  assert.ok(viewA.continents.na.name);
  s.phase = 'ended';
  const fim = publicState(s, 'a');
  assert.ok(fim.players[1].mission, 'no fim da partida as missoes sao reveladas');
});

test('emprestimo: 30% de juros, parcela por rodada e quitacao automatica', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  s.round = 5;
  const ana = s.players[0];
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'loan', amount: 600 });
  assert.equal(ana.loan.debt, 780, '30% de juros na contratacao');
  assert.equal(ana.loan.parcela, 78, 'dividido em 10 parcelas');
  assert.equal(ana.loan.autoPay, true);

  const ouroAntes = ana.gold;
  const renda = incomeOf(s, 'a');
  passTurn(s); // Ana encerra
  passTurn(s); // Bia encerra e comeca a rodada 6: cobranca
  assert.equal(ana.loan.debt, 702, 'uma parcela abatida');
  assert.equal(ana.loan.pagas, 1);
  // Na virada da rodada 6: inflacao, depois a parcela; a renda so entra quando a vez volta.
  assert.equal(ana.gold, Math.round(ouroAntes * 0.98) - 78 + renda, 'inflacao, parcela e renda');
});

test('dar o calote faz a divida subir 2% por rodada', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  s.round = 5;
  const ana = s.players[0];
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'loan', amount: 600 });
  assert.equal(act(s, 'a', { type: 'loanAutoPay', on: false }).ok, true);
  const divida = ana.loan.debt;
  passTurn(s);
  passTurn(s);
  assert.equal(ana.loan.debt, divida + Math.round(divida * 0.02));
  assert.equal(ana.loan.atrasos, 1);
  assert.equal(ana.loan.pagas, 0);
});

test('passando de 10 rodadas em calote, o banco apreende industrias', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  s.round = 5;
  const ana = s.players[0];
  const home = country(s, ana.homeId);
  ana.gold = 20_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'build', countryId: home.id, size: 'large' });
  act(s, 'a', { type: 'build', countryId: home.id, size: 'large' });
  act(s, 'a', { type: 'build', countryId: home.id, size: 'small' });
  act(s, 'a', { type: 'loan', amount: 600 });
  act(s, 'a', { type: 'loanAutoPay', on: false });
  ana.loan.takenAt = s.round - 11; // ja passou do prazo
  const dividaAntes = ana.loan.debt;
  assert.equal(home.large + home.small, 3);
  passTurn(s);
  passTurn(s);
  assert.ok(home.large + home.small < 3, 'o banco levou industria');
  assert.ok(!ana.loan || ana.loan.debt < dividaAntes, 'a divida foi abatida pelo que foi apreendido');
  assert.ok(s.log.some((l) => l.text.includes('apreende')), 'apreensao registrada no historico');
});

test('paises custam 5x a renda por rodada', () => {
  const s = newGame();
  for (const c of s.countries) assert.equal(c.price, Math.round((c.income * 5) / 10) * 10);
  assert.equal(s.countries.find((c) => c.rank === 1).price, 2000);
  assert.equal(s.countries.find((c) => c.rank === 60).price, 500);
});

test('venda ao banco paga 70% do investido e devolve o pais ao mapa', () => {
  const s = newGame();
  const home = country(s, s.players[0].homeId);
  const extra = s.countries.find((c) => !c.ownerId);
  extra.ownerId = 'a';
  extra.troops = 2;
  s.players[0].gold = 10_000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'build', countryId: extra.id, size: 'small' });
  const valor = marketValue(s, extra);
  assert.equal(valor, extra.price + 230);
  const esperado = bankOffer(s, extra);
  assert.equal(esperado, Math.round(valor * 0.7));
  const ouroAntes = s.players[0].gold;
  assert.equal(act(s, 'a', { type: 'sell', countryId: extra.id }).ok, true);
  assert.equal(s.players[0].gold, ouroAntes + esperado);
  assert.equal(extra.ownerId, null);
  assert.equal(extra.small, 0);
  assert.equal(extra.troops, 0);
  // o ultimo pais nao pode ser vendido
  assert.equal(act(s, 'a', { type: 'sell', countryId: home.id }).ok, false);
});

test('proposta entre jogadores: aceitar transfere pais e ouro', () => {
  const s = newGame();
  const extra = s.countries.find((c) => !c.ownerId);
  extra.ownerId = 'a';
  extra.troops = 4;
  const [ana, bia] = s.players;
  bia.gold = 1000;
  act(s, 'a', { type: 'roll' }, seq([1]));
  assert.equal(act(s, 'a', { type: 'offer', countryId: extra.id, toPlayerId: 'b', price: 400 }).ok, true);
  assert.equal(s.offers.length, 1);
  const proposta = s.offers[0];
  // so quem recebeu pode responder
  assert.equal(respondOffer(s, 'a', proposta.id, true).ok, false);
  const ouroAna = ana.gold;
  assert.equal(respondOffer(s, 'b', proposta.id, true).ok, true);
  assert.equal(extra.ownerId, 'b');
  assert.equal(extra.troops, 2, 'o comprador herda metade das tropas');
  assert.equal(ana.gold, ouroAna + 400);
  assert.equal(bia.gold, 600);
  assert.equal(s.offers.length, 0);
});

test('proposta pode ser recusada, retirada e expira sozinha', () => {
  const s = newGame({ eventWindow: 999 });
  s.nextEventRound = 999;
  const extra = s.countries.find((c) => !c.ownerId);
  extra.ownerId = 'a';
  extra.troops = 2;
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'offer', countryId: extra.id, toPlayerId: 'b', price: 300 });
  assert.equal(respondOffer(s, 'b', s.offers[0].id, false).ok, true);
  assert.equal(s.offers.length, 0);

  act(s, 'a', { type: 'offer', countryId: extra.id, toPlayerId: 'b', price: 300 });
  assert.equal(act(s, 'a', { type: 'cancelOffer', offerId: s.offers[0].id }).ok, true);
  assert.equal(s.offers.length, 0);

  act(s, 'a', { type: 'offer', countryId: extra.id, toPlayerId: 'b', price: 300 });
  for (let i = 0; i < 8; i++) passTurn(s);
  assert.equal(s.offers.length, 0, 'a proposta expirou com o tempo');
});

test('cada combate vem com id e nomes, para o cliente animar a invasao', () => {
  const s = newGame();
  const base = give(s, s.players[0].homeId, 'a', 6);
  const alvoId = neighborsOf(base.id)[0];
  give(s, alvoId, 'b', 2);
  act(s, 'a', { type: 'roll' }, seq([1]));
  act(s, 'a', { type: 'attack', from: base.id, to: alvoId }, seq([12, 2], 12));
  assert.equal(s.combat.id, 1);
  assert.equal(s.combat.attackerName, 'Ana');
  assert.equal(s.combat.defenderName, 'Bia');
  assert.equal(s.combat.toName, country(s, alvoId).name);
  assert.equal(s.combat.captured, true);
  assert.ok(s.combat.moved >= 1);
});
