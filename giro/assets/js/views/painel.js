/* Painel: o resultado do período em números que dá para agir em cima. */

import { getState, setPeriodo } from '../store.js';
import { resumo, agrupar, serieDiaria, pontoEquilibrio, provisoes, custoVariavelKm } from '../finance.js';
import { faixa, noPeriodo, datasDoGrafico, PERIODOS } from '../periodo.js';
import {
  colunasDiarias, barrasPorApp, barrasProporcionais, legenda, tabelaEquivalente,
} from '../charts.js';
import { corApp, nomeApp } from '../connectors/registry.js';
import { carousel } from '../carousel.js';
import { money, money0, n0, pct, esc, icon, hoursToLabel, dayMonth, safeDiv } from '../util.js';

function tile({ label, valor, nota, cls = '', hero = false }) {
  return `<div class="tile${hero ? ' hero' : ''}">
    <span class="tile-label">${esc(label)}</span>
    <span class="tile-value ${cls}">${valor}</span>
    ${nota ? `<span class="tile-note">${nota}</span>` : ''}
  </div>`;
}

export function render(root) {
  const s = getState();
  const pid = s.ui.periodo || 'semana';
  const f = faixa(pid);
  const turnos = noPeriodo(s.turnos, f);
  const r = resumo(s, turnos, f.diasCorridos);
  const cv = custoVariavelKm(s);
  const pe = pontoEquilibrio(s, r.kmPorDia);
  const prov = provisoes(s, r);
  const apps = agrupar(turnos, 'app');
  const datas = datasDoGrafico(pid);
  const serie = serieDiaria(s, s.turnos, datas);

  const semDados = s.turnos.length === 0;
  const semDadosNoPeriodo = turnos.length === 0;

  const seletor = `<div class="segmented" role="group" aria-label="Período">
    ${PERIODOS.map((p) => `<button type="button" data-periodo="${p.id}" aria-pressed="${p.id === pid}">${p.rotulo}</button>`).join('')}
  </div>`;

  const linhasApp = apps.slice(0, 6).map((a) => ({
    rotulo: nomeApp(a.chave),
    valor: a.bruto,
    cor: corApp(a.chave),
    sub: `Km · ${n0(a.km)}`,
  }));

  const composicao = [
    { nome: 'Combustível', valor: r.custoCombustivel },
    { nome: 'Manutenção', valor: r.custoManutencao },
    { nome: 'Desgaste do veículo', valor: r.custoDepreciacao },
    { nome: 'Custos fixos', valor: r.custoFixo },
    { nome: 'Gastos do turno', valor: r.gastosTurno },
    { nome: 'Sobrou para você', valor: r.liquido, tipo: 'sobra' },
  ].filter((l) => Math.abs(l.valor) > 0.004);

  const metaMes = Number(s.metas.lucroMes) || 0;
  const progresso = metaMes > 0 ? Math.max(0, r.liquido) / metaMes : 0;

  root.innerHTML = `
  <div class="view-head">
    <div class="row" style="justify-content:space-between">
      <h1>Painel</h1>
      ${seletor}
    </div>
    <p class="small dim" style="margin-top:6px">${esc(f.rotulo)} · ${r.diasTrabalhados} dia(s) rodados · ${n0(r.km)} km · ${hoursToLabel(r.horas)}</p>
  </div>

  ${semDados ? `
    <div class="card">
      <h2>Comece pelo custo, não pelo ganho</h2>
      <p class="muted small" style="margin-top:6px">Sem saber quanto custa cada quilômetro, qualquer número de ganho é chute. Leva dois minutos: confira o veículo e os custos fixos, depois lance o primeiro dia.</p>
      <div class="row" style="margin-top:14px">
        <a class="btn btn-primary" href="#/custos">${icon('gear')} Configurar custos</a>
        <a class="btn btn-ghost" href="#/lancar">${icon('plus')} Lançar um dia</a>
      </div>
    </div>` : ''}

  <div class="tiles" style="margin-bottom:14px">
    ${tile({
      label: `Sobrou ${pid === 'hoje' ? 'hoje' : `n${pid === 'mes' ? 'o mês' : 'a semana'}`}`,
      valor: money(r.liquido),
      cls: r.liquido < 0 ? 'is-neg' : r.liquido > 0 ? 'is-pos' : '',
      nota: r.bruto > 0 ? `de ${money(r.bruto)} brutos · margem ${pct(r.margem)}` : 'nenhum lançamento no período',
      hero: true,
    })}
    ${tile({ label: 'Por hora, líquido', valor: money(r.liquidoPorHora), nota: `bruto ${money(r.brutoPorHora)}/h` })}
    ${tile({ label: 'Por km, líquido', valor: money(r.liquidoPorKm), nota: `bruto ${money(r.brutoPorKm)}/km` })}
    ${tile({ label: 'Custo por km', valor: money(cv.total), nota: `combustível ${money(cv.combustivel)} · resto ${money(cv.manutencao + cv.depreciacao)}` })}
    ${tile({ label: 'Custo do período', valor: money(r.custoTotal), nota: `fixos ${money(r.custoFixo)} · variáveis ${money(r.custoVariavel)}` })}
  </div>

  ${metaMes > 0 ? `
  <div class="card">
    <div class="card-head">
      <h2>Meta do mês</h2>
      <span class="small muted num">${money0(Math.max(0, r.liquido))} de ${money0(metaMes)}</span>
    </div>
    <div class="meter ${progresso >= 1 ? 'is-good' : ''}"><i style="width:${Math.min(100, progresso * 100).toFixed(1)}%"></i></div>
    <p class="small muted" style="margin-top:9px">
      ${pid === 'mes'
        ? (progresso >= 1
            ? 'Meta batida. O que vier agora é reserva.'
            : `Faltam ${money(metaMes - Math.max(0, r.liquido))} de lucro líquido. No seu ritmo, isso são cerca de ${n0(safeDiv(metaMes - Math.max(0, r.liquido), Math.max(1, r.liquidoPorDia)))} dia(s) de trabalho.`)
        : 'A barra considera o período selecionado. Escolha <b>Mês</b> para ver a meta cheia.'}
    </p>
  </div>` : ''}

  <div class="card">
    <div class="card-head">
      <h2>Ponto de equilíbrio do dia</h2>
      <span class="badge">${n0(pe.kmReferencia)} km/dia</span>
    </div>
    <div class="propbar">
      <div class="propbar-row">
        <span class="propbar-name">Só para empatar</span>
        <span class="propbar-track"><i class="propbar-fill" style="width:${Math.min(100, safeDiv(pe.empatar, pe.metaDia) * 100).toFixed(0)}%"></i></span>
        <span class="propbar-val">${money(pe.empatar)}</span>
      </div>
      <div class="propbar-row is-rest">
        <span class="propbar-name">Para bater a meta</span>
        <span class="propbar-track"><i class="propbar-fill" style="width:100%"></i></span>
        <span class="propbar-val">${money(pe.metaDia)}</span>
      </div>
    </div>
    <p class="small muted" style="margin-top:11px">
      Rodando ${n0(pe.kmReferencia)} km num dia, o bruto precisa passar de <b>${money(pe.brutoPorKmMinimo)} por km</b> para não dar prejuízo
      e de <b>${money(pe.brutoPorKmMeta)} por km</b> para a meta fechar. Isso já embute ${money(pe.custoFixoDia)} de custo fixo por dia trabalhado.
    </p>
  </div>

  <div class="grid grid-2" style="margin-top:14px">
    <div class="card">
      <div class="card-head">
        <h2>Resultado por dia</h2>
        <span class="small dim">líquido, já descontado tudo</span>
      </div>
      <div data-chart-dias></div>
      <p class="small dim" style="margin-top:8px">Cinza é dia sem lançamento. Vermelho é dia que fechou no vermelho.</p>
      ${tabelaEquivalente(
        ['Dia', 'Bruto', 'Líquido', 'Km'],
        serie.filter((d) => !d.vazio).map((d) => [dayMonth(d.data), money(d.bruto), money(d.liquido), n0(d.km)]),
        'Resultado bruto e líquido por dia no período.'
      )}
    </div>

    <div class="card">
      <div class="card-head">
        <h2>De onde veio o dinheiro</h2>
        <span class="small dim">bruto por aplicativo</span>
      </div>
      ${linhasApp.length ? `<div data-chart-apps></div>${legenda(linhasApp)}
        ${tabelaEquivalente(
          ['Aplicativo', 'Bruto', 'Km', 'R$/km'],
          apps.map((a) => [nomeApp(a.chave), money(a.bruto), n0(a.km), money(safeDiv(a.bruto, a.km))]),
          'Faturamento bruto por aplicativo no período.'
        )}` : '<div class="empty">Sem lançamentos neste período.</div>'}
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Para onde foi cada real</h2>
      <span class="small dim">${money(r.bruto)} brutos no período</span>
    </div>
    ${r.bruto > 0 || r.custoTotal > 0
      ? barrasProporcionais(composicao, Math.max(r.bruto, r.custoTotal))
      : '<div class="empty">Lance um dia para ver a composição.</div>'}
  </div>

  ${prov.total > 0 ? `
  <div class="card">
    <div class="card-head">
      <h2>Guarde antes de gastar</h2>
      <span class="badge badge-good">${money(prov.total)}</span>
    </div>
    <p class="small muted" style="margin-bottom:12px">Manutenção e troca do veículo saem do quilômetro que você já rodou — esse dinheiro não é lucro, é conta futura que ainda não chegou.</p>
    <ul class="list">
      <li>
        <div class="list-main">
          <div class="list-title">Sobrou em conta</div>
          <div class="list-sub">o bruto menos o que já saiu de fato: combustível, custos fixos e gastos do turno</div>
        </div>
        <div class="list-val">${money(prov.caixaDisponivel)}</div>
      </li>
      ${prov.itens.map((i) => `<li>
        <div class="list-main">
          <div class="list-title">− ${esc(i.nome)}</div>
          <div class="list-sub">${esc(i.nota)}</div>
        </div>
        <div class="list-val">${money(i.valor)}</div>
      </li>`).join('')}
    </ul>
    <div class="note note-accent" style="margin-top:12px">
      Livre para usar: <b>${money(prov.sobraLivre)}</b>
    </div>
  </div>` : ''}

  <div class="card" style="background:transparent;border:0;padding:0;box-shadow:none;margin-top:14px">
    <div data-carousel></div>
    <p class="small dim center" style="margin-top:10px">
      Uma dica por vez, 60 segundos cada. <a href="#/dicas">Ver todas</a>
    </p>
  </div>

  ${semDadosNoPeriodo && !semDados ? `<div class="empty" style="margin-top:14px">Nenhum lançamento em ${esc(f.rotulo)}. <a href="#/lancar">Lançar agora</a></div>` : ''}
  `;

  // interações
  root.querySelectorAll('[data-periodo]').forEach((b) => {
    b.addEventListener('click', () => setPeriodo(b.dataset.periodo));
  });

  const hostDias = root.querySelector('[data-chart-dias]');
  if (hostDias) colunasDiarias(hostDias, serie);

  const hostApps = root.querySelector('[data-chart-apps]');
  if (hostApps && linhasApp.length) barrasPorApp(hostApps, linhasApp);

  carousel.mount(root.querySelector('[data-carousel]'));
}

export const meta = { titulo: 'Painel' };
