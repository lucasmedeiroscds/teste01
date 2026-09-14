import { once } from 'node:events';
import { chromium, devices } from 'playwright';
import { server } from './server.js';

const OUT = '/tmp/claude-0/shots';
server.listen(0); await once(server, 'listening');
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await (await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 2 })).newPage();
const cel = await (await browser.newContext({ ...devices['iPhone 12'] })).newPage();
pg.on('pageerror', e => console.log('ERR', e.message));

await pg.goto(base);
await pg.fill('#input-name', 'Ana'); await pg.click('#btn-create');
await pg.waitForSelector('#screen-lobby:not([hidden])');
const code = (await pg.textContent('#lobby-code')).trim();
await pg.locator('.class-card', { hasText: 'Laranjao' }).click();
await pg.locator('#bots-box .btn', { hasText: '3 bots' }).click();
await pg.click('#btn-start');
await pg.waitForSelector('#screen-game:not([hidden])');
await cel.goto(`${base}/?sala=${code}`);
await pg.click('#zoom-reset'); await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/01-mapa-novo.png` });

const flags = {};
const fecharModal = async () => {
  if (await pg.locator('#modal:not([hidden])').count()) {
    const t = await pg.textContent('#modal-title');
    if (t.includes('Fim de jogo')) { flags.fim = true; await pg.screenshot({ path: `${OUT}/07-fim-de-jogo.png` }); return true; }
    if (t.includes('Carta') && !flags.carta) { flags.carta = true; }
    await pg.locator('#modal-actions .btn').last().click().catch(() => {});
  }
  return false;
};

const fim = Date.now() + 170_000;
while (Date.now() < fim && !flags.fim) {
  // faixa de batalha aparece para qualquer combate na mesa
  if (!flags.batalha && await pg.locator('#battle-flash:not([hidden])').count()) {
    flags.batalha = true;
    await pg.screenshot({ path: `${OUT}/05-invasao.png` });
  }
  if (await fecharModal()) break;
  if (!(await pg.textContent('#turn-label')).includes('Sua vez')) { await pg.waitForTimeout(250); continue; }

  const btns = pg.locator('#action-box .btn');
  const texts = await btns.allTextContents();
  const enabled = await Promise.all(texts.map((_, k) => btns.nth(k).isEnabled()));
  const pick = (re) => texts.findIndex((t, k) => enabled[k] && re.test(t));

  if (!flags.emprestimo && pick(/Pegar emprestimo/) >= 0) {
    await btns.nth(pick(/Pegar emprestimo/)).click({ timeout: 3000 }).catch(() => {});
    await pg.waitForTimeout(300);
    if (await pg.locator('#modal:not([hidden])').count()) {
      flags.emprestimo = true;
      await pg.screenshot({ path: `${OUT}/03-emprestimo.png` });
      const maxRange = await pg.locator('#modal-body input[type=range]').getAttribute('max');
      console.log('teto do emprestimo na janela:', maxRange);
      await pg.locator('#modal-actions .btn', { hasText: 'Assinar' }).click();
    }
    continue;
  }
  if (!flags.venda) {
    await pg.click('#zoom-me'); await pg.waitForTimeout(150);
    const meu = await pg.evaluate(() => {
      const g = window.__ccRoom.game;
      const { playerId } = JSON.parse(localStorage.getItem('cc:session'));
      const c = g.countries.find((x) => x.ownerId === playerId);
      return c?.id || null;
    });
    if (meu) {
      const ponto = await pg.evaluate((alvo) => {
        const geo = window.__world.byId.get(alvo);
        const map = document.querySelector('#map');
        const [vx, vy, vw, vh] = map.getAttribute('viewBox').split(' ').map(Number);
        const caixa = map.getBoundingClientRect();
        const x = caixa.left + ((geo.cx - vx) / vw) * caixa.width;
        const y = caixa.top + ((geo.cy - vy) / vh) * caixa.height;
        return { x, y, ok: document.elementFromPoint(x, y)?.dataset?.id === alvo };
      }, meu);
      if (ponto.ok) {
        await pg.mouse.click(ponto.x, ponto.y);
        await pg.waitForTimeout(200);
        const vender = pg.locator('#tile-box .btn:not([disabled])', { hasText: 'Vender ou negociar' });
        if (await vender.count()) {
          await vender.click({ timeout: 3000 }).catch(() => {});
          await pg.waitForTimeout(250);
          if (await pg.locator('#modal:not([hidden])').count()) {
            flags.venda = true;
            await pg.screenshot({ path: `${OUT}/04-venda.png` });
            await pg.locator('#modal-actions .btn', { hasText: 'Cancelar' }).click();
          }
        }
      }
    }
  }

  let idx = pick(/Rolar o dado/);
  if (idx < 0) idx = pick(/Parar aqui/);
  if (idx < 0) idx = pick(/Comprar por/);
  if (idx < 0) idx = pick(/Atacar de/);
  if (idx < 0) idx = pick(/Industria (pequena|grande)/);
  if (idx < 0) idx = pick(/Pagar tributo/);
  if (idx < 0) idx = pick(/^Ok$|Deixar passar/);
  if (idx < 0) idx = pick(/Encerrar turno/);
  if (idx < 0) { await pg.waitForTimeout(250); continue; }
  await fecharModal();
  await btns.nth(idx).click({ timeout: 3000 }).catch(() => {});
  await pg.waitForTimeout(100);
}

await pg.click('#zoom-reset').catch(() => {}); await pg.waitForTimeout(300);
await pg.screenshot({ path: `${OUT}/06-mapa-final.png` });
await cel.screenshot({ path: `${OUT}/02-mapa-celular.png` });
console.log('flags:', flags);
await browser.close(); server.close();
