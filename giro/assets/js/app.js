/* Casca do app: rotas, navegação, tema e primeira configuração. */

import { getState, subscribe, update, aplicarPresetVeiculo } from './store.js';
import { carousel } from './carousel.js';
import { emExemplo, limparExemplo } from './demo.js';
import { entrarNaTela } from './anim.js';
import { $, el, icon, esc, parseNum, n0, n2, toast, uid } from './util.js';

import * as painel from './views/painel.js';
import * as lancar from './views/lancar.js';
import * as corrida from './views/corrida.js';
import * as custos from './views/custos.js';
import * as relatorios from './views/relatorios.js';
import * as conexoes from './views/conexoes.js';
import * as dicas from './views/dicas.js';

const ROTAS = [
  { id: 'painel',     hash: '#/painel',     rotulo: 'Painel',       icone: 'gauge',  view: painel,     barra: true },
  { id: 'lancar',     hash: '#/lancar',     rotulo: 'Lançar',       icone: 'plus',   view: lancar,     barra: true },
  { id: 'corrida',    hash: '#/corrida',    rotulo: 'Vale a pena?', icone: 'scale',  view: corrida,    barra: true, curto: 'Corrida' },
  { id: 'custos',     hash: '#/custos',     rotulo: 'Custos',       icone: 'wallet', view: custos,     barra: true },
  { id: 'dicas',      hash: '#/dicas',      rotulo: 'Dicas',        icone: 'bulb',   view: dicas,      barra: true },
  { id: 'relatorios', hash: '#/relatorios', rotulo: 'Relatórios',   icone: 'chart',  view: relatorios, barra: false },
  { id: 'conexoes',   hash: '#/conexoes',   rotulo: 'Conexões',     icone: 'plug',   view: conexoes,   barra: false },
];

const rotaPorHash = (h) => ROTAS.find((r) => r.hash === h) || ROTAS[0];

let rotaAtual = null;

/* ---------- tema ---------- */

function aplicarTema(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const btn = $('#btn-tema');
  if (btn) {
    const escuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    btn.innerHTML = icon(escuro ? 'sun' : 'moon');
    btn.setAttribute('aria-label', escuro ? 'Usar tema claro' : 'Usar tema escuro');
  }
}

function alternarTema() {
  const atual = getState().perfil.tema || 'auto';
  const escuro = atual === 'dark' || (atual === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const novo = escuro ? 'light' : 'dark';
  update((s) => { s.perfil.tema = novo; }, { silent: true });
  aplicarTema(novo);
}

/* ---------- casca ---------- */

function montarCasca() {
  const app = $('#app');
  app.innerHTML = `
  <header class="topbar">
    <div class="topbar-in">
      <a class="brand" href="#/painel">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>
          </svg>
        </span>
        <span>
          <span class="brand-name">Giro</span>
          <span class="brand-sub" style="display:block">para quem roda</span>
        </span>
      </a>

      <nav class="nav-desktop" aria-label="Seções">
        ${ROTAS.map((r) => `<a href="${r.hash}" data-rota="${r.id}">${esc(r.rotulo)}</a>`).join('')}
      </nav>

      <a class="icon-btn only-mobile" href="#/relatorios" aria-label="Relatórios">${icon('chart')}</a>
      <a class="icon-btn only-mobile" href="#/conexoes" aria-label="Conexões">${icon('plug')}</a>
      <button class="icon-btn" id="btn-tema" type="button" aria-label="Alternar tema">${icon('moon')}</button>
    </div>
  </header>

  <div class="faixa-exemplo" id="faixa-exemplo" role="status" hidden>
    <span><b>Dados de exemplo.</b> Nada aqui é seu — é um mês fictício para você ver o app funcionando.</span>
    <button class="btn btn-sm btn-ghost" type="button" data-limpar-exemplo>Limpar e começar do zero</button>
  </div>

  <main id="conteudo" tabindex="-1"></main>

  <footer class="foot">
    <p><b>Giro</b> — gestão financeira para entregadores e motoristas de aplicativo.
    Tudo roda no seu navegador: nenhum dado sai do aparelho, nenhum cadastro, nenhuma conta.</p>
    <p>Os cálculos usam os custos que você informa. Números de referência servem de ponto de partida,
    não de verdade absoluta — revise-os com as suas notas de posto e de oficina.</p>
  </footer>

  <nav class="nav-mobile" aria-label="Seções">
    <ul>
      ${ROTAS.filter((r) => r.barra).map((r) => `
        <li><a href="${r.hash}" data-rota-barra="${r.id}">
          ${icon(r.icone)}<span>${esc(r.curto || r.rotulo)}</span>
        </a></li>`).join('')}
    </ul>
  </nav>`;

  document.body.insertBefore(
    el('a', { class: 'skip-link', href: '#conteudo', text: 'Pular para o conteúdo' }),
    document.body.firstChild
  );

  $('#btn-tema').addEventListener('click', alternarTema);

  $('[data-limpar-exemplo]').addEventListener('click', () => {
    if (!confirm('Isso apaga o exemplo e deixa o app zerado, pronto para os seus dados. Continuar?')) return;
    limparExemplo();
    toast('Exemplo removido. O app está zerado.');
    location.hash = '#/painel';
  });

  // Com o teclado do celular aberto sobra pouca tela; a barra inferior flutuando
  // em cima dele só atrapalha quem está preenchendo um campo. Só vale onde a
  // barra existe de fato — em tela larga ela nem é exibida.
  const digitavel = (t) => t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && t.type !== 'checkbox';
  const telaEstreita = () => window.innerWidth < 860;

  document.addEventListener('focusin', (e) => {
    if (digitavel(e.target) && telaEstreita()) app.classList.add('is-digitando');
  });
  document.addEventListener('focusout', () => {
    // o campo pode ter sido removido do DOM por um redesenho, e aí focusout
    // nem sempre chega — por isso a verificação é sobre quem está em foco agora
    setTimeout(() => {
      if (!digitavel(document.activeElement)) mostrarBarra();
    }, 60);
  });
}

/** Rede de segurança: a barra inferior nunca pode ficar escondida sem motivo. */
function mostrarBarra() {
  $('#app')?.classList.remove('is-digitando');
}

/* ---------- roteador ---------- */

function navegar() {
  const rota = rotaPorHash(location.hash);
  const conteudo = $('#conteudo');
  if (!conteudo) return;

  carousel.unmount();                     // só um cronômetro por vez
  conteudo.innerHTML = '';
  rota.view.render(conteudo);
  rotaAtual = rota;
  mostrarBarra();
  atualizarFaixaExemplo();
  entrarNaTela(conteudo);

  document.title = `${rota.rotulo} · Giro`;
  document.querySelectorAll('[data-rota]').forEach((a) => {
    if (a.dataset.rota === rota.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-rota-barra]').forEach((a) => {
    if (a.dataset.rotaBarra === rota.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  window.scrollTo(0, 0);
}

/** Redesenha a view atual quando o estado muda por fora dela. */
function aoMudarEstado() {
  if (!rotaAtual) return;
  const conteudo = $('#conteudo');
  carousel.unmount();
  conteudo.innerHTML = '';
  rotaAtual.view.render(conteudo);
  mostrarBarra();
  atualizarFaixaExemplo();
}

function atualizarFaixaExemplo() {
  const faixa = $('#faixa-exemplo');
  if (faixa) faixa.hidden = !emExemplo();
}

/* ---------- primeira configuração ---------- */

function abrirOnboarding() {
  const s = getState();
  const backdrop = el('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ob-titulo' });
  backdrop.innerHTML = `
  <form class="modal" id="form-ob">
    <h2 id="ob-titulo">Bem-vindo ao Giro</h2>
    <p>Três respostas rápidas e o app já sabe quanto custa cada quilômetro que você roda. Dá para ajustar tudo depois em Custos.</p>

    <div class="field">
      <span class="field-label">Você roda de</span>
      <div class="segmented" role="group" aria-label="Tipo de veículo">
        <button type="button" data-ob-veiculo="moto" aria-pressed="true">Moto</button>
        <button type="button" data-ob-veiculo="carro" aria-pressed="false">Carro</button>
        <button type="button" data-ob-veiculo="bike" aria-pressed="false">Bike</button>
      </div>
    </div>

    <div class="fields-2" id="ob-combustivel">
      <div class="field">
        <label for="ob-preco">Preço do litro hoje</label>
        <div class="input-affix"><span>R$</span>
          <input type="text" inputmode="decimal" id="ob-preco" value="${n2(s.perfil.precoCombustivel)}">
        </div>
      </div>
      <div class="field">
        <label for="ob-consumo">Quantos km por litro</label>
        <div class="input-affix suffix"><span>km/L</span>
          <input type="text" inputmode="decimal" id="ob-consumo" value="${n0(s.perfil.consumoKmL)}">
        </div>
      </div>
    </div>

    <div class="field">
      <label for="ob-fixo">Quanto sai por mês mesmo sem rodar</label>
      <div class="input-affix"><span>R$</span>
        <input type="text" inputmode="decimal" id="ob-fixo" placeholder="0,00">
      </div>
      <span class="hint">Some parcela ou aluguel do veículo, seguro, IPVA dividido por doze, plano de celular e MEI. Se não souber agora, deixe zero.</span>
    </div>

    <div class="fields-2">
      <div class="field">
        <label for="ob-dias">Dias por mês</label>
        <input type="number" id="ob-dias" value="${n0(s.metas.diasMes)}" min="1" max="31">
      </div>
      <div class="field">
        <label for="ob-horas">Horas por dia</label>
        <input type="number" id="ob-horas" value="${n0(s.metas.horasDia)}" min="1" max="16">
      </div>
    </div>

    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-ob-pular>Pular</button>
      <button type="submit" class="btn btn-primary">Começar</button>
    </div>
  </form>`;

  document.body.append(backdrop);
  const form = backdrop.querySelector('#form-ob');
  let veiculo = 'moto';

  backdrop.querySelectorAll('[data-ob-veiculo]').forEach((b) => {
    b.addEventListener('click', () => {
      veiculo = b.dataset.obVeiculo;
      backdrop.querySelectorAll('[data-ob-veiculo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      aplicarPresetVeiculo(veiculo);
      const st = getState();
      form.querySelector('#ob-consumo').value = n0(st.perfil.consumoKmL);
      backdrop.querySelector('#ob-combustivel').hidden = veiculo === 'bike';
    });
  });

  const fechar = () => {
    update((s2) => { s2.perfil.onboarded = true; });
    backdrop.remove();
  };

  backdrop.querySelector('[data-ob-pular]').addEventListener('click', fechar);
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const preco = parseNum(form.querySelector('#ob-preco').value);
    const consumo = parseNum(form.querySelector('#ob-consumo').value);
    const fixo = parseNum(form.querySelector('#ob-fixo').value);
    const dias = Math.max(1, parseNum(form.querySelector('#ob-dias').value) || 24);
    const horas = Math.max(1, parseNum(form.querySelector('#ob-horas').value) || 8);

    update((s2) => {
      s2.perfil.precoCombustivel = preco;
      s2.perfil.consumoKmL = consumo;
      s2.metas.diasMes = dias;
      s2.metas.horasDia = horas;
      s2.perfil.onboarded = true;
      if (fixo > 0) {
        s2.custosFixos = [{ id: uid(), nome: 'Custos fixos do mês', valorMes: fixo }];
      }
    });
    backdrop.remove();
    toast('Pronto. Agora é só lançar o primeiro dia.', 'good');
  });

  form.querySelector('#ob-preco')?.focus();
}

/* ---------- início ---------- */

function iniciar() {
  montarCasca();
  aplicarTema(getState().perfil.tema || 'auto');
  const mqEscuro = matchMedia('(prefers-color-scheme: dark)');
  const aoTrocarSistema = () => {
    if ((getState().perfil.tema || 'auto') === 'auto') aplicarTema('auto');
  };
  if (mqEscuro.addEventListener) mqEscuro.addEventListener('change', aoTrocarSistema);
  else if (mqEscuro.addListener) mqEscuro.addListener(aoTrocarSistema);   // Safari <= 13

  if (!location.hash) location.replace('#/painel');
  navegar();
  window.addEventListener('hashchange', navegar);
  subscribe(aoMudarEstado);

  if (!getState().perfil.onboarded) setTimeout(abrirOnboarding, 350);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
