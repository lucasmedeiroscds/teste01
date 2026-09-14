// 50 missoes secretas. Cada jogador recebe uma no inicio da partida; cumprir a missao
// encerra o jogo. O tom e de deboche geopolitico — as regras, no entanto, sao serias:
// toda missao e verificavel automaticamente no fim de cada acao.
//
// O objeto `h` entregue ao check traz atalhos sobre o estado atual do jogador.

const G7 = ['usa', 'jpn', 'deu', 'gbr', 'fra', 'ita', 'can'];
const BRICS = ['bra', 'rus', 'ind', 'chn', 'zaf'];
const OPEP = ['sau', 'irn', 'irq', 'kwt', 'qat', 'are', 'dza', 'nga'];
const NORDICOS = ['swe', 'nor', 'dnk', 'fin'];
const VISEGRADO = ['pol', 'cze', 'svk', 'hun'];
const IBERIA = ['esp', 'prt'];
const ANGLO = ['usa', 'gbr', 'can', 'aus', 'nzl', 'irl'];
const LATAM = ['mex', 'bra', 'arg', 'col', 'chl', 'per', 'ecu'];
const NUCLEARES = ['usa', 'rus', 'chn', 'gbr', 'fra', 'ind', 'pak', 'isr'];
const ILHAS = ['gbr', 'irl', 'jpn', 'phl', 'idn', 'aus', 'nzl'];
const TIGRES = ['kor', 'tha', 'mys', 'phl', 'vnm'];

export const MISSIONS = [
  { id: 'm01', titulo: 'Consultoria estrategica', texto: 'Controle 16 paises. Ninguem perguntou como.', check: (h) => h.count >= 16 },
  { id: 'm02', titulo: 'Expansao organica', texto: 'Controle 20 paises, mas chame isso de "parceria regional".', check: (h) => h.count >= 20 },
  { id: 'm03', titulo: 'Zona de influencia', texto: 'Controle 24 paises e diga que foi a pedido da populacao.', check: (h) => h.count >= 24 },
  { id: 'm04', titulo: 'Quintal de casa', texto: 'Domine a America do Norte inteira. O quintal e seu.', check: (h) => h.contFull('na') },
  { id: 'm05', titulo: 'Operacao Bananas', texto: 'Domine a America do Sul. Puramente por interesse humanitario.', check: (h) => h.contFull('sa') },
  { id: 'm06', titulo: 'Fundo de coesao', texto: 'Domine a Europa Ocidental e emita um comunicado preocupado.', check: (h) => h.contFull('weu') },
  { id: 'm07', titulo: 'Alargamento', texto: 'Domine a Europa Oriental. Sem consulta popular, claro.', check: (h) => h.contFull('eeu') },
  { id: 'm08', titulo: 'Estabilidade regional', texto: 'Domine o Oriente Medio. Vai dar tudo certo desta vez.', check: (h) => h.contFull('me') },
  { id: 'm09', titulo: 'Rota da seda 2.0', texto: 'Domine a Asia inteira, com financiamento amigavel.', check: (h) => h.contFull('as') },
  { id: 'm10', titulo: 'Cooperacao sul-sul', texto: 'Domine a Africa. Em troca de "investimentos em infraestrutura".', check: (h) => h.contFull('af') },
  { id: 'm11', titulo: 'Turismo agressivo', texto: 'Domine a Oceania e mais 6 paises quaisquer.', check: (h) => h.contFull('oc') && h.count >= 12 },
  { id: 'm12', titulo: 'Eixo do bom senso', texto: 'Domine a America do Norte e a America do Sul.', check: (h) => h.contFull('na') && h.contFull('sa') },
  { id: 'm13', titulo: 'Cortina de ferro reformada', texto: 'Domine a Europa Oriental e o Oriente Medio.', check: (h) => h.contFull('eeu') && h.contFull('me') },
  { id: 'm14', titulo: 'Bloco economico', texto: 'Domine a Europa Ocidental e a Oceania.', check: (h) => h.contFull('weu') && h.contFull('oc') },
  { id: 'm15', titulo: 'Mesa do G7', texto: 'Controle 6 dos 7 paises do G7. A foto oficial e o que importa.', check: (h) => h.countIn(G7) >= 6 },
  { id: 'm16', titulo: 'Cupula dos emergentes', texto: 'Controle 4 paises do BRICS e prometa uma moeda nova.', check: (h) => h.countIn(BRICS) >= 5 },
  { id: 'm17', titulo: 'Cartel amigavel', texto: 'Controle 5 paises da OPEP e combine o preco no grupo.', check: (h) => h.countIn(OPEP) >= 6 },
  { id: 'm18', titulo: 'Modelo nordico', texto: 'Controle os 4 paises nordicos e poste sobre felicidade.', check: (h) => h.ownsAll(NORDICOS) },
  { id: 'm19', titulo: 'Grupo de Visegrado', texto: 'Controle os 4 paises de Visegrado e vete tudo.', check: (h) => h.ownsAll(VISEGRADO) },
  { id: 'm20', titulo: 'Tratado de Tordesilhas', texto: 'Controle Espanha, Portugal e 3 paises da America Latina.', check: (h) => h.ownsAll(IBERIA) && h.countIn(LATAM) >= 5 },
  { id: 'm21', titulo: 'Commonwealth saudosa', texto: 'Controle 5 paises da anglosfera. O cha e as 17h.', check: (h) => h.countIn(ANGLO) >= 5 },
  { id: 'm22', titulo: 'Clube nuclear', texto: 'Controle 6 potencias nucleares. Apenas para fins pacificos.', check: (h) => h.countIn(NUCLEARES) >= 6 },
  { id: 'm23', titulo: 'Doutrina das ilhas', texto: 'Controle 6 paises insulares e chame de "seguranca maritima".', check: (h) => h.countIn(ILHAS) >= 6 },
  { id: 'm24', titulo: 'Milagre asiatico', texto: 'Controle 5 tigres asiaticos e uma fabrica em cada um.', check: (h) => h.countIn(TIGRES) >= 5 },
  { id: 'm25', titulo: 'Top 3 do ranking', texto: 'Controle os tres paises mais ricos do mundo. Meritocracia.', check: (h) => h.topRanks(3) },
  { id: 'm26', titulo: 'Top 5 do ranking', texto: 'Controle 4 dos 5 primeiros do ranking mundial.', check: (h) => h.countInRank(1, 5) >= 5 },
  { id: 'm27', titulo: 'Mercado emergente', texto: 'Controle 12 paises do fim do ranking (41o ao 60o).', check: (h) => h.countInRank(41, 60) >= 12 },
  { id: 'm28', titulo: 'Diversificacao de portfolio', texto: 'Tenha paises em 6 continentes diferentes.', check: (h) => h.continentesTocados() >= 6 },
  { id: 'm29', titulo: 'Presenca global', texto: 'Tenha paises nos 8 continentes do mapa. Consultoria nao e invasao.', check: (h) => h.continentesTocados() >= 8 },
  { id: 'm30', titulo: 'Too big to fail', texto: 'Acumule 45.000 de patrimonio e um discurso sobre austeridade.', check: (h) => h.worth >= 45_000 },
  { id: 'm31', titulo: 'Superavit primario', texto: 'Acumule 60.000 de patrimonio sem nenhuma divida aberta.', check: (h) => h.worth >= 60_000 && !h.player.loan },
  { id: 'm32', titulo: 'Caixa dois', texto: 'Tenha 25.000 de ouro em caixa. Liquido, obviamente.', check: (h) => h.gold >= 25_000 },
  { id: 'm33', titulo: 'Parque industrial', texto: 'Construa 15 industrias. Emprego e dignidade (patenteados).', check: (h) => h.industrias >= 15 },
  { id: 'm34', titulo: 'Milagre economico', texto: 'Chegue a 4.000 de renda por rodada. O PIB agradece.', check: (h) => h.income >= 4000 },
  { id: 'm35', titulo: 'Choque de gestao', texto: 'Tenha 9 paises, cada um com pelo menos 2 industrias.', check: (h) => h.landsCom((c) => c.small + c.large >= 2) >= 9 },
  { id: 'm36', titulo: 'Complexo militar-industrial', texto: 'Tenha 30 tropas no mapa e uma industria em cada pais seu.', check: (h) => h.tropasNoMapa >= 60 && h.count >= 6 && h.lands.every((c) => c.small + c.large >= 1) },
  { id: 'm37', titulo: 'Guarda pretoriana', texto: 'Tenha 8 paises com 6 ou mais tropas cada. Desfile obrigatorio.', check: (h) => h.landsCom((c) => c.troops >= 6) >= 8 },
  { id: 'm38', titulo: 'Fortaleza', texto: 'Tenha um unico pais com 25 tropas. Chame de dissuasao.', check: (h) => h.lands.some((c) => c.troops >= 25) },
  { id: 'm39', titulo: 'Intervencao humanitaria', texto: 'Conquiste 7 paises na guerra (comprar nao vale).', check: (h) => h.conquistas >= 7 },
  { id: 'm40', titulo: 'Mudanca de regime', texto: 'Conquiste 11 paises na guerra. Eleicoes em breve.', check: (h) => h.conquistas >= 11 },
  { id: 'm41', titulo: 'Sancoes seletivas', texto: 'Elimine um adversario da partida. Foi o mercado.', check: (h) => h.eliminados >= 1 },
  { id: 'm42', titulo: 'Diplomacia definitiva', texto: 'Elimine dois adversarios. Sem baixas civis registradas.', check: (h) => h.eliminados >= 2 },
  { id: 'm43', titulo: 'Hegemonia regional', texto: 'Domine um continente inteiro e tenha 10 paises no total.', check: (h) => h.continentesCompletos >= 1 && h.count >= 15 },
  { id: 'm44', titulo: 'Duplo padrao', texto: 'Domine um continente e 7 paises em outro qualquer.', check: (h) => h.continentesCompletos >= 1 && h.maiorFatiaFora() >= 7 },
  { id: 'm45', titulo: 'Ajuste fiscal', texto: 'Chegue a 35.000 de patrimonio e 14 paises. Cortando o social.', check: (h) => h.worth >= 35_000 && h.count >= 14 },
  { id: 'm46', titulo: 'Corredor logistico', texto: 'Controle 10 paises que facam fronteira entre si, em cadeia.', check: (h) => h.maiorBlocoConexo() >= 10 },
  { id: 'm47', titulo: 'Imperio contiguo', texto: 'Controle 14 paises vizinhos formando um bloco unico.', check: (h) => h.maiorBlocoConexo() >= 14 },
  { id: 'm48', titulo: 'Lavagem reputacional', texto: 'Tenha 20.000 de caixa e nenhuma divida. Reputacao impecavel.', check: (h) => h.gold >= 20_000 && !h.player.loan },
  { id: 'm49', titulo: 'Dominio de mercado', texto: 'Tenha o dobro de paises do segundo colocado (minimo 12).', check: (h) => h.count >= 12 && h.count >= 2 * h.segundoColocado() },
  { id: 'm50', titulo: 'Acordo de paz', texto: 'Controle 14 paises e 35.000 de patrimonio: a paz sai caro.', check: (h) => h.count >= 14 && h.worth >= 35_000 },
];

export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
export { G7, BRICS, OPEP };
