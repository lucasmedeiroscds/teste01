/* Teste móvel nos três motores que importam: Chromium (Chrome Android),
 * WebKit (Safari iOS) e Gecko (Firefox Android).
 *
 *   npm i -D playwright
 *   npx playwright install chromium firefox webkit
 *   npx playwright install-deps            (Linux)
 *   python3 -m http.server 8899            (na raiz do repositório)
 *   node giro/tests/mobile.test.mjs
 *
 * Cobre: suporte a backdrop-filter e color-mix (com os fallbacks), rolagem
 * horizontal em todas as rotas, barra inferior fixa, carrossel no toque
 * (o cronômetro não pode travar), arrastar para trocar de dica, tamanho do
 * alvo de toque, tooltip do gráfico no dedo e aparência dos campos.
 *
 * Variáveis: GIRO_URL, GIRO_SHOTS.
 */
import { chromium, firefox, webkit, devices } from 'playwright';

const BASE = process.env.GIRO_URL || 'http://127.0.0.1:8899/giro/';
const SHOTS = process.env.GIRO_SHOTS || './shots-mobile';
const ROTAS = ['#/painel', '#/lancar', '#/corrida', '#/custos', '#/relatorios', '#/conexoes', '#/dicas'];

const ALVOS = [
  { nome: 'chrome-android', engine: chromium, ctx: { ...devices['Pixel 7'] } },
  { nome: 'safari-ios',     engine: webkit,   ctx: { ...devices['iPhone 14'] } },
  { nome: 'firefox-android',engine: firefox,  launch: { firefoxUserPrefs: { 'network.proxy.type': 0 } }, ctx: { viewport: { width: 393, height: 830 }, hasTouch: true, userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0' } },
];

const achados = [];
const nota = (alvo, msg) => { achados.push(`[${alvo}] ${msg}`); console.log(`   ✗ ${msg}`); };

for (const alvo of ALVOS) {
  console.log(`\n=== ${alvo.nome} ===`);
  const browser = await alvo.engine.launch(alvo.launch || {});
  const ctx = await browser.newContext({ ...alvo.ctx, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => nota(alvo.nome, 'PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    const u = m.location()?.url || '';
    if (m.type() === 'error' && !u.includes('fonts.g')) nota(alvo.nome, 'CONSOLE: ' + m.text().slice(0, 120));
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // semeia dados e marca onboarding como feito
  await page.evaluate(() => {
    const hoje = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const turnos = [];
    const apps = ['ifood','uber','99','rappi','ifood','uber','ifood'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      turnos.push({ id: 't'+i, data: iso(d), app: apps[i], bruto: 150 + i*22, gorjeta: i*3, km: 110 + i*11, horas: 7 + (i%3), corridas: 14 + i, gastos: i === 0 ? 28 : 0, origem: 'manual', criadoEm: new Date().toISOString() });
    }
    const s = JSON.parse(localStorage.getItem('giro.state.v1'));
    s.perfil.onboarded = true;
    s.turnos = turnos;
    localStorage.setItem('giro.state.v1', JSON.stringify(s));
  });

  // 1. suporte a CSS que a casca depende
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const suporte = await page.evaluate(() => ({
    backdrop: CSS.supports('backdrop-filter', 'blur(4px)'),
    backdropWebkit: CSS.supports('-webkit-backdrop-filter', 'blur(4px)'),
    colorMix: CSS.supports('background', 'color-mix(in srgb, red 50%, transparent)'),
    dvh: CSS.supports('height', '100dvh'),
    hasSel: CSS.supports('selector(:has(a))'),
    topbarBg: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
  }));
  console.log('   suporte:', JSON.stringify(suporte));
  if (!suporte.colorMix && /rgba\(0, 0, 0, 0\)|transparent/.test(suporte.topbarBg)) {
    nota(alvo.nome, 'topbar sem cor de fundo (color-mix não suportado e sem fallback)');
  }
  if (suporte.backdrop === false && suporte.backdropWebkit === true) {
    nota(alvo.nome, 'só suporta -webkit-backdrop-filter, que a folha de estilo não declara');
  }

  // 2. overflow horizontal por rota
  for (const rota of ROTAS) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(450);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 2) nota(alvo.nome, `overflow horizontal em ${rota}: ${over}px`);
  }
  console.log('   overflow: verificado nas 7 rotas');

  // 3. a barra inferior gruda mesmo no rodapé da tela ao rolar?
  await page.goto(BASE + '#/dicas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const antes = await page.evaluate(() => document.querySelector('.nav-mobile').getBoundingClientRect().bottom);
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(350);
  const depois = await page.evaluate(() => ({
    bottom: document.querySelector('.nav-mobile').getBoundingClientRect().bottom,
    vh: window.innerHeight,
    scrollY: window.scrollY,
  }));
  console.log(`   barra inferior: antes=${Math.round(antes)}  depois=${Math.round(depois.bottom)}  altura da tela=${depois.vh}  scroll=${Math.round(depois.scrollY)}`);
  if (depois.scrollY > 100 && Math.abs(depois.bottom - depois.vh) > 4) {
    nota(alvo.nome, `barra inferior não fica fixa ao rolar (bottom=${Math.round(depois.bottom)} vs tela=${depois.vh})`);
  }

  // 4. toque no carrossel deixa o cronômetro travado para sempre?
  await page.goto(BASE + '#/dicas', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tips');
  await page.waitForTimeout(400);
  const s0 = await page.textContent('[data-secs]');
  await page.locator('.tips-slide.is-active h3').tap().catch(async () => { await page.locator('.tips-slide.is-active h3').click(); });
  await page.waitForTimeout(2600);
  const s1 = await page.textContent('[data-secs]');
  console.log(`   carrossel após tocar no texto: ${s0} → ${s1}`);
  if (parseInt(s1) >= parseInt(s0)) nota(alvo.nome, `cronômetro travou após um toque (${s0} → ${s1}) — pausa de hover presa no toque`);

  // 4b. arrastar o dedo troca de dica
  await page.goto(BASE + '#/dicas', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tips');
  await page.waitForTimeout(400);
  const tituloAntes = await page.textContent('.tips-slide.is-active h3');
  const cx = await page.locator('.tips-viewport').boundingBox();
  if (cx) {
    await page.mouse.move(cx.x + cx.width - 30, cx.y + cx.height / 2);
    await page.touchscreen.tap(cx.x + cx.width - 30, cx.y + cx.height / 2).catch(() => {});
    // arrasto real com ponteiro de toque
    await page.evaluate(({ x, y, w }) => {
      const alvo = document.querySelector('.tips');
      const disparar = (tipo, cx2) => alvo.dispatchEvent(new PointerEvent(tipo, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
        clientX: cx2, clientY: y, buttons: tipo === 'pointerup' ? 0 : 1,
      }));
      disparar('pointerdown', x + w - 40);
      disparar('pointermove', x + 40);
      disparar('pointerup', x + 40);
    }, { x: cx.x, y: cx.y + cx.height / 2, w: cx.width });
    await page.waitForTimeout(300);
    const tituloDepois = await page.textContent('.tips-slide.is-active h3');
    console.log(`   arrastar: "${tituloAntes.slice(0, 26)}…" → "${tituloDepois.slice(0, 26)}…"`);
    if (tituloAntes === tituloDepois) nota(alvo.nome, 'arrastar o dedo não troca de dica');
  }

  // 4c. alvo de toque dos pontinhos
  const alvoPontos = await page.evaluate(() => {
    const b = document.querySelector('.tips-dots button');
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log(`   pontinho do carrossel: ${alvoPontos.w}x${alvoPontos.h}px`);
  if (alvoPontos.h < 24) nota(alvo.nome, `pontinho do carrossel com ${alvoPontos.h}px de altura (mínimo 24)`);

  // 5. tooltip do gráfico no toque: aparece e some?
  await page.goto(BASE + '#/painel', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-chart-dias] svg');
  await page.waitForTimeout(400);
  const alvoBarra = page.locator('[data-chart-dias] svg rect.hit').nth(3);
  await alvoBarra.tap().catch(async () => { await alvoBarra.click(); });
  await page.waitForTimeout(250);
  const tipDepoisDoToque = await page.locator('[data-chart-dias] .chart-tip.on').count();
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(3400);   // o auto-fechamento do toque é de 2,8 s
  const tipAindaVisivel = await page.locator('[data-chart-dias] .chart-tip.on').count();
  console.log(`   tooltip: apareceu=${!!tipDepoisDoToque}  continua na tela depois=${!!tipAindaVisivel}`);
  if (!tipDepoisDoToque) nota(alvo.nome, 'tooltip do gráfico não abre no toque');
  if (tipAindaVisivel) nota(alvo.nome, 'tooltip do gráfico fica preso na tela após o toque');

  // 6. estado de hover preso em botão depois do toque
  await page.goto(BASE + '#/lancar', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-aba]');
  await page.waitForTimeout(300);
  const btn = page.locator('[data-aba="abastecimento"]');
  const corAntes = await btn.evaluate((e) => getComputedStyle(e).backgroundColor);
  await btn.tap().catch(async () => { await btn.click(); });
  await page.waitForTimeout(400);
  console.log(`   hover em botão: antes=${corAntes}`);

  // 6b. <select> com aparência própria (o iOS ignora sem appearance:none)
  await page.goto(BASE + '#/lancar', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#t-app', { state: 'visible' });
  const sel = await page.evaluate(() => {
    const e = document.querySelector('#t-app');
    const cs = getComputedStyle(e);
    return { appearance: cs.appearance || cs.webkitAppearance, radius: cs.borderTopLeftRadius, altura: Math.round(e.getBoundingClientRect().height) };
  });
  console.log('   select:', JSON.stringify(sel));
  if (sel.appearance !== 'none') nota(alvo.nome, `select sem appearance:none (${sel.appearance})`);
  if (sel.altura < 44) nota(alvo.nome, `select com ${sel.altura}px de altura (mínimo 44)`);

  // 7. alvos de toque menores que 44px
  await page.goto(BASE + '#/painel', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const pequenos = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, a[href], input, select, summary')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 30 || r.width < 24) {
        out.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).slice(0, 24) : ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)].slice(0, 8);
  });
  if (pequenos.length) console.log('   alvos pequenos:', pequenos.join(' · '));

  // capturas
  for (const [rota, arq] of [['#/painel', 'painel'], ['#/lancar', 'lancar'], ['#/dicas', 'dicas']]) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/${alvo.nome}-${arq}.png` });
  }

  await browser.close();
}

console.log('\n================ ACHADOS ================');
if (!achados.length) console.log('Nenhum problema encontrado nos três motores.');
else achados.forEach((a) => console.log(' - ' + a));
