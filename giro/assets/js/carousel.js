/* Carrossel de dicas: uma dica por vez, 60 segundos de tela cada.
 *
 * Regras:
 *  - avanço automático a cada 60 s, com anel e barra mostrando o tempo restante;
 *  - pausa automática com o ponteiro em cima, com foco dentro do cartão ou com
 *    a aba em segundo plano — nenhuma dica gasta o tempo dela fora da tela;
 *  - navegação manual (setas, pontos, teclado) reinicia os 60 s da dica;
 *  - índice guardado, então a leitura continua de onde parou.
 *
 * É uma instância única: só existe um carrossel na tela por vez, montado na
 * view ativa. Isso evita dois cronômetros correndo em paralelo.
 */

import { DICAS, TEMPO_POR_DICA_MS } from './tips.js';
import { getState, setTipIndex } from './store.js';
import { icon, esc } from './util.js';

const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R;

class TipsCarousel {
  constructor() {
    this.index = 0;
    this.elapsed = 0;
    this.lastTick = 0;
    this.raf = 0;
    this.paused = false;
    this.pausedByUser = false;
    this.host = null;
    this.root = null;
    this.onVisibility = this.onVisibility.bind(this);
    this.onKey = this.onKey.bind(this);
  }

  /* ----- ciclo de vida ----- */

  mount(host) {
    if (!host) return;
    this.unmount();
    this.host = host;
    const saved = getState().ui?.tipIndex ?? 0;
    this.index = Number.isInteger(saved) && saved >= 0 && saved < DICAS.length ? saved : 0;
    this.elapsed = 0;
    this.pausedByUser = false;
    host.innerHTML = this.template();
    this.root = host.firstElementChild;
    this.bind();
    this.render();
    this.start();
  }

  unmount() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.root) this.root.removeEventListener('keydown', this.onKey);
    this.root = null;
    this.host = null;
  }

  /* ----- markup ----- */

  template() {
    const slides = DICAS.map((d, i) => `
      <article class="tips-slide${i === 0 ? ' is-active' : ''}"
               role="group" aria-roledescription="dica"
               aria-label="Dica ${i + 1} de ${DICAS.length}" data-slide="${i}">
        <span class="tips-cat">${esc(d.cat)}</span>
        <h3>${esc(d.titulo)}</h3>
        <p>${esc(d.texto)}</p>
        <div class="tips-action">${d.acao}</div>
      </article>`).join('');

    const dots = DICAS.map((d, i) => `
      <button type="button" data-goto="${i}" aria-current="${i === 0}"
              aria-label="Ir para a dica ${i + 1}: ${esc(d.titulo)}"></button>`).join('');

    return `
    <section class="tips" aria-roledescription="carrossel" aria-label="Dicas de gestão financeira" tabindex="-1">
      <div class="tips-head">
        <span class="tips-kicker">Dica do momento</span>
        <div class="tips-timer">
          <span class="tips-count num" data-count>1/${DICAS.length}</span>
          <svg class="tips-ring" viewBox="0 0 26 26" aria-hidden="true">
            <circle class="ring-bg" cx="13" cy="13" r="${RING_R}"></circle>
            <circle class="ring-fg" cx="13" cy="13" r="${RING_R}"
                    stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="0" data-ring></circle>
          </svg>
          <span class="tips-count num" data-secs aria-hidden="true">60s</span>
        </div>
      </div>

      <div class="tips-viewport" aria-live="polite" aria-atomic="true" data-viewport>
        ${slides}
      </div>

      <div class="tips-foot">
        <div class="tips-dots" role="tablist" aria-label="Escolher dica">${dots}</div>
        <div class="tips-nav">
          <button type="button" class="icon-btn" data-prev aria-label="Dica anterior">${icon('prev')}</button>
          <button type="button" class="icon-btn" data-toggle aria-label="Pausar rodízio" aria-pressed="false">${icon('pause')}</button>
          <button type="button" class="icon-btn" data-next aria-label="Próxima dica">${icon('next')}</button>
        </div>
      </div>

      <div class="tips-progress" role="progressbar" aria-label="Tempo da dica atual"
           aria-valuemin="0" aria-valuemax="60" aria-valuenow="0" data-bar><i></i></div>
    </section>`;
  }

  bind() {
    const r = this.root;
    r.querySelector('[data-prev]').addEventListener('click', () => this.go(this.index - 1));
    r.querySelector('[data-next]').addEventListener('click', () => this.go(this.index + 1));
    r.querySelector('[data-toggle]').addEventListener('click', () => this.toggle());
    r.querySelectorAll('[data-goto]').forEach((b) => {
      b.addEventListener('click', () => this.go(Number(b.dataset.goto)));
    });

    // pausa enquanto a pessoa está lendo com o ponteiro em cima ou com foco dentro
    r.addEventListener('pointerenter', () => this.setAutoPause(true));
    r.addEventListener('pointerleave', () => this.setAutoPause(false));
    r.addEventListener('focusin', () => this.setAutoPause(true));
    r.addEventListener('focusout', (e) => {
      if (!r.contains(e.relatedTarget)) this.setAutoPause(false);
    });
    r.addEventListener('keydown', this.onKey);

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  onKey(e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.index - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.index + 1); }
  }

  onVisibility() {
    if (document.hidden) this.stop();
    else if (!this.pausedByUser && !this.hovering) this.start();
  }

  /* ----- cronômetro ----- */

  start() {
    if (this.raf || !this.root || document.hidden) return;
    this.lastTick = performance.now();
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      const dt = now - this.lastTick;
      this.lastTick = now;
      this.elapsed += dt;
      if (this.elapsed >= TEMPO_POR_DICA_MS) {
        this.elapsed = 0;
        this.index = (this.index + 1) % DICAS.length;
        this.render();
        return;
      }
      this.renderTimer();
    };
    this.raf = requestAnimationFrame(tick);
    this.setPausedFlag(false);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.setPausedFlag(true);
  }

  setAutoPause(on) {
    this.hovering = on;
    if (this.pausedByUser) return;
    if (on) this.stop(); else this.start();
  }

  toggle() {
    this.pausedByUser = !this.pausedByUser;
    const btn = this.root?.querySelector('[data-toggle]');
    if (btn) {
      btn.innerHTML = icon(this.pausedByUser ? 'play' : 'pause');
      btn.setAttribute('aria-pressed', String(this.pausedByUser));
      btn.setAttribute('aria-label', this.pausedByUser ? 'Retomar rodízio' : 'Pausar rodízio');
    }
    if (this.pausedByUser) this.stop(); else this.start();
  }

  setPausedFlag(paused) {
    this.paused = paused;
    this.root?.classList.toggle('is-paused', paused);
  }

  /* ----- navegação ----- */

  go(i) {
    const n = DICAS.length;
    this.index = ((i % n) + n) % n;
    this.elapsed = 0;           // navegar manualmente devolve os 60 s cheios
    this.render();
    if (!this.pausedByUser && !this.hovering) this.start();
  }

  /* ----- desenho ----- */

  render() {
    if (!this.root) return;
    const slides = this.root.querySelectorAll('[data-slide]');
    slides.forEach((s, i) => s.classList.toggle('is-active', i === this.index));
    this.root.querySelectorAll('[data-goto]').forEach((b, i) => {
      b.setAttribute('aria-current', String(i === this.index));
    });
    const count = this.root.querySelector('[data-count]');
    if (count) count.textContent = `${this.index + 1}/${DICAS.length}`;
    setTipIndex(this.index);
    this.renderTimer();
  }

  renderTimer() {
    if (!this.root) return;
    const p = Math.min(1, this.elapsed / TEMPO_POR_DICA_MS);
    const restante = Math.max(0, Math.ceil((TEMPO_POR_DICA_MS - this.elapsed) / 1000));

    const ring = this.root.querySelector('[data-ring]');
    if (ring) ring.setAttribute('stroke-dashoffset', (RING_C * p).toFixed(2));

    const secs = this.root.querySelector('[data-secs]');
    if (secs) secs.textContent = `${restante}s`;

    const bar = this.root.querySelector('[data-bar]');
    if (bar) {
      bar.firstElementChild.style.width = `${(p * 100).toFixed(2)}%`;
      bar.setAttribute('aria-valuenow', String(60 - restante));
    }
  }
}

export const carousel = new TipsCarousel();
