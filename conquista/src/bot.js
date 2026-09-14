// Bots para partidas com poucos humanos (ou solo). A politica e simples e honesta:
// o bot passa pelas mesmas acoes que um jogador, nada de atalho no motor.

import { neighborsOf } from './game.js';

const BOT_NAMES = [
  'Gen. Zap', 'Dra. Planilha', 'Sr. Offshore', 'Cel. Ctrl+C',
  'Madame Cambio', 'Dep. Emenda', 'Barao do Ferro', 'Pastor Bitcoin',
];

/** Nomes disponiveis para os bots de uma sala. */
export function botNames(quantidade, usados = []) {
  const livres = BOT_NAMES.filter((n) => !usados.includes(n));
  return livres.slice(0, quantidade);
}

const donoDe = (s, id) => s.countries.find((c) => c.id === id);
const meus = (s, playerId) => s.countries.filter((c) => c.ownerId === playerId);

/** Paises do bot que fazem fronteira com alguem. */
function fronteiras(s, playerId) {
  return meus(s, playerId).filter((c) =>
    neighborsOf(c.id).some((n) => {
      const viz = donoDe(s, n);
      return viz && viz.ownerId && viz.ownerId !== playerId;
    }));
}

/** Melhor par (origem, alvo) para atacar: tropas nossas contra tropas deles. */
function melhorAtaque(s, playerId, minTropas = 3) {
  let melhor = null;
  for (const origem of meus(s, playerId)) {
    if (origem.troops < minTropas) continue;
    for (const id of neighborsOf(origem.id)) {
      const alvo = donoDe(s, id);
      if (!alvo?.ownerId || alvo.ownerId === playerId) continue;
      const vantagem = origem.troops - alvo.troops;
      if (!melhor || vantagem > melhor.vantagem) melhor = { from: origem.id, to: alvo.id, vantagem };
    }
  }
  return melhor;
}

/**
 * Proxima acao do bot. Devolve uma acao por vez — quem chama aplica com act() e
 * pergunta de novo, ate vir um endTurn.
 */
export function nextBotAction(s, playerId) {
  const bot = s.players.find((p) => p.id === playerId);
  if (!bot || !bot.alive) return null;
  const cfg = s.config;

  if (s.phase === 'roll') return { type: 'roll' };

  if (s.phase === 'move') {
    const atual = donoDe(s, bot.pos);
    if (!atual.ownerId && bot.gold >= atual.price) return { type: 'stop' };
    if (atual.ownerId && atual.ownerId !== playerId) {
      const ataque = melhorAtaque(s, playerId, 3);
      if (ataque && ataque.to === atual.id) return { type: 'stop' };
    }
    const vizinhos = neighborsOf(bot.pos).map((id) => donoDe(s, id)).filter(Boolean);
    const livres = vizinhos.filter((c) => !c.ownerId && bot.gold >= c.price);
    const inimigos = vizinhos.filter((c) => c.ownerId && c.ownerId !== playerId);
    const escolha = livres.sort((a, b) => b.income - a.income)[0]
      || inimigos.sort((a, b) => a.troops - b.troops)[0]
      || vizinhos[Math.floor(Math.random() * vizinhos.length)];
    return { type: 'move', to: escolha.id };
  }

  const pend = s.pending;
  if (pend?.kind === 'buy') {
    const alvo = donoDe(s, pend.countryId);
    return bot.gold >= alvo.price ? { type: 'buy' } : { type: 'skip' };
  }
  if (pend?.kind === 'own') {
    const alvo = donoDe(s, pend.countryId);
    const podeGrande = bot.gold >= cfg.factories.large.cost + 500 && alvo.large < cfg.factories.large.max;
    const cabe = alvo.small + alvo.large < cfg.maxFactoriesPerCountry;
    if (cabe && podeGrande) return { type: 'build', countryId: alvo.id, size: 'large' };
    if (cabe && bot.gold >= cfg.factories.small.cost + 400) {
      return { type: 'build', countryId: alvo.id, size: 'small' };
    }
    return { type: 'skip' };
  }
  if (pend?.kind === 'enemy') {
    const ataque = melhorAtaque(s, playerId, 3);
    if (ataque && ataque.to === pend.countryId) return { type: 'attack', from: ataque.from };
    return { type: 'tribute' };
  }

  // Reforcos: tudo na fronteira mais fraca (ou no pais mais rico, se estiver em paz).
  if (bot.reserve > 0) {
    const linha = fronteiras(s, playerId);
    const alvo = linha.sort((a, b) => a.troops - b.troops)[0]
      || meus(s, playerId).sort((a, b) => b.income - a.income)[0];
    if (alvo) return { type: 'deploy', countryId: alvo.id, count: bot.reserve };
  }

  // Ataque oportunista: so quando ha vantagem clara de tropas.
  if (!bot.atacouNesteTurno) {
    const ataque = melhorAtaque(s, playerId, 4);
    if (ataque && ataque.vantagem >= 2) {
      bot.atacouNesteTurno = true;
      return { type: 'attack', from: ataque.from, to: ataque.to };
    }
  }

  // Constroi onde houver espaco, guardando caixa para tributos.
  if (bot.gold >= cfg.factories.large.cost + 600) {
    const alvo = meus(s, playerId)
      .filter((c) => c.small + c.large < cfg.maxFactoriesPerCountry && c.large < cfg.factories.large.max)
      .sort((a, b) => b.income - a.income)[0];
    if (alvo) return { type: 'build', countryId: alvo.id, size: 'large' };
  }
  if (bot.gold >= cfg.factories.small.cost + 400) {
    const alvo = meus(s, playerId)
      .filter((c) => c.small + c.large < cfg.maxFactoriesPerCountry && c.small < cfg.factories.small.max)
      .sort((a, b) => b.income - a.income)[0];
    if (alvo) return { type: 'build', countryId: alvo.id, size: 'small' };
  }

  // Sem caixa e com o banco liberado, pega emprestimo (e paga as parcelas direitinho).
  if (!bot.loan && bot.gold < 150 && s.round >= cfg.loanFromRound) {
    return { type: 'loan', amount: cfg.loanMax };
  }

  bot.atacouNesteTurno = false;
  return { type: 'endTurn' };
}
