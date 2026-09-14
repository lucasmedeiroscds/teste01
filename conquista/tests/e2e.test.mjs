// Teste de ponta a ponta: dois navegadores (desktop e celular) jogando na mesma sala
// no mapa-mundi, com escolha de classe, rolagem de dado e movimento entre paises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { server } from '../server.js';


/**
 * Clica num pais pelo id, mirando o centroide (o clique no centro da caixa do elemento
 * cairia no mar em paises com formato concavo ou em arquipelagos).
 * Devolve false quando o ponto nao pertence ao proprio pais.
 */
async function clicarPais(page, id) {
  const ponto = await page.evaluate((alvo) => {
    const geo = window.__world.byId.get(alvo);
    const map = document.querySelector('#map');
    const [vx, vy, vw, vh] = map.getAttribute('viewBox').split(' ').map(Number);
    const caixa = map.getBoundingClientRect();
    const x = caixa.left + ((geo.cx - vx) / vw) * caixa.width;
    const y = caixa.top + ((geo.cy - vy) / vh) * caixa.height;
    const alvoNoPonto = document.elementFromPoint(x, y);
    return { x, y, acerta: alvoNoPonto?.dataset?.id === alvo };
  }, id);
  if (!ponto.acerta) return false;
  await page.mouse.click(ponto.x, ponto.y);
  return true;
}

test('dois jogadores (PC e celular) entram na sala e jogam um turno', async (t) => {
  server.listen(0);
  await once(server, 'listening');
  const base = `http://localhost:${server.address().port}`;
  // O ambiente pode ter uma build do Chromium diferente da baixada pelo Playwright.
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {});
  t.after(async () => { await browser.close(); server.close(); });

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ ...devices['iPhone 12'] });
  const pc = await desktop.newPage();
  const cel = await mobile.newPage();
  const errors = [];
  for (const page of [pc, cel]) page.on('pageerror', (e) => errors.push(e.message));

  await pc.goto(base);
  await pc.fill('#input-name', 'Ana');
  await pc.click('#btn-create');
  await pc.waitForSelector('#screen-lobby:not([hidden])');
  const code = (await pc.textContent('#lobby-code')).trim();
  assert.match(code, /^[A-Z0-9]{4}$/);

  await cel.goto(`${base}/?sala=${code}`);
  await cel.fill('#input-name', 'Bia');
  await cel.click('#btn-join');
  await cel.waitForSelector('#screen-lobby:not([hidden])');
  await pc.waitForFunction(() => document.querySelectorAll('#lobby-players li').length === 2);

  // Escolha de classe (a do celular vira figura religiosa).
  await cel.locator('.class-card', { hasText: 'Figura religiosa' }).click();
  await cel.waitForSelector('.class-card.on');

  await pc.click('#btn-start');
  await pc.waitForSelector('#screen-game:not([hidden])');
  await cel.waitForSelector('#screen-game:not([hidden])');
  assert.equal(await pc.locator('#map path.country').count(), 60);
  assert.equal(await pc.locator('#map circle.pawn').count(), 2);

  // Quem estiver na vez rola o dado, anda para um vizinho e para.
  const turnPage = (await pc.textContent('#turn-label')).includes('Sua vez') ? pc : cel;
  const otherPage = turnPage === pc ? cel : pc;
  await turnPage.locator('#action-box .btn', { hasText: 'Rolar o dado' }).click();
  await turnPage.waitForSelector('.map-status');
  const posAntes = await turnPage.evaluate(() => document.querySelector('#map-status').textContent);
  assert.match(posAntes, /Passos restantes: [1-6]/);
  // Anda clicando direto num pais vizinho no mapa (nao so pelo botao da lista).
  const vizinhos = await turnPage.evaluate(() => {
    const nomes = [...document.querySelectorAll('#action-box .row .btn')].map((b) => b.textContent);
    return [...window.__world.byId.values()].filter((c) => nomes.includes(c.name)).map((c) => c.id);
  });
  const passosAntes = Number(posAntes.match(/Passos restantes: (\d)/)[1]);
  await turnPage.click('#zoom-reset'); // mapa inteiro na tela antes de clicar no pais
  await turnPage.waitForTimeout(200); // o mapa e redesenhado num rAF apos mudar o zoom
  let clicou = false;
  for (const id of vizinhos) {
    clicou = await clicarPais(turnPage, id);
    if (clicou) break;
  }
  assert.ok(clicou, 'algum vizinho pode ser clicado direto no mapa');
  await turnPage.waitForFunction(
    (antes) => {
      const txt = document.querySelector('#map-status')?.textContent || '';
      const m = txt.match(/Passos restantes: (\d)/);
      return !m || Number(m[1]) < antes;
    },
    passosAntes,
  );
  await turnPage.locator('#action-box .btn', { hasText: /Parar aqui|Encerrar turno/ }).first().click();
  await turnPage.waitForSelector('#action-box');
  await otherPage.waitForFunction(() => document.querySelectorAll('#log li').length > 3);

  // Tocar num pais abre a ficha dele no painel.
  await cel.click('#zoom-reset');
  await cel.waitForTimeout(200);
  const candidatos = await cel.evaluate(() => window.__ccRoom.game.countries.map((c) => c.id));
  let abriu = false;
  for (const id of candidatos) {
    if (await clicarPais(cel, id)) { abriu = true; break; }
  }
  assert.ok(abriu, 'algum pais pode ser tocado no mapa');
  await cel.waitForSelector('#tile-box .box-title');
  assert.match(await cel.textContent('#tile-box'), /no ranking/);

  // O mapa cabe na tela do celular (sem rolagem horizontal).
  const overflow = await cel.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `tabuleiro estourou a largura no celular (${overflow}px)`);

  assert.deepEqual(errors, []);
});

test('modo solo pelo navegador: um humano contra dois bots', async (t) => {
  server.listen(0);
  await once(server, 'listening');
  const base = `http://localhost:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {});
  t.after(async () => { await browser.close(); server.close(); });

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(base);
  await page.fill('#input-name', 'Ana');
  await page.click('#btn-create');
  await page.waitForSelector('#screen-lobby:not([hidden])');

  // Sozinho, o botao de iniciar so libera depois de adicionar bots.
  assert.equal(await page.locator('#btn-start').isDisabled(), true);
  await page.locator('#bots-box .btn', { hasText: '2 bots' }).click();
  await page.waitForFunction(() => !document.querySelector('#btn-start').disabled);
  await page.click('#btn-start');
  await page.waitForSelector('#screen-game:not([hidden])');

  await page.waitForFunction(() => document.querySelectorAll('#game-players li').length === 3, null, { timeout: 15_000 });
  await page.click('.tab[data-tab="jogadores"]');
  assert.match(await page.textContent('#game-players'), /🤖/);

  // Joga o turno do humano; depois o jogo anda sozinho enquanto a vez e dos bots.
  await page.click('.tab[data-tab="acoes"]');
  await page.waitForFunction(() => document.querySelector('#turn-label').textContent.includes('Sua vez'), null, { timeout: 20_000 });
  await page.locator('#action-box .btn', { hasText: 'Rolar o dado' }).click();
  await page.locator('#action-box .btn', { hasText: 'Parar aqui' }).click();
  const linhas = await page.locator('#log li').count();
  await page.locator('#action-box .btn', { hasText: 'Encerrar turno' }).click();
  await page.waitForFunction(
    (antes) => document.querySelectorAll('#log li').length > antes + 2,
    linhas,
    { timeout: 25_000 },
  );
  assert.match(await page.textContent('#log'), /Gen\. Zap|Dra\. Planilha|Sr\. Offshore/);
  assert.deepEqual(erros, []);
});
