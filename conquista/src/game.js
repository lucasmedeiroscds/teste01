// Motor de regras de "Conquista & Capital" (servidor autoritativo, sem I/O).
// Mapa-mundi com as 60 maiores economias, classes com habilidade, economia com
// manutencao e imposto progressivo, combate em dado de 12 e missoes secretas.

import { CONTINENTS, countriesOfContinent } from './countries.js';
import { ADJACENCY, MAP_COUNTRIES } from './map.js';
import { MISSIONS } from './missions.js';
import { EVENT_CARDS } from './cards.js';

export const PLAYER_COLORS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];

export const CLASSES = {
  empresario: {
    id: 'empresario',
    name: 'Empresario',
    ability: 'Lavei, sumi',
    desc: 'Paga 10% a menos de imposto. O contador e criativo, o juiz e amigo.',
  },
  politico: {
    id: 'politico',
    name: 'Politico',
    ability: 'Meu pedaco',
    desc: 'A cada 4 rodadas embolsa 10% do proprio patrimonio. Emenda parlamentar, ora.',
  },
  religiosa: {
    id: 'religiosa',
    name: 'Figura religiosa',
    ability: 'Dizimo',
    desc: 'A cada 8 rodadas recolhe 10% do patrimonio dos outros. Fe que move o caixa.',
  },
  laranjao: {
    id: 'laranjao',
    name: 'Laranjao',
    ability: 'Testa de ferro',
    desc: '+1 no dado quando invade os outros. O nome no contrato nunca e o seu.',
  },
};

export const RULES = {
  startGold: 1000,
  startTroops: 5,
  minReinforcements: 3, // reforcos do War: max(3, paises/2) + bonus de continente
  recruitCost: 100,
  factories: {
    small: { cost: 230, income: 35, label: 'Industria pequena', max: 3 },
    large: { cost: 500, income: 75, label: 'Industria grande', max: 2 },
  },
  maxFactoriesPerCountry: 3,
  factoryUpkeepRate: 0.2, // manutencao por rodada: 20% do que a industria rende
  inflationEvery: 2,
  inflationRate: 0.02,
  bankTaxEvery: 13,
  // Imposto progressivo: a aliquota sobe conforme o patrimonio do jogador.
  taxBrackets: [
    [5_000, 0.1],
    [15_000, 0.15],
    [40_000, 0.2],
    [100_000, 0.25],
    [Infinity, 0.3],
  ],
  taxDiscount: 0.1, // habilidade do empresario
  politicianEvery: 4,
  politicianRate: 0.1,
  titheEvery: 8,
  titheRate: 0.1,
  loanMax: 600,
  loanFromRound: 5,
  loanInterest: 0.3, // juros cobrados na contratacao
  loanInstallments: 10, // a divida vem parcelada, uma parcela por rodada
  loanLateRate: 0.02, // deixou de pagar: o saldo devedor sobe 2% por rodada
  loanSeizeAfter: 10, // passou disso com divida aberta, o banco apreende industrias
  sellToBankRate: 0.7, // o banco recompra o pais por 70% do valor investido
  offerTimeout: 3, // rodadas ate uma proposta entre jogadores expirar
  tributePerTroop: 10,
  tributePerSmall: 30,
  tributePerLarge: 60,
  combatDie: 12, // combate: 1d12 de cada lado, maior leva o pais
  invasionBonus: 1, // bonus do laranjao
  eventWindow: 20, // em algum momento de cada 20 rodadas todos compram uma carta
  objectiveContinentsMin: 8, // tamanho combinado dos dois continentes da carta
  objectiveContinentsMax: 16,
  maxRounds: 40, // rede de seguranca: no fim vence o maior patrimonio
};

const defaultRng = () => Math.random();
const rollDie = (rng, faces = 6) => 1 + Math.floor(rng() * faces);
const fail = (msg) => ({ ok: false, error: msg });
const okRes = (extra = {}) => ({ ok: true, ...extra });
const pct = (value, rate) => Math.round(value * rate);
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

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

/** Continentes totalmente controlados por um jogador. */
export function continentsOf(s, playerId) {
  return Object.keys(CONTINENTS).filter((key) => {
    const ids = countriesOfContinent(key);
    return ids.every((id) => byCountry(s, id)?.ownerId === playerId);
  });
}

/** Renda bruta por rodada (paises + industrias). */
export function grossIncomeOf(s, playerId) {
  const f = s.config.factories;
  return ownedBy(s, playerId).reduce(
    (sum, c) => sum + c.income + c.small * f.small.income + c.large * f.large.income,
    0,
  );
}

/** Manutencao das industrias por rodada. */
export function upkeepOf(s, playerId) {
  const f = s.config.factories;
  return ownedBy(s, playerId).reduce(
    (sum, c) => sum + Math.round((c.small * f.small.income + c.large * f.large.income) * s.config.factoryUpkeepRate),
    0,
  );
}

export const incomeOf = (s, playerId) => grossIncomeOf(s, playerId) - upkeepOf(s, playerId);

/** Patrimonio: caixa + paises + industrias + tropas - divida. */
export function netWorth(s, player) {
  const f = s.config.factories;
  const assets = ownedBy(s, player.id).reduce(
    (sum, c) => sum + c.price + c.small * f.small.cost + c.large * f.large.cost + c.troops * 10,
    0,
  );
  return player.gold + assets + player.reserve * 10 - (player.loan?.debt || 0);
}

/** Valor de mercado de um pais: preco mais o que foi investido em industrias. */
export function marketValue(s, country) {
  const f = s.config.factories;
  return country.price + country.small * f.small.cost + country.large * f.large.cost;
}

export const bankOffer = (s, country) => Math.round(marketValue(s, country) * s.config.sellToBankRate);

export function tributeOf(s, country) {
  const cfg = s.config;
  return Math.round(
    country.income / 4 +
      country.small * cfg.tributePerSmall +
      country.large * cfg.tributePerLarge +
      country.troops * cfg.tributePerTroop,
  );
}

/** Aliquota do imposto, que sobe junto com o patrimonio do jogador. */
export function taxRateFor(s, player) {
  const worth = netWorth(s, player);
  const faixa = s.config.taxBrackets.find(([limite]) => worth <= limite);
  return faixa ? faixa[1] : s.config.taxBrackets[s.config.taxBrackets.length - 1][1];
}

/** Imposto devido, ja com a faixa de patrimonio e a habilidade do empresario. */
export function taxFor(s, player) {
  if (player.taxFree) return 0;
  const bruto = Math.max(0, Math.round(player.gold * taxRateFor(s, player)));
  return player.cls === 'empresario' ? Math.round(bruto * (1 - s.config.taxDiscount)) : bruto;
}

/** Bonus do jogador no dado de invasao (classe + cartas). */
export function attackBonus(s, player) {
  let bonus = player.cls === 'laranjao' ? s.config.invasionBonus : 0;
  if (player.diceBonus && s.round <= player.diceBonus.until) bonus += player.diceBonus.bonus;
  return bonus;
}

// ------------------------------------------------------------------- missoes

/** Atalhos usados pelos checks das missoes. */
function missionCtx(s, player) {
  const lands = ownedBy(s, player.id);
  const ids = new Set(lands.map((c) => c.id));
  const completos = continentsOf(s, player.id);
  return {
    player,
    state: s,
    lands,
    count: lands.length,
    gold: player.gold,
    worth: netWorth(s, player),
    income: incomeOf(s, player.id),
    industrias: lands.reduce((a, c) => a + c.small + c.large, 0),
    tropasNoMapa: lands.reduce((a, c) => a + c.troops, 0),
    conquistas: player.conquistas,
    eliminados: player.eliminados,
    continentesCompletos: completos.length,
    owns: (id) => ids.has(id),
    ownsAll: (list) => list.every((id) => ids.has(id)),
    countIn: (list) => list.filter((id) => ids.has(id)).length,
    countInRank: (de, ate) => lands.filter((c) => c.rank >= de && c.rank <= ate).length,
    topRanks: (n) => lands.filter((c) => c.rank <= n).length >= n,
    landsCom: (fn) => lands.filter(fn).length,
    contFull: (key) => completos.includes(key),
    contCount: (key) => lands.filter((c) => c.cont === key).length,
    continentesTocados: () => new Set(lands.map((c) => c.cont)).size,
    maiorFatiaFora: () => {
      const fora = Object.keys(CONTINENTS).filter((k) => !completos.includes(k));
      return Math.max(0, ...fora.map((k) => lands.filter((c) => c.cont === k).length));
    },
    maiorBlocoConexo: () => {
      let maior = 0;
      const vistos = new Set();
      for (const inicio of ids) {
        if (vistos.has(inicio)) continue;
        let tamanho = 0;
        const fila = [inicio];
        vistos.add(inicio);
        while (fila.length) {
          const atual = fila.pop();
          tamanho++;
          for (const viz of neighborsOf(atual)) {
            if (ids.has(viz) && !vistos.has(viz)) { vistos.add(viz); fila.push(viz); }
          }
        }
        maior = Math.max(maior, tamanho);
      }
      return maior;
    },
    segundoColocado: () => Math.max(0, ...s.players
      .filter((p) => p.alive && p.id !== player.id)
      .map((p) => ownedBy(s, p.id).length)),
  };
}

/** Sorteia dois continentes cujo tamanho somado fica numa faixa jogavel. */
function drawObjectiveContinents(s, rng) {
  const keys = Object.keys(CONTINENTS);
  const pares = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const total = countriesOfContinent(keys[i]).length + countriesOfContinent(keys[j]).length;
      if (total >= s.config.objectiveContinentsMin && total <= s.config.objectiveContinentsMax) {
        pares.push([keys[i], keys[j]]);
      }
    }
  }
  return pick(pares, rng);
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
  if (creditor && creditor.alive) creditor.eliminados += 1;
  pushLog(
    s,
    creditor
      ? `${player.name} foi eliminado (${reason}): ${creditor.name} fica com ${lands.length} pais(es).`
      : `${player.name} foi eliminado (${reason}).`,
    'bad',
  );
}

/** Reforcos no estilo War: paises/2 (minimo 3) + bonus dos continentes completos. */
export function reinforcementsFor(s, playerId) {
  const lands = ownedBy(s, playerId).length;
  const base = Math.max(s.config.minReinforcements, Math.floor(lands / 2));
  const bonus = continentsOf(s, playerId).reduce((a, k) => a + CONTINENTS[k].bonus, 0);
  return { base, bonus, total: base + bonus };
}

function grantIncome(s, player) {
  const bruto = grossIncomeOf(s, player.id);
  const manutencao = upkeepOf(s, player.id);
  const liquido = bruto - manutencao;
  const reforcos = reinforcementsFor(s, player.id);
  player.gold += liquido;
  player.reserve += reforcos.total;
  pushLog(
    s,
    `${player.name} arrecada ${liquido} de ouro (${bruto} - ${manutencao} de manutencao) e ` +
      `${reforcos.total} tropa(s)${reforcos.bonus ? ` (${reforcos.base} + ${reforcos.bonus} de continente)` : ''}.`,
  );
}

// -------------------------------------------------------------- cartas de evento

/** Aplica uma carta de evento a um jogador. */
export function applyCard(s, player, card, rng = defaultRng) {
  const lands = ownedBy(s, player.id);
  const partes = [];
  if (card.gold) {
    if (card.gold > 0) { player.gold += card.gold; partes.push(`+${card.gold} de ouro`); }
    else { payDebt(s, player, -card.gold, null); partes.push(`${card.gold} de ouro`); }
  }
  if (card.goldPct) {
    const v = pct(player.gold, Math.abs(card.goldPct));
    if (card.goldPct > 0) { player.gold += v; partes.push(`+${v} de ouro`); }
    else { payDebt(s, player, v, null); partes.push(`-${v} de ouro`); }
  }
  if (card.worthPct) {
    const v = pct(netWorth(s, player), Math.abs(card.worthPct));
    if (card.worthPct > 0) { player.gold += v; partes.push(`+${v} de ouro`); }
    else { payDebt(s, player, v, null); partes.push(`-${v} de ouro`); }
  }
  if (card.troops) {
    player.reserve = Math.max(0, player.reserve + card.troops);
    partes.push(`${card.troops > 0 ? '+' : ''}${card.troops} tropa(s) na reserva`);
  }
  if (card.troopsCountry && lands.length) {
    const alvo = [...lands].sort((a, b) => b.income - a.income)[0];
    alvo.troops += card.troopsCountry;
    partes.push(`+${card.troopsCountry} tropa(s) em ${alvo.name}`);
  }
  if (card.loseTroops && lands.length) {
    const alvo = [...lands].sort((a, b) => b.troops - a.troops)[0];
    const perde = Math.min(card.loseTroops, Math.max(0, alvo.troops - 1));
    alvo.troops -= perde;
    partes.push(`-${perde} tropa(s) em ${alvo.name}`);
  }
  if (card.factory) {
    const alvo = lands.find((c) => c.small + c.large < s.config.maxFactoriesPerCountry);
    if (alvo) { alvo.small += 1; partes.push(`industria pequena em ${alvo.name}`); }
  }
  if (card.loseFactory) {
    const alvo = lands.find((c) => c.large > 0) || lands.find((c) => c.small > 0);
    if (alvo) {
      if (alvo.large > 0) alvo.large -= 1; else alvo.small -= 1;
      partes.push(`perdeu uma industria em ${alvo.name}`);
    }
  }
  if (card.forgiveLoan && player.loan) { player.loan = null; partes.push('divida perdoada'); }
  if (card.debt) {
    player.loan = player.loan
      ? { ...player.loan, debt: player.loan.debt + card.debt }
      : { principal: 0, debt: card.debt, takenAt: s.round };
    partes.push(`divida +${card.debt}`);
  }
  if (card.diceBonus) {
    player.diceBonus = { bonus: card.diceBonus.bonus, until: s.round + card.diceBonus.rounds };
    partes.push(`${card.diceBonus.bonus > 0 ? '+' : ''}${card.diceBonus.bonus} no dado ate a rodada ${player.diceBonus.until}`);
  }
  if (card.taxFree) { player.taxFree = true; partes.push('isento do proximo imposto'); }
  if (card.stealEach) {
    let total = 0;
    for (const outro of s.players) {
      if (outro.id === player.id || !outro.alive) continue;
      const v = Math.min(outro.gold, card.stealEach);
      outro.gold -= v;
      total += v;
    }
    player.gold += total;
    partes.push(`+${total} tirado dos adversarios`);
  }
  if (card.payEach) {
    for (const outro of s.players) {
      if (outro.id === player.id || !outro.alive) continue;
      const v = Math.min(player.gold, card.payEach);
      player.gold -= v;
      outro.gold += v;
    }
    partes.push(`pagou ${card.payEach} a cada adversario`);
  }
  player.card = { ...card, resumo: partes.join(', ') };
  pushLog(s, `Carta (${player.name}) — ${card.titulo}: ${card.texto} [${partes.join(', ') || 'sem efeito'}]`,
    card.tipo === 'buff' ? 'good' : 'bad');
  return player.card;
}

function drawEventCards(s, rng) {
  s.events = [];
  for (const p of s.players.filter((x) => x.alive)) {
    applyCard(s, p, pick(EVENT_CARDS, rng), rng);
  }
  s.events.push({ kind: 'cartas', text: 'Rodada de cartas de evento: todo mundo comprou uma.' });
  // Proxima leva em algum momento das proximas 20 rodadas.
  s.nextEventRound = s.round + 1 + Math.floor(rng() * s.config.eventWindow);
}

// -------------------------------------------------------------------- turnos

function checkVictory(s) {
  const alive = s.players.filter((p) => p.alive);
  if (!alive.length) { s.phase = 'ended'; s.winner = null; return true; }
  for (const p of alive) {
    const ctx = missionCtx(s, p);
    if (p.mission && MISSIONS.find((m) => m.id === p.mission.id)?.check(ctx)) {
      s.winner = { id: p.id, reason: `Cumpriu a missao: ${p.mission.titulo}`, mission: p.mission };
      break;
    }
    const alvos = p.mission?.continentes || [];
    if (alvos.length === 2 && alvos.every((k) => ctx.contFull(k))) {
      s.winner = {
        id: p.id,
        reason: `Conquistou ${alvos.map((k) => CONTINENTS[k].name).join(' e ')}`,
      };
      break;
    }
  }
  if (!s.winner && alive.length === 1) s.winner = { id: alive[0].id, reason: 'Ultimo jogador em pe' };
  if (!s.winner && s.round > s.config.maxRounds) {
    const best = [...alive].sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
    s.winner = { id: best.id, reason: 'Maior patrimonio ao fim das rodadas' };
  }
  if (s.winner) {
    s.phase = 'ended';
    s.pending = null;
    pushLog(s, `${byId(s, s.winner.id).name} venceu: ${s.winner.reason}.`, 'good');
  }
  return !!s.winner;
}

/** Quem ficou sem nenhum pais esta fora do jogo. */
function checkEliminations(s, culpado = null) {
  for (const p of s.players) {
    if (p.alive && !ownedBy(s, p.id).length) {
      eliminate(s, p, culpado && culpado.id !== p.id ? culpado : null, 'ficou sem nenhum pais');
    }
  }
}

/**
 * Cobranca da parcela do emprestimo, uma por rodada. Quem nao paga (por escolha ou por
 * falta de caixa) ve o saldo devedor subir 2% por rodada; passando de 10 rodadas com a
 * divida aberta, o banco apreende industrias ate cobrir o valor.
 */
function chargeInstallment(s, player) {
  const cfg = s.config;
  const loan = player.loan;
  if (!loan) return;
  const parcela = Math.min(loan.parcela, loan.debt);
  if (loan.autoPay && player.gold >= parcela) {
    player.gold -= parcela;
    loan.debt -= parcela;
    loan.pagas += 1;
    if (loan.debt <= 0) {
      player.loan = null;
      pushLog(s, `${player.name} quita a ultima parcela do emprestimo.`, 'good');
      return;
    }
    pushLog(s, `${player.name} paga a parcela de ${parcela} ao banco (saldo ${loan.debt}).`);
  } else {
    const juros = pct(loan.debt, cfg.loanLateRate);
    loan.debt += juros;
    loan.atrasos += 1;
    pushLog(
      s,
      `${player.name} nao pagou a parcela: juros de ${cfg.loanLateRate * 100}% sobre a divida ` +
        `(+${juros}, saldo ${loan.debt}).`,
      'warn',
    );
  }
  if (s.round - loan.takenAt > cfg.loanSeizeAfter && loan.debt > 0) seizeFactories(s, player);
}

/** O banco apreende industrias proporcionais ao valor da divida. */
function seizeFactories(s, player) {
  const loan = player.loan;
  const f = s.config.factories;
  const apreendidas = [];
  while (loan.debt > 0) {
    const lands = ownedBy(s, player.id);
    const alvo = lands.find((c) => c.large > 0) || lands.find((c) => c.small > 0);
    if (!alvo) break;
    const grande = alvo.large > 0;
    if (grande) alvo.large -= 1; else alvo.small -= 1;
    const valor = grande ? f.large.cost : f.small.cost;
    loan.debt = Math.max(0, loan.debt - valor);
    apreendidas.push(`${grande ? 'grande' : 'pequena'} em ${alvo.name}`);
  }
  if (!apreendidas.length) {
    pushLog(s, `O banco quer apreender bens de ${player.name}, mas nao sobrou industria nenhuma.`, 'bad');
    return;
  }
  pushLog(
    s,
    `Banco apreende ${apreendidas.length} industria(s) de ${player.name} (${apreendidas.join(', ')}) — ` +
      `saldo devedor: ${loan.debt}.`,
    'bad',
  );
  if (loan.debt <= 0) {
    player.loan = null;
    pushLog(s, `A divida de ${player.name} foi liquidada na marra.`, 'warn');
  }
}

function applyRoundEvents(s, rng) {
  const cfg = s.config;
  const round = s.round;
  const alive = () => s.players.filter((p) => p.alive);
  s.events = [];

  if (round % cfg.inflationEvery === 0) {
    for (const p of alive()) {
      const loss = pct(p.gold, cfg.inflationRate);
      p.gold -= loss;
      if (loss) pushLog(s, `Inflacao: ${p.name} perde ${loss} de ouro.`, 'warn');
    }
    s.events.push({ kind: 'inflacao', text: `Inflacao: -${cfg.inflationRate * 100}% do caixa de todos.` });
  }

  if (round % cfg.bankTaxEvery === 0) {
    for (const p of alive()) {
      const aliquota = taxRateFor(s, p);
      const due = taxFor(s, p);
      p.gold -= due;
      pushLog(
        s,
        `Imposto (faixa de ${Math.round(aliquota * 100)}% do patrimonio): ${p.name} paga ${due} de ouro` +
          `${p.taxFree ? ' — isento pela carta' : ''}${p.cls === 'empresario' && !p.taxFree ? ' (Lavei, sumi: -10%)' : ''}.`,
        'bad',
      );
      p.taxFree = false;
    }
    s.events.push({ kind: 'imposto', text: 'Imposto do banco: aliquota progressiva sobre o patrimonio.' });
  }

  if (round % cfg.politicianEvery === 0) {
    for (const p of alive().filter((x) => x.cls === 'politico')) {
      const gain = pct(netWorth(s, p), cfg.politicianRate);
      p.gold += gain;
      pushLog(s, `Meu pedaco: ${p.name} desvia ${gain} de ouro.`, 'good');
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
      pushLog(s, `Dizimo: ${pastor.name} recolhe ${total} de ouro dos demais.`, 'good');
    }
  }

  for (const p of alive().filter((x) => x.loan)) chargeInstallment(s, p);

  if (round >= s.nextEventRound) drawEventCards(s, rng);

  const vencidas = s.offers.filter((o) => round - o.round >= cfg.offerTimeout);
  if (vencidas.length) {
    s.offers = s.offers.filter((o) => round - o.round < cfg.offerTimeout);
    pushLog(s, `${vencidas.length} proposta(s) de venda expiraram.`);
  }
}

function nextTurn(s, rng) {
  checkEliminations(s);
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
      applyRoundEvents(s, rng);
    }
  } while (!s.players[s.turn].alive && guard++ < s.players.length * 2);
  checkEliminations(s);
  if (checkVictory(s)) return;
  s.phase = 'roll';
  const p = current(s);
  grantIncome(s, p);
  pushLog(s, `Rodada ${s.round}: vez de ${p.name}.`);
}

export function surrender(s, playerId, rng = defaultRng) {
  const p = byId(s, playerId);
  if (!p || !p.alive || s.phase === 'ended') return fail('Jogador indisponivel.');
  pushLog(s, `${p.name} desistiu.`, 'bad');
  eliminate(s, p, null, 'desistiu da partida');
  if (current(s).id === playerId) nextTurn(s, rng);
  else checkVictory(s);
  return okRes();
}

// ------------------------------------------------------------------- partida

export function createGame(playersInput, options = {}, rng = defaultRng) {
  const countries = MAP_COUNTRIES.map((c) => ({
    id: c.id,
    name: c.name,
    cont: c.cont,
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
    offers: [],
    offerSeq: 0,
    winner: null,
    config: { ...RULES, ...options },
  };
  state.nextEventRound = 2 + Math.floor(rng() * state.config.eventWindow);

  const pool = countries.map((c) => c.id);
  const missoes = [...MISSIONS];
  state.players = playersInput.map((p, i) => {
    const pickId = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const home = countries.find((c) => c.id === pickId);
    home.ownerId = p.id;
    home.troops = state.config.startTroops;
    const mission = missoes.splice(Math.floor(rng() * missoes.length), 1)[0];
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
      conquistas: 0,
      eliminados: 0,
      taxFree: false,
      diceBonus: null,
      card: null,
      mission: {
        id: mission.id,
        titulo: mission.titulo,
        texto: mission.texto,
        continentes: drawObjectiveContinents(state, rng),
      },
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
  checkEliminations(s, owner);
  checkVictory(s);
  return okRes();
}

function doBuild(s, player, action) {
  const size = action.size === 'large' ? 'large' : 'small';
  const spec = s.config.factories[size];
  const country = byCountry(s, action.countryId);
  if (!country) return fail('Pais invalido.');
  if (country.ownerId !== player.id) return fail('O pais nao e seu.');
  if (country.small + country.large >= s.config.maxFactoriesPerCountry) {
    return fail(`${country.name} ja tem ${s.config.maxFactoriesPerCountry} industrias (o teto por pais).`);
  }
  if (country[size] >= spec.max) return fail(`Limite de ${spec.label.toLowerCase()} atingido nesse pais.`);
  if (player.gold < spec.cost) return fail('Ouro insuficiente.');
  player.gold -= spec.cost;
  country[size] += 1;
  const manutencao = Math.round(spec.income * s.config.factoryUpkeepRate);
  pushLog(
    s,
    `${player.name} constroi uma ${spec.label.toLowerCase()} em ${country.name} ` +
      `(-${spec.cost}, +${spec.income}/rodada, -${manutencao} de manutencao).`,
    'good',
  );
  checkVictory(s);
  return okRes();
}

function doSell(s, player, action) {
  const country = byCountry(s, action.countryId);
  if (!country) return fail('Pais invalido.');
  if (country.ownerId !== player.id) return fail('O pais nao e seu.');
  if (ownedBy(s, player.id).length <= 1) return fail('Voce nao pode vender seu ultimo pais.');
  const valor = bankOffer(s, country);
  player.gold += valor;
  country.ownerId = null;
  country.troops = 0;
  country.small = 0;
  country.large = 0;
  s.offers = s.offers.filter((o) => o.countryId !== country.id);
  pushLog(s, `${player.name} vende ${country.name} ao banco por ${valor} (70% do investido).`, 'warn');
  return okRes();
}

function doOffer(s, player, action) {
  const country = byCountry(s, action.countryId);
  const alvo = byId(s, action.toPlayerId);
  const preco = Math.max(0, Math.floor(Number(action.price) || 0));
  if (!country) return fail('Pais invalido.');
  if (country.ownerId !== player.id) return fail('O pais nao e seu.');
  if (!alvo || !alvo.alive || alvo.id === player.id) return fail('Escolha um adversario em jogo.');
  if (ownedBy(s, player.id).length <= 1) return fail('Voce nao pode vender seu ultimo pais.');
  if (s.offers.some((o) => o.countryId === country.id && o.toId === alvo.id)) {
    return fail('Ja existe uma proposta desse pais para esse jogador.');
  }
  s.offers.push({
    id: `of${++s.offerSeq}`,
    fromId: player.id,
    toId: alvo.id,
    countryId: country.id,
    price: preco,
    round: s.round,
  });
  pushLog(s, `${player.name} oferece ${country.name} a ${alvo.name} por ${preco}.`, 'warn');
  return okRes();
}

function doCancelOffer(s, player, action) {
  const antes = s.offers.length;
  s.offers = s.offers.filter((o) => !(o.id === action.offerId && o.fromId === player.id));
  if (s.offers.length === antes) return fail('Proposta nao encontrada.');
  pushLog(s, `${player.name} retira uma proposta de venda.`);
  return okRes();
}

/**
 * Resposta a uma proposta de compra. Vale fora do turno: quem recebe pode aceitar
 * ou recusar a qualquer momento.
 */
export function respondOffer(s, playerId, offerId, aceitar) {
  if (s.phase === 'ended') return fail('A partida acabou.');
  const player = byId(s, playerId);
  const proposta = s.offers.find((o) => o.id === offerId);
  if (!player?.alive || !proposta || proposta.toId !== playerId) return fail('Proposta indisponivel.');
  const vendedor = byId(s, proposta.fromId);
  const country = byCountry(s, proposta.countryId);
  s.offers = s.offers.filter((o) => o.id !== offerId);
  if (!aceitar) {
    pushLog(s, `${player.name} recusa comprar ${country.name}.`);
    return okRes();
  }
  if (!vendedor?.alive || country.ownerId !== vendedor.id) return fail('O pais mudou de dono.');
  if (player.gold < proposta.price) return fail('Ouro insuficiente.');
  player.gold -= proposta.price;
  vendedor.gold += proposta.price;
  country.ownerId = player.id;
  country.troops = Math.max(1, Math.floor(country.troops / 2));
  pushLog(s, `${player.name} compra ${country.name} de ${vendedor.name} por ${proposta.price}.`, 'good');
  checkEliminations(s, player);
  checkVictory(s);
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
  checkVictory(s);
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
  const parcela = Math.ceil(debt / cfg.loanInstallments);
  player.gold += amount;
  player.loan = {
    principal: amount,
    debt,
    parcela,
    takenAt: s.round,
    autoPay: true,
    pagas: 0,
    atrasos: 0,
  };
  pushLog(
    s,
    `${player.name} pega ${amount} emprestado (juros de ${cfg.loanInterest * 100}%: divide de ${debt} em ` +
      `${cfg.loanInstallments} parcelas de ${parcela}).`,
    'warn',
  );
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
  checkVictory(s);
  return okRes();
}

/**
 * Combate: cada lado rola 1d12 e o maior numero leva o pais (empate defende).
 * O laranjao soma +1 ao invadir, e cartas podem somar ou tirar mais.
 */
function doAttack(s, player, action, rng) {
  const invasao = s.pending?.kind === 'enemy';
  if (!invasao && s.phase !== 'action' && s.phase !== 'move') return fail('Role o dado primeiro.');
  const from = byCountry(s, action.from);
  const target = invasao ? byCountry(s, s.pending.countryId) : byCountry(s, action.to);
  if (!from || from.ownerId !== player.id) return fail('Origem invalida.');
  if (!target || !target.ownerId) return fail('Alvo precisa ser inimigo.');
  if (target.ownerId === player.id) return fail('Alvo precisa ser inimigo.');
  if (from.troops < 2) return fail('Precisa de pelo menos 2 tropas na origem.');
  if (!neighborsOf(from.id).includes(target.id)) return fail('Sem fronteira com o alvo.');

  const defender = byId(s, target.ownerId);
  const bonus = attackBonus(s, player);
  const attDie = rollDie(rng, s.config.combatDie);
  const defDie = rollDie(rng, s.config.combatDie);
  const attTotal = attDie + bonus;
  const venceu = attTotal > defDie;

  s.combatSeq = (s.combatSeq || 0) + 1;
  s.combat = {
    id: s.combatSeq,
    from: from.id,
    to: target.id,
    fromName: from.name,
    toName: target.name,
    attDie,
    defDie,
    bonus,
    attTotal,
    captured: venceu,
    attackerId: player.id,
    attackerName: player.name,
    defenderId: defender.id,
    defenderName: defender.name,
  };

  pushLog(
    s,
    `Guerra em ${target.name}: ${player.name} tira ${attDie}${bonus ? `+${bonus}=${attTotal}` : ''} x ` +
      `${defDie} de ${defender.name}.`,
    'warn',
  );

  if (venceu) {
    const moving = Math.max(1, Math.floor(from.troops / 2));
    target.ownerId = player.id;
    target.troops = moving;
    from.troops -= moving;
    player.conquistas += 1;
    s.combat.moved = moving;
    pushLog(s, `${player.name} conquista ${target.name} e marcha com ${moving} tropa(s).`, 'good');
    if (invasao) s.pending = null;
    checkEliminations(s, player);
  } else {
    from.troops -= 1;
    pushLog(s, `${defender.name} segura ${target.name}; ${player.name} perde 1 tropa.`, 'bad');
  }
  checkVictory(s);
  return okRes();
}

function doEndTurn(s, player, rng) {
  if (s.phase === 'move') {
    s.phase = 'action';
    resolveLanding(s, player);
    if (s.pending?.kind === 'enemy') return fail('Resolva o desembarque antes de encerrar o turno.');
  }
  if (s.pending && s.pending.kind === 'enemy') {
    return fail('Pague o tributo ou conquiste o pais antes de encerrar o turno.');
  }
  s.pending = null;
  nextTurn(s, rng);
  return okRes();
}

/** Ponto de entrada unico: aplica uma acao de um jogador. */
export function act(state, playerId, action, rng = defaultRng) {
  if (state.phase === 'ended') return fail('A partida acabou.');
  const player = byId(state, playerId);
  if (!player || !player.alive) return fail('Jogador fora da partida.');
  if (current(state).id !== playerId) return fail('Nao e a sua vez.');
  const inTurn = state.phase === 'move' || state.phase === 'action';
  const resultado = resolveAction(state, player, action, rng, inTurn);
  // Toda acao bem-sucedida pode ter completado uma missao ou um objetivo de continentes.
  if (resultado.ok && state.phase !== 'ended') checkVictory(state);
  return resultado;
}

function resolveAction(state, player, action, rng, inTurn) {
  switch (action.type) {
    case 'roll': return doRoll(state, player, rng);
    case 'move': return doMove(state, player, action);
    case 'stop': return doStop(state, player);
    case 'buy': return doBuy(state, player);
    case 'tribute': return doTribute(state, player);
    case 'attack': return doAttack(state, player, action, rng);
    case 'build': return inTurn ? doBuild(state, player, action) : fail('Role o dado primeiro.');
    case 'sell': return inTurn ? doSell(state, player, action) : fail('Role o dado primeiro.');
    case 'offer': return inTurn ? doOffer(state, player, action) : fail('Role o dado primeiro.');
    case 'cancelOffer': return doCancelOffer(state, player, action);
    case 'deploy': return inTurn ? doDeploy(state, player, action) : fail('Role o dado primeiro.');
    case 'recruit': return inTurn ? doRecruit(state, player, action) : fail('Role o dado primeiro.');
    case 'loan': return inTurn ? doLoan(state, player, action) : fail('Role o dado primeiro.');
    case 'repay': return inTurn ? doRepay(state, player, action) : fail('Role o dado primeiro.');
    case 'loanAutoPay': {
      if (!player.loan) return fail('Voce nao tem divida com o banco.');
      player.loan.autoPay = !!action.on;
      pushLog(
        state,
        player.loan.autoPay
          ? `${player.name} volta a pagar as parcelas do banco.`
          : `${player.name} decide nao pagar as parcelas (juros de ${state.config.loanLateRate * 100}% por rodada).`,
        player.loan.autoPay ? 'info' : 'warn',
      );
      return okRes();
    }
    case 'skip':
      if (state.pending && state.pending.kind === 'enemy') return fail('Voce nao pode ignorar o desembarque.');
      state.pending = null;
      return okRes();
    case 'endTurn': return doEndTurn(state, player, rng);
    default: return fail('Acao desconhecida.');
  }
}

/**
 * Estado enviado aos clientes. A missao e a carta sao segredo: so vao para o dono
 * (ou para todos quando a partida acaba).
 */
export function publicState(s, viewerId = null) {
  const acabou = s.phase === 'ended';
  return {
    countries: s.countries.map((c) => ({
      id: c.id,
      name: c.name,
      cont: c.cont,
      rank: c.rank,
      income: c.income,
      price: c.price,
      ownerId: c.ownerId,
      troops: c.troops,
      small: c.small,
      large: c.large,
      tribute: c.ownerId ? tributeOf(s, c) : null,
      value: c.ownerId ? marketValue(s, c) : null,
      bankOffer: c.ownerId ? bankOffer(s, c) : null,
    })),
    offers: s.offers.filter((o) => !viewerId || o.fromId === viewerId || o.toId === viewerId),
    continents: CONTINENTS,
    players: s.players.map((p) => {
      const meu = acabou || p.id === viewerId;
      return {
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
        gross: grossIncomeOf(s, p.id),
        upkeep: upkeepOf(s, p.id),
        worth: netWorth(s, p),
        taxRate: taxRateFor(s, p),
        attackBonus: attackBonus(s, p),
        continents: continentsOf(s, p.id),
        reinforcements: reinforcementsFor(s, p.id),
        conquistas: p.conquistas,
        eliminados: p.eliminados,
        taxFree: p.taxFree,
        diceBonus: p.diceBonus,
        mission: meu ? p.mission : null,
        card: meu ? p.card : null,
      };
    }),
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
      maxRounds: s.config.maxRounds,
      recruitCost: s.config.recruitCost,
      factories: s.config.factories,
      maxFactoriesPerCountry: s.config.maxFactoriesPerCountry,
      factoryUpkeepRate: s.config.factoryUpkeepRate,
      loanMax: s.config.loanMax,
      loanFromRound: s.config.loanFromRound,
      loanInterest: s.config.loanInterest,
      loanInstallments: s.config.loanInstallments,
      loanLateRate: s.config.loanLateRate,
      loanSeizeAfter: s.config.loanSeizeAfter,
      inflationEvery: s.config.inflationEvery,
      bankTaxEvery: s.config.bankTaxEvery,
      taxBrackets: s.config.taxBrackets.map(([limite, taxa]) => [limite === Infinity ? null : limite, taxa]),
      combatDie: s.config.combatDie,
      sellToBankRate: s.config.sellToBankRate,
      offerTimeout: s.config.offerTimeout,
      eventWindow: s.config.eventWindow,
    },
  };
}

export { CONTINENTS, MISSIONS, EVENT_CARDS };
