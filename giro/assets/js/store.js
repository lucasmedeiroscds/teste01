/* Estado do app + persistência local (localStorage). Nada sai do aparelho. */

import { uid, todayISO } from './util.js';

const KEY = 'giro.state.v1';
const VERSION = 1;

/* ---------- Presets de manutenção por tipo de veículo ---------- */
export const MANUTENCAO_PRESETS = {
  moto: [
    { nome: 'Troca de óleo + filtro', custo: 75, intervaloKm: 2000 },
    { nome: 'Relação (coroa, pinhão, corrente)', custo: 260, intervaloKm: 14000 },
    { nome: 'Pneus (dianteiro + traseiro)', custo: 620, intervaloKm: 16000 },
    { nome: 'Pastilhas / lonas de freio', custo: 130, intervaloKm: 9000 },
    { nome: 'Revisão e itens de desgaste', custo: 200, intervaloKm: 6000 },
  ],
  carro: [
    { nome: 'Troca de óleo + filtros', custo: 330, intervaloKm: 10000 },
    { nome: 'Pneus (jogo)', custo: 1700, intervaloKm: 45000 },
    { nome: 'Freios (pastilhas + discos)', custo: 700, intervaloKm: 35000 },
    { nome: 'Revisão e itens de desgaste', custo: 550, intervaloKm: 10000 },
    { nome: 'Alinhamento / balanceamento', custo: 150, intervaloKm: 10000 },
  ],
  bike: [
    { nome: 'Relação e transmissão', custo: 180, intervaloKm: 3000 },
    { nome: 'Pneus e câmaras', custo: 220, intervaloKm: 5000 },
    { nome: 'Freios (pastilhas/sapatas)', custo: 90, intervaloKm: 2500 },
    { nome: 'Revisão geral', custo: 130, intervaloKm: 3000 },
  ],
};

export const VEICULO_PRESETS = {
  moto:  { consumoKmL: 32, valor: 18000, residual: 6000,  vidaUtilKm: 100000, combustivel: 'gasolina' },
  carro: { consumoKmL: 11, valor: 60000, residual: 22000, vidaUtilKm: 250000, combustivel: 'gasolina' },
  bike:  { consumoKmL: 0,  valor: 4500,  residual: 800,   vidaUtilKm: 25000,  combustivel: 'nenhum' },
};

function defaultCustosFixos() {
  return [
    { id: uid(), nome: 'Plano de celular / internet', valorMes: 60 },
    { id: uid(), nome: 'Seguro do veículo', valorMes: 0 },
    { id: uid(), nome: 'IPVA + licenciamento (1/12)', valorMes: 0 },
    { id: uid(), nome: 'Parcela / aluguel do veículo', valorMes: 0 },
    { id: uid(), nome: 'DAS do MEI', valorMes: 0 },
  ];
}

export function defaultState() {
  const p = VEICULO_PRESETS.moto;
  return {
    v: VERSION,
    perfil: {
      nome: '',
      veiculo: 'moto',
      combustivel: p.combustivel,
      consumoKmL: p.consumoKmL,
      precoCombustivel: 6.19,
      tema: 'auto',
      onboarded: false,
      criadoEm: todayISO(),
    },
    veiculo: { valor: p.valor, residual: p.residual, vidaUtilKm: p.vidaUtilKm, contarDepreciacao: true },
    metas: { lucroMes: 3000, diasMes: 24, horasDia: 8, ganhoHoraMin: 25 },
    custosFixos: defaultCustosFixos(),
    manutencao: MANUTENCAO_PRESETS.moto.map((m) => ({ id: uid(), ...m })),
    provisoes: { emergencia: 0.10, descanso: 0.08, imposto: 0 },
    turnos: [],
    abastecimentos: [],
    ui: { tipIndex: 0, periodo: 'semana' },
  };
}

/* ---------- Núcleo ---------- */

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.warn('Giro: não foi possível ler os dados salvos, começando do zero.', err);
    return defaultState();
  }
}

/** Preenche campos ausentes sem perder o que o usuário já tem. */
function migrate(raw) {
  const base = defaultState();
  const s = { ...base, ...raw, v: VERSION };
  s.perfil = { ...base.perfil, ...(raw.perfil || {}) };
  s.veiculo = { ...base.veiculo, ...(raw.veiculo || {}) };
  s.metas = { ...base.metas, ...(raw.metas || {}) };
  s.provisoes = { ...base.provisoes, ...(raw.provisoes || {}) };
  s.ui = { ...base.ui, ...(raw.ui || {}) };
  s.custosFixos = Array.isArray(raw.custosFixos) ? raw.custosFixos : base.custosFixos;
  s.manutencao = Array.isArray(raw.manutencao) ? raw.manutencao : base.manutencao;
  s.turnos = Array.isArray(raw.turnos) ? raw.turnos : [];
  s.abastecimentos = Array.isArray(raw.abastecimentos) ? raw.abastecimentos : [];
  return s;
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Giro: falha ao salvar (armazenamento cheio ou bloqueado).', err);
    }
  }, 120);
}

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error(err); }
  }
}

/** Aplica uma mutação e notifica. `mutator` recebe o estado (mutável). */
export function update(mutator, { silent = false } = {}) {
  const result = mutator(state);
  if (result && typeof result === 'object') state = result;
  persist();
  if (!silent) emit();
  return state;
}

/* ---------- Ações de domínio ---------- */

export function addTurno(t) {
  const turno = {
    id: uid(),
    data: t.data || todayISO(),
    app: t.app || 'outros',
    bruto: Number(t.bruto) || 0,
    gorjeta: Number(t.gorjeta) || 0,
    km: Number(t.km) || 0,
    horas: Number(t.horas) || 0,
    corridas: Number(t.corridas) || 0,
    gastos: Number(t.gastos) || 0,
    obs: t.obs || '',
    origem: t.origem || 'manual',
    criadoEm: new Date().toISOString(),
  };
  update((s) => { s.turnos.push(turno); });
  return turno;
}

export function addTurnos(list) {
  const novos = list.map((t) => ({
    id: uid(),
    data: t.data || todayISO(),
    app: t.app || 'outros',
    bruto: Number(t.bruto) || 0,
    gorjeta: Number(t.gorjeta) || 0,
    km: Number(t.km) || 0,
    horas: Number(t.horas) || 0,
    corridas: Number(t.corridas) || 0,
    gastos: Number(t.gastos) || 0,
    obs: t.obs || '',
    origem: t.origem || 'importado',
    criadoEm: new Date().toISOString(),
  }));
  update((s) => { s.turnos.push(...novos); });
  return novos;
}

export function removeTurno(id) {
  update((s) => { s.turnos = s.turnos.filter((t) => t.id !== id); });
}

export function addAbastecimento(a) {
  const item = {
    id: uid(),
    data: a.data || todayISO(),
    litros: Number(a.litros) || 0,
    valor: Number(a.valor) || 0,
    odometro: Number(a.odometro) || 0,
    tanqueCheio: a.tanqueCheio !== false,
    criadoEm: new Date().toISOString(),
  };
  update((s) => { s.abastecimentos.push(item); });
  return item;
}

export function removeAbastecimento(id) {
  update((s) => { s.abastecimentos = s.abastecimentos.filter((a) => a.id !== id); });
}

export function setTipIndex(i) {
  update((s) => { s.ui.tipIndex = i; }, { silent: true });
}

export function setPeriodo(p) {
  update((s) => { s.ui.periodo = p; });
}

export function aplicarPresetVeiculo(tipo) {
  const p = VEICULO_PRESETS[tipo] || VEICULO_PRESETS.moto;
  update((s) => {
    s.perfil.veiculo = tipo;
    s.perfil.consumoKmL = p.consumoKmL;
    s.perfil.combustivel = p.combustivel;
    s.veiculo.valor = p.valor;
    s.veiculo.residual = p.residual;
    s.veiculo.vidaUtilKm = p.vidaUtilKm;
    s.manutencao = (MANUTENCAO_PRESETS[tipo] || []).map((m) => ({ id: uid(), ...m }));
  });
}

/* ---------- Backup ---------- */

export function exportJSON() {
  return JSON.stringify({ ...state, exportadoEm: new Date().toISOString(), app: 'Giro' }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Arquivo inválido.');
  state = migrate(parsed);
  persist();
  emit();
  return state;
}

export function resetAll() {
  state = defaultState();
  persist();
  emit();
}
