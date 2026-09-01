/* Utilitários de formatação, datas e DOM. */

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const money = (v) => BRL.format(Number.isFinite(v) ? v : 0);
export const money0 = (v) => BRL0.format(Number.isFinite(v) ? v : 0);
export const n2 = (v) => NUM2.format(Number.isFinite(v) ? v : 0);
export const n1 = (v) => NUM1.format(Number.isFinite(v) ? v : 0);
export const n0 = (v) => NUM0.format(Number.isFinite(v) ? v : 0);
export const pct = (v, d = 0) => `${(Number.isFinite(v) ? v * 100 : 0).toFixed(d).replace('.', ',')}%`;

/**
 * Converte texto digitado em número, tratando as duas convenções que aparecem
 * de verdade num campo destes: a brasileira ("1.234,56") e a americana
 * ("1,234.56" ou "12.5"), que vem colada de planilha e de extrato.
 *
 * O caso perigoso é o ponto sozinho: "2.000" é dois mil no Brasil e dois
 * inteiros nos Estados Unidos. Resolvemos pelo formato — grupos de exatamente
 * três dígitos depois do ponto são separador de milhar, com a ressalva de que
 * algo começando em "0." é decimal ("0.075" é setenta e cinco milésimos).
 */
export function parseNum(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;

  let s = String(input).trim().replace(/[\s\u00a0]|[Rr]\$/g, '');
  if (!s) return 0;

  const negativo = /^[-−]/.test(s);
  s = s.replace(/[-−+]/g, '');

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  if (temVirgula && temPonto) {
    // o separador que aparece por último é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (temVirgula) {
    // numa página em português, vírgula sozinha é decimal — a não ser que
    // haja mais de uma, e aí só podem ser separadores de milhar
    const n = (s.match(/,/g) || []).length;
    s = n > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (temPonto) {
    const n = (s.match(/\./g) || []).length;
    if (n > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s) && !/^0\./.test(s)) s = s.replace('.', '');
  }

  const v = parseFloat(s);
  if (!Number.isFinite(v)) return 0;
  return negativo ? -v : v;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export const safeDiv = (a, b) => (b > 0 && Number.isFinite(a / b) ? a / b : 0);
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

/* ---------- Datas (trabalhamos com strings ISO "AAAA-MM-DD", fuso local) ---------- */

export function todayISO(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoToDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, days) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** Segunda-feira da semana do ISO informado. */
export function startOfWeek(iso) {
  const d = isoToDate(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return todayISO(d);
}

export function startOfMonth(iso) {
  return `${String(iso).slice(0, 7)}-01`;
}

export function endOfMonth(iso) {
  const d = isoToDate(iso);
  return todayISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const weekdayShort = (iso) => DIAS[isoToDate(iso).getDay()];
export const dayMonth = (iso) => {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (iso) => {
  const d = isoToDate(iso);
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
};
export function longDate(iso) {
  const d = isoToDate(iso);
  return `${weekdayShort(iso)}, ${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

/** Lista de datas ISO de `from` até `to`, inclusive. */
export function dateRange(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 1000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function hoursToLabel(h) {
  if (!Number.isFinite(h) || h <= 0) return '0h';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
}

/* ---------- DOM ---------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escapa texto para interpolação segura em template de HTML. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function uid() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let toastTimer = null;
export function toast(msg, kind = 'info') {
  let host = $('#toast');
  if (!host) {
    host = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    Object.assign(host.style, {
      position: 'fixed', left: '50%', bottom: 'calc(var(--nav-h) + 16px)',
      transform: 'translateX(-50%)', zIndex: '80', maxWidth: 'min(92vw, 420px)',
      padding: '11px 15px', borderRadius: '11px', fontSize: '14px', fontWeight: '600',
      boxShadow: 'var(--shadow-2)', textAlign: 'center', opacity: '0',
      transition: 'opacity .18s ease', pointerEvents: 'none',
    });
    document.body.append(host);
  }
  host.style.background = kind === 'error' ? 'var(--critical)' : kind === 'good' ? 'var(--good)' : 'var(--surface-3)';
  host.style.color = kind === 'info' ? 'var(--text-1)' : '#fff';
  host.textContent = msg;
  host.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.style.opacity = '0'; }, 3200);
}

/**
 * Lê um arquivo escolhido pelo usuário como texto.
 * Blob.text() só chegou no Safari 14; em iOS mais antigo cai no FileReader.
 */
export function lerTexto(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ''));
    leitor.onerror = () => reject(leitor.error || new Error('Falha ao ler o arquivo.'));
    leitor.readAsText(file, 'utf-8');
  });
}

export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Ícones inline (traço 1.75, 24x24). */
const ICONS = {
  gauge: '<path d="M12 21a9 9 0 1 0-9-9"/><path d="M3 12h2M12 3v2M20 8l-1.7 1"/><path d="m12 12 5-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  scale: '<path d="M12 3v18M7 8h10"/><path d="M4 8 2 14h4L4 8ZM20 8l-2 6h4l-2-6Z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 11h-5a2 2 0 0 0 0 4h5v-4Z"/>',
  plug: '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0V8Z"/><path d="M12 17v5"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v-4M12 17V7M17 17v-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 9h0a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  play: '<path d="M6 4v16l14-8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4v16M17 4v16"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V8M7 12l5-5 5 5M4 4h16"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  fuel: '<path d="M4 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15"/><path d="M3 20h12M6 9h6"/><path d="M14 8h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};

export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
