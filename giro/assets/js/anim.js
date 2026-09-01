/* Movimento com moderação.
 *
 * A regra aqui é: a animação existe para explicar, não para enfeitar. Número
 * que sobe conta ao leitor que aquilo é um valor acumulado; barra que cresce da
 * linha de base mostra de onde ela é medida; a tela que entra deslizando diz
 * que você mudou de lugar. Tudo dura menos de meio segundo, acontece uma vez, e
 * some por completo para quem pediu menos movimento no sistema.
 */

const menosMovimento = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const semAnimacao = menosMovimento;

const suavizar = (t) => 1 - Math.pow(1 - t, 3);   // desacelera no fim

/**
 * Conta de um valor até outro, escrevendo com o formatador informado.
 * Guarda o último valor no próprio elemento, então trocar de período anima a
 * diferença em vez de recomeçar do zero.
 */
export function contarAte(el, valor, formatar, duracao = 420) {
  if (!el) return;
  const destino = Number(valor) || 0;
  const anterior = Number(el.dataset.valor);
  const inicio = Number.isFinite(anterior) ? anterior : 0;
  el.dataset.valor = String(destino);

  if (menosMovimento() || inicio === destino || Math.abs(destino - inicio) < 0.005) {
    el.textContent = formatar(destino);
    return;
  }

  if (el._raf) cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const passo = (agora) => {
    const t = Math.min(1, (agora - t0) / duracao);
    el.textContent = formatar(inicio + (destino - inicio) * suavizar(t));
    if (t < 1) el._raf = requestAnimationFrame(passo);
    else { el._raf = 0; el.textContent = formatar(destino); }
  };
  el._raf = requestAnimationFrame(passo);
}

/** Anima todos os valores marcados com data-anima dentro de um contêiner. */
export function animarValores(raiz, formatadores) {
  raiz.querySelectorAll('[data-anima]').forEach((el) => {
    const formatar = formatadores[el.dataset.anima];
    if (!formatar) return;
    contarAte(el, Number(el.dataset.bruto), formatar);
  });
}

/** Pisca um valor que acabou de mudar por causa de outra coisa que a pessoa fez. */
export function piscar(el) {
  if (!el || menosMovimento()) return;
  el.classList.remove('piscou');
  void el.offsetWidth;                 // reinicia a animação
  el.classList.add('piscou');
}

/** Entrada da tela ao trocar de rota. */
export function entrarNaTela(el) {
  if (!el || menosMovimento()) return;
  el.classList.remove('entrando');
  void el.offsetWidth;
  el.classList.add('entrando');
}

/**
 * Atraso escalonado para uma lista de elementos, em milissegundos.
 * Limitado para que uma lista longa não vire uma espera.
 */
export const escalonar = (i, passo = 45, teto = 320) => Math.min(i * passo, teto);
