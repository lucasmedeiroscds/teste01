/* Registro de plataformas e o contrato de conexão.
 * ---------------------------------------------------------------------------
 * Levantamento feito antes de escrever este arquivo, porque ele muda o produto:
 *
 *   NENHUMA das grandes plataformas de entrega e transporte que operam no
 *   Brasil publica hoje uma API que permita a um entregador ou motorista
 *   autorizar um app de terceiros a ler os PRÓPRIOS ganhos.
 *
 * O que existe de API pública em cada uma é voltado para o outro lado do
 * balcão — restaurante, loja, embarcador, empresa — e não para quem roda:
 *
 *   • iFood  — o Portal do Desenvolvedor expõe APIs de Merchant, Catálogo,
 *              Pedido e Financeiro para ESTABELECIMENTOS, além de integração
 *              para operadores logísticos (empresas). Não há escopo de
 *              "entregador lê os próprios ganhos".
 *   • Uber   — a plataforma pública cobre Rides, Uber Eats (lado do
 *              restaurante), Uber Direct e Uber for Business. A antiga Driver
 *              API (escopos partner.trips / partner.payments), que permitia
 *              exatamente esse acesso, foi descontinuada e não está aberta.
 *              Em compensação, o motorista consegue baixar o próprio extrato
 *              em CSV no portal de parceiros — e esse caminho a gente suporta.
 *   • 99     — as integrações públicas são de 99 Empresas (contratos
 *              corporativos). Nada para o motorista pessoa física.
 *   • Rappi  — APIs de Partners (lojas) e de Entregas para empresas. Nada
 *              para o entregador.
 *   • Loggi  — API de envios para embarcadores. Nada para o entregador.
 *
 * Conclusão prática, sem enrolação: prometer "conectar sua conta do iFood"
 * seria mentira. O que dá para fazer bem é (1) importar o extrato que a
 * própria plataforma deixa você baixar, (2) lançar rápido na mão, e (3)
 * deixar a porta aberta — o contrato `ConectorAdapter` abaixo — para o dia em
 * que alguma delas abrir a API, ou para uma integração via Open Finance, que
 * é o caminho regulado para ler os repasses direto da conta bancária.
 * --------------------------------------------------------------------------- */

/**
 * Contrato que qualquer integração futura precisa cumprir.
 *
 * @typedef {Object} ConectorAdapter
 * @property {string}  id
 * @property {string}  nome
 * @property {'api'|'extrato'|'manual'} modo
 * @property {() => boolean}           disponivel   Se dá para usar agora.
 * @property {() => Promise<void>}     conectar     OAuth, upload de arquivo etc.
 * @property {() => Promise<boolean>}  conectado
 * @property {(desde: string) => Promise<Array<TurnoImportado>>} buscar
 * @property {() => Promise<void>}     desconectar
 *
 * @typedef {Object} TurnoImportado
 * @property {string} data      AAAA-MM-DD
 * @property {string} app       id da plataforma
 * @property {number} bruto
 * @property {number} gorjeta
 * @property {number} km
 * @property {number} horas
 * @property {number} corridas
 */

export const STATUS = {
  EXTRATO: {
    id: 'extrato',
    rotulo: 'Importa extrato',
    badge: 'badge-good',
    texto: 'A plataforma deixa você baixar o próprio extrato. O Giro lê esse arquivo.',
  },
  MANUAL: {
    id: 'manual',
    rotulo: 'Lançamento manual',
    badge: 'badge-warning',
    texto: 'Sem exportação oficial para quem roda. O lançamento rápido resolve em 20 segundos por dia.',
  },
  INDISPONIVEL: {
    id: 'indisponivel',
    rotulo: 'Sem API para entregador',
    badge: 'badge-critical',
    texto: 'A API pública da plataforma atende lojas e empresas, não a conta de quem entrega.',
  },
};

/** Ordem fixa — é ela que define a cor de cada plataforma nos gráficos. */
export const PLATAFORMAS = [
  {
    id: 'ifood',
    nome: 'iFood',
    sigla: 'iF',
    tipo: 'Entrega',
    slot: 0,
    status: STATUS.MANUAL,
    apiPublica: 'Merchant, Catálogo, Pedido e Financeiro — para estabelecimentos. Também integração para operadores logísticos (empresas).',
    paraQuemRoda: 'Não há escopo que permita ao entregador autorizar leitura dos próprios ganhos.',
    comoTrazer: [
      'No app iFood Entregador, abra Ganhos e anote o total da jornada e os quilômetros.',
      'Lance uma linha por dia no Giro — leva menos de meio minuto.',
      'Se você recebe a nota de pagamento semanal por e-mail, lance o total da semana em um único registro e ajuste os quilômetros.',
    ],
  },
  {
    id: 'uber',
    nome: 'Uber / Uber Eats',
    sigla: 'Ub',
    tipo: 'Transporte e entrega',
    slot: 1,
    status: STATUS.EXTRATO,
    apiPublica: 'Rides, Eats (lado do restaurante), Uber Direct e Uber for Business.',
    paraQuemRoda: 'A antiga Driver API (partner.trips / partner.payments) foi descontinuada. Em troca, o extrato do motorista pode ser baixado em CSV no portal de parceiros.',
    comoTrazer: [
      'Acesse o portal de parceiros da Uber pelo navegador e entre com sua conta.',
      'Vá em Ganhos e baixe o extrato do período em CSV.',
      'Traga o arquivo em Conexões → Importar extrato. O Giro identifica as colunas e mostra uma prévia antes de gravar.',
    ],
  },
  {
    id: '99',
    nome: '99',
    sigla: '99',
    tipo: 'Transporte e entrega',
    slot: 2,
    status: STATUS.MANUAL,
    apiPublica: 'Integrações de 99 Empresas, para contratos corporativos.',
    paraQuemRoda: 'Sem API e sem exportação oficial para o motorista pessoa física.',
    comoTrazer: [
      'No app, abra Carteira e veja o resumo do dia ou da semana.',
      'Lance o bruto, os quilômetros e as horas no Giro.',
      'Se você monta uma planilha própria, dá para importar por CSV com qualquer nome de coluna.',
    ],
  },
  {
    id: 'rappi',
    nome: 'Rappi',
    sigla: 'Ra',
    tipo: 'Entrega',
    slot: 3,
    status: STATUS.MANUAL,
    apiPublica: 'Rappi Partners (lojas) e Rappi Entregas para empresas.',
    paraQuemRoda: 'Não há acesso programático aos ganhos do entregador.',
    comoTrazer: [
      'Confira o resumo de ganhos no app ao encerrar a jornada.',
      'Lance o total do dia, com quilômetros e horas.',
    ],
  },
  {
    id: 'loggi',
    nome: 'Loggi',
    sigla: 'Lo',
    tipo: 'Entrega',
    slot: 4,
    status: STATUS.MANUAL,
    apiPublica: 'API de envios para embarcadores (quem manda a encomenda).',
    paraQuemRoda: 'Nada voltado ao entregador parceiro.',
    comoTrazer: [
      'Use o resumo da rota no app ao fechar o dia.',
      'Lance o valor da rota, os quilômetros e o tempo.',
    ],
  },
  {
    id: 'outros',
    nome: 'Outros / particular',
    sigla: '••',
    tipo: 'Livre',
    slot: 5,
    status: STATUS.MANUAL,
    apiPublica: '—',
    paraQuemRoda: 'Fretes, mototáxi, cliente fixo, marmita, farmácia: tudo que não cabe nas outras.',
    comoTrazer: [
      'Lance como qualquer outro turno.',
      'Vale a pena separar: quase sempre é aqui que está o melhor R$ por quilômetro.',
    ],
  },
];

export const PLATAFORMA_POR_ID = Object.fromEntries(PLATAFORMAS.map((p) => [p.id, p]));
export const nomeApp = (id) => PLATAFORMA_POR_ID[id]?.nome || 'Outros';
export const corApp = (id) => `var(--s${(PLATAFORMA_POR_ID[id]?.slot ?? 5) + 1})`;

/**
 * Caminho regulado que hoje é o único capaz de automatizar de verdade:
 * ler os repasses direto da conta bancária, com consentimento do titular.
 * Exige ser instituição participante autorizada pelo Banco Central, então
 * fica registrado como direção, não como promessa.
 */
export const OPEN_FINANCE = {
  nome: 'Open Finance Brasil',
  resumo: 'Os repasses dos aplicativos caem na sua conta. Com o seu consentimento, uma instituição participante consegue ler esses lançamentos por API oficial e regulada — sem depender de nenhum aplicativo de entrega abrir nada.',
  limite: 'Só instituições autorizadas pelo Banco Central podem consumir essas APIs. Um site que roda no seu navegador, como este, não pode. Fica como o caminho certo para uma versão com servidor.',
  alternativa: 'Enquanto isso: o extrato bancário em OFX ou CSV que o seu banco já deixa baixar pode ser importado aqui como qualquer outra planilha.',
};
