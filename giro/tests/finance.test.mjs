import { resumo, provisoes, custoVariavelKm, custoFixoMes, avaliarCorrida, pontoEquilibrio, consumoReal, DIAS_MES_MEDIO }
  from '../assets/js/finance.js';

const r2 = (v) => Math.round(v * 100) / 100;
let falhas = 0;
const eq = (nome, a, b, tol = 0.02) => {
  const ok = Math.abs(a - b) <= tol;
  console.log(`${ok ? '✓' : '✗'} ${nome}: ${r2(a)} ${ok ? '==' : '!='} ${r2(b)}`);
  if (!ok) falhas++;
};

const state = {
  perfil: { consumoKmL: 28, precoCombustivel: 6.29, veiculo: 'moto' },
  veiculo: { valor: 18000, residual: 6000, vidaUtilKm: 100000, contarDepreciacao: true },
  metas: { lucroMes: 3000, diasMes: 24, horasDia: 8, ganhoHoraMin: 25 },
  custosFixos: [{ id: 'a', nome: 'fixos', valorMes: 540 }],
  manutencao: [
    { id: 'm1', nome: 'óleo', custo: 75, intervaloKm: 2000 },      // 0,0375
    { id: 'm2', nome: 'pneus', custo: 620, intervaloKm: 16000 },   // 0,03875
    { id: 'm3', nome: 'relação', custo: 260, intervaloKm: 14000 }, // 0,018571
  ],
  provisoes: { emergencia: 0.10, descanso: 0.08, imposto: 0 },
};

const cv = custoVariavelKm(state);
eq('combustível/km  6,29 ÷ 28', cv.combustivel, 6.29 / 28, 1e-6);
eq('manutenção/km   soma dos itens', cv.manutencao, 75 / 2000 + 620 / 16000 + 260 / 14000, 1e-6);
eq('depreciação/km  (18000−6000) ÷ 100000', cv.depreciacao, 0.12, 1e-9);
eq('custo variável total/km', cv.total, 6.29 / 28 + (75 / 2000 + 620 / 16000 + 260 / 14000) + 0.12, 1e-6);

const turnos = [
  { data: '2026-09-01', app: 'ifood', bruto: 214, gorjeta: 12, km: 138, horas: 8, corridas: 22, gastos: 32 },
  { data: '2026-09-02', app: 'uber',  bruto: 268, gorjeta: 0,  km: 176, horas: 9.5, corridas: 19, gastos: 0 },
  { data: '2026-09-02', app: 'ifood', bruto: 40,  gorjeta: 5,  km: 20,  horas: 1,   corridas: 4,  gastos: 0 },
];
const r = resumo(state, turnos, 2);

eq('bruto = ganhos + gorjetas', r.bruto, 214 + 12 + 268 + 40 + 5, 1e-9);
eq('km somados', r.km, 334, 1e-9);
eq('dias trabalhados (2 turnos no mesmo dia contam 1)', r.diasTrabalhados, 2, 0);
eq('custo variável = km × custo/km', r.custoVariavel, 334 * cv.total, 1e-6);
eq('custo fixo do período = 540 × 2 ÷ 30,44', r.custoFixo, 540 * 2 / DIAS_MES_MEDIO, 1e-6);
eq('líquido fecha a conta', r.liquido, r.bruto - r.custoVariavel - r.custoFixo - r.gastosTurno, 1e-9);
eq('R$/hora líquido', r.liquidoPorHora, r.liquido / 18.5, 1e-6);

const prov = provisoes(state, r);
eq('caixa = bruto − combustível − fixos − gastos', prov.caixaDisponivel, r.bruto - r.custoCombustivel - r.custoFixo - r.gastosTurno, 1e-9);
eq('total a separar', prov.total, prov.manutencao + prov.trocaVeiculo + prov.emergencia + prov.descanso + prov.imposto, 1e-9);
eq('PONTE: caixa − separar = livre', prov.caixaDisponivel - prov.total, prov.sobraLivre, 1e-9);
eq('PONTE: livre = líquido − emergência − descanso', prov.sobraLivre, r.liquido - prov.emergencia - prov.descanso - prov.imposto, 0.001);

const pe = pontoEquilibrio(state, 120);
eq('empatar = fixo/dia + km × custo/km', pe.empatar, 540 / 24 + 120 * cv.total, 1e-6);
eq('meta/dia = empatar + lucro alvo do dia', pe.metaDia, pe.empatar + 3000 / 24, 1e-6);

const ruim = avaliarCorrida(state, { valor: 6.5, kmColeta: 4, kmEntrega: 6, kmRetorno: 6, minutos: 28 });
eq('km total da corrida (com volta)', ruim.kmTotal, 16, 1e-9);
eq('líquido da corrida', ruim.liquido, 6.5 - 16 * cv.total - (540 / 24 / 8) * (28 / 60), 1e-6);
console.log(`${ruim.veredito === 'ruim' ? '✓' : '✗'} veredito da corrida ruim = ${ruim.veredito}`);
if (ruim.veredito !== 'ruim') falhas++;
eq('valor mínimo cobre custo + meta/hora', ruim.valorMinimo, ruim.custoTotal + 25 * (28 / 60), 1e-6);

const boa = avaliarCorrida(state, { valor: 32, kmColeta: 2, kmEntrega: 7, kmRetorno: 7, minutos: 25 });
console.log(`${boa.veredito === 'boa' ? '✓' : '✗'} veredito da corrida boa = ${boa.veredito}`);
if (boa.veredito !== 'boa') falhas++;

const c = consumoReal([
  { data: '2026-08-01', odometro: 5000, litros: 11.4, valor: 71.7, tanqueCheio: true },
  { data: '2026-08-05', odometro: 5310, litros: 11.1, valor: 69.8, tanqueCheio: true },
  { data: '2026-08-09', odometro: 5602, litros: 10.6, valor: 66.7, tanqueCheio: true },
]);
eq('consumo real km/L (método do tanque cheio)', c.kmL, (310 + 292) / (11.1 + 10.6), 1e-6);
eq('preço médio do litro', c.precoMedioLitro, (71.7 + 69.8 + 66.7) / (11.4 + 11.1 + 10.6), 1e-6);

// casos-limite: nada deve virar NaN
const vazio = resumo(state, [], 0);
const provVazio = provisoes(state, vazio);
const todosFinitos = [...Object.values(vazio), ...Object.values(provVazio)]
  .filter((v) => typeof v === 'number').every(Number.isFinite);
console.log(`${todosFinitos ? '✓' : '✗'} sem dados: nenhum NaN ou Infinity`);
if (!todosFinitos) falhas++;

const semCusto = custoVariavelKm({ perfil: { consumoKmL: 0, precoCombustivel: 6 }, veiculo: {}, manutencao: [] });
console.log(`${Number.isFinite(semCusto.total) && semCusto.total === 0 ? '✓' : '✗'} bike (sem combustível): custo/km = ${semCusto.total}`);
if (semCusto.total !== 0) falhas++;

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nMotor financeiro: tudo confere.');
process.exit(falhas ? 1 : 0);
