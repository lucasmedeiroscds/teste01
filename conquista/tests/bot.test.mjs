import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, current } from '../src/game.js';
import { botNames, nextBotAction } from '../src/bot.js';

/** Toca uma partida inteira so com bots e devolve o que aconteceu. */
function jogarComBots(qtd, seed) {
  let x = seed;
  const rng = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const nomes = botNames(qtd);
  const s = createGame(
    nomes.map((nome, i) => ({ id: `bot${i + 1}`, name: nome, cls: 'empresario', bot: true })),
    {},
    rng,
  );
  let acoes = 0;
  let invalidas = 0;
  while (!s.winner && acoes < 20_000) {
    const jogador = current(s);
    const acao = nextBotAction(s, jogador.id);
    assert.ok(acao, 'o bot sempre tem uma acao');
    const res = act(s, jogador.id, acao, rng);
    if (!res.ok) {
      invalidas++;
      act(s, jogador.id, { type: 'endTurn' }, rng);
    }
    acoes++;
  }
  return { s, acoes, invalidas };
}

test('nomes de bot nao se repetem', () => {
  const nomes = botNames(5);
  assert.equal(nomes.length, 5);
  assert.equal(new Set(nomes).size, 5);
  assert.equal(botNames(3, nomes.slice(0, 2)).some((n) => nomes.slice(0, 2).includes(n)), false);
});

test('uma partida so de bots termina sozinha, sem acoes invalidas', () => {
  for (const seed of [7, 99, 2024]) {
    const { s, acoes, invalidas } = jogarComBots(4, seed);
    assert.ok(s.winner, `a partida terminou (semente ${seed})`);
    assert.equal(invalidas, 0, `nenhuma acao invalida (semente ${seed}, ${acoes} acoes)`);
    assert.ok(acoes < 20_000, 'sem laco infinito');
    assert.ok(s.round <= s.config.maxRounds + 1);
  }
});

test('bot compra, constroi e usa as tropas', () => {
  const { s } = jogarComBots(3, 11);
  const donos = s.countries.filter((c) => c.ownerId).length;
  const industrias = s.countries.reduce((a, c) => a + c.small + c.large, 0);
  const tropas = s.countries.reduce((a, c) => a + c.troops, 0);
  assert.ok(donos > 3, `bots expandiram (${donos} paises com dono)`);
  assert.ok(industrias > 0, `bots construiram (${industrias} industrias)`);
  assert.ok(tropas > 10, `bots posicionaram tropas (${tropas})`);
});

test('bot enfrenta guerra: alguem conquista alguma coisa ao longo da partida', () => {
  let conquistas = 0;
  for (const seed of [3, 8, 21, 55]) {
    const { s } = jogarComBots(4, seed);
    conquistas += s.players.reduce((a, p) => a + p.conquistas, 0);
  }
  assert.ok(conquistas > 0, `houve guerra em algum momento (${conquistas} conquistas)`);
});
