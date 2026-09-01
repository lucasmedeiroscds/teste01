/* Recortes de período usados no painel e nos relatórios. */

import { todayISO, isoToDate, startOfWeek, startOfMonth, endOfMonth, addDays, dateRange, dayMonth, monthLabel } from './util.js';

export const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
];

export function faixa(id, hoje = todayISO()) {
  if (id === 'hoje') {
    return { de: hoje, ate: hoje, rotulo: 'hoje', diasCorridos: 1 };
  }
  if (id === 'mes') {
    const de = startOfMonth(hoje);
    const fim = endOfMonth(hoje);
    const ate = hoje < fim ? hoje : fim;
    return { de, ate, rotulo: monthLabel(hoje), diasCorridos: dateRange(de, ate).length };
  }
  const de = startOfWeek(hoje);
  const fimSemana = addDays(de, 6);
  const ate = hoje < fimSemana ? hoje : fimSemana;
  return { de, ate, rotulo: `semana de ${dayMonth(de)}`, diasCorridos: dateRange(de, ate).length };
}

export const noPeriodo = (turnos, f) => turnos.filter((t) => t.data >= f.de && t.data <= f.ate);

/** Mesmo dia do mês seguinte/anterior, encurtando quando o mês é mais curto. */
function somarMeses(iso, n) {
  const d = isoToDate(iso);
  const dia = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimoDia));
  return todayISO(alvo);
}

/**
 * A janela de referência para o número atual.
 *
 * O deslocamento acompanha o ciclo do período, e não os dias corridos, porque
 * neste trabalho o dia da semana manda no faturamento. Comparar a terça-feira
 * de hoje com o domingo passado mostraria uma queda que não é sua — mostraria
 * apenas que domingo rende mais. Então: hoje contra o mesmo dia da semana
 * passada, a semana contra a semana anterior, o mês contra o mesmo intervalo
 * do mês anterior.
 */
export function faixaAnterior(f, id = 'semana') {
  if (id === 'hoje') {
    const d = addDays(f.de, -7);
    return { de: d, ate: d, diasCorridos: 1, rotulo: 'o mesmo dia da semana passada' };
  }
  if (id === 'mes') {
    return {
      de: somarMeses(f.de, -1),
      ate: somarMeses(f.ate, -1),
      diasCorridos: f.diasCorridos,
      rotulo: 'o mesmo intervalo do mês passado',
    };
  }
  return {
    de: addDays(f.de, -7),
    ate: addDays(f.ate, -7),
    diasCorridos: f.diasCorridos,
    rotulo: 'a semana passada',
  };
}

/** Acima disto a porcentagem vira ruído: base pequena demais para comparar. */
export const VARIACAO_MAXIMA = 2.5;

/**
 * Variação relativa entre dois valores.
 * Devolve `null` sempre que o número não teria significado — sem base, base
 * negativa, ou salto tão grande que só denuncia que a referência era quase
 * zero. Um "+578%" contra uma semana parada não informa nada e ainda assusta.
 */
export function variacao(atual, anterior) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  if (anterior <= 0) return null;
  const v = (atual - anterior) / anterior;
  if (!Number.isFinite(v) || Math.abs(v) > VARIACAO_MAXIMA) return null;
  return v;
}

/** Datas do eixo do gráfico: a faixa inteira, mesmo os dias sem lançamento. */
export function datasDoGrafico(id, hoje = todayISO()) {
  if (id === 'hoje') return dateRange(addDays(hoje, -13), hoje);
  if (id === 'mes') {
    const de = startOfMonth(hoje);
    return dateRange(de, hoje < endOfMonth(hoje) ? hoje : endOfMonth(hoje));
  }
  const de = startOfWeek(hoje);
  return dateRange(de, addDays(de, 6));
}
