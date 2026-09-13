// Teste de ponta a ponta: dois navegadores (desktop e celular) jogando na mesma sala.
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

  await pc.click('#btn-start');
  await pc.waitForSelector('#screen-game:not([hidden])');
  await cel.waitForSelector('#screen-game:not([hidden])');
  assert.equal(await pc.locator('#board .tile').count(), 28);

  // Quem estiver na vez rola os dados; o outro ve o resultado.
  const turnPage = (await pc.textContent('#turn-label')).includes('Sua vez') ? pc : cel;
  const otherPage = turnPage === pc ? cel : pc;
  await turnPage.click('#action-box .btn');
  await turnPage.waitForSelector('.die');
  await otherPage.waitForSelector('.die');

  // O tabuleiro cabe na tela do celular (sem rolagem horizontal).
  const overflow = await cel.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `tabuleiro estourou a largura no celular (${overflow}px)`);

  assert.deepEqual(errors, []);
});
