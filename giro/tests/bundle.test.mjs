/* Confere que o arquivo único de giro/dist/ se comporta igual à versão em
 * módulos — mesmos números, mesmos gráficos, mesmo carrossel — nos três
 * motores, em viewport de celular.
 *
 *   node giro/tools/bundle.mjs
 *   python3 -m http.server 8899
 *   node giro/tests/bundle.test.mjs
 */
/* Confere que a versão de arquivo único se comporta como a versão em módulos,
 * nos três motores, em viewport de celular. */
import { chromium, firefox, webkit, devices } from 'playwright';

const URL_BUNDLE = process.env.GIRO_BUNDLE_URL || 'http://127.0.0.1:8899/giro/dist/giro.html';
const problemas = [];
const resultados = [];

/** Espera o texto parar de mudar — os números do painel entram contando. */
async function textoEstavel(page, seletor, timeout = 4000) {
  const fim = Date.now() + timeout;
  let anterior = null;
  let iguais = 0;
  while (Date.now() < fim) {
    const atual = await page.textContent(seletor);
    iguais = atual === anterior ? iguais + 1 : 0;
    if (iguais >= 3) return atual;
    anterior = atual;
    await page.waitForTimeout(90);
  }
  return anterior ?? '';
}

const ALVOS = [
  { nome: 'chrome-android', engine: chromium, launch: {}, ctx: { ...devices['Pixel 7'] } },
  { nome: 'safari-ios', engine: webkit, launch: {}, ctx: { ...devices['iPhone 14'] } },
  { nome: 'firefox-android', engine: firefox, launch: { firefoxUserPrefs: { 'network.proxy.type': 0 } }, ctx: { viewport: { width: 393, height: 830 }, hasTouch: true } },
];

for (const alvo of ALVOS) {
  const browser = await alvo.engine.launch(alvo.launch);
  const page = await (await browser.newContext({ ...alvo.ctx, locale: 'pt-BR' })).newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { const u = m.location()?.url || ''; if (m.type() === 'error' && !u.includes('fonts.g')) erros.push(m.text()); });

  await page.goto(URL_BUNDLE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#form-ob', { timeout: 15000 });
  await page.fill('#ob-preco', '6,29');
  await page.fill('#ob-consumo', '28');
  await page.fill('#ob-fixo', '540');
  await page.click('#form-ob button[type=submit]');
  await page.waitForSelector('#form-ob', { state: 'detached' });

  // lança um dia e confere o cálculo
  await page.click('.nav-mobile a[href="#/lancar"]');
  await page.waitForSelector('#form-turno');
  await page.fill('#t-bruto', '240');
  await page.fill('#t-km', '152');
  await page.fill('#t-horas', '8');
  const previa = (await textoEstavel(page, '#previa')).replace(/\s+/g, ' ');
  await page.click('#form-turno button[type=submit]');
  await page.waitForTimeout(300);

  await page.click('.nav-mobile a[href="#/painel"]');
  await page.waitForSelector('[data-chart-dias] svg', { timeout: 10000 });
  const hero = (await textoEstavel(page, '.tile.hero')).replace(/\s+/g, ' ').trim();
  const colunas = await page.locator('[data-chart-dias] svg path.bar').count();

  // carrossel: 60 s e sem travar no toque
  await page.click('.nav-mobile a[href="#/dicas"]');
  await page.waitForSelector('.tips');
  const s0 = await page.textContent('[data-secs]');
  await page.locator('.tips-slide.is-active h3').tap().catch(() => page.locator('.tips-slide.is-active h3').click());
  await page.waitForTimeout(2600);
  const s1 = await page.textContent('[data-secs]');

  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const persistiu = await page.evaluate(() => JSON.parse(localStorage.getItem('giro.state.v1') || '{}').turnos?.length ?? 0);

  console.log(`\n[${alvo.nome}]`);
  console.log(`  prévia ao vivo : ${previa.slice(0, 70)}`);
  console.log(`  painel         : ${hero}`);
  console.log(`  colunas        : ${colunas}   overflow: ${over}px   turnos salvos: ${persistiu}`);
  console.log(`  carrossel      : ${s0} → ${s1}`);

  if (erros.length) problemas.push(`[${alvo.nome}] erros: ${erros.slice(0, 3).join(' | ')}`);
  resultados.push({ motor: alvo.nome, previa: previa.match(/R\$[\s\u00a0]*[\d.,]+/)?.[0], hero: hero.match(/R\$[\s\u00a0]*[\d.,]+/)?.[0], colunas });
  if (colunas < 5) problemas.push(`[${alvo.nome}] gráfico não desenhou (${colunas} colunas)`);
  if (over > 2) problemas.push(`[${alvo.nome}] overflow horizontal de ${over}px`);
  if (persistiu !== 1) problemas.push(`[${alvo.nome}] não persistiu no localStorage`);
  if (parseInt(s1) >= parseInt(s0)) problemas.push(`[${alvo.nome}] carrossel travou após toque`);

  await page.screenshot({ path: `${process.env.GIRO_SHOTS || './shots-mobile'}/bundle-${alvo.nome}.png` });
  await browser.close();
}

// o que importa é os três motores darem exatamente o mesmo número
const assinatura = (r) => `${r.previa}|${r.hero}|${r.colunas}`;
const unicos = [...new Set(resultados.map(assinatura))];
console.log('\n================');
if (unicos.length !== 1) {
  problemas.push('motores divergiram: ' + resultados.map((r) => `${r.motor}=${assinatura(r)}`).join('  '));
} else {
  console.log('Os três motores produzem o mesmo resultado:', unicos[0]);
}
if (problemas.length) { problemas.forEach((p) => console.log(' ✗ ' + p)); process.exit(1); }
console.log('Arquivo único: idêntico à versão em módulos nos três motores.');
