// Motor de regras de "Conquista & Capital" (servidor autoritativo, sem I/O).
// Mapa-mundi com as 60 maiores economias: cada pais rende ouro por rodada conforme a
// posicao no ranking de produtividade, e os jogadores escolhem uma classe (empresario,
// politico ou figura religiosa) com uma habilidade propria.

import { ADJACENCY, MAP_COUNTRIES } from './map.js';

export const PLAYER_COLORS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];

export const CLASSES = {
  empresario: {
    id: 'empresario',
    name: 'Empresario',
    ability: 'Lavei, sumi',
    desc: 'Paga 10% a menos em todo imposto cobrado pelo banco.',
  },
  politico: {
    id: 'politico',
    name: 'Politico',
    ability: 'Meu pedaco',
    desc: 'A cada 4 rodadas recebe 10% do proprio patrimonio.',
  },
  religiosa: {
    id: 'religiosa',
    name: 'Figura religiosa',
    ability: 'Dizimo',
    desc: 'A cada 8 rodadas recebe 10% do patrimonio de cada outro jogador.',
  },
};

export const RULES = {
  startGold: 1000,
  startTroops: 5,
  minReinforcements: 2,
  recruitCost: 100,
  factories: {
    small: { cost: 230, income: 35, label: 'Industria pequena', max: 3 },
    large: { cost: 500, income: 75, label: 'Industria grande', max: 2 },
  },
  inflationEvery: 2,
  inflationRate: 0.02,
  bankTaxEvery: 13,
  bankTaxRate: 0.2,
  taxDiscount: 0.1, // habilidade do empresario
  politicianEvery: 4,
  politicianRate: 0.1,
  titheEvery: 8,
  titheRate: 0.1,
  loanMax: 600,
  loanFromRound: 5,
  loanInterest: 0.2, // juros fixos na contratacao
  loanInterestEvery: 5, // rodadas ate incidir juros sobre o saldo devedor
  loanInterestRate: 0.1,
  tributePerTroop: 10,
  tributePerSmall: 30,
  tributePerLarge: 60,
  targetCountries: 20,
  maxRounds: 40,
};

const defaultRng = () => Math.random();
const rollDie = (rng) => 1 + Math.floor(rng() * 6);
const fail = (msg) => ({ ok: false, error: msg });
const okRes = (extra = {}) => ({ ok: true, ...extra });
const pct = (value, rate) => Math.round(value * rate);

export function createGame(playersInput, options = {}, rng = defaultRng) {
  const countries = MAP_COUNTRIES.map((c) => ({
    id: c.id,
    name: c.name,
    rank: c.rank,
    income: c.income,
    price: c.price,
    ownerId: null,
    troops: 0,
    small: 0,
    large: 0,
  }));
  const state = {
    countries,
    players: [],
    turn: 0,
    round: 1,
    phase: 'roll',
    dice: null,
    moves: 0,
    pending: null,
    combat: null,
    log: [],
    events: [],
    winner: null,
    config: { ...RULES, ...options },
  };

  // Cada jogador comeca com um pais aleatorio do mapa.
  const pool = countries.map((c) => c.id);
  state.players = playersInput.map((p, i) => {
    const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const home = countries.find((c) => c.id === pick);
    home.ownerId = p.id;
    home.troops = state.config.startTroops;
    return {
      id: p.id,
      name: p.name,
      cls: CLASSES[p.cls] ? p.cls : 'empresario',
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      gold: state.config.startGold,
      reserve: 3,
      pos: home.id,
      alive: true,
      loan: null,
      homeId: home.id,
    };
  });

  pushLog(state, `Partida iniciada com ${state.players.length} jogadores no mapa-mundi.`);
  for (const p of state.players) {
    const home = byCountry(state, p.pos);
    pushLog(state, `${p.name} (${CLASSES[p.cls].name}) comeca em ${home.name} — ${home.income} ouro/rodada.`);
  }
  grantIncome(state, current(state));
  pushLog(state, `Rodada 1: vez de ${current(state).name}.`);
  return state;
}

// ---------------------------------------------------------------- utilidades

export const current = (s) => s.players[s.turn];
const byId = (s, id) => s.players.find((p) => p.id === id) || null;
const byCountry = (s, id) => s.countries.find((c) => c.id === id) || null;
const ownedBy = (s, id) => s.countries.filter((c) => c.ownerId === id);

function pushLog(s, text, kind = 'info') {
  s.log.push({ text, kind, at: s.log.length });
  if (s.log.length > 240) s.log.shift();
}

export function neighborsOf(countryId) {
  return ADJACENCY.get(countryId) || [];
}

/** Ouro por rodada de um jogador: paises + industrias. */
export function incomeOf(s, playerId) {
  const f = s.config.factories;
  return ownedBy(s, playerId).reduce(
    (sum, c) => sum + c.income + c.small * f.small.income + c.large * f.large.income,
    0,
  );
}

/** Patrimonio: caixa + paises + industrias + tropas - divida. */
export function netWorth(s, player) {
  const f = s.config.factories;
  const assets = ownedBy(s, player.id).reduce(
    (sum, c) => sum + c.price + c.small * f.small.cost + c.large * f.large.cost + c.troops * 10,
    0,
  );
  return player.gold + assets + player.reserve * 10 - (player.loan?.debt || 0);
}

export function tributeOf(s, country) {
  const cfg = s.config;
  return Math.round(
    country.income / 4 +
      country.small * cfg.tributePerSmall +
      country.large * cfg.tributePerLarge +
      country.troops * cfg.tributePerTroop,
  );
}

/** Imposto devido pelo jogador, ja com a habilidade "Lavei, sumi" do empresario. */
export function taxFor(s, player, amount) {
  const raw = Math.max(0, Math.round(amount));
  if (player.cls !== 'empresario') return raw;
  return Math.round(raw * (1 - s.config.taxDiscount));
}

// ------------------------------------------------------------------ economia

function payDebt(s, debtor, amount, creditor) {
  if (debtor.gold >= amount) {
    debtor.gold -= amount;
    if (creditor) creditor.gold += amount;
    return true;
  }
  const paid = Math.max(0, debtor.gold);
  debtor.gold = 0;
  if (creditor) creditor.gold += paid;
  eliminate(s, debtor, creditor, 'nao conseguiu pagar suas dividas');
  return false;
}

function eliminate(s, player, creditor, reason) {
  if (!player.alive) return;
  player.alive = false;
  player.gold = 0;
  player.loan = null;
  const lands = ownedBy(s, player.id);
  for (const c of lands) {
    if (creditor && creditor.alive) {
      c.ownerId = creditor.id;
      c.troops = Math.max(1, Math.floor(c.troops / 2));
    } else {
      c.ownerId = null;
      c.troops = 0;
      c.small = 0;
      c.large = 0;
    }
  }
  player.reserve = 0;
  pushLog(
    s,
    creditor
      ? `${player.name} quebrou (${reason}): ${creditor.name} assume ${lands.length} pais(es).`
      : `${player.name} quebrou (${reason}) e saiu do jogo.`,
    'bad',
  );
}

function grantIncome(s, player) {
  const gold = incomeOf(s, player.id);
  const lands = ownedBy(s, player.id).length;
  const troops = Math.max(s.config.minReinforcements, Math.floor(lands / 3));
  player.gold += gold;
  player.reserve += troops;
  pushLog(s, `${player.name} arrecada ${gold} de ouro e ${troops} tropa(s).`);
}

/** Eventos que valem para todo mundo e acontecem em rodadas especificas. */
function applyRoundEvents(s) {
  const cfg = s.config;
  const round = s.round;
  const alive = () => s.players.filter((p) => p.alive);
  s.events = [];

  if (round % cfg.inflationEvery === 0) {
    for (const p of alive()) {
      const loss = pct(p.gold, cfg.inflationRate);
      p.gold -= loss;
      if (loss) pushLog(s, `Inflacao: ${p.name} perde ${loss} de ouro (${cfg.inflationRate * 100}% do caixa).`, 'warn');
    }
    s.events.push({ kind: 'inflacao', text: `Inflacao: -${cfg.inflationRate * 100}% do caixa de todos.` });
  }

  if (round % cfg.bankTaxEvery === 0) {
    for (const p of alive()) {
      const due = taxFor(s, p, p.gold * cfg.bankTaxRate);
      p.gold -= due;
      pushLog(
        s,
        `Imposto do banco: ${p.name} paga ${due} de ouro${p.cls === 'empresario' ? ' (Lavei, sumi: -10%)' : ''}.`,
        'bad',
      );
    }
    s.events.push({ kind: 'imposto', text: `Imposto do banco: ${cfg.bankTaxRate * 100}% do caixa de todos.` });
  }

  if (round % cfg.politicianEvery === 0) {
    for (const p of alive().filter((x) => x.cls === 'politico')) {
      const gain = pct(netWorth(s, p), cfg.politicianRate);
      p.gold += gain;
      pushLog(s, `Meu pedaco: ${p.name} desvia ${gain} de ouro (10% do proprio patrimonio).`, 'good');
    }
  }

  if (round % cfg.titheEvery === 0) {
    for (const pastor of alive().filter((x) => x.cls === 'religiosa')) {
      let total = 0;
      for (const p of alive()) {
        if (p.id === pastor.id) continue;
        const due = Math.min(p.gold, pct(netWorth(s, p), cfg.titheRate));
        p.gold -= due;
        total += due;
      }
      pastor.gold += total;
      pushLog(s, `Dizimo: ${pastor.name} recolhe ${total} de ouro dos demais jogadores.`, 'good');
    }
  }

  if (round % cfg.loanInterestEvery === 0) {
    for (const p of alive().filter((x) => x.loan)) {
      const juros = pct(p.loan.debt, cfg.loanInterestRate);
      p.loan.debt += juros;
      pushLog(s, `Juros: a divida de ${p.name} sobe ${juros} (saldo ${p.loan.debt}).`, 'warn');
    }
  }
}

// -------------------------------------------------------------------- turnos

function checkVictory(s) {
  const alive = s.players.filter((p) => p.alive);
  if (!alive.length) {
    s.winner = null;
    s.phase = 'ended';
    return true;
  }
  if (alive.length === 1) {
    s.winner = { id: alive[0].id, reason: 'Ultimo jogador em pe' };
  } else {
    const dominator = alive.find((p) => ownedBy(s, p.id).length >= s.config.targetCountries);
    if (dominator) {
      s.winner = { id: dominator.id, reason: `Controla ${s.config.targetCountries}+ paises` };
    } else if (s.round > s.config.maxRounds) {
      const best = [...alive].sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
      s.winner = { id: best.id, reason: 'Maior patrimonio ao fim das rodadas' };
    }
  }
  if (s.winner) {
    s.phase = 'ended';
    s.pending = null;
    pushLog(s, `${byId(s, s.winner.id).name} venceu: ${s.winner.reason}.`, 'good');
  }
  return !!s.winner;
}

function nextTurn(s) {
  if (checkVictory(s)) return;
  s.pending = null;
  s.combat = null;
  s.dice = null;
  s.moves = 0;
  let guard = 0;
  do {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) {
      s.round += 1;
      applyRoundEvents(s);
    }
  } while (!s.players[s.turn].alive && guard++ < s.players.length * 2);
  for (const p of s.players) {
    if (p.alive && !ownedBy(s, p.id).length && p.gold < 320) {
      eliminate(s, p, null, 'ficou sem paises e sem caixa');
    }
  }
  if (checkVictory(s)) return;
  s.phase = 'roll';
  const p = current(s);
  grantIncome(s, p);
  pushLog(s, `Rodada ${s.round}: vez de ${p.name}.`);
}

export function surrender(s, playerId) {
  const p = byId(s, playerId);
  if (!p || !p.alive || s.phase === 'ended') return fail('Jogador indisponivel.');
  pushLog(s, `${p.name} desistiu.`, 'bad');
  eliminate(s, p, null, 'desistiu da partida');
  if (current(s).id === playerId) nextTurn(s);
  else checkVictory(s);
  return okRes();
}

// ---------------------------------------------------------------- movimentos

function resolveLanding(s, player) {
  const country = byCountry(s, player.pos);
  s.moves = 0;
  if (!country.ownerId) {
    s.pending = { kind: 'buy', countryId: country.id, price: country.price };
    pushLog(s, `${country.name} esta sem dono (${country.price} de ouro, ${country.income}/rodada).`);
  } else if (country.ownerId === player.id) {
    s.pending = { kind: 'own', countryId: country.id };
    pushLog(s, `${player.name} visita ${country.name}.`);
  } else {
    const tribute = tributeOf(s, country);
    s.pending = { kind: 'enemy', countryId: country.id, tribute };
    pushLog(
      s,
      `${player.name} desembarca em ${country.name} (${byId(s, country.ownerId).name}): tributo de ${tribute} ou guerra.`,
      'warn',
    );
  }
}

function doRoll(s, player, rng) {
  if (s.phase !== 'roll') return fail('Nao e hora de rolar o dado.');
  const d = rollDie(rng);
  s.dice = [d];
  s.combat = null;
  s.moves = d;
  s.phase = 'move';
  pushLog(s, `${player.name} tira ${d} e tem ${d} passo(s) para andar pelo mapa.`);
  return okRes();
}

function doMove(s, player, action) {
  if (s.phase !== 'move') return fail('Role o dado primeiro.');
  if (s.moves <= 0) return fail('Sem passos restantes.');
  const target = byCountry(s, action.to);
  if (!target) return fail('Pais invalido.');
  if (!neighborsOf(player.pos).includes(target.id)) return fail('Esse pais nao faz fronteira com o atual.');
  player.pos = target.id;
  s.moves -= 1;
  if (s.moves === 0) {
    s.phase = 'action';
    resolveLanding(s, player);
  }
  return okRes();
}

function doStop(s, player) {
  if (s.phase !== 'move') return fail('Voce nao esta se movendo.');
  s.phase = 'action';
  resolveLanding(s, player);
  return okRes();
}

// -------------------------------------------------------------------- acoes

function doBuy(s, player) {
  if (!s.pending || s.pending.kind !== 'buy') return fail('Nao ha pais a comprar.');
  const country = byCountry(s, s.pending.countryId);
  if (player.gold < country.price) return fail('Ouro insuficiente.');
  player.gold -= country.price;
  country.ownerId = player.id;
  country.troops = Math.max(1, country.troops);
  s.pending = null;
  pushLog(s, `${player.name} compra ${country.name} por ${country.price} (+${country.income}/rodada).`, 'good');
  checkVictory(s);
  return okRes();
}

function doTribute(s, player) {
  if (!s.pending || s.pending.kind !== 'enemy') return fail('Nao ha tributo pendente.');
  const country = byCountry(s, s.pending.countryId);
  const owner = byId(s, country.ownerId);
  const amount = s.pending.tribute;
  s.pending = null;
  pushLog(s, `${player.name} paga ${amount} de tributo a ${owner.name}.`);
  payDebt(s, player, amount, owner);
  checkVictory(s);
  return okRes();
}

function doBuild(s, player, action) {
  const size = action.size === 'large' ? 'large' : 'small';
  const spec = s.config.factories[size];
  const country = byCountry(s, action.countryId);
  if (!country) return fail('Pais invalido.');
  if (country.ownerId !== player.id) return fail('O pais nao e seu.');
  if (country[size] >= spec.max) return fail(`Limite de ${spec.label.toLowerCase()} atingido nesse pais.`);
  if (player.gold < spec.cost) return fail('Ouro insuficiente.');
  player.gold -= spec.cost;
  country[size] += 1;
  pushLog(
    s,
    `${player.name} constroi uma ${spec.label.toLowerCase()} em ${country.name} (-${spec.cost}, +${spec.income}/rodada).`,
    'good',
  );
  return okRes();
}

function doDeploy(s, player, action) {
  const count = Math.max(1, Math.floor(Number(action.count) || 1));
  const country = byCountry(s, action.countryId);
  if (!country) return fail('Pais invalido.');
  if (country.ownerId !== player.id) return fail('O pais nao e seu.');
  if (player.reserve < count) return fail('Reserva insuficiente.');
  player.reserve -= count;
  country.troops += count;
  pushLog(s, `${player.name} posiciona ${count} tropa(s) em ${country.name}.`);
  return okRes();
}

function doRecruit(s, player, action) {
  const count = Math.max(1, Math.floor(Number(action.count) || 1));
  const cost = count * s.config.recruitCost;
  if (player.gold < cost) return fail('Ouro insuficiente para recrutar.');
  player.gold -= cost;
  player.reserve += count;
  pushLog(s, `${player.name} recruta ${count} tropa(s) por ${cost}.`);
  return okRes();
}

function doLoan(s, player, action) {
  const cfg = s.config;
  if (s.round < cfg.loanFromRound) return fail(`O banco so empresta a partir da rodada ${cfg.loanFromRound}.`);
  if (player.loan) return fail('Voce ja tem um emprestimo em aberto.');
  const amount = Math.min(cfg.loanMax, Math.max(50, Math.floor(Number(action.amount) || 0)));
  if (!amount) return fail('Valor invalido.');
  const debt = Math.round(amount * (1 + cfg.loanInterest));
  player.gold += amount;
  player.loan = { principal: amount, debt, takenAt: s.round };
  pushLog(s, `${player.name} pega ${amount} emprestado do banco (divida de ${debt}).`, 'warn');
  return okRes();
}

function doRepay(s, player, action) {
  if (!player.loan) return fail('Voce nao tem divida com o banco.');
  const want = Math.floor(Number(action.amount) || player.loan.debt);
  const amount = Math.min(player.loan.debt, Math.max(1, want), player.gold);
  if (amount <= 0) return fail('Ouro insuficiente.');
  player.gold -= amount;
  player.loan.debt -= amount;
  if (player.loan.debt <= 0) {
    player.loan = null;
    pushLog(s, `${player.name} quita a divida com o banco.`, 'good');
  } else {
    pushLog(s, `${player.name} paga ${amount} ao banco (restam ${player.loan.debt}).`);
  }
  return okRes();
}

function doAttack(s, player, action, rng) {
  // Duas formas de atacar: ao desembarcar num pais inimigo (invasao) ou, a qualquer
  // momento do seu turno, a partir de uma fronteira sua — como no War.
  const invasao = s.pending?.kind === 'enemy';
  if (!invasao && s.phase !== 'action' && s.phase !== 'move') return fail('Role o dado primeiro.');
  const from = byCountry(s, action.from);
  const target = invasao ? byCountry(s, s.pending.countryId) : byCountry(s, action.to);
  if (!from || from.ownerId !== player.id) return fail('Origem invalida.');
  if (!target || !target.ownerId || target.ownerId === player.id) return fail('Alvo precisa ser inimigo.');
  if (from.troops < 2) return fail('Precisa de pelo menos 2 tropas na origem.');
  if (!neighborsOf(from.id).includes(target.id)) return fail('Sem fronteira com o alvo.');

  const attCount = Math.min(3, from.troops - 1);
  const defCount = Math.max(1, Math.min(2, target.troops));
  const bonus = Math.min(2, target.small + target.large * 2); // industrias defendem o territorio
  const attRolls = Array.from({ length: attCount }, () => rollDie(rng)).sort((a, b) => b - a);
  const defRolls = Array.from({ length: defCount }, () => rollDie(rng))
    .map((d) => Math.min(6, d + bonus))
    .sort((a, b) => b - a);

  let attLoss = 0;
  let defLoss = 0;
  for (let i = 0; i < Math.min(attRolls.length, defRolls.length); i++) {
    if (attRolls[i] > defRolls[i]) defLoss++;
    else attLoss++;
  }
  from.troops -= attLoss;
  target.troops = Math.max(0, target.troops - defLoss);

  const loser = byId(s, target.ownerId);
  s.combat = { from: from.id, to: target.id, attRolls, defRolls, attLoss, defLoss, captured: false };
  pushLog(
    s,
    `Guerra em ${target.name}: ${player.name} [${attRolls.join(',')}] x ${loser.name} [${defRolls.join(',')}] — ` +
      `atacante perde ${attLoss}, defensor perde ${defLoss}.`,
    'warn',
  );

  if (target.troops === 0) {
    const moving = Math.min(from.troops - 1, Math.max(1, attCount));
    target.ownerId = player.id;
    target.troops = moving;
    from.troops -= moving;
    s.combat.captured = true;
    if (invasao) s.pending = null;
    pushLog(s, `${player.name} toma ${target.name} de ${loser.name} (industrias incluidas).`, 'good');
    if (!ownedBy(s, loser.id).length && loser.gold < 320) eliminate(s, loser, player, 'perdeu o ultimo pais');
    checkVictory(s);
  }
  return okRes();
}

function doEndTurn(s, player) {
  if (s.phase === 'move') {
    s.phase = 'action';
    resolveLanding(s, player);
    if (s.pending?.kind === 'enemy') return fail('Resolva o desembarque antes de encerrar o turno.');
  }
  if (s.pending && s.pending.kind === 'enemy') {
    return fail('Pague o tributo ou conquiste o pais antes de encerrar o turno.');
  }
  s.pending = null;
  nextTurn(s);
  return okRes();
}

/** Ponto de entrada unico: aplica uma acao de um jogador. */
export function act(state, playerId, action, rng = defaultRng) {
  if (state.phase === 'ended') return fail('A partida acabou.');
  const player = byId(state, playerId);
  if (!player || !player.alive) return fail('Jogador fora da partida.');
  if (current(state).id !== playerId) return fail('Nao e a sua vez.');
  const inTurn = state.phase === 'move' || state.phase === 'action';

  switch (action.type) {
    case 'roll': return doRoll(state, player, rng);
    case 'move': return doMove(state, player, action);
    case 'stop': return doStop(state, player);
    case 'buy': return doBuy(state, player);
    case 'tribute': return doTribute(state, player);
    case 'attack': return doAttack(state, player, action, rng);
    case 'build': return inTurn ? doBuild(state, player, action) : fail('Role o dado primeiro.');
    case 'deploy': return inTurn ? doDeploy(state, player, action) : fail('Role o dado primeiro.');
    case 'recruit': return inTurn ? doRecruit(state, player, action) : fail('Role o dado primeiro.');
    case 'loan': return inTurn ? doLoan(state, player, action) : fail('Role o dado primeiro.');
    case 'repay': return inTurn ? doRepay(state, player, action) : fail('Role o dado primeiro.');
    case 'skip':
      if (state.pending && state.pending.kind === 'enemy') return fail('Voce nao pode ignorar o desembarque.');
      state.pending = null;
      return okRes();
    case 'endTurn': return doEndTurn(state, player);
    default: return fail('Acao desconhecida.');
  }
}

/** Estado serializavel enviado aos clientes. */
export function publicState(s) {
  return {
    countries: s.countries.map((c) => ({
      id: c.id,
      name: c.name,
      rank: c.rank,
      income: c.income,
      price: c.price,
      ownerId: c.ownerId,
      troops: c.troops,
      small: c.small,
      large: c.large,
      tribute: c.ownerId ? tributeOf(s, c) : null,
    })),
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      cls: p.cls,
      className: CLASSES[p.cls].name,
      ability: CLASSES[p.cls].ability,
      color: p.color,
      gold: p.gold,
      reserve: p.reserve,
      pos: p.pos,
      alive: p.alive,
      loan: p.loan,
      lands: ownedBy(s, p.id).length,
      income: incomeOf(s, p.id),
      worth: netWorth(s, p),
    })),
    turn: s.turn,
    currentId: current(s).id,
    round: s.round,
    phase: s.phase,
    dice: s.dice,
    moves: s.moves,
    pending: s.pending,
    combat: s.combat,
    events: s.events,
    winner: s.winner,
    log: s.log.slice(-40),
    config: {
      targetCountries: s.config.targetCountries,
      maxRounds: s.config.maxRounds,
      recruitCost: s.config.recruitCost,
      factories: s.config.factories,
      loanMax: s.config.loanMax,
      loanFromRound: s.config.loanFromRound,
      loanInterest: s.config.loanInterest,
      inflationEvery: s.config.inflationEvery,
      bankTaxEvery: s.config.bankTaxEvery,
    },
  };
}
