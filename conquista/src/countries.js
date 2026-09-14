// As 60 maiores economias do mundo (PIB nominal, ordem aproximada do ranking do FMI).
// O ranking define o ouro por rodada: 1o lugar = 400/rodada, 60o = 100/rodada.
// Ficaram de fora territorios nao soberanos (Hong Kong) e paises pequenos demais para
// aparecer no mapa 110m (Singapura), alem de Taiwan por ser status disputado.

const RANKED = [
  ['usa', 'Estados Unidos', 'United States of America'],
  ['chn', 'China', 'China'],
  ['deu', 'Alemanha', 'Germany'],
  ['jpn', 'Japao', 'Japan'],
  ['ind', 'India', 'India'],
  ['gbr', 'Reino Unido', 'United Kingdom'],
  ['fra', 'Franca', 'France'],
  ['ita', 'Italia', 'Italy'],
  ['bra', 'Brasil', 'Brazil'],
  ['can', 'Canada', 'Canada'],
  ['rus', 'Russia', 'Russia'],
  ['mex', 'Mexico', 'Mexico'],
  ['aus', 'Australia', 'Australia'],
  ['kor', 'Coreia do Sul', 'South Korea'],
  ['esp', 'Espanha', 'Spain'],
  ['idn', 'Indonesia', 'Indonesia'],
  ['tur', 'Turquia', 'Turkey'],
  ['nld', 'Holanda', 'Netherlands'],
  ['sau', 'Arabia Saudita', 'Saudi Arabia'],
  ['che', 'Suica', 'Switzerland'],
  ['pol', 'Polonia', 'Poland'],
  ['bel', 'Belgica', 'Belgium'],
  ['swe', 'Suecia', 'Sweden'],
  ['arg', 'Argentina', 'Argentina'],
  ['irl', 'Irlanda', 'Ireland'],
  ['isr', 'Israel', 'Israel'],
  ['tha', 'Tailandia', 'Thailand'],
  ['aut', 'Austria', 'Austria'],
  ['are', 'Emirados Arabes', 'United Arab Emirates'],
  ['nor', 'Noruega', 'Norway'],
  ['phl', 'Filipinas', 'Philippines'],
  ['vnm', 'Vietna', 'Vietnam'],
  ['bgd', 'Bangladesh', 'Bangladesh'],
  ['mys', 'Malasia', 'Malaysia'],
  ['dnk', 'Dinamarca', 'Denmark'],
  ['col', 'Colombia', 'Colombia'],
  ['egy', 'Egito', 'Egypt'],
  ['zaf', 'Africa do Sul', 'South Africa'],
  ['irn', 'Ira', 'Iran'],
  ['nga', 'Nigeria', 'Nigeria'],
  ['pak', 'Paquistao', 'Pakistan'],
  ['rou', 'Romenia', 'Romania'],
  ['chl', 'Chile', 'Chile'],
  ['cze', 'Chequia', 'Czechia'],
  ['fin', 'Finlandia', 'Finland'],
  ['prt', 'Portugal', 'Portugal'],
  ['kaz', 'Cazaquistao', 'Kazakhstan'],
  ['per', 'Peru', 'Peru'],
  ['irq', 'Iraque', 'Iraq'],
  ['nzl', 'Nova Zelandia', 'New Zealand'],
  ['grc', 'Grecia', 'Greece'],
  ['dza', 'Argelia', 'Algeria'],
  ['qat', 'Catar', 'Qatar'],
  ['hun', 'Hungria', 'Hungary'],
  ['kwt', 'Kuwait', 'Kuwait'],
  ['eth', 'Etiopia', 'Ethiopia'],
  ['ukr', 'Ucrania', 'Ukraine'],
  ['mar', 'Marrocos', 'Morocco'],
  ['svk', 'Eslovaquia', 'Slovakia'],
  ['ecu', 'Equador', 'Ecuador'],
];

export const INCOME_TOP = 400;
export const INCOME_BOTTOM = 100;

/** Ouro por rodada: escala linear do 1o (400) ao 60o (100) colocado. */
export function incomeForRank(rank, total = RANKED.length) {
  const step = (INCOME_TOP - INCOME_BOTTOM) / (total - 1);
  return Math.round((INCOME_TOP - (rank - 1) * step) / 5) * 5;
}

export const COUNTRIES = RANKED.map(([id, name, atlas], i) => {
  const rank = i + 1;
  const income = incomeForRank(rank);
  return { id, name, atlas, rank, income, price: Math.round((income * 3.2) / 10) * 10 };
});

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
