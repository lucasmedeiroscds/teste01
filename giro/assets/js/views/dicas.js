/* Dicas: o carrossel em tela cheia, mais o texto completo de todas as dicas
 * para quem prefere ler de uma vez em vez de esperar o rodízio. */

import { carousel } from '../carousel.js';
import { DICAS, TEMPO_POR_DICA_MS } from '../tips.js';
import { esc } from '../util.js';

export function render(root) {
  const minutos = Math.round((DICAS.length * TEMPO_POR_DICA_MS) / 60000);

  root.innerHTML = `
  <div class="view-head">
    <h1>Dicas</h1>
    <p>${DICAS.length} dicas de gestão financeira escritas para quem vive de aplicativo. Uma por vez, 60 segundos cada — a volta completa leva ${minutos} minutos. Passe adiante quando quiser: o cronômetro reinicia.</p>
  </div>

  <div data-carousel></div>

  <div class="card" style="margin-top:16px">
    <div class="card-head">
      <h2>Todas as dicas</h2>
      <span class="small dim">para ler no seu ritmo</span>
    </div>
    <div class="stack">
      ${DICAS.map((d, i) => `
        <details style="border-bottom:1px solid var(--line);padding-bottom:10px">
          <summary style="cursor:pointer;font-weight:620;list-style:none;display:flex;gap:10px;align-items:baseline">
            <span class="num dim tiny" style="flex:0 0 22px">${String(i + 1).padStart(2, '0')}</span>
            <span>${esc(d.titulo)}</span>
          </summary>
          <p class="small muted" style="margin:9px 0 0 32px">${esc(d.texto)}</p>
          <div class="tips-action" style="margin:10px 0 0 32px">${d.acao}</div>
        </details>`).join('')}
    </div>
  </div>

  <div class="note" style="margin-top:16px">
    As dicas são orientação geral de organização financeira, escritas a partir da realidade de custos de quem roda por aplicativo.
    Elas não substituem contador nem consultor de investimentos — para decisão tributária e previdenciária, confirme com um profissional.
  </div>`;

  carousel.mount(root.querySelector('[data-carousel]'));
}

export const meta = { titulo: 'Dicas' };
