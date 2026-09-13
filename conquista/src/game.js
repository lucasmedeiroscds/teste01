// Motor de regras de "Conquista & Capital" (servidor autoritativo, sem I/O).
// Mistura Banco Imobiliario (andar pelo tabuleiro, comprar territorio, pagar tributo,
// construir fortalezas, falir) com War (reserva de tropas, fronteiras, dados de combate,
// bonus por continente e conquista territorial).

import { CONTINENTS, COUNCIL_CARDS, createAdjacency, createTiles } from './board.js';

export const PLAYER_COLORS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];

export const RULES = {
  startMoney: 1500,
  startTroops: 8,
  passStartMoney: 200,
  passStartTroops: 1,
  landStartTroops: 2,
  hqTroops: 3,
  neutralTroops: 2,
  incomeBase: 100,
  incomePerLand: 20,
  minReinforcements: 3,
  recruitCost: 100,
  maxForts: 3,
  tributePerTroop: 15,
  targetLands: 15, // controlar 15 dos 24 territorios vence a partida
  maxRounds: 40,
};

const defaultRng = () => Math.random();
const rollDie = (rng) => 1 + Math.floor(rng() * 6);

export function createGame(playersInput, options = {}) {
  const tiles = createTiles().map((t) => ({ ...t, ownerId: null, troops: 0, forts: 0 }));
  const state = {
    tiles,
    players: playersInput.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      money: RULES.startMoney,
      reserve: RULES.startTroops,
      pos: 0,
      alive: true,
      bot: !!p.bot,
    })),
    turn: 0,
    round: 1,
    phase: 'roll',
    dice: null,
    doubles: 0,
    pending: null,
    combat: null,
    card: null,
    log: [],
    winner: null,
    config: { ...RULES, ...options },
  };
  state.adjacency = createAdjacency(tiles);
  pushLog(state, `Partida iniciada com ${state.players.length} comandantes.`);
  pushLog(state, `Vez de ${current(state).name}.`);
  return state;
}

// ---------------------------------------------------------------- utilidades

export const current = (s) => s.players[s.turn];
const byId = (s, id) => s.players.find((p) => p.id === id) || null;
const landsOf = (s, id) => s.tiles.filter((t) => t.type === 'land' && t.ownerId === id);
const fail = (msg) => ({ ok: false, error: msg });
const ok = (extra = {}) => ({ ok: true, ...extra });

function pushLog(s, text, kind = 'info') {
  s.log.push({ text, kind, at: s.log.length });
  if (s.log.length > 200) s.log.shift();
}

export function neighborsOf(s, index) {
  return [...(s.adjacency.get(index) || [])];
}

/** Continentes totalmente controlados por um jogador. */
export function continentsOf(s, playerId) {
  const out = [];
  for (const key of Object.keys(CONTINENTS)) {
    const lands = s.tiles.filter((t) => t.cont === key);
    if (lands.length && lands.every((t) => t.ownerId === playerId)) out.push(key);
  }
  return out;
}

export function tributeOf(s, tile) {
  const contBonus = continentsOf(s, tile.ownerId).includes(tile.cont) ? 2 : 1;
  return Math.round((tile.rent * (1 + tile.forts) * contBonus + tile.troops * s.config.tributePerTroop));
}

export function netWorth(s, player) {
  const lands = landsOf(s, player.id);
  const assets = lands.reduce((sum, t) => sum + t.price + t.forts * t.fortCost + t.troops * 10, 0);
  return player.money + assets + player.reserve * 10;
}

// ------------------------------------------------------------------ economia

/** Paga uma divida; devolve true se o devedor sobreviveu. */
function payDebt(s, debtor, amount, creditor) {
  if (debtor.money >= amount) {
    debtor.money -= amount;
    if (creditor) creditor.money += amount;
    return true;
  }
  const paid = Math.max(0, debtor.money);
  debtor.money = 0;
  if (creditor) creditor.money += paid;
  eliminate(s, debtor, creditor);
  return false;
}

function eliminate(s, player, creditor) {
  player.alive = false;
  player.money = 0;
  const lands = landsOf(s, player.id);
  for (const t of lands) {
    if (creditor && creditor.alive) {
      t.ownerId = creditor.id;
      t.troops = Math.max(1, Math.floor(t.troops / 2));
    } else {
      t.ownerId = null;
      t.troops = 0;
      t.forts = 0;
    }
  }
  player.reserve = 0;
  pushLog(
    s,
    creditor
      ? `${player.name} faliu! ${creditor.name} assume ${lands.length} territorio(s).`
      : `${player.name} faliu e saiu da guerra.`,
    'bad',
  );
}

function grantIncome(s, player) {
  const lands = landsOf(s, player.id);
  const conts = continentsOf(s, player.id);
  let money = s.config.incomeBase + s.config.incomePerLand * lands.length;
  let troops = Math.max(s.config.minReinforcements, Math.floor(lands.length / 3));
  for (const key of conts) {
    money += CONTINENTS[key].bonusMoney;
    troops += CONTINENTS[key].bonusTroops;
  }
  player.money += money;
  player.reserve += troops;
  const extra = conts.length ? ` (+bonus de ${conts.map((k) => CONTINENTS[k].name).join(', ')})` : '';
  pushLog(s, `${player.name} arrecada $${money} e ${troops} tropas${extra}.`);
}

// -------------------------------------------------------------------- turnos

function aliveIds(s) {
  return s.players.filter((p) => p.alive).map((p) => p.id);
}

function checkVictory(s) {
  const alive = s.players.filter((p) => p.alive);
  if (alive.length === 1) {
    s.winner = { id: alive[0].id, reason: 'Ultimo comandante em pe' };
  } else {
    const dominator = alive.find((p) => landsOf(s, p.id).length >= s.config.targetLands);
    if (dominator) {
      s.winner = { id: dominator.id, reason: `Controla ${s.config.targetLands}+ territorios` };
    } else if (s.round > s.config.maxRounds) {
      const best = [...alive].sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
      s.winner = { id: best.id, reason: 'Maior patrimonio ao fim das rodadas' };
    }
  }
  if (s.winner) {
    s.phase = 'ended';
    s.pending = null;
    pushLog(s, `${byId(s, s.winner.id).name} venceu a partida: ${s.winner.reason}.`, 'good');
  }
  return !!s.winner;
}

function nextTurn(s) {
  if (checkVictory(s)) return;
  s.pending = null;
  s.combat = null;
  s.card = null;
  s.dice = null;
  s.doubles = 0;
  let guard = 0;
  do {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) s.round += 1;
  } while (!s.players[s.turn].alive && guard++ < s.players.length * 2);
  if (checkVictory(s)) return;
  s.phase = 'roll';
  const p = current(s);
  grantIncome(s, p);
  pushLog(s, `Rodada ${s.round}: vez de ${p.name}.`);
}

/** Remove um jogador que abandonou a partida. */
export function surrender(s, playerId) {
  const p = byId(s, playerId);
  if (!p || !p.alive || s.phase === 'ended') return fail('Jogador indisponivel.');
  pushLog(s, `${p.name} abandonou a guerra.`, 'bad');
  eliminate(s, p, null);
  if (current(s).id === playerId) nextTurn(s);
  else checkVictory(s);
  return ok();
}

// ---------------------------------------------------------------- movimentos

function landOn(s, player, rng) {
  const tile = s.tiles[player.pos];
  switch (tile.type) {
    case 'start':
      player.money += s.config.passStartMoney;
      player.reserve += s.config.landStartTroops;
      pushLog(s, `${player.name} chega a Base Aliada: +$${s.config.passStartMoney} e +${s.config.landStartTroops} tropas.`);
      break;
    case 'hq':
      player.reserve += s.config.hqTroops;
      s.pending = { kind: 'command', tileId: null };
      pushLog(s, `${player.name} ocupa o Quartel-General: +${s.config.hqTroops} tropas e um ataque livre.`);
      break;
    case 'neutral':
      player.reserve += s.config.neutralTroops;
      pushLog(s, `${player.name} descansa na Zona Neutra: +${s.config.neutralTroops} tropas.`);
      break;
    case 'council':
      drawCard(s, player, rng);
      break;
    case 'land':
      if (!tile.ownerId) {
        s.pending = { kind: 'buy', tileId: tile.index };
        pushLog(s, `${tile.name} esta livre por $${tile.price}.`);
      } else if (tile.ownerId === player.id) {
        s.pending = { kind: 'own', tileId: tile.index };
        pushLog(s, `${player.name} inspeciona ${tile.name}.`);
      } else {
        const tribute = tributeOf(s, tile);
        s.pending = { kind: 'enemy', tileId: tile.index, tribute };
        pushLog(
          s,
          `${player.name} invade ${tile.name} (${byId(s, tile.ownerId).name}): pague $${tribute} ou declare guerra.`,
          'warn',
        );
      }
      break;
    default:
      break;
  }
}

function drawCard(s, player, rng) {
  const card = COUNCIL_CARDS[Math.floor(rng() * COUNCIL_CARDS.length)];
  s.card = card;
  pushLog(s, `Conselho de Guerra - ${player.name}: ${card.text}`, 'warn');
  let money = card.money || 0;
  if (card.perLand) money += card.perLand * landsOf(s, player.id).length;
  if (card.perFort) money += card.perFort * landsOf(s, player.id).reduce((a, t) => a + t.forts, 0);
  if (card.troops) player.reserve = Math.max(0, player.reserve + card.troops);
  if (card.goStart) {
    player.pos = 0;
    player.money += s.config.passStartMoney;
    player.reserve += s.config.landStartTroops;
  }
  if (money > 0) player.money += money;
  else if (money < 0) payDebt(s, player, -money, null);
}

// -------------------------------------------------------------------- acoes

function doRoll(s, player, rng) {
  if (s.phase !== 'roll') return fail('Nao e hora de rolar os dados.');
  const d1 = rollDie(rng);
  const d2 = rollDie(rng);
  s.dice = [d1, d2];
  s.combat = null;
  s.card = null;
  const isDouble = d1 === d2;
  s.doubles = isDouble ? s.doubles + 1 : 0;
  if (isDouble && s.doubles >= 3) {
    pushLog(s, `${player.name} tirou 3 duplas seguidas: motim nas tropas, perde a vez.`, 'bad');
    player.reserve = Math.max(0, player.reserve - 2);
    nextTurn(s);
    return ok();
  }
  const steps = d1 + d2;
  const before = player.pos;
  player.pos = (player.pos + steps) % s.tiles.length;
  if (player.pos < before || steps === s.tiles.length) {
    if (player.pos !== 0) {
      player.money += s.config.passStartMoney;
      player.reserve += s.config.passStartTroops;
      pushLog(s, `${player.name} passa pela Base Aliada: +$${s.config.passStartMoney} e +${s.config.passStartTroops} tropa.`);
    }
  }
  pushLog(s, `${player.name} tira ${d1}+${d2}${isDouble ? ' (dupla!)' : ''} e vai para ${s.tiles[player.pos].name}.`);
  s.phase = 'action';
  landOn(s, player, rng);
  return ok();
}

function doBuy(s, player) {
  if (!s.pending || s.pending.kind !== 'buy') return fail('Nao ha territorio a comprar.');
  const tile = s.tiles[s.pending.tileId];
  if (player.money < tile.price) return fail('Dinheiro insuficiente.');
  player.money -= tile.price;
  tile.ownerId = player.id;
  tile.troops = Math.max(1, tile.troops);
  s.pending = null;
  pushLog(s, `${player.name} anexa ${tile.name} por $${tile.price}.`, 'good');
  checkVictory(s);
  return ok();
}

function doTribute(s, player) {
  if (!s.pending || s.pending.kind !== 'enemy') return fail('Nao ha tributo pendente.');
  const tile = s.tiles[s.pending.tileId];
  const owner = byId(s, tile.ownerId);
  const amount = s.pending.tribute;
  s.pending = null;
  pushLog(s, `${player.name} paga $${amount} de tributo a ${owner.name}.`);
  payDebt(s, player, amount, owner);
  checkVictory(s);
  return ok();
}

function doFortify(s, player) {
  if (!s.pending || s.pending.kind !== 'own') return fail('Voce precisa estar em um territorio seu.');
  const tile = s.tiles[s.pending.tileId];
  if (tile.forts >= s.config.maxForts) return fail('Fortalezas no maximo.');
  if (player.money < tile.fortCost) return fail('Dinheiro insuficiente.');
  player.money -= tile.fortCost;
  tile.forts += 1;
  pushLog(s, `${player.name} constroi a ${tile.forts}a fortaleza em ${tile.name} (-$${tile.fortCost}).`, 'good');
  return ok();
}

function doDeploy(s, player, action) {
  const count = Math.max(1, Math.floor(Number(action.count) || 1));
  const tile = s.tiles[action.tileId];
  if (!tile || tile.type !== 'land') return fail('Casa invalida.');
  if (tile.ownerId !== player.id) return fail('Territorio nao e seu.');
  if (player.reserve < count) return fail('Reserva insuficiente.');
  player.reserve -= count;
  tile.troops += count;
  pushLog(s, `${player.name} posiciona ${count} tropa(s) em ${tile.name}.`);
  return ok();
}

function doRecruit(s, player, action) {
  const count = Math.max(1, Math.floor(Number(action.count) || 1));
  const cost = count * s.config.recruitCost;
  if (player.money < cost) return fail('Dinheiro insuficiente para recrutar.');
  player.money -= cost;
  player.reserve += count;
  pushLog(s, `${player.name} recruta ${count} tropa(s) por $${cost}.`);
  return ok();
}

function doAttack(s, player, action, rng) {
  if (!s.pending || (s.pending.kind !== 'enemy' && s.pending.kind !== 'command')) {
    return fail('Nao ha alvo para atacar agora.');
  }
  const from = s.tiles[action.from];
  const target = s.pending.kind === 'enemy' ? s.tiles[s.pending.tileId] : s.tiles[action.to];
  if (!from || from.type !== 'land' || from.ownerId !== player.id) return fail('Origem invalida.');
  if (!target || target.type !== 'land') return fail('Alvo invalido.');
  if (target.ownerId === player.id || !target.ownerId) return fail('Alvo precisa ser inimigo.');
  if (from.troops < 2) return fail('Precisa de pelo menos 2 tropas na origem.');
  if (!neighborsOf(s, from.index).includes(target.index)) return fail('Sem fronteira com o alvo.');

  const attCount = Math.min(3, from.troops - 1);
  const defCount = Math.min(2, target.troops);
  const attRolls = Array.from({ length: attCount }, () => rollDie(rng)).sort((a, b) => b - a);
  const bonus = Math.min(2, target.forts);
  const defRolls = Array.from({ length: Math.max(1, defCount) }, () => rollDie(rng))
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

  const defenderName = byId(s, target.ownerId).name;
  s.combat = {
    from: from.index,
    to: target.index,
    attRolls,
    defRolls,
    attLoss,
    defLoss,
    captured: false,
  };
  pushLog(
    s,
    `Batalha em ${target.name}: ${player.name} [${attRolls.join(',')}] x ${defenderName} [${defRolls.join(',')}] - ` +
      `atacante perde ${attLoss}, defensor perde ${defLoss}.`,
    'warn',
  );

  if (target.troops === 0) {
    const moving = Math.min(from.troops - 1, Math.max(1, attCount));
    const loser = byId(s, target.ownerId);
    target.ownerId = player.id;
    target.forts = Math.floor(target.forts / 2);
    target.troops = moving;
    from.troops -= moving;
    s.combat.captured = true;
    pushLog(s, `${player.name} conquista ${target.name} de ${loser.name} com ${moving} tropa(s)!`, 'good');
    if (s.pending.kind === 'enemy' && s.pending.tileId === target.index) s.pending = null;
    else s.pending = null;
    if (!landsOf(s, loser.id).length && loser.money <= 0) eliminate(s, loser, player);
    checkVictory(s);
  } else if (s.pending.kind === 'command' && from.troops < 2) {
    s.pending = null;
  }
  return ok();
}

function doEndTurn(s, player) {
  if (s.pending && s.pending.kind === 'enemy') {
    return fail('Resolva a invasao: pague o tributo ou conquiste o territorio.');
  }
  s.pending = null;
  if (s.dice && s.dice[0] === s.dice[1] && s.doubles > 0 && s.doubles < 3) {
    s.phase = 'roll';
    s.combat = null;
    s.card = null;
    pushLog(s, `${player.name} tirou dupla e joga novamente.`);
    return ok();
  }
  nextTurn(s);
  return ok();
}

/** Ponto de entrada unico: aplica uma acao de um jogador. */
export function act(state, playerId, action, rng = defaultRng) {
  if (state.phase === 'ended') return fail('A partida acabou.');
  const player = byId(state, playerId);
  if (!player || !player.alive) return fail('Jogador fora da partida.');
  if (current(state).id !== playerId) return fail('Nao e a sua vez.');

  switch (action.type) {
    case 'roll':
      return doRoll(state, player, rng);
    case 'buy':
      return doBuy(state, player);
    case 'tribute':
      return doTribute(state, player);
    case 'fortify':
      return doFortify(state, player);
    case 'deploy':
      return state.phase === 'action' ? doDeploy(state, player, action) : fail('Role os dados primeiro.');
    case 'recruit':
      return state.phase === 'action' ? doRecruit(state, player, action) : fail('Role os dados primeiro.');
    case 'attack':
      return doAttack(state, player, action, rng);
    case 'skip':
      if (state.pending && state.pending.kind === 'enemy') return fail('Voce nao pode ignorar a invasao.');
      state.pending = null;
      return ok();
    case 'endTurn':
      return doEndTurn(state, player);
    default:
      return fail('Acao desconhecida.');
  }
}

/** Estado serializavel enviado aos clientes. */
export function publicState(s) {
  return {
    tiles: s.tiles.map((t) => ({
      index: t.index,
      row: t.row,
      col: t.col,
      type: t.type,
      id: t.id || null,
      name: t.name,
      desc: t.desc || null,
      cont: t.cont || null,
      price: t.price || null,
      rent: t.rent || null,
      fortCost: t.fortCost || null,
      ownerId: t.ownerId,
      troops: t.troops,
      forts: t.forts,
      tribute: t.ownerId ? tributeOf(s, t) : null,
    })),
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      money: p.money,
      reserve: p.reserve,
      pos: p.pos,
      alive: p.alive,
      lands: landsOf(s, p.id).length,
      continents: continentsOf(s, p.id),
      worth: netWorth(s, p),
    })),
    turn: s.turn,
    currentId: current(s).id,
    round: s.round,
    phase: s.phase,
    dice: s.dice,
    pending: s.pending,
    combat: s.combat,
    card: s.card,
    winner: s.winner,
    log: s.log.slice(-40),
    config: { targetLands: s.config.targetLands, maxRounds: s.config.maxRounds, recruitCost: s.config.recruitCost },
    adjacency: Object.fromEntries([...s.adjacency].map(([k, v]) => [k, [...v]])),
  };
}

export { aliveIds, CONTINENTS };
