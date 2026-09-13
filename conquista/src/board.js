// Tabuleiro de "Conquista & Capital".
// 28 casas em anel (perimetro de uma grade 8x8): 4 cantos especiais e 24 territorios
// divididos em 6 continentes de 4 territorios cada.

export const CONTINENTS = {
  na: { name: 'America do Norte', color: '#ef4444', bonusMoney: 150, bonusTroops: 3 },
  sa: { name: 'America do Sul', color: '#f59e0b', bonusMoney: 130, bonusTroops: 2 },
  eu: { name: 'Europa', color: '#3b82f6', bonusMoney: 170, bonusTroops: 3 },
  af: { name: 'Africa', color: '#22c55e', bonusMoney: 150, bonusTroops: 3 },
  as: { name: 'Asia', color: '#a855f7', bonusMoney: 200, bonusTroops: 4 },
  oc: { name: 'Oceania', color: '#14b8a6', bonusMoney: 120, bonusTroops: 2 },
};

// Ordem em volta do anel. Cantos ficam nos indices 0, 7, 14 e 21.
const RING = [
  { type: 'start', name: 'Base Aliada', desc: 'Receba $200 e 2 tropas ao passar ou parar.' },
  { type: 'land', id: 'alasca', name: 'Alasca', cont: 'na', price: 120 },
  { type: 'land', id: 'quebec', name: 'Quebec', cont: 'na', price: 130 },
  { type: 'land', id: 'california', name: 'California', cont: 'na', price: 140 },
  { type: 'land', id: 'mexico', name: 'Mexico', cont: 'na', price: 150 },
  { type: 'land', id: 'colombia', name: 'Colombia', cont: 'sa', price: 160 },
  { type: 'land', id: 'peru', name: 'Peru', cont: 'sa', price: 170 },
  { type: 'hq', name: 'Quartel-General', desc: 'Receba 3 tropas e um ataque livre a partir de qualquer fronteira sua.' },
  { type: 'land', id: 'brasil', name: 'Brasil', cont: 'sa', price: 190 },
  { type: 'land', id: 'argentina', name: 'Argentina', cont: 'sa', price: 200 },
  { type: 'land', id: 'portugal', name: 'Portugal', cont: 'eu', price: 210 },
  { type: 'land', id: 'franca', name: 'Franca', cont: 'eu', price: 220 },
  { type: 'land', id: 'alemanha', name: 'Alemanha', cont: 'eu', price: 230 },
  { type: 'land', id: 'ucrania', name: 'Ucrania', cont: 'eu', price: 240 },
  { type: 'neutral', name: 'Zona Neutra', desc: 'Descanso das tropas: receba 2 tropas de reserva.' },
  { type: 'land', id: 'egito', name: 'Egito', cont: 'af', price: 250 },
  { type: 'land', id: 'nigeria', name: 'Nigeria', cont: 'af', price: 260 },
  { type: 'land', id: 'congo', name: 'Congo', cont: 'af', price: 270 },
  { type: 'land', id: 'africa_sul', name: 'Africa do Sul', cont: 'af', price: 280 },
  { type: 'land', id: 'india', name: 'India', cont: 'as', price: 290 },
  { type: 'land', id: 'china', name: 'China', cont: 'as', price: 310 },
  { type: 'council', name: 'Conselho de Guerra', desc: 'Compre uma carta de Conselho.' },
  { type: 'land', id: 'siberia', name: 'Siberia', cont: 'as', price: 320 },
  { type: 'land', id: 'japao', name: 'Japao', cont: 'as', price: 340 },
  { type: 'land', id: 'sumatra', name: 'Sumatra', cont: 'oc', price: 350 },
  { type: 'land', id: 'nova_guine', name: 'Nova Guine', cont: 'oc', price: 360 },
  { type: 'land', id: 'australia', name: 'Australia', cont: 'oc', price: 380 },
  { type: 'land', id: 'nova_zelandia', name: 'Nova Zelandia', cont: 'oc', price: 400 },
];

// Rotas maritimas: ligacoes extras entre territorios distantes no anel.
const SEA_ROUTES = [
  ['alasca', 'siberia'],
  ['brasil', 'nigeria'],
  ['portugal', 'egito'],
  ['california', 'japao'],
  ['australia', 'nova_zelandia'],
  ['sumatra', 'india'],
  ['argentina', 'africa_sul'],
  ['nova_zelandia', 'alasca'],
];

function ringCoords(i) {
  // Perimetro de uma grade 8x8 (linha 1 = topo). Comeca no canto inferior direito
  // e anda no sentido anti-horario, como num tabuleiro classico.
  if (i <= 7) return { row: 8, col: 8 - i };
  if (i <= 14) return { row: 8 - (i - 7), col: 1 };
  if (i <= 21) return { row: 1, col: 1 + (i - 14) };
  return { row: 1 + (i - 21), col: 8 };
}

/** Cria a lista de casas (estatica) do tabuleiro. */
export function createTiles() {
  return RING.map((t, i) => {
    const base = { index: i, ...ringCoords(i), ...t };
    if (t.type === 'land') {
      base.rent = Math.round(t.price / 6 / 5) * 5; // tributo base
      base.fortCost = Math.round(t.price * 0.8);
    }
    return base;
  });
}

/** Mapa de adjacencias (por indice de casa) usado nos combates. */
export function createAdjacency(tiles) {
  const lands = tiles.filter((t) => t.type === 'land');
  const byId = new Map(lands.map((t) => [t.id, t.index]));
  const adj = new Map(lands.map((t) => [t.index, new Set()]));
  const link = (a, b) => {
    if (a === b || a === undefined || b === undefined) return;
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  // Vizinhos no anel (ignorando os cantos).
  for (let i = 0; i < lands.length; i++) {
    link(lands[i].index, lands[(i + 1) % lands.length].index);
  }
  // Territorios do mesmo continente fazem fronteira entre si.
  for (const a of lands) {
    for (const b of lands) if (a.cont === b.cont) link(a.index, b.index);
  }
  // Rotas maritimas.
  for (const [a, b] of SEA_ROUTES) link(byId.get(a), byId.get(b));
  return adj;
}

export const COUNCIL_CARDS = [
  { text: 'Rota comercial lucrativa: receba $250.', money: 250 },
  { text: 'Suprimentos capturados: receba 3 tropas de reserva.', troops: 3 },
  { text: 'Reforco da ONU: receba 2 tropas e $100.', troops: 2, money: 100 },
  { text: 'Imposto de guerra: pague $180.', money: -180 },
  { text: 'Motim nas tropas: perca 2 tropas da reserva.', troops: -2 },
  { text: 'Espionagem bem-sucedida: receba $150 e 1 tropa.', money: 150, troops: 1 },
  { text: 'Manutencao das fortalezas: pague $80 por fortaleza construida.', perFort: -80 },
  { text: 'Tratado de paz: receba $60 por territorio que voce controla.', perLand: 60 },
  { text: 'Bloqueio naval: pague $40 por territorio que voce controla.', perLand: -40 },
  { text: 'Recrutamento em massa: receba 4 tropas de reserva.', troops: 4 },
  { text: 'Convocacao geral: va para a Base Aliada e receba o bonus.', goStart: true },
  { text: 'Doacao de aliados: receba $200.', money: 200 },
];
