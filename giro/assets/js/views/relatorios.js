/* Relatórios: o fechamento que dá para levar para o contador, para o banco
 * ou para a conversa difícil com você mesmo no fim do mês. */

import { getState } from '../store.js';
import { resumo, agrupar, provisoes, custoVariavelKm } from '../finance.js';
import { nomeApp } from '../connectors/registry.js';
import { turnosParaCSV } from '../connectors/csv.js';
import {
  money, n0, pct, esc, icon, toast, download, hoursToLabel, todayISO, monthLabel, endOfMonth, dateRange, startOfWeek, dayMonth, addDays, safeDiv,
} from '../util.js';

let mesSelecionado = null;

function mesesComDados(turnos) {
  const set = new Set(turnos.map((t) => String(t.data).slice(0, 7)));
  const atual = todayISO().slice(0, 7);
  set.add(atual);
  return [...set].sort().reverse();
}

export function render(root) {
  const s = getState();
  const meses = mesesComDados(s.turnos);
  if (!mesSelecionado || !meses.includes(mesSelecionado)) mesSelecionado = meses[0];

  const de = `${mesSelecionado}-01`;
  const fimMes = endOfMonth(de);
  const hoje = todayISO();
  const ate = hoje < fimMes ? (hoje >= de ? hoje : fimMes) : fimMes;
  const dias = dateRange(de, ate).length;

  const turnos = s.turnos.filter((t) => t.data >= de && t.data <= ate);
  const r = resumo(s, turnos, dias);
  const prov = provisoes(s, r);
  const cv = custoVariavelKm(s);
  const apps = agrupar(turnos, 'app');
  const semanas = porSemana(s, turnos, de, ate);
  const med = mediana(semanas.map((w) => w.liquido).filter((v) => v !== 0));

  root.innerHTML = `
  <div class="view-head">
    <div class="row" style="justify-content:space-between">
      <h1>Relatórios</h1>
      <select id="sel-mes" aria-label="Mês do relatório" style="width:auto;min-width:150px">
        ${meses.map((m) => `<option value="${m}" ${m === mesSelecionado ? 'selected' : ''}>${esc(monthLabel(`${m}-01`))}</option>`).join('')}
      </select>
    </div>
    <p class="small dim" style="margin-top:6px">${dayMonth(de)} a ${dayMonth(ate)} · ${r.diasTrabalhados} dia(s) rodados · ${n0(r.km)} km · ${hoursToLabel(r.horas)}</p>
  </div>

  ${turnos.length === 0 ? '<div class="empty">Nenhum lançamento neste mês.</div>' : `

  <div class="card">
    <div class="card-head"><h2>Fechamento</h2>
      <button class="btn btn-ghost btn-sm" data-csv>${icon('download')} Exportar CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <tbody>
          <tr><td>Faturamento bruto</td><td class="n">${money(r.bruto)}</td><td class="n dim">100%</td></tr>
          <tr><td>&nbsp;&nbsp;incluindo gorjetas e bônus</td><td class="n dim">${money(r.gorjetas)}</td><td class="n dim">${pct(safeDiv(r.gorjetas, r.bruto))}</td></tr>
          <tr><td>Combustível</td><td class="n">− ${money(r.custoCombustivel)}</td><td class="n dim">${pct(safeDiv(r.custoCombustivel, r.bruto))}</td></tr>
          <tr><td>Manutenção (provisionada por km)</td><td class="n">− ${money(r.custoManutencao)}</td><td class="n dim">${pct(safeDiv(r.custoManutencao, r.bruto))}</td></tr>
          <tr><td>Desgaste do veículo</td><td class="n">− ${money(r.custoDepreciacao)}</td><td class="n dim">${pct(safeDiv(r.custoDepreciacao, r.bruto))}</td></tr>
          <tr><td>Custos fixos do período</td><td class="n">− ${money(r.custoFixo)}</td><td class="n dim">${pct(safeDiv(r.custoFixo, r.bruto))}</td></tr>
          <tr><td>Gastos de turno</td><td class="n">− ${money(r.gastosTurno)}</td><td class="n dim">${pct(safeDiv(r.gastosTurno, r.bruto))}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Sobrou para você</td><td class="n" style="color:${r.liquido < 0 ? 'var(--critical)' : 'var(--good)'}">${money(r.liquido)}</td><td class="n">${pct(r.margem)}</td></tr>
        </tfoot>
      </table>
    </div>
  </div>

  <div class="tiles" style="margin:14px 0">
    <div class="tile"><span class="tile-label">Por dia rodado</span><span class="tile-value">${money(r.liquidoPorDia)}</span><span class="tile-note">líquido</span></div>
    <div class="tile"><span class="tile-label">Por hora</span><span class="tile-value">${money(r.liquidoPorHora)}</span><span class="tile-note">bruto ${money(r.brutoPorHora)}</span></div>
    <div class="tile"><span class="tile-label">Por km</span><span class="tile-value">${money(r.liquidoPorKm)}</span><span class="tile-note">custo ${money(cv.total)}/km</span></div>
    <div class="tile"><span class="tile-label">Por corrida</span><span class="tile-value">${money(r.brutoPorCorrida)}</span><span class="tile-note">${n0(r.corridas)} no mês</span></div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Semana a semana</h2>
      ${med !== null ? `<span class="badge">mediana ${money(med)}</span>` : ''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Semana</th><th class="n">Dias</th><th class="n">Km</th><th class="n">Bruto</th><th class="n">Líquido</th><th class="n">R$/h</th></tr></thead>
        <tbody>
          ${semanas.map((w) => `<tr>
            <td>${dayMonth(w.de)} – ${dayMonth(w.ate)}</td>
            <td class="n">${w.dias}</td>
            <td class="n">${n0(w.km)}</td>
            <td class="n">${money(w.bruto)}</td>
            <td class="n" style="color:${w.liquido < 0 ? 'var(--critical)' : 'inherit'}">${money(w.liquido)}</td>
            <td class="n">${money(w.porHora)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${med !== null ? `<div class="note note-accent" style="margin-top:12px">
      Sua semana mediana rendeu <b>${money(med)}</b> líquidos. É esse número — e não a melhor semana — que deve sustentar aluguel, parcela e mercado.
    </div>` : ''}
  </div>

  <div class="card">
    <div class="card-head"><h2>Por aplicativo</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Aplicativo</th><th class="n">Dias</th><th class="n">Bruto</th><th class="n">Km</th><th class="n">R$/km bruto</th><th class="n">Custo do km</th><th class="n">Margem no km</th></tr></thead>
        <tbody>
          ${apps.map((a) => {
            const rsKm = safeDiv(a.bruto, a.km);
            const margem = rsKm - cv.total;
            return `<tr>
              <td>${esc(nomeApp(a.chave))}</td>
              <td class="n">${a.n}</td>
              <td class="n">${money(a.bruto)}</td>
              <td class="n">${n0(a.km)}</td>
              <td class="n">${money(rsKm)}</td>
              <td class="n dim">${money(cv.total)}</td>
              <td class="n" style="color:${margem < 0 ? 'var(--critical)' : 'var(--good)'}">${money(margem)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="tiny dim" style="margin-top:9px">A última coluna é a que importa: quanto sobra em cada quilômetro depois do custo de rodar. Se der negativo, aquele aplicativo está te custando dinheiro.</p>
  </div>

  ${prov.total > 0 ? `
  <div class="card">
    <div class="card-head"><h2>Quanto separar deste mês</h2><span class="badge badge-good">${money(prov.total)}</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Destino</th><th class="n">Valor</th></tr></thead>
        <tbody>
          <tr><td>Sobrou em conta<div class="tiny dim">bruto menos o que já saiu: combustível, custos fixos e gastos de turno</div></td><td class="n">${money(prov.caixaDisponivel)}</td></tr>
          ${prov.itens.map((i) => `<tr><td>− ${esc(i.nome)}<div class="tiny dim">${esc(i.nota)}</div></td><td class="n">− ${money(i.valor)}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td>Livre para usar</td><td class="n">${money(prov.sobraLivre)}</td></tr></tfoot>
      </table>
    </div>
  </div>` : ''}
  `}`;

  root.querySelector('#sel-mes')?.addEventListener('change', (e) => {
    mesSelecionado = e.target.value;
    render(root);
  });

  root.querySelector('[data-csv]')?.addEventListener('click', () => {
    download(`giro-${mesSelecionado}.csv`, turnosParaCSV(turnos, nomeApp), 'text/csv;charset=utf-8');
    toast('CSV do mês gerado.', 'good');
  });
}

/* ---------- auxiliares ---------- */

function porSemana(s, turnos, de, ate) {
  const semanas = new Map();
  for (const t of turnos) {
    const chave = startOfWeek(t.data);
    if (!semanas.has(chave)) semanas.set(chave, []);
    semanas.get(chave).push(t);
  }
  return [...semanas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ini, lista]) => {
    const fim = addDays(ini, 6);
    const deW = ini < de ? de : ini;
    const ateW = fim > ate ? ate : fim;
    const r = resumo(s, lista, dateRange(deW, ateW).length);
    return {
      de: deW, ate: ateW, dias: r.diasTrabalhados, km: r.km,
      bruto: r.bruto, liquido: r.liquido, porHora: r.liquidoPorHora,
    };
  });
}

function mediana(vals) {
  if (!vals.length) return null;
  const v = [...vals].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

export const meta = { titulo: 'Relatórios' };
