/* Dados de exemplo.
 *
 * O problema que isto resolve: quem abre o Giro pela primeira vez vê zeros.
 * Gráfico vazio, painel vazio, e nenhuma ideia do que o app faz — para
 * descobrir, precisaria antes fazer digitação. Com um toque, o app se enche de
 * um mês plausível de trabalho e a pessoa entende olhando.
 *
 * Duas regras que tornam isso seguro:
 *   1. o exemplo só é oferecido quando não existe nenhum lançamento real;
 *   2. enquanto ele estiver ligado há um aviso fixo na tela, e o primeiro
 *      lançamento de verdade apaga o exemplo inteiro antes de gravar.
 * Assim nunca dá para confundir número de brincadeira com número seu.
 */

import { update, getState, defaultState } from './store.js';
import { todayISO, addDays, uid, isoToDate } from './util.js';

/* Um dia de trabalho verossímil de moto em cidade grande:
 * 7 a 10 horas, 100 a 190 km, R$ 1,20 a R$ 1,80 por km bruto. Fim de semana
 * rende mais, segunda e terça rendem menos, e um dia de chuva paga melhor. */
const PERFIL_DIA = [
  // dom  seg  ter  qua  qui  sex  sáb
  { peso: 1.15, folga: 0.10 },
  { peso: 0.78, folga: 0.30 },
  { peso: 0.82, folga: 0.25 },
  { peso: 0.90, folga: 0.15 },
  { peso: 1.00, folga: 0.10 },
  { peso: 1.30, folga: 0.05 },
  { peso: 1.35, folga: 0.05 },
];

const APPS = [
  { id: 'ifood', fatia: 0.46, rsKm: 1.42 },
  { id: 'uber',  fatia: 0.27, rsKm: 1.63 },
  { id: '99',    fatia: 0.15, rsKm: 1.55 },
  { id: 'rappi', fatia: 0.12, rsKm: 1.28 },
];

/** Gerador determinístico: o mesmo exemplo toda vez, sem depender de sorte. */
function embaralhador(semente) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function gerarTurnos(dias = 35, hoje = todayISO()) {
  const rnd = embaralhador(20260901);
  const turnos = [];

  for (let i = dias - 1; i >= 0; i--) {
    const data = addDays(hoje, -i);
    const perfil = PERFIL_DIA[isoToDate(data).getDay()];
    // Hoje e ontem sempre têm movimento: se o exemplo cair numa segunda-feira
    // dia 1º, sem isso o painel abriria praticamente vazio — justamente o que
    // ele existe para evitar.
    const recente = i <= 1;
    if (!recente && rnd() < perfil.folga) continue;          // dia de folga

    const chuva = rnd() < 0.14;
    const horas = 6.5 + rnd() * 3.5;
    const kmHora = 17 + rnd() * 5;
    const kmDia = horas * kmHora;
    // leve melhora nas duas últimas semanas: é o que um exemplo deve mostrar —
    // alguém que começou a controlar os números e está ganhando terreno
    const tendencia = i <= 12 ? 1 + (12 - i) * 0.014 : 1;
    const impulso = perfil.peso * tendencia * (chuva ? 1.22 : 1) * (0.9 + rnd() * 0.2);

    // o dia se divide entre um ou dois aplicativos, como acontece de verdade
    const quantos = rnd() < 0.55 ? 1 : 2;
    const escolhidos = [];
    let restante = 1;
    for (let n = 0; n < quantos; n++) {
      const sorteio = rnd();
      let acumulado = 0;
      let escolhido = APPS[0];
      for (const app of APPS) {
        acumulado += app.fatia;
        if (sorteio <= acumulado) { escolhido = app; break; }
      }
      if (escolhidos.some((e) => e.app.id === escolhido.id)) continue;
      const fatia = n === quantos - 1 ? restante : 0.55 + rnd() * 0.2;
      restante -= fatia;
      escolhidos.push({ app: escolhido, fatia });
    }

    for (const { app, fatia } of escolhidos) {
      const km = Math.round(kmDia * fatia);
      if (km < 12) continue;
      const bruto = Math.round(km * app.rsKm * impulso * 100) / 100;
      turnos.push({
        id: uid(),
        data,
        app: app.id,
        bruto,
        gorjeta: app.id === 'ifood' && rnd() < 0.45 ? Math.round(rnd() * 22 * 100) / 100 : 0,
        km,
        horas: Math.round(horas * fatia * 100) / 100,
        corridas: Math.max(3, Math.round(km / 6.2)),
        gastos: rnd() < 0.5 ? Math.round((18 + rnd() * 26) * fatia) : 0,
        obs: chuva ? 'chuva, taxa melhor' : '',
        origem: 'exemplo',
        criadoEm: new Date().toISOString(),
      });
    }
  }
  return turnos;
}

export function gerarAbastecimentos(hoje = todayISO()) {
  const rnd = embaralhador(77712);
  const saidas = [];
  let odometro = 41260;
  for (let i = 6; i >= 0; i--) {
    const litros = Math.round((9.4 + rnd() * 2.6) * 100) / 100;
    const preco = 6.05 + rnd() * 0.45;
    saidas.push({
      id: uid(),
      data: addDays(hoje, -i * 5),
      litros,
      valor: Math.round(litros * preco * 100) / 100,
      odometro: Math.round(odometro),
      tanqueCheio: true,
      criadoEm: new Date().toISOString(),
    });
    odometro += litros * (27 + rnd() * 4);
  }
  return saidas;
}

export const emExemplo = (estado = getState()) => !!estado.ui?.exemplo;

/** Só faz sentido oferecer o exemplo para quem ainda não tem nada. */
export const podeOferecerExemplo = (estado = getState()) =>
  !emExemplo(estado) && estado.turnos.length === 0;

export function ativarExemplo() {
  update((s) => {
    const base = defaultState();
    return {
      ...base,
      perfil: { ...base.perfil, onboarded: true, precoCombustivel: 6.29, consumoKmL: 28 },
      custosFixos: [
        { id: uid(), nome: 'Parcela da moto', valorMes: 520 },
        { id: uid(), nome: 'Seguro', valorMes: 95 },
        { id: uid(), nome: 'IPVA + licenciamento (1/12)', valorMes: 38 },
        { id: uid(), nome: 'Plano de celular', valorMes: 60 },
        { id: uid(), nome: 'DAS do MEI', valorMes: 76 },
      ],
      turnos: gerarTurnos(),
      abastecimentos: gerarAbastecimentos(),
      ui: { ...base.ui, exemplo: true, periodo: 'semana' },
    };
  });
}

/** Apaga o exemplo e devolve o app zerado, pronto para os dados de verdade. */
export function limparExemplo() {
  update(() => ({ ...defaultState(), perfil: { ...defaultState().perfil, onboarded: true } }));
}
