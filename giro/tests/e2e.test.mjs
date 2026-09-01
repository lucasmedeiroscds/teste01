/* Teste ponta a ponta do Giro num Chromium real.
 *
 *   npx playwright install chromium      (uma vez)
 *   python3 -m http.server 8899           (na raiz do repositório)
 *   node giro/tests/e2e.test.mjs
 *
 * Variáveis: GIRO_URL, GIRO_SHOTS, CHROME_PATH.
 */
import { chromium } from 'playwright';

const SHOTS = process.env.GIRO_SHOTS || './shots';
const BASE = process.env.GIRO_URL || 'http://127.0.0.1:8899/giro/';
const problemas = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR', colorScheme: 'dark' });
const page = await ctx.newPage();

page.on('console', (m) => {
  const url = m.location()?.url || '';
  if (m.type() === 'error' && !url.includes('fonts.g')) problemas.push('CONSOLE: ' + m.text() + ' @ ' + url);
});
page.on('pageerror', (e) => problemas.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => {
  if (!r.url().includes('fonts.g')) problemas.push('REQFAIL: ' + r.url() + ' ' + r.failure()?.errorText);
});

await page.goto(BASE, { waitUntil: 'networkidle' });

/* 1. onboarding */
await page.waitForSelector('#form-ob', { timeout: 5000 });
log('✓ onboarding apareceu');
await page.screenshot({ path: `${SHOTS}/01-onboarding.png` });
await page.fill('#ob-preco', '6,29');
await page.fill('#ob-consumo', '28');
await page.fill('#ob-fixo', '540');
await page.click('#form-ob button[type=submit]');
await page.waitForSelector('#form-ob', { state: 'detached' });
log('✓ onboarding concluído');

/* 2. painel vazio */
await page.screenshot({ path: `${SHOTS}/02-painel-vazio.png`, fullPage: true });

/* 3. lançar turnos */
const hoje = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const dias = [];
for (let i = 6; i >= 0; i--) { const d = new Date(hoje); d.setDate(d.getDate() - i); dias.push(iso(d)); }

const dados = [
  ['ifood', 214, 12, 138, 8, 0, 22],
  ['uber', 268, 0, 176, 9, 30, 19],
  ['ifood', 152, 6, 121, 6, 0, 15],
  ['99', 198, 0, 164, 8, 0, 17],
  ['ifood', 305, 24, 189, 10, 0, 31],
  ['rappi', 96, 4, 88, 4, 0, 11],
  ['uber', 240, 0, 152, 8, 0, 18],
];

await page.click('a[href="#/lancar"]');
await page.waitForSelector('#form-turno');

for (let i = 0; i < dados.length; i++) {
  const [app, bruto, gorj, km, hh, mm, corridas] = dados[i];
  await page.fill('#t-data', dias[i]);
  await page.selectOption('#t-app', app);
  await page.fill('#t-bruto', String(bruto).replace('.', ','));
  await page.fill('#t-gorjeta', String(gorj));
  await page.fill('#t-km', String(km));
  await page.fill('#t-horas', String(hh));
  await page.fill('#t-min', String(mm));
  await page.fill('#t-corridas', String(corridas));
  if (i === 0) {
    await page.fill('#t-gastos', '32');
    const previa = await page.textContent('#previa');
    log('  prévia ao vivo:', previa.replace(/\s+/g, ' ').trim().slice(0, 110));
    if (!/Sobra estimada/.test(previa)) problemas.push('prévia do turno não calculou');
  }
  await page.click('#form-turno button[type=submit]');
  await page.waitForTimeout(120);
}
log('✓ 7 turnos lançados');
await page.screenshot({ path: `${SHOTS}/03-lancar.png`, fullPage: true });

/* 4. abastecimentos */
await page.click('button[data-aba="abastecimento"]');
await page.waitForSelector('#form-abast');
const abast = [[dias[0], 5000, 11.4, 71.7], [dias[2], 5310, 11.1, 69.8], [dias[4], 5602, 10.6, 66.7], [dias[6], 5901, 10.9, 68.6]];
for (const [d, odo, l, v] of abast) {
  await page.fill('#a-data', d);
  await page.fill('#a-odo', String(odo));
  await page.fill('#a-litros', String(l).replace('.', ','));
  await page.fill('#a-valor', String(v).replace('.', ','));
  await page.click('#form-abast button[type=submit]');
  await page.waitForTimeout(100);
}
const consumoTxt = await page.textContent('#form-abast + .card');
log('✓ consumo real:', consumoTxt.replace(/\s+/g, ' ').match(/Consumo medido\s*([\d,]+)/)?.[1] || '?', 'km/L');
await page.screenshot({ path: `${SHOTS}/04-abastecimento.png`, fullPage: true });

/* 5. painel com dados */
await page.click('a[href="#/painel"]');
await page.waitForSelector('[data-chart-dias] svg');
const nColunas = await page.locator('[data-chart-dias] svg path.bar').count();
const nBarrasApp = await page.locator('[data-chart-apps] svg path.bar').count();
log(`✓ gráficos: ${nColunas} colunas de dia, ${nBarrasApp} barras de app`);
if (nColunas < 5 || nBarrasApp < 2) problemas.push('gráficos não renderizaram como esperado');
const heroTxt = await page.textContent('.tile.hero');
log('  hero:', heroTxt.replace(/\s+/g, ' ').trim());
await page.screenshot({ path: `${SHOTS}/05-painel-dark.png`, fullPage: true });

/* período mês */
await page.click('button[data-periodo="mes"]');
await page.waitForTimeout(300);
log('  período mês:', (await page.textContent('.tile.hero')).replace(/\s+/g, ' ').trim());

/* 6. tooltip do gráfico */
await page.click('button[data-periodo="semana"]');
await page.waitForTimeout(300);
const hit = page.locator('[data-chart-dias] svg rect.hit').nth(3);
await hit.hover();
await page.waitForTimeout(200);
const tipVisivel = await page.locator('[data-chart-dias] .chart-tip.on').count();
log(tipVisivel ? '✓ tooltip do gráfico funciona' : '✗ tooltip não apareceu');
if (!tipVisivel) problemas.push('tooltip do gráfico de dias não apareceu');

/* 7. calculadora de corrida */
await page.click('a[href="#/corrida"]');
await page.waitForSelector('#form-corrida');
await page.fill('#c-valor', '6,50');
await page.fill('#c-coleta', '4');
await page.fill('#c-entrega', '6');
await page.fill('#c-min', '28');
await page.waitForTimeout(250);
const res1 = (await page.textContent('#resultado')).replace(/\s+/g, ' ').trim();
log('  corrida ruim →', res1.slice(0, 130));
if (!/Não vale/.test(res1)) problemas.push('veredito "não vale" não apareceu para corrida ruim');
await page.screenshot({ path: `${SHOTS}/06-corrida-ruim.png`, fullPage: true });

await page.fill('#c-valor', '32,00');
await page.fill('#c-coleta', '2');
await page.fill('#c-entrega', '7');
await page.fill('#c-min', '25');
await page.waitForTimeout(250);
const res2 = (await page.textContent('#resultado')).replace(/\s+/g, ' ').trim();
log('  corrida boa  →', res2.slice(0, 130));
if (!/Vale a pena/.test(res2)) problemas.push('veredito "vale a pena" não apareceu para corrida boa');
await page.screenshot({ path: `${SHOTS}/07-corrida-boa.png`, fullPage: true });

/* 8. custos */
await page.click('a[href="#/custos"]');
await page.waitForSelector('#resumo-custos');
const custoKm = (await page.textContent('#resumo-custos .tile.hero')).replace(/\s+/g, ' ').trim();
log('  ', custoKm);
await page.fill('#p-preco', '7,50');
await page.waitForTimeout(200);
const custoKm2 = (await page.textContent('#resumo-custos .tile.hero')).replace(/\s+/g, ' ').trim();
log('  após subir o litro para 7,50:', custoKm2);
if (custoKm === custoKm2) problemas.push('resumo de custos não recalculou ao vivo');
await page.fill('#p-preco', '6,29');
await page.waitForTimeout(150);

// regressão: campos formatados com separador de milhar ("2.000") precisam ser
// relidos como 2000, não como 2 — senão o R$/km do item sai 1000x errado
const porKm = await page.locator('[data-manut] span.num').allTextContents();
log('  R$/km por item de manutenção:', porKm.join(' · '));
if (porKm.some((t) => !/^R\$\s0,\d\d\/km$/.test(t.replace(/\s/g, ' ').trim()))) {
  problemas.push('R$/km de manutenção fora de escala — provável erro ao reler número com separador de milhar: ' + porKm.join(' | '));
}
const intervalo = await page.inputValue('[data-manut] [data-manut-km]');
await page.fill('#m-dias', '25');
await page.waitForTimeout(200);
await page.fill('#m-dias', '24');
const intervaloDepois = await page.inputValue('[data-manut] [data-manut-km]');
if (intervalo !== intervaloDepois) problemas.push(`intervalo de manutenção mudou sozinho: ${intervalo} → ${intervaloDepois}`);
log(`  intervalo do 1º item estável em "${intervaloDepois}"`);

await page.screenshot({ path: `${SHOTS}/08-custos.png`, fullPage: true });

/* 9. relatórios */
await page.click('a[href="#/relatorios"]');
await page.waitForSelector('#sel-mes');
await page.screenshot({ path: `${SHOTS}/09-relatorios.png`, fullPage: true });
const fech = (await page.textContent('tfoot')).replace(/\s+/g, ' ').trim();
log('  fechamento:', fech);

/* 10. carrossel de dicas */
await page.click('a[href="#/dicas"]');
await page.waitForSelector('.tips');
const dur = await page.evaluate(async () => (await import('./assets/js/tips.js')).TEMPO_POR_DICA_MS);
log(`✓ tempo por dica = ${dur} ms (${dur / 1000}s)`);
if (dur !== 60000) problemas.push('tempo por dica não é 60 s');

const secs0 = await page.textContent('[data-secs]');
await page.mouse.move(5, 5);
await page.waitForTimeout(2500);
const secs1 = await page.textContent('[data-secs]');
log(`  contagem: ${secs0} → ${secs1}`);
if (parseInt(secs1) >= parseInt(secs0)) problemas.push('cronômetro não está correndo');

const t0 = await page.textContent('.tips-slide.is-active h3');
await page.click('[data-next]');
await page.waitForTimeout(150);
const t1 = await page.textContent('.tips-slide.is-active h3');
const secsReset = await page.textContent('[data-secs]');
log(`  próxima dica: "${t1.slice(0, 46)}…" · cronômetro voltou para ${secsReset}`);
if (t0 === t1) problemas.push('botão próxima não trocou a dica');
if (parseInt(secsReset) < 59) problemas.push('cronômetro não reiniciou ao navegar');

await page.mouse.move(5, 5);
await page.click('[data-toggle]');
const sp0 = await page.textContent('[data-secs]');
await page.waitForTimeout(1600);
const sp1 = await page.textContent('[data-secs]');
log(`  pausado: ${sp0} → ${sp1}`);
if (sp0 !== sp1) problemas.push('pausa não segurou o cronômetro');
await page.click('[data-toggle]');
await page.mouse.move(5, 5);

const nDots = await page.locator('.tips-dots button').count();
log(`✓ ${nDots} dicas no carrossel`);
await page.screenshot({ path: `${SHOTS}/10-dicas.png`, fullPage: true });

/* 11. conexões + import CSV */
await page.click('a[href="#/conexoes"]');
await page.waitForSelector('#arq');
await page.screenshot({ path: `${SHOTS}/11-conexoes.png`, fullPage: true });

const csv = [
  'Data da viagem,Ganhos,Gorjeta,Distância da viagem (km),Duração,Cidade',
  `${dias[1]} 12:04:00,"18,90","0,00","7,4",00:22:11,Recife`,
  `${dias[1]} 13:31:00,"12,40","3,00","4,1",00:15:40,Recife`,
  `${dias[3]} 19:02:00,"24,10","0,00","11,8",00:31:05,Recife`,
  `${dias[3]} 20:14:00,"9,80","2,00","3,2",00:11:20,Recife`,
  'linha,quebrada,sem,data,,',
].join('\n');
await page.setInputFiles('#arq', { name: 'extrato-uber.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
await page.waitForSelector('#mapeamento table');
const mapeadas = await page.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('[data-map]')].map((s) => [s.dataset.map, s.value])));
log('  mapeamento automático:', JSON.stringify(mapeadas));
if (!mapeadas.data || !mapeadas.bruto || !mapeadas.km) problemas.push('auto-mapeamento do CSV falhou');
const previaLinhas = await page.locator('#mapeamento tbody tr').count();
log(`  prévia: ${previaLinhas} lançamento(s) agrupados por dia`);
await page.screenshot({ path: `${SHOTS}/12-import-csv.png`, fullPage: true });
await page.click('[data-confirmar]');
await page.waitForTimeout(400);
const totalTurnos = await page.evaluate(() => JSON.parse(localStorage.getItem('giro.state.v1')).turnos.length);
log(`✓ CSV importado — ${totalTurnos} lançamentos no total`);
if (totalTurnos !== 9) problemas.push(`esperava 9 lançamentos após importar, achei ${totalTurnos}`);

/* 12. persistência após recarregar */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const temModal = await page.locator('#form-ob').count();
if (temModal) problemas.push('onboarding reapareceu depois de concluído');
log(temModal ? '✗ onboarding reapareceu' : '✓ dados persistiram, onboarding não voltou');

/* 13. tema claro */
await page.click('#btn-tema');
await page.waitForTimeout(300);
await page.goto(BASE + '#/painel');
await page.waitForSelector('[data-chart-dias] svg');
await page.screenshot({ path: `${SHOTS}/13-painel-light.png`, fullPage: true });
log('✓ tema claro');

/* 14. mobile */
const mob = await ctx.newPage();
mob.on('pageerror', (e) => problemas.push('MOBILE PAGEERROR: ' + e.message));
await mob.setViewportSize({ width: 390, height: 844 });
await mob.goto(BASE + '#/painel', { waitUntil: 'networkidle' });
await mob.waitForSelector('.nav-mobile');
await mob.waitForTimeout(700);
await mob.screenshot({ path: `${SHOTS}/14-mobile-painel.png`, fullPage: true });
await mob.goto(BASE + '#/dicas');
await mob.waitForSelector('.tips');
await mob.waitForTimeout(500);
await mob.screenshot({ path: `${SHOTS}/15-mobile-dicas.png`, fullPage: true });
await mob.goto(BASE + '#/corrida');
await mob.waitForSelector('#form-corrida');
await mob.fill('#c-valor', '14,00'); await mob.fill('#c-coleta', '3'); await mob.fill('#c-entrega', '5'); await mob.fill('#c-min', '22');
await mob.waitForTimeout(300);
await mob.screenshot({ path: `${SHOTS}/16-mobile-corrida.png`, fullPage: true });

/* 15. overflow horizontal */
for (const [nome, p] of [['desktop', page], ['mobile', mob]]) {
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log(`  overflow horizontal ${nome}: ${over}px`);
  if (over > 2) problemas.push(`overflow horizontal em ${nome}: ${over}px`);
}

await browser.close();

console.log('\n================ RESULTADO ================');
if (problemas.length) { console.log('PROBLEMAS:'); problemas.forEach((p) => console.log(' - ' + p)); process.exit(1); }
console.log('Tudo passou.');
