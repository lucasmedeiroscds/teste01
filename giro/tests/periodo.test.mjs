/* Testes das janelas de período e da comparação com o passado.
 *   node giro/tests/periodo.test.mjs
 */
import { faixa, faixaAnterior, variacao, datasDoGrafico, VARIACAO_MAXIMA } from '../assets/js/periodo.js';

let falhas = 0;
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${msg}${extra ? `  ${extra}` : ''}`);
  if (!cond) falhas++;
};
const eq = (a, b, msg) => ok(a === b, msg, a === b ? '' : `(${a} != ${b})`);

/* 2026-09-01 é uma terça-feira. */
const TERCA = '2026-09-01';

/* ---------- janelas ---------- */
const hoje = faixa('hoje', TERCA);
eq(hoje.de, TERCA, 'hoje começa e termina no próprio dia');
eq(hoje.diasCorridos, 1, 'hoje cobre 1 dia');

const semana = faixa('semana', TERCA);
eq(semana.de, '2026-08-31', 'a semana começa na segunda-feira');
eq(semana.ate, TERCA, 'a semana não avança para o futuro');
eq(semana.diasCorridos, 2, 'a semana corrida tem 2 dias na terça');

const mes = faixa('mes', TERCA);
eq(mes.de, '2026-09-01', 'o mês começa no dia 1');
eq(mes.ate, TERCA, 'o mês vai até hoje');

/* ---------- comparação: desloca pelo ciclo, não por dias corridos ---------- */
const antHoje = faixaAnterior(hoje, 'hoje');
eq(antHoje.de, '2026-08-25', 'hoje compara com o mesmo dia da semana passada');
eq(new Date(antHoje.de + 'T12:00').getDay(), 2, 'e esse dia também é uma terça');

const antSemana = faixaAnterior(semana, 'semana');
eq(antSemana.de, '2026-08-24', 'a semana compara com a segunda anterior');
eq(antSemana.ate, '2026-08-25', 'até a terça anterior — mesmos dias da semana');

const antMes = faixaAnterior(mes, 'mes');
eq(antMes.de, '2026-08-01', 'o mês compara com o dia 1 do mês passado');
eq(antMes.ate, '2026-08-01', 'até o mesmo dia do mês passado');

/* mês curto: 31 de março compara com 28 de fevereiro, não estoura */
const marco = faixa('mes', '2026-03-31');
const antMarco = faixaAnterior(marco, 'mes');
eq(antMarco.ate, '2026-02-28', 'mês mais curto é encurtado, não transborda');

/* 31 de janeiro → fevereiro não existe dia 31 */
const jan = faixa('mes', '2027-01-31');
eq(faixaAnterior(jan, 'mes').ate, '2026-12-31', 'dezembro anterior tem dia 31');

/* ---------- variação ---------- */
eq(variacao(120, 100), 0.2, 'subiu 20%');
eq(variacao(80, 100), -0.2, 'caiu 20%');
ok(variacao(100, 0) === null, 'sem base não há variação');
ok(variacao(100, -5) === null, 'base negativa não vira porcentagem');
ok(variacao(700, 100) === null, `salto acima de ${VARIACAO_MAXIMA * 100}% é ruído, não informação`);
ok(variacao(340, 100) !== null, 'salto dentro do limite é mostrado');
ok(variacao(NaN, 100) === null, 'valor inválido não vira variação');

/* ---------- eixo do gráfico ---------- */
eq(datasDoGrafico('hoje', TERCA).length, 14, 'o gráfico de "hoje" mostra 14 dias');
eq(datasDoGrafico('semana', TERCA).length, 7, 'o gráfico da semana mostra a semana inteira');
eq(datasDoGrafico('semana', TERCA)[0], '2026-08-31', 'e começa na segunda');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nPeríodos e comparação: tudo confere.');
process.exit(falhas ? 1 : 0);
