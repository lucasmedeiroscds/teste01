/* Dicas de gestão financeira escritas para quem vive de app.
 * Cada dica fica 60 segundos na tela — o texto foi dimensionado para ser lido
 * com folga nesse tempo (90 a 130 palavras). */

export const TEMPO_POR_DICA_MS = 60000;

export const DICAS = [
  {
    cat: 'Custo',
    titulo: 'O app mostra o bruto. O seu dinheiro é o líquido.',
    texto: 'Quando o aplicativo diz que você fez R$ 220 no dia, ele está falando do faturamento — não do seu ganho. Desse valor ainda saem combustível, óleo, pneu, relação, freio, a desvalorização do veículo e a sua parte dos custos fixos do mês. Numa moto rodando em cidade grande, esse conjunto costuma comer entre R$ 0,50 e R$ 0,90 por quilômetro. Em 120 km de trabalho, são R$ 60 a R$ 110 que já saíram, mesmo que ainda não tenham saído da sua conta. Quem trabalha pelo bruto vive achando que ganha bem e nunca entende por que o dinheiro some.',
    acao: 'Preencha a aba <b>Custos</b> uma vez. O Giro passa a calcular o líquido sozinho em todo lançamento.',
  },
  {
    cat: 'Organização',
    titulo: 'Separe a conta de rodar da conta de viver.',
    texto: 'O erro mais caro do autônomo é misturar o caixa do trabalho com o dinheiro de casa. Tudo cai na mesma conta, você paga o mercado com o dinheiro que era da revisão, e quando o pneu careca aparece não tem de onde tirar. A solução custa zero: abra uma segunda conta digital só para receber dos aplicativos. Dela saem combustível, manutenção, seguro e as provisões. Para a sua conta pessoal vai apenas o valor que você define como salário. Duas contas transformam uma bagunça em duas contas simples, cada uma com um trabalho claro.',
    acao: 'Abra hoje uma segunda conta digital gratuita e cadastre-a como conta de recebimento nos aplicativos.',
  },
  {
    cat: 'Renda',
    titulo: 'Pague-se um salário fixo, não o que sobrou.',
    texto: 'Semana boa, você gasta; semana ruim, você aperta. Esse sobe e desce é o que impede o entregador de construir qualquer coisa. Faça o contrário: olhe seus últimos três meses, pegue o líquido médio semanal e defina um salário um pouco abaixo dele — algo como 85%. Todo domingo você transfere exatamente esse valor para a conta pessoal. O que passar disso fica na conta de rodar, formando o colchão que cobre a semana fraca, a chuva de três dias e o mês de janeiro. Você para de viver o ganho do dia e passa a viver de uma renda previsível.',
    acao: 'Calcule 85% do seu líquido semanal médio no <b>Painel</b> e transfira esse valor fixo toda semana.',
  },
  {
    cat: 'Custo',
    titulo: 'Guarde manutenção por quilômetro, não por mês.',
    texto: 'Manutenção não acontece por mês, acontece por quilômetro. O pneu não sabe se é dia 5 ou dia 25 — ele sabe que rodou 16 mil quilômetros. Por isso guardar “um pouco quando dá” nunca funciona: a conta chega junta e vira parcelamento no cartão. Faça a conta certa uma vez: some quanto custa cada item e a cada quantos quilômetros ele é trocado. Óleo a R$ 75 a cada 2.000 km são R$ 0,04 por km. Pneus a R$ 620 a cada 16.000 km, mais R$ 0,04. Somando tudo, você descobre quanto separar de verdade a cada quilômetro rodado.',
    acao: 'Confira sua tabela em <b>Custos → Manutenção</b> e transfira a provisão do dia para a conta de rodar.',
  },
  {
    cat: 'Reserva',
    titulo: 'Sua reserva de emergência tem nome: 30 dias parado.',
    texto: 'Quem trabalha por aplicativo não tem afastamento, não tem atestado remunerado e não tem carro reserva. Moto quebrada, braço quebrado ou conta bloqueada significam renda zero no mesmo dia. Sua reserva mínima não é um número redondo bonito: é o custo de viver e manter o veículo por trinta dias sem faturar nada. Some as despesas de casa mais os custos fixos do trabalho e você tem o alvo. Comece com dez por cento de cada líquido, guardado em algo que renda e possa ser sacado no mesmo dia. Não é aplicação para ficar rico — é o que impede você de voltar a zero.',
    acao: 'Deixe a provisão de emergência em 10% na aba <b>Custos</b> e não toque nessa conta.',
  },
  {
    cat: 'Proteção',
    titulo: 'MEI e INSS: o barato de não pagar é o mais caro.',
    texto: 'Sem contribuição, um acidente que te afaste por dois meses vale exatamente zero de auxílio. O MEI custa por volta de R$ 76 a R$ 82 por mês e dá acesso a auxílio-doença, salário-maternidade, aposentadoria por idade e pensão para a família. É cerca de R$ 2,60 por dia — menos que um lanche na rua. Além disso, o CNPJ abre porta para conta PJ, maquininha com taxa menor, crédito com juro mais baixo e nota fiscal quando um cliente pedir. Quem entrega e dirige tem risco de trabalho alto e proteção baixa; essa é a forma mais barata de inverter um pouco essa conta.',
    acao: 'Cadastre o valor do DAS em <b>Custos fixos</b> para ele aparecer no seu custo real por dia.',
  },
  {
    cat: 'Combustível',
    titulo: 'Você não sabe seu consumo — você acha que sabe.',
    texto: 'Quase todo mundo repete o número que veio no manual ou o que o vendedor falou. Consumo real depende de peso da bag, trânsito parado, pneu vazio, filtro sujo e do seu pé. A diferença entre 32 e 26 km por litro muda o seu custo por quilômetro em quase 25% — e é isso que decide se uma corrida de R$ 7 vale ou não. Medir é simples: encha o tanque até o bico desarmar, anote o odômetro, rode normalmente e anote de novo no próximo tanque cheio. Divida os quilômetros pelos litros do segundo abastecimento. Três medições já te dão a verdade.',
    acao: 'Registre cada abastecimento em <b>Lançar → Abastecimento</b>. O Giro calcula seu km/l real.',
  },
  {
    cat: 'Decisão',
    titulo: 'Recusar corrida ruim é conta, não preguiça.',
    texto: 'Uma corrida de R$ 6,50 com 4 km até a coleta e 6 km de entrega são 10 km rodados, mais o retorno para a região boa. Com custo de R$ 0,70 por km, saíram R$ 7 no mínimo — você pagou para trabalhar, e ainda gastou vinte minutos que poderiam ter recebido outra chamada. O ponto não é recusar tudo: é ter um número na cabeça. Defina seu R$ por quilômetro mínimo e seu R$ por hora mínimo e compare antes de aceitar. Você vai aceitar menos corridas, rodar menos quilômetros e terminar o dia com mais dinheiro e menos desgaste no veículo.',
    acao: 'Use a aba <b>Vale a pena?</b> antes de aceitar. Em 5 segundos ela diz o líquido e o mínimo aceitável.',
  },
  {
    cat: 'Dívida',
    titulo: 'A parcela do veículo tem um teto: 25% do líquido.',
    texto: 'Financiar moto ou carro para trabalhar pode fazer sentido, mas a parcela é um custo fixo que não te pergunta se a semana foi boa. Regra prática: parcela mais seguro não deve passar de um quarto do seu ganho líquido médio mensal. Acima disso, qualquer imprevisto — três dias de chuva, uma quebra, uma queda de demanda — vira atraso. Cuidado especial com financiamento longo de veículo usado: você pode terminar devendo mais do que ele vale. E compare sempre com o aluguel semanal: em muitos casos alugar custa mais no ano, mas em outros ele evita uma dívida que você não consegue carregar.',
    acao: 'Lance a parcela em <b>Custos fixos</b> e veja quanto ela pesa no seu ponto de equilíbrio diário.',
  },
  {
    cat: 'Combustível',
    titulo: 'O que importa não é o preço da bomba, é o R$ por km.',
    texto: 'Rodar oito quilômetros para economizar dez centavos no litro é prejuízo em quase todos os casos: você gastou combustível, tempo e desgaste para ganhar poucos reais. E na hora de escolher entre etanol e gasolina, use a regra dos 70%: se o etanol estiver custando mais que 70% do preço da gasolina, a gasolina compensa mais — porque o etanol rende menos por litro. Com gasolina a R$ 6,20, o etanol só vale até cerca de R$ 4,34. Quem roda 150 km por dia sente essa diferença em cheio no fim do mês, e ela cabe numa continha de dez segundos no posto.',
    acao: 'Anote o preço pago em cada abastecimento — o Giro mostra o preço médio real do seu litro.',
  },
  {
    cat: 'Tributos',
    titulo: 'IPVA, licenciamento e multa não são surpresa. São calendário.',
    texto: 'Todo janeiro o IPVA chega, e todo janeiro alguém se surpreende. Some IPVA, licenciamento, seguro obrigatório e uma média das suas multas do último ano, divida por doze e trate isso como uma despesa mensal. Numa moto popular costuma dar entre R$ 40 e R$ 90 por mês; num carro, bem mais. Guardando esse valor todo mês, em janeiro você paga à vista com desconto em vez de parcelar com juros ou rodar com o documento atrasado — o que, se der blitz, custa multa, guincho e dias sem faturar. É a provisão mais fácil de fazer e a mais esquecida.',
    acao: 'Crie o custo fixo “IPVA + licenciamento (1/12)” em <b>Custos</b> com o valor anual dividido por doze.',
  },
  {
    cat: 'Custo',
    titulo: 'Comida e água na rua corroem o líquido em silêncio.',
    texto: 'Almoço na rua, um lanche à tarde, água, café: fácil chegar a R$ 35 por dia sem perceber. Em 24 dias de trabalho são R$ 840 por mês — para muita gente, isso é a diferença entre fechar no azul e no vermelho. Não se trata de passar fome trabalhando: marmita e garrafa térmica na bag resolvem a maior parte, e você ainda perde menos tempo procurando lugar para parar. Guarde o restaurante para dois dias na semana. E lance esse gasto no aplicativo como custo de trabalho, porque é exatamente isso que ele é.',
    acao: 'Use o campo <b>Gastos do turno</b> ao lançar o dia e veja o total no relatório do mês.',
  },
  {
    cat: 'Planejamento',
    titulo: 'Planeje pela semana mediana, não pela melhor.',
    texto: 'Todo mundo lembra da sexta de chuva com taxa dinâmica em que fez R$ 400. O problema é usar esse dia como base para assumir compromisso. Pegue as últimas oito semanas, coloque os líquidos em ordem e use o valor do meio — a mediana. É esse número que paga aluguel, parcela e mercado. Se a mediana não cobre suas contas fixas, o problema não é falta de esforço: é estrutura, e ele não se resolve rodando mais duas horas. Se cobre com folga, você acabou de descobrir sua real capacidade de poupar. Média engana; mediana não.',
    acao: 'Abra <b>Relatórios</b> e compare os fechamentos das últimas semanas antes de assumir qualquer parcela.',
  },
  {
    cat: 'Dívida',
    titulo: 'Rotativo do cartão e empréstimo relâmpago são armadilha.',
    texto: 'O rotativo do cartão de crédito no Brasil costuma passar de 400% ao ano. Um saldo de R$ 1.000 arrastado por seis meses vira uma dívida que consome semanas inteiras de trabalho. Empréstimo oferecido dentro do aplicativo de entrega parece prático porque desconta do repasse, mas o custo efetivo raramente é baixo — e ele reduz o seu recebimento justamente na semana em que você mais precisa. Se já existe dívida cara, ataque primeiro a de maior juro, negocie à vista com desconto e considere trocar por uma linha mais barata. Pagar juro alto é trabalhar de graça para o banco.',
    acao: 'Liste suas dívidas por taxa de juro, não por valor. A de maior taxa é a primeira a morrer.',
  },
  {
    cat: 'Decisão',
    titulo: 'A décima hora do dia raramente paga o que custa.',
    texto: 'Depois de oito ou nove horas, três coisas acontecem juntas: o rendimento por hora cai, o risco de acidente sobe e o desgaste do veículo continua igual. Vale a pena esticar quando existe incentivo real — dinâmica alta, bônus por quantidade, chuva com taxa extra. Não vale quando é só teimosia para bater um número redondo. Faça a conta marginal: quanto essa hora extra deve render para pagar combustível, desgaste e o seu cansaço? Se a resposta for menos do que você está ganhando nela, vá para casa. Acidente é o custo mais caro da categoria, e ele não aparece em nenhuma planilha.',
    acao: 'Compare o R$/hora líquido das suas últimas horas em <b>Relatórios</b> antes de esticar o turno.',
  },
  {
    cat: 'Renda',
    titulo: 'Bônus e promoção são bônus. Não são salário.',
    texto: 'Campanha de fim de semana, meta de 30 entregas, dinâmica de fim de mês: tudo isso é bem-vindo, mas some sem aviso quando o aplicativo muda a regra. Se o seu orçamento depende de bater promoção toda semana, ele está apoiado em algo que não é seu. Monte o planejamento em cima do ganho base — o que você faz num dia comum, sem incentivo — e trate todo bônus como dinheiro extra, destinado à reserva, à quitação de dívida ou à troca do veículo. Assim, quando a campanha acabar, muda o ritmo de poupança, não a sua capacidade de pagar as contas.',
    acao: 'Lance bônus e gorjeta em campos separados para enxergar quanto do seu ganho é base e quanto é extra.',
  },
];
