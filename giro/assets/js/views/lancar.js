/* Lançar: entrada rápida do dia e dos abastecimentos.
 * Otimizado para ser preenchido no celular, com uma mão, no fim do turno. */

import { getState, addTurno, removeTurno, addAbastecimento, removeAbastecimento } from '../store.js';
import { custoVariavelKm, custoFixoMes, consumoReal, DIAS_MES_MEDIO } from '../finance.js';
import { PLATAFORMAS, nomeApp } from '../connectors/registry.js';
import { emExemplo, limparExemplo } from '../demo.js';
import {
  money, n0, n1, parseNum, todayISO, longDate, esc, icon, toast, hoursToLabel, safeDiv,
} from '../util.js';

let aba = 'turno';

export function render(root) {
  const s = getState();
  const cv = custoVariavelKm(s);
  const fixoDia = custoFixoMes(s) / DIAS_MES_MEDIO;
  const cons = consumoReal(s.abastecimentos);

  const recentes = [...s.turnos].sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm)).slice(0, 12);
  const abastRecentes = [...s.abastecimentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);

  root.innerHTML = `
  <div class="view-head">
    <h1>Lançar</h1>
    <p>Um registro por dia por aplicativo já basta. O importante é o bruto, os quilômetros e o tempo — é disso que sai todo o resto.</p>
  </div>

  <div class="segmented" role="group" aria-label="O que lançar" style="margin-bottom:14px">
    <button type="button" data-aba="turno" aria-pressed="${aba === 'turno'}">Turno</button>
    <button type="button" data-aba="abastecimento" aria-pressed="${aba === 'abastecimento'}">Abastecimento</button>
  </div>

  <div ${aba === 'turno' ? '' : 'hidden'}>
    <form class="card" id="form-turno" novalidate>
      <div class="fields-2">
        <div class="field">
          <label for="t-data">Data</label>
          <input type="date" id="t-data" name="data" value="${todayISO()}" required>
        </div>
        <div class="field">
          <label for="t-app">Aplicativo</label>
          <select id="t-app" name="app">
            ${PLATAFORMAS.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="fields-2">
        <div class="field">
          <label for="t-bruto">Ganho bruto</label>
          <div class="input-affix"><span>R$</span>
            <input type="text" inputmode="decimal" id="t-bruto" name="bruto" placeholder="0,00" required>
          </div>
          <span class="hint">O total que o app mostra, antes de qualquer desconto.</span>
        </div>
        <div class="field">
          <label for="t-gorjeta">Gorjeta / bônus</label>
          <div class="input-affix"><span>R$</span>
            <input type="text" inputmode="decimal" id="t-gorjeta" name="gorjeta" placeholder="0,00">
          </div>
          <span class="hint">Separe do bruto: bônus não é renda garantida.</span>
        </div>
      </div>

      <div class="fields-3">
        <div class="field">
          <label for="t-km">Quilômetros</label>
          <div class="input-affix suffix"><span>km</span>
            <input type="text" inputmode="decimal" id="t-km" name="km" placeholder="0">
          </div>
        </div>
        <div class="field">
          <label for="t-horas">Horas</label>
          <input type="number" inputmode="numeric" id="t-horas" name="hh" min="0" max="24" step="1" placeholder="0">
        </div>
        <div class="field">
          <label for="t-min">Minutos</label>
          <input type="number" inputmode="numeric" id="t-min" name="mm" min="0" max="59" step="5" placeholder="0">
        </div>
      </div>

      <div class="fields-2">
        <div class="field">
          <label for="t-corridas">Corridas / entregas</label>
          <input type="number" inputmode="numeric" id="t-corridas" name="corridas" min="0" step="1" placeholder="0">
        </div>
        <div class="field">
          <label for="t-gastos">Gastos do turno</label>
          <div class="input-affix"><span>R$</span>
            <input type="text" inputmode="decimal" id="t-gastos" name="gastos" placeholder="0,00">
          </div>
          <span class="hint">Comida, pedágio, estacionamento, lavagem.</span>
        </div>
      </div>

      <div class="field">
        <label for="t-obs">Observação</label>
        <input type="text" id="t-obs" name="obs" placeholder="chuva, dinâmica alta, zona sul…" maxlength="120">
      </div>

      <div class="note note-accent" id="previa" aria-live="polite">
        Preencha o bruto e os quilômetros para ver quanto sobra de verdade.
      </div>

      <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">${icon('check')} Salvar turno</button>
      <p class="tiny dim center" style="margin-top:9px">Custo variável em uso: ${money(cv.total)}/km · custo fixo: ${money(fixoDia)}/dia</p>
    </form>

    <div class="card">
      <div class="card-head"><h2>Últimos lançamentos</h2><span class="small dim">${s.turnos.length} no total</span></div>
      ${recentes.length ? `<ul class="list">${recentes.map((t) => {
        const bruto = (t.bruto || 0) + (t.gorjeta || 0);
        const liq = bruto - (t.km || 0) * cv.total - (t.gastos || 0) - fixoDia;
        return `<li>
          <div class="list-main">
            <div class="list-title">${esc(nomeApp(t.app))} · ${money(bruto)}</div>
            <div class="list-sub">${esc(longDate(t.data))} · ${n0(t.km)} km · ${hoursToLabel(t.horas)}${t.corridas ? ` · ${t.corridas} corridas` : ''}${t.origem === 'importado' ? ' · importado' : ''}</div>
          </div>
          <div class="list-val" style="color:${liq < 0 ? 'var(--critical)' : 'inherit'}">${money(liq)}</div>
          <button class="icon-btn" data-del-turno="${t.id}" aria-label="Apagar lançamento de ${esc(longDate(t.data))}">${icon('trash')}</button>
        </li>`;
      }).join('')}</ul>` : '<div class="empty">Nenhum turno lançado ainda.</div>'}
    </div>
  </div>

  <div ${aba === 'abastecimento' ? '' : 'hidden'}>
    <form class="card" id="form-abast" novalidate>
      <div class="fields-2">
        <div class="field">
          <label for="a-data">Data</label>
          <input type="date" id="a-data" name="data" value="${todayISO()}" required>
        </div>
        <div class="field">
          <label for="a-odo">Odômetro</label>
          <div class="input-affix suffix"><span>km</span>
            <input type="text" inputmode="decimal" id="a-odo" name="odometro" placeholder="0">
          </div>
        </div>
      </div>
      <div class="fields-2">
        <div class="field">
          <label for="a-litros">Litros</label>
          <div class="input-affix suffix"><span>L</span>
            <input type="text" inputmode="decimal" id="a-litros" name="litros" placeholder="0,00" required>
          </div>
        </div>
        <div class="field">
          <label for="a-valor">Valor pago</label>
          <div class="input-affix"><span>R$</span>
            <input type="text" inputmode="decimal" id="a-valor" name="valor" placeholder="0,00" required>
          </div>
        </div>
      </div>
      <div class="checkline">
        <input type="checkbox" id="a-cheio" name="tanqueCheio" checked>
        <label for="a-cheio">Enchi o tanque até o bico desarmar<br><span class="hint">É o que permite medir o consumo real. Sem isso o registro entra só como gasto.</span></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${icon('fuel')} Salvar abastecimento</button>
    </form>

    <div class="card">
      <div class="card-head"><h2>Seu consumo real</h2>
        ${cons.confiavel ? '<span class="badge badge-good">medido</span>' : '<span class="badge">precisa de mais dados</span>'}
      </div>
      ${cons.amostras > 0 ? `
        <div class="tiles">
          <div class="tile"><span class="tile-label">Consumo medido</span><span class="tile-value">${n1(cons.kmL)} <span class="small dim">km/L</span></span><span class="tile-note">${cons.amostras} medição(ões) · ${n0(cons.kmMedidos)} km</span></div>
          <div class="tile"><span class="tile-label">Preço médio do litro</span><span class="tile-value">${money(cons.precoMedioLitro)}</span><span class="tile-note">gasto total ${money(cons.gastoTotal)}</span></div>
          <div class="tile"><span class="tile-label">Custo de combustível</span><span class="tile-value">${money(safeDiv(cons.precoMedioLitro, cons.kmL))} <span class="small dim">/km</span></span><span class="tile-note">medido, não estimado</span></div>
        </div>
        ${cons.confiavel && Math.abs(cons.kmL - s.perfil.consumoKmL) > 0.6 ? `
          <div class="note note-warning" style="margin-top:12px">
            Seu perfil está com <b>${n1(s.perfil.consumoKmL)} km/L</b>, mas a medição diz <b>${n1(cons.kmL)} km/L</b>.
            <button class="btn btn-sm btn-ghost" data-usar-consumo="${cons.kmL.toFixed(2)}" style="margin-top:8px">Usar o valor medido</button>
          </div>` : ''}
      ` : '<div class="empty">Registre dois abastecimentos de tanque cheio para o Giro calcular seu km/L de verdade.</div>'}

      ${abastRecentes.length ? `<ul class="list" style="margin-top:12px">${abastRecentes.map((a) => `<li>
        <div class="list-main">
          <div class="list-title">${n1(a.litros)} L · ${money(a.valor)}</div>
          <div class="list-sub">${esc(longDate(a.data))} · ${a.odometro ? `${n0(a.odometro)} km` : 'sem odômetro'} · ${money(safeDiv(a.valor, a.litros))}/L${a.tanqueCheio === false ? ' · parcial' : ''}</div>
        </div>
        <button class="icon-btn" data-del-abast="${a.id}" aria-label="Apagar abastecimento">${icon('trash')}</button>
      </li>`).join('')}</ul>` : ''}
    </div>
  </div>`;

  /* ---------- eventos ---------- */

  root.querySelectorAll('[data-aba]').forEach((b) => {
    b.addEventListener('click', () => { aba = b.dataset.aba; render(root); });
  });

  const formTurno = root.querySelector('#form-turno');
  if (formTurno) {
    const previa = root.querySelector('#previa');
    const calcular = () => {
      const bruto = parseNum(formTurno.bruto.value) + parseNum(formTurno.gorjeta.value);
      const km = parseNum(formTurno.km.value);
      const gastos = parseNum(formTurno.gastos.value);
      const horas = (parseNum(formTurno.hh.value) || 0) + (parseNum(formTurno.mm.value) || 0) / 60;
      if (!bruto && !km) {
        previa.className = 'note note-accent';
        previa.innerHTML = 'Preencha o bruto e os quilômetros para ver quanto sobra de verdade.';
        return;
      }
      const custoVar = km * cv.total;
      const liq = bruto - custoVar - gastos - fixoDia;
      const porHora = safeDiv(liq, horas);
      previa.className = `note ${liq < 0 ? 'note-critical' : 'note-good'}`;
      previa.innerHTML = `Sobra estimada: <b>${money(liq)}</b>
        ${horas > 0 ? ` · <b>${money(porHora)}/h</b>` : ''}
        ${km > 0 ? ` · <b>${money(safeDiv(liq, km))}/km</b>` : ''}
        <br><span class="tiny dim">${money(bruto)} bruto − ${money(custoVar)} de rodagem${gastos ? ` − ${money(gastos)} de gastos` : ''} − ${money(fixoDia)} de custo fixo do dia</span>`;
    };
    formTurno.addEventListener('input', calcular);

    formTurno.addEventListener('submit', (e) => {
      e.preventDefault();
      const bruto = parseNum(formTurno.bruto.value);
      if (bruto <= 0 && parseNum(formTurno.km.value) <= 0) {
        toast('Informe pelo menos o ganho bruto ou os quilômetros.', 'error');
        return;
      }
      // Dado de verdade e exemplo nunca convivem: o primeiro lançamento seu
      // limpa o mês fictício, para não haver número de brincadeira misturado.
      const saindoDoExemplo = emExemplo();
      if (saindoDoExemplo) limparExemplo();
      addTurno({
        data: formTurno.data.value || todayISO(),
        app: formTurno.app.value,
        bruto,
        gorjeta: parseNum(formTurno.gorjeta.value),
        km: parseNum(formTurno.km.value),
        horas: (parseNum(formTurno.hh.value) || 0) + (parseNum(formTurno.mm.value) || 0) / 60,
        corridas: parseNum(formTurno.corridas.value),
        gastos: parseNum(formTurno.gastos.value),
        obs: formTurno.obs.value.trim(),
      });
      toast(saindoDoExemplo ? 'Exemplo removido e primeiro dia salvo.' : 'Turno salvo.', 'good');
      render(root);
    });
  }

  const formAbast = root.querySelector('#form-abast');
  if (formAbast) {
    formAbast.addEventListener('submit', (e) => {
      e.preventDefault();
      const litros = parseNum(formAbast.litros.value);
      const valor = parseNum(formAbast.valor.value);
      if (litros <= 0 || valor <= 0) { toast('Informe os litros e o valor pago.', 'error'); return; }
      const saindoDoExemplo = emExemplo();
      if (saindoDoExemplo) limparExemplo();
      addAbastecimento({
        data: formAbast.data.value || todayISO(),
        litros, valor,
        odometro: parseNum(formAbast.odometro.value),
        tanqueCheio: formAbast.tanqueCheio.checked,
      });
      toast(saindoDoExemplo ? 'Exemplo removido e abastecimento salvo.' : 'Abastecimento registrado.', 'good');
      render(root);
    });
  }

  root.querySelectorAll('[data-del-turno]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('Apagar este lançamento?')) return;
      removeTurno(b.dataset.delTurno);
      render(root);
    });
  });

  root.querySelectorAll('[data-del-abast]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!confirm('Apagar este abastecimento?')) return;
      removeAbastecimento(b.dataset.delAbast);
      render(root);
    });
  });

  const usar = root.querySelector('[data-usar-consumo]');
  if (usar) {
    usar.addEventListener('click', () => {
      const v = Number(usar.dataset.usarConsumo);
      import('../store.js').then(({ update }) => {
        update((st) => { st.perfil.consumoKmL = v; });
        toast(`Consumo atualizado para ${n1(v)} km/L.`, 'good');
        render(root);
      });
    });
  }
}

export const meta = { titulo: 'Lançar' };
