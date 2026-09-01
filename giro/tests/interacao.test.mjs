/* Testa o que foi acrescentado para o app ficar mais dinâmico e intuitivo:
 * dados de exemplo, comparação com o período anterior, leitura em português,
 * animação de números e barras, atalhos da calculadora e transição de tela.
 *
 *   python3 -m http.server 8899        (na raiz do repositório)
 *   node giro/tests/interacao.test.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.GIRO_URL || 'http://127.0.0.1:8899/giro/';
const SHOTS = process.env.GIRO_SHOTS || './shots';
const problemas = [];
const log = (...a) => console.log(...a);
const falha = (m) => { problemas.push(m); console.log('   ✗ ' + m); };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'pt-BR', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => falha('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  const u = m.location()?.url || '';
  if (m.type() === 'error' && !u.includes('fonts.g')) falha('CONSOLE: ' + m.text().slice(0, 120));
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#form-ob');
await page.click('[data-ob-pular]');
await page.waitForTimeout(300);

/* 1. estado vazio ativo */
const passos = await page.locator('.passo').count();
const feitosAntes = await page.locator('.passo.feito').count();
log(`✓ primeiros passos: ${passos} etapas, ${feitosAntes} já marcada(s)`);
if (passos !== 3) falha(`esperava 3 passos, achei ${passos}`);

/* 2. dados de exemplo */
if (!(await page.locator('[data-exemplo]').count())) falha('botão de exemplo não apareceu no estado vazio');
await page.click('[data-exemplo]');
await page.waitForSelector('[data-chart-dias] svg');
await page.waitForTimeout(900);

const faixaVisivel = await page.locator('#faixa-exemplo:not([hidden])').count();
const turnosExemplo = await page.evaluate(() => JSON.parse(localStorage.getItem('giro.state.v1')).turnos.length);
const colunas = await page.locator('[data-chart-dias] svg path.bar').count();
const heroExemplo = (await page.textContent('.tile.hero')).replace(/\s+/g, ' ').trim();
log(`✓ exemplo: ${turnosExemplo} lançamentos, ${colunas} colunas no gráfico, faixa de aviso visível=${!!faixaVisivel}`);
log(`   painel abre em: ${heroExemplo}`);
if (/R\$\s*0,00/.test(heroExemplo)) falha('o exemplo abriu com o painel zerado');
if (turnosExemplo < 15) falha(`exemplo gerou poucos lançamentos (${turnosExemplo})`);
if (!faixaVisivel) falha('faixa de aviso do exemplo não apareceu');
if (colunas < 7) falha(`gráfico ficou vazio com os dados de exemplo (${colunas} colunas)`);

/* a faixa tem que seguir em todas as telas */
await page.click('.nav-mobile a[href="#/custos"]');
await page.waitForTimeout(400);
if (!(await page.locator('#faixa-exemplo:not([hidden])').count())) falha('faixa de exemplo some ao trocar de tela');
await page.click('.nav-mobile a[href="#/painel"]');
await page.waitForSelector('[data-chart-dias] svg');
await page.waitForTimeout(600);

/* 3. comparação com o período anterior
 *    Semeado à mão: a comparação exige base nos dois lados, e a data em que o
 *    teste roda pode cair no começo da semana, quando o app corretamente se
 *    cala. Aqui garantimos os dois lados para ver o selo aparecer. */
await page.evaluate(() => {
  const p = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const hoje = new Date();
  const seg = new Date(hoje); seg.setDate(seg.getDate() - ((hoje.getDay() + 6) % 7));
  const dia = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d); };
  const semanaPassada = new Date(seg); semanaPassada.setDate(semanaPassada.getDate() - 7);
  const linha = (data, bruto, km) => ({
    id: 'x' + data + km, data, app: 'ifood', bruto, gorjeta: 0, km,
    horas: 8, corridas: 20, gastos: 0, origem: 'manual', criadoEm: '',
  });
  const s = JSON.parse(localStorage.getItem('giro.state.v1'));
  s.turnos = [
    linha(dia(semanaPassada, 0), 200, 140), linha(dia(semanaPassada, 1), 210, 145),
    linha(dia(seg, 0), 250, 140), linha(dia(seg, 1), 260, 145),
  ];
  s.ui.periodo = 'semana';
  localStorage.setItem('giro.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-chart-dias] svg');
await page.waitForTimeout(900);

const deltas = await page.locator('.delta').allTextContents();
const classesDelta = await page.evaluate(() => [...document.querySelectorAll('.delta')].map((d) => d.className).join(' | '));
const refTexto = (await page.textContent('.view-head p')).replace(/\s+/g, ' ');
log(`✓ variação: ${deltas.length} selo(s) — ${deltas.join(', ')}`);
log(`   ${classesDelta}`);
log(`   referência: ${(refTexto.match(/comparam com [^·]+/) || ['(nenhuma)'])[0].trim()}`);
if (!deltas.length) falha('nenhum selo de variação apareceu, mesmo com base nos dois lados');
if (!/subiu-bom/.test(classesDelta)) falha('semana melhor que a anterior não foi marcada como positiva');
if (!/comparam com a semana passada/.test(refTexto)) falha('a referência da comparação não está escrita na tela');
await page.screenshot({ path: `${SHOTS}/int-03-deltas.png`, fullPage: true });

/* a base fraca precisa calar o selo em vez de mostrar porcentagem absurda */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('giro.state.v1'));
  s.turnos = s.turnos.map((t, i) => (i < 2 ? { ...t, bruto: 4, km: 3 } : t));
  localStorage.setItem('giro.state.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-chart-dias] svg');
await page.waitForTimeout(700);
const deltasRuido = await page.locator('.delta').allTextContents();
log(`✓ base quase zero: ${deltasRuido.length ? deltasRuido.join(', ') : 'nenhum selo (correto)'}`);
if (deltasRuido.some((t) => /\d{3,}%/.test(t))) falha(`porcentagem ilegível exibida: ${deltasRuido.join(', ')}`);
if (deltasRuido.some((t) => /^\s*\d{2,3}%/.test(t) && parseInt(t) >= 100)) falha(`variação acima do dobro devia virar multiplicador: ${deltasRuido.join(', ')}`);

/* volta ao exemplo para o resto do teste */
await page.evaluate(() => localStorage.removeItem('giro.state.v1'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#form-ob');
await page.click('[data-ob-pular]');
await page.waitForTimeout(300);
await page.click('[data-exemplo]');
await page.waitForSelector('[data-chart-dias] svg');
await page.waitForTimeout(800);

/* 4. leitura em português sob os números */
const leituras = await page.locator('.leitura').allTextContents();
log(`✓ leitura em português: ${leituras.length} linha(s)`);
log(`   ex.: "${(leituras[0] || '').replace(/\s+/g, ' ').trim()}"`);
if (leituras.length < 3) falha(`esperava leituras nos cartões principais, achei ${leituras.length}`);

/* 5. o número é contado, não aparece pronto */
await page.click('button[data-periodo="semana"]');
const amostras = await page.evaluate(async () => {
  const el = document.querySelector('.tile.hero .tile-value');
  const vistos = [];
  for (let i = 0; i < 8; i++) {
    vistos.push(el.textContent);
    await new Promise((r) => setTimeout(r, 45));
  }
  return [...new Set(vistos)].length;
});
log(`✓ contagem animada: ${amostras} valores distintos durante a transição`);
if (amostras < 3) falha(`o número não foi contado, apareceu pronto (${amostras} amostras distintas)`);

/* 6. barras entram animadas e o destaque acompanha o toque */
const temAnimacao = await page.evaluate(() => {
  const g = document.querySelector('[data-chart-dias] .bar-in');
  return g ? getComputedStyle(g).animationName : 'sem grupo';
});
log(`✓ animação das barras: ${temAnimacao}`);
if (temAnimacao !== 'barraSobe') falha(`barras sem animação de entrada (${temAnimacao})`);

await page.locator('[data-chart-dias] svg rect.hit').nth(5).tap();
await page.waitForTimeout(250);
const destacada = await page.locator('[data-chart-dias] .bar.is-hot').count();
log(`✓ destaque da barra tocada: ${destacada}`);
if (!destacada) falha('a barra tocada não recebeu destaque');

await page.screenshot({ path: `${SHOTS}/int-01-painel-exemplo.png`, fullPage: true });

/* 7. atalhos da calculadora */
await page.click('.nav-mobile a[href="#/corrida"]');
await page.waitForSelector('#form-corrida');
await page.click('[data-chip="c-valor"][data-valor="8"]');
await page.click('[data-chip="c-entrega"][data-valor="5"]');
await page.fill('#c-coleta', '3');
await page.waitForTimeout(350);
const valorCampo = await page.inputValue('#c-valor');
const chipAceso = await page.locator('[data-chip="c-valor"][aria-pressed="true"]').count();
const veredito = (await page.textContent('.veredito')).replace(/\s+/g, ' ').trim();
log(`✓ atalhos: valor="${valorCampo}", ${chipAceso} atalho aceso`);
log(`   veredito: ${veredito}`);
if (valorCampo !== '8') falha(`o atalho não preencheu o campo (${valorCampo})`);
if (!chipAceso) falha('o atalho usado não ficou aceso');
if (!/Vale a pena|No limite|Não vale/.test(veredito)) falha('veredito grande não renderizou');
await page.screenshot({ path: `${SHOTS}/int-02-corrida.png`, fullPage: true });

/* 7b. com um campo em foco a barra inferior sai da frente do teclado,
 *     e ela precisa voltar assim que o foco sai */
await page.locator('#c-coleta').focus();
await page.waitForTimeout(200);
const barraOculta = await page.evaluate(() => document.querySelector('#app').classList.contains('is-digitando'));
await page.evaluate(() => document.activeElement.blur());
await page.waitForTimeout(250);
const barraVoltou = await page.locator('.nav-mobile a[href="#/painel"]').isVisible();
log(`✓ barra inferior: escondida com o teclado=${barraOculta}, voltou ao sair do campo=${barraVoltou}`);
if (!barraOculta) falha('a barra inferior não saiu da frente do teclado');
if (!barraVoltou) falha('a barra inferior não voltou depois de sair do campo');

/* 8. o primeiro lançamento de verdade apaga o exemplo */
await page.click('.nav-mobile a[href="#/lancar"]');
await page.waitForSelector('#form-turno');
await page.fill('#t-bruto', '240');
await page.fill('#t-km', '152');
await page.fill('#t-horas', '8');
await page.evaluate(() => document.activeElement.blur());
await page.waitForTimeout(150);
await page.click('#form-turno button[type=submit]');
await page.waitForTimeout(600);
const depois = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('giro.state.v1'));
  return { turnos: s.turnos.length, exemplo: !!s.ui.exemplo, origens: [...new Set(s.turnos.map((t) => t.origem))] };
});
const faixaSumiu = !(await page.locator('#faixa-exemplo:not([hidden])').count());
log(`✓ após o primeiro lançamento real: ${depois.turnos} turno(s), origem ${depois.origens.join('/')}, exemplo=${depois.exemplo}, faixa sumiu=${faixaSumiu}`);
if (depois.turnos !== 1) falha(`o exemplo não foi limpo: sobraram ${depois.turnos} lançamentos`);
if (depois.exemplo) falha('a marca de exemplo continuou ligada');
if (!faixaSumiu) falha('a faixa de exemplo continuou na tela');

/* 9. quem pede menos movimento não recebe animação */
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'pt-BR', reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('#form-ob');
await p2.click('[data-ob-pular]');
await p2.waitForTimeout(300);
await p2.click('[data-exemplo]');
await p2.waitForSelector('[data-chart-dias] svg');
await p2.waitForTimeout(500);
const semMovimento = await p2.evaluate(() => {
  const g = document.querySelector('[data-chart-dias] .bar-in');
  const t = document.querySelector('.tiles .tile');
  return { barra: g ? getComputedStyle(g).animationName : '?', tile: t ? getComputedStyle(t).animationName : '?' };
});
log(`✓ prefers-reduced-motion: barra=${semMovimento.barra}, cartão=${semMovimento.tile}`);
if (semMovimento.barra !== 'none' || semMovimento.tile !== 'none') {
  falha(`animação não foi desligada com movimento reduzido (${JSON.stringify(semMovimento)})`);
}

await browser.close();
console.log('\n================');
if (problemas.length) { problemas.forEach((p) => console.log(' ✗ ' + p)); process.exit(1); }
console.log('Interação: tudo passou.');
