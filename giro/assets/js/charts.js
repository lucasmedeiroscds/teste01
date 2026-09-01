/* Gráficos em SVG, sem biblioteca externa.
 *
 * Especificação seguida em todos: marca fina (coluna no máximo 24 px), ponta de
 * dado arredondada em 4 px e quadrada na linha de base, grade em fio de 1 px
 * sólido e recuada, rótulo direto só no extremo, cor nunca no texto — a
 * identidade vem do quadradinho ao lado — e tabela equivalente sempre
 * disponível para quem não distingue as cores.
 */

import { money, money0, n0, n1, dayMonth, weekdayShort, esc, el } from './util.js';

const SERIES_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];
export const seriesColor = (i) => `var(${SERIES_VARS[i % SERIES_VARS.length]})`;

/** Retângulo com dois cantos arredondados do lado da ponta de dado. */
function capPath(x, y, w, h, r, side) {
  const rr = Math.max(0, Math.min(r, w / 2, Math.abs(h)));
  if (Math.abs(h) < 0.6) return `M${x} ${y}h${w}v${h || 0.6}h${-w}Z`;
  if (side === 'top')    return `M${x} ${y + h}V${y + rr}a${rr} ${rr} 0 0 1 ${rr} ${-rr}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${y + h}Z`;
  if (side === 'bottom') return `M${x} ${y}V${y + h - rr}a${rr} ${rr} 0 0 0 ${rr} ${rr}h${w - 2 * rr}a${rr} ${rr} 0 0 0 ${rr} ${-rr}V${y}Z`;
  // 'right' (barra horizontal)
  return `M${x} ${y}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}H${x}Z`;
}

function niceTicks(min, max, count = 4) {
  if (min === max) { min = Math.min(0, min); max = Math.max(1, max); }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { ticks: out, lo, hi: out[out.length - 1] };
}

function tooltipFor(host) {
  let tip = host.querySelector('.chart-tip');
  if (!tip) {
    tip = el('div', { class: 'chart-tip' });
    host.append(tip);
  }
  return tip;
}

/** Redesenha quando o contêiner muda de largura. */
function autoRender(host, draw) {
  let last = 0;
  const run = () => {
    const w = Math.max(240, Math.round(host.clientWidth));
    if (Math.abs(w - last) < 4) return;
    last = w;
    draw(w);
  };
  run();
  if (typeof ResizeObserver === 'function') {
    if (host._ro) host._ro.disconnect();
    host._ro = new ResizeObserver(() => run());
    host._ro.observe(host);
  } else if (!host._onResize) {
    host._onResize = () => run();
    window.addEventListener('resize', host._onResize);
  }
}

/**
 * Liga o tooltip do gráfico funcionando com mouse E com dedo.
 *
 * No toque, pointermove sozinho não serve: só existe evento enquanto o dedo
 * está encostado, e nada avisa quando ele sai. Então o toque abre o tooltip no
 * pointerdown, ele acompanha o arrasto e some sozinho depois de alguns
 * segundos. A posição é presa dentro do cartão, senão em tela estreita ele
 * vaza pela borda.
 */
function ligarTooltip(svg, host, tip, conteudo) {
  let sumir = 0;

  const esconder = () => { clearTimeout(sumir); tip.classList.remove('on'); };

  const mostrar = (e) => {
    const hit = e.target.closest && e.target.closest('.hit');
    if (!hit) { esconder(); return; }
    const html = conteudo(Number(hit.dataset.i));
    if (!html) { esconder(); return; }
    tip.innerHTML = html;
    const rect = host.getBoundingClientRect();
    const meia = Math.min(90, rect.width / 2);
    tip.style.left = `${clampNum(e.clientX - rect.left, meia, Math.max(meia, rect.width - meia))}px`;
    tip.style.top = `${e.clientY - rect.top - 8}px`;
    tip.classList.add('on');
    clearTimeout(sumir);
    if (e.pointerType === 'touch') sumir = setTimeout(esconder, 2800);
  };

  svg.addEventListener('pointerdown', mostrar);
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !e.buttons) return;   // dedo já saiu
    mostrar(e);
  });
  // No toque, o ponteiro deixa de existir assim que o dedo sai, e o navegador
  // dispara pointerleave logo depois do pointerup — fechar aqui apagaria o
  // tooltip no mesmo instante em que ele abriu. Quem fecha nesse caso é o
  // cronômetro de alguns segundos.
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') esconder(); });
  svg.addEventListener('pointercancel', esconder);
}

const clampNum = (v, min, max) => Math.min(max, Math.max(min, v));

/* ==========================================================================
   1. Colunas: resultado por dia
   ========================================================================== */

/**
 * @param {HTMLElement} host
 * @param {Array<{data:string, liquido:number, bruto:number, km:number, vazio:boolean}>} dados
 */
export function colunasDiarias(host, dados) {
  host.classList.add('chart-host');
  const tip = tooltipFor(host);

  autoRender(host, (W) => {
    const H = 190;
    const padL = 46;
    const padR = 10;
    const padT = 16;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const vals = dados.map((d) => d.liquido);
    const { ticks, lo, hi } = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
    const y = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
    const zeroY = y(0);

    const band = plotW / Math.max(1, dados.length);
    const GAP = 2;                                   // vão em cor de superfície entre colunas
    const barW = Math.min(24, Math.max(4, band - GAP * 2));

    const maxIdx = vals.indexOf(Math.max(...vals));
    const showEvery = dados.length > 16 ? Math.ceil(dados.length / 8) : dados.length > 9 ? 2 : 1;

    const parts = [];
    parts.push(`<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Resultado líquido por dia">`);

    for (const t of ticks) {
      const ty = y(t);
      parts.push(`<line class="${t === 0 ? 'axis-line' : 'grid-line'}" x1="${padL}" y1="${ty.toFixed(1)}" x2="${W - padR}" y2="${ty.toFixed(1)}"/>`);
      parts.push(`<text class="lbl" x="${padL - 7}" y="${(ty + 3.5).toFixed(1)}" text-anchor="end">${money0(t)}</text>`);
    }

    dados.forEach((d, i) => {
      const cx = padL + band * i + band / 2;
      const x = cx - barW / 2;
      const v = d.liquido;
      const top = Math.min(y(v), zeroY);
      const h = Math.abs(y(v) - zeroY);
      const neg = v < 0;
      const fill = d.vazio ? 'var(--surface-3)' : neg ? 'var(--critical)' : 'var(--accent)';
      const hEff = Math.max(h, d.vazio ? 2 : 1.5);
      const yEff = neg ? zeroY : zeroY - hEff;
      parts.push(`<path class="bar" d="${capPath(x, yEff, barW, hEff, 4, neg ? 'bottom' : 'top')}" fill="${fill}"/>`);

      if (i === maxIdx && v > 0 && !d.vazio) {
        parts.push(`<text class="lbl-strong" x="${cx.toFixed(1)}" y="${(yEff - 6).toFixed(1)}" text-anchor="middle">${money0(v)}</text>`);
      }
      if (i % showEvery === 0) {
        parts.push(`<text class="lbl" x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle">${dayMonth(d.data)}</text>`);
      }
      parts.push(`<rect class="hit" x="${(cx - band / 2).toFixed(1)}" y="${padT}" width="${band.toFixed(1)}" height="${plotH}" data-i="${i}"/>`);
    });

    parts.push('</svg>');
    host.querySelector('svg')?.remove();
    host.insertAdjacentHTML('afterbegin', parts.join(''));

    ligarTooltip(host.querySelector('svg'), host, tip, (i) => {
      const d = dados[i];
      if (!d) return '';
      return `<b>${weekdayShort(d.data)} ${dayMonth(d.data)}</b>
        <div class="r"><span>Bruto</span><span>${money(d.bruto)}</span></div>
        <div class="r"><span>Líquido</span><span>${money(d.liquido)}</span></div>
        <div class="r"><span>Km</span><span>${n0(d.km)}</span></div>`;
    });
  });
}

/* ==========================================================================
   2. Barras horizontais: bruto por aplicativo
   ========================================================================== */

/**
 * @param {HTMLElement} host
 * @param {Array<{rotulo:string, valor:number, cor:string, sub:string}>} linhas
 */
export function barrasPorApp(host, linhas) {
  host.classList.add('chart-host');
  const tip = tooltipFor(host);

  autoRender(host, (W) => {
    const rowH = 30;
    const GAP = 2;
    const barH = Math.min(24, rowH - GAP * 2 - 6);
    const padL = 0;
    const padR = 76;                                  // espaço para o rótulo direto
    const labelW = Math.min(96, Math.max(64, W * 0.26));
    const plotW = Math.max(40, W - labelW - padR - padL);
    const H = linhas.length * rowH + 6;
    const max = Math.max(...linhas.map((l) => l.valor), 1);

    const parts = [`<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Faturamento bruto por aplicativo">`];

    linhas.forEach((l, i) => {
      const y = i * rowH + 3;
      const w = Math.max(3, (l.valor / max) * plotW);
      const cy = y + rowH / 2 - 3;
      parts.push(`<text class="lbl" x="0" y="${(cy + 4).toFixed(1)}">${esc(l.rotulo)}</text>`);
      parts.push(`<path class="bar" d="${capPath(labelW, cy - barH / 2, w, barH, 4, 'right')}" fill="${l.cor}"/>`);
      parts.push(`<text class="lbl-strong" x="${(labelW + w + 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}">${money0(l.valor)}</text>`);
      parts.push(`<rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}" data-i="${i}"/>`);
    });

    parts.push('</svg>');
    host.querySelector('svg')?.remove();
    host.insertAdjacentHTML('afterbegin', parts.join(''));

    ligarTooltip(host.querySelector('svg'), host, tip, (i) => {
      const l = linhas[i];
      if (!l) return '';
      const [rotuloSub, valorSub] = String(l.sub || '').split('·');
      return `<b>${esc(l.rotulo)}</b>
        <div class="r"><span>Bruto</span><span>${money(l.valor)}</span></div>
        ${l.sub ? `<div class="r"><span>${esc(rotuloSub.trim())}</span><span>${esc((valorSub || '').trim())}</span></div>` : ''}`;
    });
  });
}

/** Legenda: o canal de identidade que não depende de distinguir cor sozinho. */
export function legenda(linhas) {
  return `<div class="chart-legend">${linhas
    .map((l) => `<span><i style="background:${l.cor}"></i>${esc(l.rotulo)}</span>`)
    .join('')}</div>`;
}

/* ==========================================================================
   3. Barras proporcionais: para onde foi cada real
   ========================================================================== */

/**
 * Uma série, uma cor — o comprimento é a única informação codificada.
 * A sobra ganha o verde de estado porque ali a cor significa "bom/ruim".
 * @param {Array<{nome:string, valor:number, tipo?:'custo'|'sobra'}>} linhas
 * @param {number} total
 */
export function barrasProporcionais(linhas, total) {
  const base = Math.max(total, 1);
  return `<div class="propbar">${linhas.map((l) => {
    const share = Math.abs(l.valor) / base;
    const isRest = l.tipo === 'sobra';
    const neg = isRest && l.valor < 0;
    return `<div class="propbar-row${isRest ? ' is-rest' : ''}${neg ? ' is-neg' : ''}">
      <span class="propbar-name">${esc(l.nome)}</span>
      <span class="propbar-track"><i class="propbar-fill" style="width:${(Math.min(1, share) * 100).toFixed(1)}%"></i></span>
      <span class="propbar-val">${money(l.valor)} <span class="dim">${(share * 100).toFixed(0)}%</span></span>
    </div>`;
  }).join('')}</div>`;
}

/* ==========================================================================
   4. Tabela equivalente (exigida sempre que a cor for canal de identidade)
   ========================================================================== */

export function tabelaEquivalente(colunas, linhas, resumoTexto = '') {
  return `<details class="table-alt">
    <summary class="small muted" style="cursor:pointer;margin-top:10px">Ver os mesmos números em tabela</summary>
    <div class="table-wrap" style="margin-top:8px">
      <table>
        <caption class="sr-only">${esc(resumoTexto)}</caption>
        <thead><tr>${colunas.map((c, i) => `<th${i ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${linhas.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  </details>`;
}
