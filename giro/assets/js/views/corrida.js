/* "Vale a pena?": decide uma corrida antes de aceitar.
 * A conta que ninguém faz na pressa — e é ela que separa dia bom de dia longo. */

import { getState, update } from '../store.js';
import { avaliarCorrida, custoVariavelKm, custoFixoPorHora } from '../finance.js';
import { money, n1, n0, parseNum, safeDiv } from '../util.js';

const VEREDITOS = {
  boa:    { rotulo: 'Vale a pena', badge: 'badge-good',     nota: 'note-good',     texto: 'Paga os custos e ainda entrega o seu R$ por hora alvo.' },
  limite: { rotulo: 'No limite',   badge: 'badge-warning',  nota: 'note-warning',  texto: 'Sobra alguma coisa, mas abaixo do que você definiu como mínimo por hora. Aceite só se estiver parado ou se for na direção de casa.' },
  ruim:   { rotulo: 'Não vale',    badge: 'badge-critical', nota: 'note-critical', texto: 'Depois de combustível, desgaste e a fatia de custo fixo do tempo gasto, essa corrida sai do seu bolso.' },
};

const entrada = { valor: '', kmColeta: '', kmEntrega: '', kmRetorno: '', minutos: '', contarRetorno: true };

export function render(root) {
  const s = getState();
  const cv = custoVariavelKm(s);
  const fixoHora = custoFixoPorHora(s);

  root.innerHTML = `
  <div class="view-head">
    <h1>Vale a pena?</h1>
    <p>Digite o que o aplicativo está oferecendo. Em cinco segundos você sabe se aquela corrida paga os próprios custos — e qual seria o valor mínimo para valer.</p>
  </div>

  <form class="card" id="form-corrida" novalidate>
    <div class="field">
      <label for="c-valor">Valor oferecido</label>
      <div class="input-affix"><span>R$</span>
        <input type="text" inputmode="decimal" id="c-valor" placeholder="0,00" autocomplete="off">
      </div>
    </div>

    <div class="fields-2">
      <div class="field">
        <label for="c-coleta">Até a coleta</label>
        <div class="input-affix suffix"><span>km</span>
          <input type="text" inputmode="decimal" id="c-coleta" placeholder="0" autocomplete="off">
        </div>
      </div>
      <div class="field">
        <label for="c-entrega">Coleta até a entrega</label>
        <div class="input-affix suffix"><span>km</span>
          <input type="text" inputmode="decimal" id="c-entrega" placeholder="0" autocomplete="off">
        </div>
      </div>
    </div>

    <div class="checkline">
      <input type="checkbox" id="c-retorno" checked>
      <label for="c-retorno">Contar a volta para a região de trabalho<br>
        <span class="hint">Se a entrega te joga longe, a volta é quilômetro que você roda sem receber. Ignorar isso é o erro mais comum.</span>
      </label>
    </div>

    <div class="field" id="wrap-retorno">
      <label for="c-kmretorno">Km de retorno</label>
      <div class="input-affix suffix"><span>km</span>
        <input type="text" inputmode="decimal" id="c-kmretorno" placeholder="igual ao trecho da entrega" autocomplete="off">
      </div>
    </div>

    <div class="field">
      <label for="c-min">Tempo estimado</label>
      <div class="input-affix suffix"><span>min</span>
        <input type="text" inputmode="decimal" id="c-min" placeholder="0" autocomplete="off">
      </div>
      <span class="hint">Inclua espera no estabelecimento e trânsito. É o tempo que essa corrida tira do seu turno.</span>
    </div>
  </form>

  <div class="card" id="resultado" aria-live="polite">
    <div class="empty">Preencha o valor e a distância para ver o resultado.</div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Seus números de referência</h2><a class="small" href="#/custos">ajustar</a></div>
    <ul class="list">
      <li><div class="list-main"><div class="list-title">Custo por km rodado</div><div class="list-sub">combustível ${money(cv.combustivel)} · manutenção ${money(cv.manutencao)} · desgaste ${money(cv.depreciacao)}</div></div><div class="list-val">${money(cv.total)}</div></li>
      <li><div class="list-main"><div class="list-title">Custo fixo por hora</div><div class="list-sub">o que corre mesmo com a moto parada, dividido pelas horas planejadas</div></div><div class="list-val">${money(fixoHora)}</div></li>
      <li><div class="list-main"><div class="list-title">R$ por hora mínimo</div><div class="list-sub">o piso que você definiu para aceitar corrida</div></div><div class="list-val">
        <div class="input-affix" style="width:110px"><span>R$</span>
          <input type="text" inputmode="decimal" id="c-metahora" value="${n1(s.metas.ganhoHoraMin)}" aria-label="R$ por hora mínimo">
        </div>
      </div></li>
    </ul>
  </div>

  <div class="card">
    <h2>Regra de bolso para decidir sem calculadora</h2>
    <p class="small muted" style="margin-top:6px">Com os seus custos de hoje, uma corrida só se paga acima destes valores por quilômetro total (ida, entrega e volta):</p>
    <div class="table-wrap" style="margin-top:10px">
      <table>
        <thead><tr><th>Km total da corrida</th><th class="n">Mínimo para empatar</th><th class="n">Mínimo para bater a meta</th></tr></thead>
        <tbody>
          ${[4, 8, 12, 18, 25].map((km) => {
            const minutos = Math.max(10, Math.round((km / 20) * 60));
            const horas = minutos / 60;
            const empatar = km * cv.total + fixoHora * horas;
            const meta = empatar + (Number(s.metas.ganhoHoraMin) || 0) * horas;
            return `<tr><td>${km} km <span class="dim">(~${minutos} min)</span></td><td class="n">${money(empatar)}</td><td class="n">${money(meta)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="tiny dim" style="margin-top:9px">Estimativa com média de 20 km/h, que é o que se consegue em trânsito urbano contando espera. Ajuste mentalmente para cima se a sua região trava mais.</p>
  </div>`;

  const form = root.querySelector('#form-corrida');
  const out = root.querySelector('#resultado');
  const wrapRetorno = root.querySelector('#wrap-retorno');
  const el = (id) => root.querySelector(id);

  el('#c-valor').value = entrada.valor;
  el('#c-coleta').value = entrada.kmColeta;
  el('#c-entrega').value = entrada.kmEntrega;
  el('#c-kmretorno').value = entrada.kmRetorno;
  el('#c-min').value = entrada.minutos;
  el('#c-retorno').checked = entrada.contarRetorno;

  function calcular() {
    entrada.valor = el('#c-valor').value;
    entrada.kmColeta = el('#c-coleta').value;
    entrada.kmEntrega = el('#c-entrega').value;
    entrada.kmRetorno = el('#c-kmretorno').value;
    entrada.minutos = el('#c-min').value;
    entrada.contarRetorno = el('#c-retorno').checked;

    wrapRetorno.hidden = !entrada.contarRetorno;

    const kmEntrega = parseNum(entrada.kmEntrega);
    const kmRetorno = entrada.contarRetorno
      ? (parseNum(entrada.kmRetorno) || kmEntrega)
      : 0;

    const valor = parseNum(entrada.valor);
    const kmColeta = parseNum(entrada.kmColeta);
    const minutos = parseNum(entrada.minutos) || Math.max(8, Math.round(((kmColeta + kmEntrega + kmRetorno) / 20) * 60));

    if (valor <= 0 || kmColeta + kmEntrega <= 0) {
      out.innerHTML = '<div class="empty">Preencha o valor e a distância para ver o resultado.</div>';
      return;
    }

    const a = avaliarCorrida(getState(), { valor, kmColeta, kmEntrega, kmRetorno, minutos });
    const v = VEREDITOS[a.veredito];

    out.innerHTML = `
      <div class="card-head">
        <h2>${money(a.liquido)} de sobra</h2>
        <span class="badge ${v.badge}">${v.rotulo}</span>
      </div>
      <div class="tiles">
        <div class="tile"><span class="tile-label">Por hora, líquido</span><span class="tile-value ${a.liquidoPorHora < a.metaHora ? 'is-neg' : 'is-pos'}">${money(a.liquidoPorHora)}</span><span class="tile-note">seu piso: ${money(a.metaHora)}/h</span></div>
        <div class="tile"><span class="tile-label">Bruto por km</span><span class="tile-value">${money(a.brutoPorKm)}</span><span class="tile-note">mínimo: ${money(a.brutoPorKmMinimo)}/km</span></div>
        <div class="tile"><span class="tile-label">Distância total</span><span class="tile-value">${n1(a.kmTotal)} <span class="small dim">km</span></span><span class="tile-note">${n0(minutos)} min · ${entrada.contarRetorno ? 'com volta' : 'sem volta'}</span></div>
      </div>

      <div class="note ${v.nota}" style="margin-top:14px">${v.texto}</div>

      <div class="propbar" style="margin-top:14px">
        <div class="propbar-row"><span class="propbar-name">Rodagem (${n1(a.kmTotal)} km)</span><span class="propbar-track"><i class="propbar-fill" style="width:${Math.min(100, safeDiv(a.custoVariavel, valor) * 100).toFixed(0)}%"></i></span><span class="propbar-val">${money(a.custoVariavel)}</span></div>
        <div class="propbar-row"><span class="propbar-name">Custo fixo do tempo</span><span class="propbar-track"><i class="propbar-fill" style="width:${Math.min(100, safeDiv(a.custoFixo, valor) * 100).toFixed(0)}%"></i></span><span class="propbar-val">${money(a.custoFixo)}</span></div>
        <div class="propbar-row ${a.liquido < 0 ? 'is-neg' : 'is-rest'}"><span class="propbar-name">Sobra para você</span><span class="propbar-track"><i class="propbar-fill" style="width:${Math.min(100, Math.abs(safeDiv(a.liquido, valor)) * 100).toFixed(0)}%"></i></span><span class="propbar-val">${money(a.liquido)}</span></div>
      </div>

      <div class="note note-accent" style="margin-top:14px">
        Para essa corrida valer a pena de verdade, o aplicativo teria que oferecer no mínimo <b>${money(a.valorMinimo)}</b>.
        ${valor < a.valorMinimo ? ` Faltam ${money(a.valorMinimo - valor)}.` : ' Já está acima disso.'}
      </div>`;
  }

  form.addEventListener('input', calcular);
  el('#c-retorno').addEventListener('change', calcular);
  el('#c-metahora').addEventListener('input', (e) => {
    update((st) => { st.metas.ganhoHoraMin = parseNum(e.target.value); }, { silent: true });
    calcular();
  });
  calcular();
}

export const meta = { titulo: 'Vale a pena?' };
