/* Motor de cálculo. Funções puras: recebem estado e lançamentos, devolvem números.
 *
 * Modelo de custo em três camadas:
 *   1. Custo variável por km  — combustível + manutenção + depreciação. Anda, gasta.
 *   2. Custo fixo             — corre no calendário, você rodando ou não.
 *   3. Gastos do turno        — alimentação, pedágio, estacionamento, lavagem.
 *
 * Custo fixo é alocado de duas maneiras diferentes, de propósito:
 *   • no resultado (quanto sobrou de verdade) → pelo calendário do período;
 *   • na meta e na calculadora de corrida     → por dia trabalhado planejado,
 *     porque é assim que se decide se uma corrida paga a própria fatia.
 */

import { safeDiv, sum, round2 } from './util.js';

export const DIAS_MES_MEDIO = 30.44;

/* ---------- Camada 1: custo por km ---------- */

export function custoCombustivelKm(state) {
  const { consumoKmL, precoCombustivel } = state.perfil;
  if (!consumoKmL || consumoKmL <= 0) return 0;
  return safeDiv(Number(precoCombustivel) || 0, Number(consumoKmL));
}

export function custoManutencaoKm(state) {
  return sum(state.manutencao || [], (m) => safeDiv(Number(m.custo) || 0, Number(m.intervaloKm) || 0));
}

export function custoDepreciacaoKm(state) {
  const v = state.veiculo || {};
  if (!v.contarDepreciacao) return 0;
  const perda = (Number(v.valor) || 0) - (Number(v.residual) || 0);
  if (perda <= 0) return 0;
  return safeDiv(perda, Number(v.vidaUtilKm) || 0);
}

export function custoVariavelKm(state) {
  const combustivel = custoCombustivelKm(state);
  const manutencao = custoManutencaoKm(state);
  const depreciacao = custoDepreciacaoKm(state);
  return { combustivel, manutencao, depreciacao, total: combustivel + manutencao + depreciacao };
}

/* ---------- Camada 2: custo fixo ---------- */

export function custoFixoMes(state) {
  return sum(state.custosFixos || [], (c) => Number(c.valorMes) || 0);
}

/** Custo fixo que corre no calendário do período (o dinheiro que sai de fato). */
export function custoFixoCalendario(state, diasCorridos) {
  return custoFixoMes(state) * safeDiv(Math.max(0, diasCorridos), DIAS_MES_MEDIO);
}

/** Fatia de custo fixo que cada dia trabalhado precisa carregar (base da meta). */
export function custoFixoPorDiaTrabalhado(state) {
  return safeDiv(custoFixoMes(state), Number(state.metas?.diasMes) || 0);
}

export function custoFixoPorHora(state) {
  return safeDiv(custoFixoPorDiaTrabalhado(state), Number(state.metas?.horasDia) || 0);
}

/* ---------- Resumo de um conjunto de turnos ---------- */

/**
 * @param {object} state
 * @param {Array}  turnos   lançamentos já filtrados pelo período
 * @param {number} diasCorridos  dias de calendário cobertos pelo período
 */
export function resumo(state, turnos, diasCorridos) {
  const cvKm = custoVariavelKm(state);
  const bruto = sum(turnos, (t) => (Number(t.bruto) || 0) + (Number(t.gorjeta) || 0));
  const gorjetas = sum(turnos, (t) => Number(t.gorjeta) || 0);
  const km = sum(turnos, (t) => Number(t.km) || 0);
  const horas = sum(turnos, (t) => Number(t.horas) || 0);
  const corridas = sum(turnos, (t) => Number(t.corridas) || 0);
  const gastosTurno = sum(turnos, (t) => Number(t.gastos) || 0);

  const diasTrabalhados = new Set(turnos.map((t) => t.data)).size;
  const dias = Number.isFinite(diasCorridos) ? diasCorridos : diasTrabalhados;

  const custoCombustivel = km * cvKm.combustivel;
  const custoManutencao = km * cvKm.manutencao;
  const custoDepreciacao = km * cvKm.depreciacao;
  const custoVariavel = custoCombustivel + custoManutencao + custoDepreciacao;
  const custoFixo = custoFixoCalendario(state, dias);
  const custoTotal = custoVariavel + custoFixo + gastosTurno;
  const liquido = bruto - custoTotal;

  return {
    bruto, gorjetas, km, horas, corridas, gastosTurno,
    diasTrabalhados, diasCorridos: dias,
    custoCombustivel, custoManutencao, custoDepreciacao,
    custoVariavel, custoFixo, custoTotal, liquido,
    custoVariavelKm: cvKm.total,
    brutoPorKm: safeDiv(bruto, km),
    liquidoPorKm: safeDiv(liquido, km),
    brutoPorHora: safeDiv(bruto, horas),
    liquidoPorHora: safeDiv(liquido, horas),
    brutoPorCorrida: safeDiv(bruto, corridas),
    liquidoPorDia: safeDiv(liquido, diasTrabalhados),
    margem: safeDiv(liquido, bruto),
    kmPorDia: safeDiv(km, diasTrabalhados),
    horasPorDia: safeDiv(horas, diasTrabalhados),
  };
}

/** Agrupa turnos por chave e devolve totais ordenados do maior bruto para o menor. */
export function agrupar(turnos, chave) {
  const mapa = new Map();
  for (const t of turnos) {
    const k = t[chave] || 'outros';
    const cur = mapa.get(k) || { chave: k, bruto: 0, km: 0, horas: 0, corridas: 0, n: 0 };
    cur.bruto += (Number(t.bruto) || 0) + (Number(t.gorjeta) || 0);
    cur.km += Number(t.km) || 0;
    cur.horas += Number(t.horas) || 0;
    cur.corridas += Number(t.corridas) || 0;
    cur.n += 1;
    mapa.set(k, cur);
  }
  return [...mapa.values()].sort((a, b) => b.bruto - a.bruto);
}

/** Série diária de bruto e líquido para o intervalo de datas informado. */
export function serieDiaria(state, turnos, datas) {
  const cvKm = custoVariavelKm(state);
  const fixoDia = custoFixoMes(state) / DIAS_MES_MEDIO;
  const porDia = new Map(datas.map((d) => [d, { data: d, bruto: 0, km: 0, horas: 0, gastos: 0 }]));
  for (const t of turnos) {
    const d = porDia.get(t.data);
    if (!d) continue;
    d.bruto += (Number(t.bruto) || 0) + (Number(t.gorjeta) || 0);
    d.km += Number(t.km) || 0;
    d.horas += Number(t.horas) || 0;
    d.gastos += Number(t.gastos) || 0;
  }
  return datas.map((data) => {
    const d = porDia.get(data);
    const liquido = d.bruto - d.km * cvKm.total - d.gastos - fixoDia;
    return { ...d, liquido: d.bruto > 0 || d.km > 0 ? liquido : 0, vazio: d.bruto === 0 && d.km === 0 };
  });
}

/* ---------- Ponto de equilíbrio e meta ---------- */

/**
 * Quanto é preciso faturar (bruto) num dia trabalhado só para empatar,
 * e quanto para bater a meta de lucro do mês.
 */
export function pontoEquilibrio(state, kmPorDia) {
  const cvKm = custoVariavelKm(state).total;
  const km = Number(kmPorDia) > 0 ? Number(kmPorDia) : (Number(state.metas?.horasDia) || 8) * 20;
  const fixoDia = custoFixoPorDiaTrabalhado(state);
  const empatar = fixoDia + km * cvKm;
  const diasMes = Number(state.metas?.diasMes) || 24;
  const lucroDia = safeDiv(Number(state.metas?.lucroMes) || 0, diasMes);
  return {
    kmReferencia: km,
    custoFixoDia: fixoDia,
    custoVariavelDia: km * cvKm,
    empatar,
    metaDia: empatar + lucroDia,
    lucroDiaAlvo: lucroDia,
    brutoPorKmMinimo: safeDiv(empatar, km),
    brutoPorKmMeta: safeDiv(empatar + lucroDia, km),
    metaHora: safeDiv(empatar + lucroDia, Number(state.metas?.horasDia) || 8),
  };
}

/* ---------- Calculadora "vale a pena?" ---------- */

/**
 * @param {object} state
 * @param {object} c   valor, kmColeta, kmEntrega, kmRetorno e minutos
 */
export function avaliarCorrida(state, c) {
  const cvKm = custoVariavelKm(state);
  const kmTotal = (Number(c.kmColeta) || 0) + (Number(c.kmEntrega) || 0) + (Number(c.kmRetorno) || 0);
  const horas = safeDiv(Number(c.minutos) || 0, 60);
  const valor = Number(c.valor) || 0;

  const custoVariavel = kmTotal * cvKm.total;
  const custoFixo = custoFixoPorHora(state) * horas;
  const custoTotal = custoVariavel + custoFixo;
  const liquido = valor - custoTotal;

  const metaHora = Number(state.metas?.ganhoHoraMin) || 0;
  const valorMinimo = custoTotal + metaHora * horas;

  const liquidoPorHora = safeDiv(liquido, horas);
  const brutoPorKm = safeDiv(valor, kmTotal);
  const liquidoPorKm = safeDiv(liquido, kmTotal);

  let veredito = 'boa';
  if (liquido <= 0) veredito = 'ruim';
  else if (metaHora > 0 && liquidoPorHora < metaHora) veredito = 'limite';

  return {
    kmTotal, horas, valor,
    custoVariavel, custoFixo, custoTotal, liquido,
    liquidoPorHora, brutoPorKm, liquidoPorKm,
    valorMinimo, metaHora,
    brutoPorKmMinimo: safeDiv(valorMinimo, kmTotal),
    veredito,
  };
}

/* ---------- Provisões: o dinheiro que não é seu ---------- */

/**
 * Quanto separar do que entrou. Manutenção e depreciação vêm do km rodado
 * (não de um percentual chutado); reserva e descanso saem do líquido.
 */
export function provisoes(state, r) {
  const p = state.provisoes || {};

  // Manutenção e depreciação já foram descontadas do líquido, mas ainda não
  // saíram da conta — são conta futura de um km que já foi rodado. Por isso
  // a base para "quanto separar" é o caixa disponível, não o lucro: caixa é
  // o que entrou menos o que de fato já saiu (combustível, fixos, gastos).
  const caixaDisponivel = r.bruto - r.custoCombustivel - r.custoFixo - r.gastosTurno;

  const manutencao = r.custoManutencao;
  const trocaVeiculo = r.custoDepreciacao;
  const base = Math.max(0, r.liquido);
  const emergencia = base * (Number(p.emergencia) || 0);
  const descanso = base * (Number(p.descanso) || 0);
  const imposto = base * (Number(p.imposto) || 0);
  const total = manutencao + trocaVeiculo + emergencia + descanso + imposto;
  return {
    caixaDisponivel,
    manutencao, trocaVeiculo, emergencia, descanso, imposto, total,
    sobraLivre: caixaDisponivel - total,
    itens: [
      { nome: 'Manutenção (pelo km rodado)', valor: manutencao, nota: 'óleo, pneus, freios, revisão' },
      { nome: 'Troca do veículo', valor: trocaVeiculo, nota: 'depreciação — o veículo está virando dinheiro' },
      { nome: 'Reserva de emergência', valor: emergencia, nota: 'dia parado, doença, imprevisto' },
      { nome: 'Descanso / 13º próprio', valor: descanso, nota: 'você também tira férias' },
      { nome: 'Imposto', valor: imposto, nota: 'se você declara' },
    ].filter((i) => i.valor > 0.004),
  };
}

/* ---------- Consumo real a partir dos abastecimentos ---------- */

/**
 * Método do tanque cheio: entre dois abastecimentos completos, os litros do
 * segundo são exatamente o que o veículo gastou no trecho.
 */
export function consumoReal(abastecimentos) {
  const cheios = (abastecimentos || [])
    .filter((a) => a.tanqueCheio !== false && Number(a.odometro) > 0)
    .sort((a, b) => Number(a.odometro) - Number(b.odometro));

  let km = 0;
  let litros = 0;
  for (let i = 1; i < cheios.length; i++) {
    const d = Number(cheios[i].odometro) - Number(cheios[i - 1].odometro);
    const l = Number(cheios[i].litros) || 0;
    if (d > 0 && d < 5000 && l > 0) { km += d; litros += l; }
  }

  const todos = abastecimentos || [];
  const litrosTodos = sum(todos, (a) => Number(a.litros) || 0);
  const valorTodos = sum(todos, (a) => Number(a.valor) || 0);

  return {
    amostras: Math.max(0, cheios.length - 1),
    kmL: safeDiv(km, litros),
    kmMedidos: km,
    litrosMedidos: litros,
    precoMedioLitro: safeDiv(valorTodos, litrosTodos),
    gastoTotal: valorTodos,
    confiavel: cheios.length >= 3 && km > 200,
  };
}

/** Formata o custo por km em centavos, que é como a conta é lida na prática. */
export const centavosPorKm = (v) => round2((Number(v) || 0) * 100);
