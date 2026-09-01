/* Testes do interpretador de números digitados.
 *   node giro/tests/util.test.mjs
 */
import { parseNum } from '../assets/js/util.js';

const casos = [
  // brasileiro
  ['1.234,56', 1234.56], ['2.000', 2000], ['18.000', 18000], ['100.000', 100000],
  ['1.234.567', 1234567], ['12,5', 12.5], ['0,075', 0.075], ['R$ 6,29', 6.29],
  ['R$ 1.234,56', 1234.56], ['540,00', 540], ['25,0', 25],
  // americano / colado de planilha
  ['12.5', 12.5], ['6.29', 6.29], ['0.075', 0.075], ['1,234.56', 1234.56],
  ['0.5', 0.5], ['1,234,567', 1234567], ['12.345.678', 12345678],
  // numa página em pt-BR, vírgula sozinha é decimal, mesmo com três casas
  ['1,234', 1.234],
  // inteiros e limites
  ['0', 0], ['7', 7], ['', 0], ['   ', 0], ['abc', 0], ['-12,5', -12.5],
  [null, 0], [undefined, 0], [42, 42], [NaN, 0],
];

let falhas = 0;
for (const [entrada, esperado] of casos) {
  const obtido = parseNum(entrada);
  const ok = Math.abs(obtido - esperado) < 1e-9;
  if (!ok) falhas++;
  console.log(`${ok ? '✓' : '✗'} parseNum(${JSON.stringify(entrada)}) = ${obtido}${ok ? '' : `  (esperado ${esperado})`}`);
}

// ida e volta: o que a interface formata precisa voltar igual
const { n0, n1, n2 } = await import('../assets/js/util.js');
for (const v of [0, 7, 25, 540, 2000, 16000, 18000, 100000, 1234567, 0.49, 6.29, 1234.56]) {
  for (const [nome, fmt] of [['n0', n0], ['n1', n1], ['n2', n2]]) {
    const texto = fmt(v);
    const volta = parseNum(texto);
    const esperado = nome === 'n0' ? Math.round(v) : nome === 'n1' ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
    const ok = Math.abs(volta - esperado) < 1e-9;
    if (!ok) { falhas++; console.log(`✗ ida e volta ${nome}(${v}) → "${texto}" → ${volta} (esperado ${esperado})`); }
  }
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nLeitura de números: tudo confere (formatar e reler não perde valor).');
process.exit(falhas ? 1 : 0);
