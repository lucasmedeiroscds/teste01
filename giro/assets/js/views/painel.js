/* Painel: o resultado do período em números que dá para agir em cima. */

import { getState, setPeriodo } from '../store.js';
import { resumo, agrupar, serieDiaria, pontoEquilibrio, provisoes, custoVariavelKm } from '../finance.js';
import { faixa, faixaAnterior, noPeriodo, datasDoGrafico, PERIODOS, variacao } from '../periodo.js';
import {
  colunasDiarias, barrasPorApp, barrasProporcionais, legenda, tabelaEquivalente,
} from '../charts.js';
import { corApp, nomeApp } from '../connectors/registry.js';
import { carousel } from '../carousel.js';
import { money, money0, n0, n1, esc, icon, toast, hoursToLabel, dayMonth, safeDiv } from '../util.js';
import { animarValores, escalonar } from '../anim.js';
import { podeOferecerExemplo, ativarExemplo } from '../demo.js';

const SETA_CIMA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const SETA_BAIXO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

/**
 * Selo de variação contra o mesmo período anterior.
 * `subirEBom` inverte a leitura para as métricas em que subir é ruim (custo).
 */
function delta(v, { subirEBom = true, rotulo = 'o período anterior' } = {}) {
  if (v == null || !Number.isFinite(v)) return '';
  if (Math.abs(v) < 0.005) return `<span class="delta" title="igual ${esc(rotulo)}">estável</span>`;
  const subiu = v > 0;
  const bom = subiu === subirEBom;
  const classe = `${subiu ? 'subiu' : 'caiu'}-${bom ? 'bom' : 'ruim'}`;
  // Dobrou para cima já não se lê bem em porcentagem: "248%" exige conta na
  // cabeça, "2,5x" não. Abaixo disso a porcentagem continua sendo o natural.
  const mag = Math.abs(v);
  const texto = mag >= 1 ? `${n1(1 + mag)}x` : `${(mag * 100).toFixed(0)}%`;
  return `<span class="delta ${classe}" title="${subiu ? 'acima' : 'abaixo'} do ${esc(rotulo)}">`
    + `${subiu ? SETA_CIMA : SETA_BAIXO}${texto}</span>`;
}

/**
 * @param {object} o
 * @param {number} o.bruto  valor cru, para a contagem animada
 * @param {string} o.fmt    nome do formatador registrado em FORMATOS
 */
function tile({ label, bruto, fmt = 'moeda', nota, variacaoHTML = '', leitura = '', cls = '', hero = false, i = 0 }) {
  return `<div class="tile${hero ? ' hero' : ''}" style="animation-delay:${escalonar(i, 40, 260)}ms">
    <span class="tile-label">${esc(label)}</span>
    <span class="tile-value ${cls}" data-anima="${fmt}" data-bruto="${bruto}">${FORMATOS[fmt](bruto)}</span>
    ${nota || variacaoHTML ? `<span class="tile-note">${variacaoHTML}${variacaoHTML && nota ? ' · ' : ''}${nota || ''}</span>` : ''}
    ${leitura ? `<span class="leitura">${leitura}</span>` : ''}
  </div>`;
}

/** Formatadores usados pela contagem animada. */
const FORMATOS = {
  moeda: (v) => money(v),
  moeda0: (v) => money0(v),
  inteiro: (v) => n0(v),
  decimal: (v) => n1(v),
};

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12 5 5L20 6"/></svg>';

/**
 * Estado vazio que se resolve enquanto a pessoa usa: cada passo se marca
 * sozinho quando fica pronto, então o cartão vira um progresso em vez de um
 * texto que ninguém lê duas vezes.
 */
function primeirosPassos(s) {
  const custosProntos = (s.custosFixos || []).some((c) => Number(c.valorMes) > 0)
    || Number(s.perfil.consumoKmL) > 0;
  const passos = [
    { feito: custosProntos, titulo: 'Diga quanto custa rodar', sub: 'veículo, combustível e contas do mês', acao: '#/custos', rotulo: 'Configurar' },
    { feito: s.turnos.length > 0, titulo: 'Lance o primeiro dia', sub: 'bruto, quilômetros e horas — vinte segundos', acao: '#/lancar', rotulo: 'Lançar' },
    { feito: false, titulo: 'Veja o que sobrou de verdade', sub: 'o painel se preenche sozinho a partir daí', acao: null },
  ];

  return `<div class="card">
    <h2>Três passos e o painel ganha vida</h2>
    <p class="muted small" style="margin-top:6px">Sem saber o custo do quilômetro, qualquer número de ganho é chute. Se preferir ver funcionando antes de digitar, carregue um mês de exemplo.</p>
    <ol class="passos">
      ${passos.map((p, i) => `<li class="passo${p.feito ? ' feito' : ''}">
        <span class="passo-marca">${p.feito ? CHECK : i + 1}</span>
        <span>
          <span class="passo-titulo">${esc(p.titulo)}</span>
          <span class="passo-sub" style="display:block">${esc(p.sub)}</span>
        </span>
        ${p.acao && !p.feito ? `<a class="btn btn-sm btn-ghost" href="${p.acao}">${esc(p.rotulo)}</a>` : '<span></span>'}
      </li>`).join('')}
    </ol>
    ${podeOferecerExemplo(s) ? `
      <button class="btn btn-primary btn-block" data-exemplo style="margin-top:14px">
        ${icon('play')} Ver funcionando com dados de exemplo
      </button>
      <p class="tiny dim center" style="margin-top:8px">Um mês fictício de trabalho. Sai com um toque, sem deixar rastro.</p>` : ''}
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

  const fAnt = faixaAnterior(f, pid);
  const rAnt = resumo(s, noPeriodo(s.turnos, fAnt), fAnt.diasCorridos);
  // Um ou dois dias trabalhados de cada lado não sustentam uma comparação:
  // no começo da semana ou do mês a seta diria mais sobre o calendário do que
  // sobre o trabalho. Sem base suficiente, nenhum selo aparece.
  const minDias = pid === 'hoje' ? 1 : 2;
  const houveAnterior = rAnt.bruto > 0
    && rAnt.diasTrabalhados >= minDias
    && r.diasTrabalhados >= minDias;
  const varDe = (atual, anterior) => (houveAnterior ? variacao(atual, anterior) : null);
  const refComparacao = fAnt.rotulo;

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
    <p class="small dim" style="margin-top:6px">
      ${esc(f.rotulo)} · ${r.diasTrabalhados} dia(s) rodados · ${n0(r.km)} km · ${hoursToLabel(r.horas)}
      ${houveAnterior ? `<br>as setas comparam com <b>${esc(refComparacao)}</b>` : ''}
    </p>
  </div>

  ${semDados ? primeirosPassos(s) : ''}

  <div class="tiles" style="margin-bottom:14px">
    ${tile({
      label: `Sobrou ${pid === 'hoje' ? 'hoje' : `n${pid === 'mes' ? 'o mês' : 'a semana'}`}`,
      bruto: r.liquido,
      cls: r.liquido < 0 ? 'is-neg' : r.liquido > 0 ? 'is-pos' : '',
      variacaoHTML: delta(varDe(r.liquido, rAnt.liquido), { rotulo: refComparacao }),
      nota: r.bruto > 0 ? `de ${money(r.bruto)} brutos` : 'nenhum lançamento no período',
      leitura: r.bruto > 0
        ? `De cada <b>R$ 10</b> que entraram, <b>${money(r.margem * 10)}</b> ficaram com você.`
        : '',
      hero: true, i: 0,
    })}
    ${tile({
      label: 'Por hora, líquido', bruto: r.liquidoPorHora,
      variacaoHTML: delta(varDe(r.liquidoPorHora, rAnt.liquidoPorHora), { rotulo: refComparacao }),
      nota: `bruto ${money(r.brutoPorHora)}/h`,
      leitura: r.horas > 0 ? `Um turno de <b>8 h</b> nesse ritmo deixa <b>${money(r.liquidoPorHora * 8)}</b>.` : '',
      i: 1,
    })}
    ${tile({
      label: 'Por km, líquido', bruto: r.liquidoPorKm,
      variacaoHTML: delta(varDe(r.liquidoPorKm, rAnt.liquidoPorKm), { rotulo: refComparacao }),
      nota: `bruto ${money(r.brutoPorKm)}/km`,
      leitura: r.km > 0 ? `A cada <b>100 km</b> rodados sobram <b>${money(r.liquidoPorKm * 100)}</b>.` : '',
      i: 2,
    })}
    ${tile({
      label: 'Custo por km', bruto: cv.total,
      nota: `combustível ${money(cv.combustivel)} · resto ${money(cv.manutencao + cv.depreciacao)}`,
      leitura: `Rodar <b>100 km</b> custa <b>${money(cv.total * 100)}</b>, mesmo sem receber nada.`,
      i: 3,
    })}
    ${tile({
      label: 'Custo do período', bruto: r.custoTotal,
      variacaoHTML: delta(varDe(r.custoTotal, rAnt.custoTotal), { subirEBom: false, rotulo: refComparacao }),
      nota: `fixos ${money(r.custoFixo)} · variáveis ${money(r.custoVariavel)}`,
      i: 4,
    })}
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

  root.querySelector('[data-exemplo]')?.addEventListener('click', () => {
    ativarExemplo();
    toast('Dados de exemplo carregados. Explore à vontade.', 'good');
  });

  animarValores(root, FORMATOS);
  carousel.mount(root.querySelector('[data-carousel]'));
}

export const meta = { titulo: 'Painel' };
