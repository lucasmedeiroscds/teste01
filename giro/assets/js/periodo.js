/* Recortes de período usados no painel e nos relatórios. */

import { todayISO, startOfWeek, startOfMonth, endOfMonth, addDays, dateRange, dayMonth, monthLabel } from './util.js';

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
