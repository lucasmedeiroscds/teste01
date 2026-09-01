/* Custos: a página que faz todo o resto do app dizer a verdade.
 * Preenchida uma vez, revisada de vez em quando. */

import { getState, update, aplicarPresetVeiculo } from '../store.js';
import { custoVariavelKm, custoFixoMes, custoFixoPorDiaTrabalhado, pontoEquilibrio, custoManutencaoKm } from '../finance.js';
import { money, n0, n1, n2, pct, parseNum, esc, icon, toast, uid, safeDiv } from '../util.js';

const COMBUSTIVEIS = [
  ['gasolina', 'Gasolina'], ['etanol', 'Etanol'], ['diesel', 'Diesel'],
  ['gnv', 'GNV'], ['eletrico', 'Elétrico'], ['nenhum', 'Não usa combustível'],
];

const VEICULOS = [['moto', 'Moto'], ['carro', 'Carro'], ['bike', 'Bike / patinete']];

export function render(root) {
  const s = getState();
  const cv = custoVariavelKm(s);
  const fixoMes = custoFixoMes(s);
  const fixoDia = custoFixoPorDiaTrabalhado(s);
  const pe = pontoEquilibrio(s, (Number(s.metas.horasDia) || 8) * 20);
  const isBike = s.perfil.veiculo === 'bike';

  root.innerHTML = `
  <div class="view-head">
    <h1>Custos</h1>
    <p>Aqui você monta o custo real de rodar. Estes números alimentam o painel, a calculadora de corrida e as provisões — vale gastar dez minutos com atenção.</p>
  </div>

  <div class="card" id="resumo-custos">
    ${resumoHTML(cv, fixoMes, fixoDia, pe)}
  </div>

  <div class="card">
    <div class="card-head"><h2>Veículo e combustível</h2></div>
    <div class="field">
      <span class="field-label">Tipo de veículo</span>
      <div class="segmented" role="group" aria-label="Tipo de veículo">
        ${VEICULOS.map(([id, nome]) => `<button type="button" data-veiculo="${id}" aria-pressed="${s.perfil.veiculo === id}">${nome}</button>`).join('')}
      </div>
      <span class="hint">Trocar o tipo recarrega a tabela de manutenção com valores de referência. Ajuste depois para a sua realidade.</span>
    </div>

    <div class="fields-2">
      <div class="field">
        <label for="p-comb">Combustível</label>
        <select id="p-comb" data-set="perfil.combustivel">
          ${COMBUSTIVEIS.map(([id, nome]) => `<option value="${id}" ${s.perfil.combustivel === id ? 'selected' : ''}>${nome}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="p-preco">Preço do litro</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="p-preco" data-set="perfil.precoCombustivel" value="${n2(s.perfil.precoCombustivel)}" ${isBike ? 'disabled' : ''}>
        </div>
      </div>
    </div>

    <div class="field">
      <label for="p-consumo">Consumo</label>
      <div class="input-affix suffix"><span>km/L</span>
        <input type="text" inputmode="decimal" id="p-consumo" data-set="perfil.consumoKmL" value="${n1(s.perfil.consumoKmL)}" ${isBike ? 'disabled' : ''}>
      </div>
      <span class="hint">Se você já registrou abastecimentos, use o valor medido em <a href="#/lancar">Lançar → Abastecimento</a> em vez de chutar.</span>
    </div>

    <div class="checkline">
      <input type="checkbox" id="v-dep" data-check="veiculo.contarDepreciacao" ${s.veiculo.contarDepreciacao ? 'checked' : ''}>
      <label for="v-dep">Contar o desgaste do veículo no custo<br>
        <span class="hint">Cada quilômetro rodado tira valor do veículo. Ignorar isso faz o lucro parecer maior do que é — até a hora de trocar.</span>
      </label>
    </div>

    <div class="fields-3" ${s.veiculo.contarDepreciacao ? '' : 'hidden'}>
      <div class="field">
        <label for="v-valor">Valor hoje</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="v-valor" data-set="veiculo.valor" value="${n0(s.veiculo.valor)}">
        </div>
      </div>
      <div class="field">
        <label for="v-res">Valor na troca</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="v-res" data-set="veiculo.residual" value="${n0(s.veiculo.residual)}">
        </div>
      </div>
      <div class="field">
        <label for="v-vida">Km até trocar</label>
        <div class="input-affix suffix"><span>km</span>
          <input type="text" inputmode="decimal" id="v-vida" data-set="veiculo.vidaUtilKm" value="${n0(s.veiculo.vidaUtilKm)}">
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Custos fixos do mês</h2>
      <span class="badge">${money(fixoMes)}/mês</span>
    </div>
    <p class="small muted" style="margin-bottom:12px">O que sai todo mês, você rodando ou não. Anuais como IPVA e seguro entram divididos por doze.</p>
    <div id="lista-fixos">
      ${(s.custosFixos || []).map((c) => linhaFixo(c)).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" data-add-fixo style="margin-top:8px">${icon('plus')} Adicionar custo fixo</button>
    <div class="note" style="margin-top:14px">
      Dividido pelos <b>${n0(s.metas.diasMes)} dias</b> que você planeja rodar por mês, cada dia trabalhado carrega <b>${money(fixoDia)}</b> de custo fixo antes da primeira corrida.
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Manutenção por quilômetro</h2>
      <span class="badge">${money(custoManutencaoKm(s))}/km</span>
    </div>
    <p class="small muted" style="margin-bottom:12px">Cada item custa X e dura Y quilômetros. Dividindo um pelo outro sai quanto você precisa guardar a cada quilômetro rodado.</p>
    <div id="lista-manut">
      ${(s.manutencao || []).map((m) => linhaManut(m)).join('')}
    </div>
    <button class="btn btn-ghost btn-sm" data-add-manut style="margin-top:8px">${icon('plus')} Adicionar item</button>
  </div>

  <div class="card">
    <div class="card-head"><h2>Metas</h2></div>
    <div class="fields-2">
      <div class="field">
        <label for="m-lucro">Lucro líquido no mês</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="m-lucro" data-set="metas.lucroMes" value="${n0(s.metas.lucroMes)}">
        </div>
      </div>
      <div class="field">
        <label for="m-hora">R$ por hora mínimo</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="m-hora" data-set="metas.ganhoHoraMin" value="${n1(s.metas.ganhoHoraMin)}">
        </div>
      </div>
    </div>
    <div class="fields-2">
      <div class="field">
        <label for="m-dias">Dias que pretende rodar por mês</label>
        <input type="number" id="m-dias" data-set="metas.diasMes" value="${n0(s.metas.diasMes)}" min="1" max="31" step="1">
      </div>
      <div class="field">
        <label for="m-horas">Horas por dia</label>
        <input type="number" id="m-horas" data-set="metas.horasDia" value="${n0(s.metas.horasDia)}" min="1" max="16" step="1">
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Provisões</h2></div>
    <p class="small muted" style="margin-bottom:12px">Percentuais tirados do que sobra. Manutenção e troca do veículo não entram aqui: eles já são calculados pelo quilômetro rodado, que é mais preciso que qualquer percentual.</p>
    <div class="fields-3">
      <div class="field">
        <label for="pr-emerg">Reserva de emergência</label>
        <div class="input-affix suffix"><span>%</span>
          <input type="text" inputmode="decimal" id="pr-emerg" data-pct="provisoes.emergencia" value="${n0(s.provisoes.emergencia * 100)}">
        </div>
      </div>
      <div class="field">
        <label for="pr-desc">Descanso / 13º</label>
        <div class="input-affix suffix"><span>%</span>
          <input type="text" inputmode="decimal" id="pr-desc" data-pct="provisoes.descanso" value="${n0(s.provisoes.descanso * 100)}">
        </div>
      </div>
      <div class="field">
        <label for="pr-imp">Imposto</label>
        <div class="input-affix suffix"><span>%</span>
          <input type="text" inputmode="decimal" id="pr-imp" data-pct="provisoes.imposto" value="${n0(s.provisoes.imposto * 100)}">
        </div>
      </div>
    </div>
  </div>`;

  bind(root);
}

/* ---------- pedaços ---------- */

function resumoHTML(cv, fixoMes, fixoDia, pe) {
  return `
  <div class="card-head"><h2>Onde você está agora</h2></div>
  <div class="tiles">
    <div class="tile hero">
      <span class="tile-label">Custo por quilômetro rodado</span>
      <span class="tile-value">${money(cv.total)}</span>
      <span class="tile-note">combustível ${money(cv.combustivel)} · manutenção ${money(cv.manutencao)} · desgaste ${money(cv.depreciacao)}</span>
    </div>
    <div class="tile"><span class="tile-label">Custo fixo</span><span class="tile-value">${money(fixoMes)}</span><span class="tile-note">${money(fixoDia)} por dia trabalhado</span></div>
    <div class="tile"><span class="tile-label">Empatar no dia</span><span class="tile-value">${money(pe.empatar)}</span><span class="tile-note">rodando ${n0(pe.kmReferencia)} km</span></div>
  </div>`;
}

function linhaFixo(c) {
  return `<div class="row" data-fixo="${c.id}" style="gap:8px;flex-wrap:nowrap;margin-bottom:8px">
    <input type="text" value="${esc(c.nome)}" data-fixo-nome aria-label="Nome do custo fixo" style="flex:1;min-width:0">
    <div class="input-affix" style="width:130px;flex:0 0 130px"><span>R$</span>
      <input type="text" inputmode="decimal" value="${n2(c.valorMes)}" data-fixo-valor aria-label="Valor mensal de ${esc(c.nome)}">
    </div>
    <button class="icon-btn" data-del-fixo aria-label="Remover ${esc(c.nome)}">${icon('trash')}</button>
  </div>`;
}

function linhaManut(m) {
  const porKm = safeDiv(Number(m.custo) || 0, Number(m.intervaloKm) || 0);
  return `<div data-manut="${m.id}" style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line)">
    <div class="row" style="gap:8px;flex-wrap:nowrap">
      <input type="text" value="${esc(m.nome)}" data-manut-nome aria-label="Item de manutenção" style="flex:1;min-width:0">
      <button class="icon-btn" data-del-manut aria-label="Remover ${esc(m.nome)}">${icon('trash')}</button>
    </div>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:nowrap">
      <div class="input-affix" style="flex:1;min-width:0"><span>R$</span>
        <input type="text" inputmode="decimal" value="${n2(m.custo)}" data-manut-custo aria-label="Custo de ${esc(m.nome)}">
      </div>
      <div class="input-affix suffix" style="flex:1;min-width:0"><span>km</span>
        <input type="text" inputmode="decimal" value="${n0(m.intervaloKm)}" data-manut-km aria-label="Intervalo em km de ${esc(m.nome)}">
      </div>
      <span class="num small dim nowrap" style="flex:0 0 auto;min-width:64px;text-align:right">${money(porKm)}/km</span>
    </div>
  </div>`;
}

/* ---------- eventos ---------- */

function setPath(obj, caminho, valor) {
  const [a, b] = caminho.split('.');
  obj[a][b] = valor;
}

function bind(root) {
  const refrescarResumo = () => {
    const s = getState();
    const host = root.querySelector('#resumo-custos');
    if (host) {
      host.innerHTML = resumoHTML(
        custoVariavelKm(s), custoFixoMes(s), custoFixoPorDiaTrabalhado(s),
        pontoEquilibrio(s, (Number(s.metas.horasDia) || 8) * 20)
      );
    }
    root.querySelectorAll('[data-manut]').forEach((row) => {
      const custo = parseNum(row.querySelector('[data-manut-custo]').value);
      const km = parseNum(row.querySelector('[data-manut-km]').value);
      const span = row.querySelector('span.num');
      if (span) span.textContent = `${money(safeDiv(custo, km))}/km`;
    });
  };

  root.querySelectorAll('[data-veiculo]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('Trocar o tipo de veículo substitui a tabela de manutenção pelos valores de referência. Continuar?')) return;
      aplicarPresetVeiculo(b.dataset.veiculo);
      toast('Veículo atualizado.', 'good');
      render(root);
    });
  });

  root.querySelectorAll('[data-set]').forEach((input) => {
    input.addEventListener('input', () => {
      const valor = input.type === 'number' || input.inputMode === 'decimal' || input.inputMode === 'numeric'
        ? parseNum(input.value)
        : input.value;
      update((s) => setPath(s, input.dataset.set, valor), { silent: true });
      refrescarResumo();
    });
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', () => {
        update((s) => setPath(s, input.dataset.set, input.value), { silent: true });
        refrescarResumo();
      });
    }
  });

  root.querySelectorAll('[data-pct]').forEach((input) => {
    input.addEventListener('input', () => {
      update((s) => setPath(s, input.dataset.pct, Math.max(0, parseNum(input.value)) / 100), { silent: true });
    });
  });

  root.querySelectorAll('[data-check]').forEach((input) => {
    input.addEventListener('change', () => {
      update((s) => setPath(s, input.dataset.check, input.checked), { silent: true });
      render(root);
    });
  });

  // custos fixos
  root.querySelectorAll('[data-fixo]').forEach((row) => {
    const id = row.dataset.fixo;
    row.querySelector('[data-fixo-nome]').addEventListener('input', (e) => {
      update((s) => { const c = s.custosFixos.find((x) => x.id === id); if (c) c.nome = e.target.value; }, { silent: true });
    });
    row.querySelector('[data-fixo-valor]').addEventListener('input', (e) => {
      update((s) => { const c = s.custosFixos.find((x) => x.id === id); if (c) c.valorMes = parseNum(e.target.value); }, { silent: true });
      refrescarResumo();
    });
    row.querySelector('[data-del-fixo]').addEventListener('click', () => {
      update((s) => { s.custosFixos = s.custosFixos.filter((x) => x.id !== id); }, { silent: true });
      render(root);
    });
  });

  root.querySelector('[data-add-fixo]')?.addEventListener('click', () => {
    update((s) => { s.custosFixos.push({ id: uid(), nome: '', valorMes: 0 }); }, { silent: true });
    render(root);
    root.querySelector('#lista-fixos [data-fixo]:last-child [data-fixo-nome]')?.focus();
  });

  // manutenção
  root.querySelectorAll('[data-manut]').forEach((row) => {
    const id = row.dataset.manut;
    const write = (campo, valor) => update((s) => {
      const m = s.manutencao.find((x) => x.id === id);
      if (m) m[campo] = valor;
    }, { silent: true });

    row.querySelector('[data-manut-nome]').addEventListener('input', (e) => write('nome', e.target.value));
    row.querySelector('[data-manut-custo]').addEventListener('input', (e) => { write('custo', parseNum(e.target.value)); refrescarResumo(); });
    row.querySelector('[data-manut-km]').addEventListener('input', (e) => { write('intervaloKm', parseNum(e.target.value)); refrescarResumo(); });
    row.querySelector('[data-del-manut]').addEventListener('click', () => {
      update((s) => { s.manutencao = s.manutencao.filter((x) => x.id !== id); }, { silent: true });
      render(root);
    });
  });

  root.querySelector('[data-add-manut]')?.addEventListener('click', () => {
    update((s) => { s.manutencao.push({ id: uid(), nome: '', custo: 0, intervaloKm: 10000 }); }, { silent: true });
    render(root);
    root.querySelector('#lista-manut [data-manut]:last-child [data-manut-nome]')?.focus();
  });
}

export const meta = { titulo: 'Custos' };
