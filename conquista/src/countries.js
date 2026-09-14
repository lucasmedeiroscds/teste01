// As 60 maiores economias do mundo (PIB nominal, ordem aproximada do ranking do FMI).
// O ranking define o ouro por rodada: 1o lugar = 400/rodada, 60o = 100/rodada.
// Ficaram de fora territorios nao soberanos (Hong Kong) e paises pequenos demais para
// aparecer no mapa 110m (Singapura), alem de Taiwan por ser status disputado.

const RANKED = [
  ['usa', 'Estados Unidos', 'United States of America', 'na'],
  ['chn', 'China', 'China', 'as'],
  ['deu', 'Alemanha', 'Germany', 'weu'],
  ['jpn', 'Japao', 'Japan', 'as'],
  ['ind', 'India', 'India', 'as'],
  ['gbr', 'Reino Unido', 'United Kingdom', 'weu'],
  ['fra', 'Franca', 'France', 'weu'],
  ['ita', 'Italia', 'Italy', 'weu'],
  ['bra', 'Brasil', 'Brazil', 'sa'],
  ['can', 'Canada', 'Canada', 'na'],
  ['rus', 'Russia', 'Russia', 'as'],
  ['mex', 'Mexico', 'Mexico', 'na'],
  ['aus', 'Australia', 'Australia', 'oc'],
  ['kor', 'Coreia do Sul', 'South Korea', 'as'],
  ['esp', 'Espanha', 'Spain', 'weu'],
  ['idn', 'Indonesia', 'Indonesia', 'oc'],
  ['tur', 'Turquia', 'Turkey', 'me'],
  ['nld', 'Holanda', 'Netherlands', 'weu'],
  ['sau', 'Arabia Saudita', 'Saudi Arabia', 'me'],
  ['che', 'Suica', 'Switzerland', 'weu'],
  ['pol', 'Polonia', 'Poland', 'eeu'],
  ['bel', 'Belgica', 'Belgium', 'weu'],
  ['swe', 'Suecia', 'Sweden', 'eeu'],
  ['arg', 'Argentina', 'Argentina', 'sa'],
  ['irl', 'Irlanda', 'Ireland', 'weu'],
  ['isr', 'Israel', 'Israel', 'me'],
  ['tha', 'Tailandia', 'Thailand', 'as'],
  ['aut', 'Austria', 'Austria', 'weu'],
  ['are', 'Emirados Arabes', 'United Arab Emirates', 'me'],
  ['nor', 'Noruega', 'Norway', 'eeu'],
  ['phl', 'Filipinas', 'Philippines', 'as'],
  ['vnm', 'Vietna', 'Vietnam', 'as'],
  ['bgd', 'Bangladesh', 'Bangladesh', 'as'],
  ['mys', 'Malasia', 'Malaysia', 'as'],
  ['dnk', 'Dinamarca', 'Denmark', 'eeu'],
  ['col', 'Colombia', 'Colombia', 'sa'],
  ['egy', 'Egito', 'Egypt', 'af'],
  ['zaf', 'Africa do Sul', 'South Africa', 'af'],
  ['irn', 'Ira', 'Iran', 'me'],
  ['nga', 'Nigeria', 'Nigeria', 'af'],
  ['pak', 'Paquistao', 'Pakistan', 'as'],
  ['rou', 'Romenia', 'Romania', 'eeu'],
  ['chl', 'Chile', 'Chile', 'sa'],
  ['cze', 'Chequia', 'Czechia', 'eeu'],
  ['fin', 'Finlandia', 'Finland', 'eeu'],
  ['prt', 'Portugal', 'Portugal', 'weu'],
  ['kaz', 'Cazaquistao', 'Kazakhstan', 'as'],
  ['per', 'Peru', 'Peru', 'sa'],
  ['irq', 'Iraque', 'Iraq', 'me'],
  ['nzl', 'Nova Zelandia', 'New Zealand', 'oc'],
  ['grc', 'Grecia', 'Greece', 'eeu'],
  ['dza', 'Argelia', 'Algeria', 'af'],
  ['qat', 'Catar', 'Qatar', 'me'],
  ['hun', 'Hungria', 'Hungary', 'eeu'],
  ['kwt', 'Kuwait', 'Kuwait', 'me'],
  ['eth', 'Etiopia', 'Ethiopia', 'af'],
  ['ukr', 'Ucrania', 'Ukraine', 'eeu'],
  ['mar', 'Marrocos', 'Morocco', 'af'],
  ['svk', 'Eslovaquia', 'Slovakia', 'eeu'],
  ['ecu', 'Equador', 'Ecuador', 'sa'],
];

export const INCOME_TOP = 400;
export const INCOME_BOTTOM = 100;

/** Ouro por rodada: escala linear do 1o (400) ao 60o (100) colocado. */
export function incomeForRank(rank, total = RANKED.length) {
  const step = (INCOME_TOP - INCOME_BOTTOM) / (total - 1);
  return Math.round((INCOME_TOP - (rank - 1) * step) / 5) * 5;
}

// Continentes (estilo War): o bonus de tropas por continente completo vale por rodada.
export const CONTINENTS = {
  na: { name: 'America do Norte', color: '#ef4444', bonus: 3 },
  sa: { name: 'America do Sul', color: '#f59e0b', bonus: 3 },
  weu: { name: 'Europa Ocidental', color: '#3b82f6', bonus: 5 },
  eeu: { name: 'Europa Oriental', color: '#6366f1', bonus: 5 },
  me: { name: 'Oriente Medio', color: '#eab308', bonus: 4 },
  as: { name: 'Asia', color: '#a855f7', bonus: 6 },
  af: { name: 'Africa', color: '#22c55e', bonus: 3 },
  oc: { name: 'Oceania', color: '#14b8a6', bonus: 2 },
};

export const COUNTRIES = RANKED.map(([id, name, atlas, cont], i) => {
  const rank = i + 1;
  const income = incomeForRank(rank);
  return { id, name, atlas, cont, rank, income, price: Math.round((income * 3.2) / 10) * 10 };
});

/** Ids dos paises de um continente. */
export const countriesOfContinent = (key) => COUNTRIES.filter((c) => c.cont === key).map((c) => c.id);

// Ligacoes maritimas: ilhas e travessias curtas que o mapa de fronteiras nao cobre.
export const SEA_ROUTES = [
  ['gbr', 'irl'], ['gbr', 'fra'], ['gbr', 'nld'], ['gbr', 'nor'],
  ['dnk', 'swe'], ['dnk', 'nor'], ['swe', 'fin'], ['fin', 'swe'],
  ['jpn', 'kor'], ['jpn', 'chn'], ['jpn', 'rus'],
  ['idn', 'mys'], ['idn', 'aus'], ['idn', 'phl'], ['phl', 'vnm'], ['phl', 'chn'],
  ['aus', 'nzl'], ['nzl', 'chl'],
  ['esp', 'mar'], ['ita', 'grc'], ['grc', 'tur'], ['ita', 'dza'],
  ['usa', 'jpn'], ['usa', 'gbr'], ['can', 'gbr'],
  ['bra', 'nga'], ['zaf', 'bra'], ['arg', 'zaf'],
  ['are', 'irn'], ['qat', 'irn'], ['kwt', 'irn'], ['sau', 'egy'], ['are', 'sau'], ['qat', 'sau'],
  ['egy', 'grc'], ['tur', 'ukr'], ['tur', 'rou'],
  ['ind', 'bgd'], ['ind', 'are'], ['mys', 'tha'],
  ['eth', 'sau'], ['nga', 'dza'], ['per', 'chl'],
  ['mex', 'col'], ['col', 'per'],
];
