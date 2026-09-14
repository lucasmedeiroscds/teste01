// Teste de ponta a ponta: dois navegadores (desktop e celular) jogando na mesma sala
// no mapa-mundi, com escolha de classe, rolagem de dado e movimento entre paises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { server } from '../server.js';

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
  const vizinho = await turnPage.evaluate(async () => {
    const world = await (await fetch('data/world.json')).json();
    const nome = document.querySelector('#action-box .row .btn').textContent;
    const alvo = world.countries.find((c) => c.name === nome);
    return { index: world.countries.indexOf(alvo), name: alvo.name };
  });
  const passosAntes = Number(posAntes.match(/Passos restantes: (\d)/)[1]);
  await turnPage.click('#zoom-reset'); // mapa inteiro na tela antes de clicar no pais
  await turnPage.locator('#map path.country').nth(vizinho.index).click();
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

  // Tocar num pais abre a ficha dele no painel (o mapa comeca centrado no pais do jogador).
  const caixa = await cel.locator('#map').boundingBox();
  await cel.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await cel.waitForSelector('#tile-box .box-title');
  assert.match(await cel.textContent('#tile-box'), /no ranking/);

  // O mapa cabe na tela do celular (sem rolagem horizontal).
  const overflow = await cel.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `tabuleiro estourou a largura no celular (${overflow}px)`);

  assert.deepEqual(errors, []);
});
