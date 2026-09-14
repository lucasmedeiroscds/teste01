// Cartas de evento. Uma vez em cada janela de 20 rodadas (a rodada exata e sorteada),
// todo mundo compra uma carta: pode ser bencao ou desgraca. O texto e sarcastico; o
// efeito e mecanico e resolvido pelo motor (veja applyCard em game.js).
//
// Efeitos possiveis:
//   gold            ouro direto (+/-)
//   goldPct         percentual do caixa (+/-)
//   worthPct        percentual do patrimonio (+/-), pago/recebido do banco
//   troops          tropas na reserva (+/-)
//   troopsCountry   tropas colocadas num pais seu (o de maior renda)
//   loseTroops      tropas perdidas num pais seu (o de mais tropas)
//   factory         ganha uma industria pequena de graca (respeita o teto do pais)
//   loseFactory     perde uma industria
//   forgiveLoan     divida com o banco perdoada
//   debt            aumenta a divida (ou cria uma)
//   diceBonus       modificador no dado de invasao por N rodadas ({ bonus, rounds })
//   taxFree         isento do proximo imposto do banco
//   stealEach       tira ouro de cada adversario
//   payEach         paga ouro a cada adversario

export const EVENT_CARDS = [
  { id: 'e01', tipo: 'buff', titulo: 'Pacote de estimulo', texto: 'O banco central imprime dinheiro e chama de "liquidez". Receba 600.', gold: 600 },
  { id: 'e02', tipo: 'buff', titulo: 'Leilao de privatizacao', texto: 'Voce vendeu uma estatal para voce mesmo. Receba 450.', gold: 450 },
  { id: 'e03', tipo: 'buff', titulo: 'Ajuda humanitaria (com juros)', texto: 'Doacao internacional cai na conta errada: a sua. Receba 350.', gold: 350 },
  { id: 'e04', tipo: 'buff', titulo: 'Boom das commodities', texto: 'Descobriram algo caro embaixo do seu quintal. Receba 12% do caixa.', goldPct: 0.12 },
  { id: 'e05', tipo: 'buff', titulo: 'Anistia fiscal', texto: 'Seus impostos atrasados viraram "acordo de conformidade". Divida perdoada.', forgiveLoan: true },
  { id: 'e06', tipo: 'buff', titulo: 'Emenda do relator', texto: 'Ninguem sabe quem pediu, mas a obra saiu. Ganhe uma industria pequena.', factory: 'small' },
  { id: 'e07', tipo: 'buff', titulo: 'Servico militar obrigatorio', texto: 'Patriotismo compulsorio rende 4 tropas na reserva.', troops: 4 },
  { id: 'e08', tipo: 'buff', titulo: 'Exercicio militar conjunto', texto: 'Aliados "de passagem" deixam 3 tropas no seu melhor pais.', troopsCountry: 3 },
  { id: 'e09', tipo: 'buff', titulo: 'Assessoria de imprensa', texto: 'Sua invasao virou "operacao especial". +2 no dado por 2 rodadas.', diceBonus: { bonus: 2, rounds: 2 } },
  { id: 'e10', tipo: 'buff', titulo: 'Lobby bem pago', texto: 'O relatorio saiu a seu favor. Isento do proximo imposto.', taxFree: true },
  { id: 'e11', tipo: 'buff', titulo: 'Offshore descoberta (por voce)', texto: 'Reencontrou seu proprio dinheiro nas Ilhas. Receba 500.', gold: 500 },
  { id: 'e12', tipo: 'buff', titulo: 'Sancoes ao vizinho', texto: 'O embargo alheio virou seu mercado. Tire 120 de cada adversario.', stealEach: 120 },
  { id: 'e13', tipo: 'buff', titulo: 'Cupula do clima', texto: 'Voce prometeu metas para 2200. Receba 400 de credito de carbono.', gold: 400 },
  { id: 'e14', tipo: 'buff', titulo: 'Startup unicornio', texto: 'Um aplicativo que nao lucra vale bilhoes. Receba 10% do patrimonio.', worthPct: 0.1 },
  { id: 'e15', tipo: 'buff', titulo: 'Reforma da previdencia', texto: 'Todo mundo trabalha ate morrer, o caixa agradece. Receba 350.', gold: 350 },
  { id: 'e16', tipo: 'buff', titulo: 'Base militar "temporaria"', texto: 'Temporaria ha 40 anos. Ganhe 2 tropas e 200 de aluguel.', troops: 2, gold: 200 },
  { id: 'e17', tipo: 'buff', titulo: 'Acordo bilateral', texto: 'Assinado as pressas, lido por ninguem. Receba 300 e 2 tropas.', gold: 300, troops: 2 },
  { id: 'e18', tipo: 'buff', titulo: 'Missao de paz', texto: 'Paz armada, mas paz. Coloque 4 tropas no seu melhor pais.', troopsCountry: 4 },
  { id: 'e19', tipo: 'buff', titulo: 'Marketing de guerra', texto: 'A opiniao publica comprou a narrativa. +1 no dado por 3 rodadas.', diceBonus: { bonus: 1, rounds: 3 } },
  { id: 'e20', tipo: 'buff', titulo: 'Perdao do FMI', texto: 'Perdoaram sua divida em troca de "reformas". Divida zerada e 150.', forgiveLoan: true, gold: 150 },
  { id: 'e21', tipo: 'debuff', titulo: 'CPI instalada', texto: 'Sete meses de sessoes e nenhuma conclusao. Pague 400.', gold: -400 },
  { id: 'e22', tipo: 'debuff', titulo: 'Crise cambial', texto: 'Sua moeda virou souvenir. Perca 15% do caixa.', goldPct: -0.15 },
  { id: 'e23', tipo: 'debuff', titulo: 'Fuga de capitais', texto: 'O dinheiro saiu antes de voce acordar. Perca 12% do caixa.', goldPct: -0.12 },
  { id: 'e24', tipo: 'debuff', titulo: 'Greve geral', texto: 'Ninguem trabalha, mas a folha de pagamento continua. Pague 350.', gold: -350 },
  { id: 'e25', tipo: 'debuff', titulo: 'Escandalo de corrupcao', texto: 'Pego no aeroporto com a mala. Pague 8% do patrimonio.', worthPct: -0.08 },
  { id: 'e26', tipo: 'debuff', titulo: 'Sancoes internacionais', texto: 'Agora e voce no embargo. Pague 100 a cada adversario.', payEach: 100 },
  { id: 'e27', tipo: 'debuff', titulo: 'Desercao em massa', texto: 'O soldo atrasou. Perca 3 tropas do seu maior exercito.', loseTroops: 3 },
  { id: 'e28', tipo: 'debuff', titulo: 'Sucateamento', texto: 'Manutencao? Nunca ouvi falar. Perca uma industria.', loseFactory: true },
  { id: 'e29', tipo: 'debuff', titulo: 'Emprestimo predatorio', texto: 'Assinou sem ler a letra miuda. Sua divida cresce 400.', debt: 400 },
  { id: 'e30', tipo: 'debuff', titulo: 'Vazamento de documentos', texto: 'Seus planos estao no jornal. -1 no dado por 3 rodadas.', diceBonus: { bonus: -1, rounds: 3 } },
  { id: 'e31', tipo: 'debuff', titulo: 'Pandemia de burocracia', texto: 'Tres carimbos para cada decisao. Perca 10% do caixa.', goldPct: -0.1 },
  { id: 'e32', tipo: 'debuff', titulo: 'Auditoria surpresa', texto: 'O auditor era honesto. Pague 500.', gold: -500 },
  { id: 'e33', tipo: 'debuff', titulo: 'Apagao', texto: 'A privatizacao deu certo, menos a luz. Pague 300 e perca 1 tropa.', gold: -300, loseTroops: 1 },
  { id: 'e34', tipo: 'debuff', titulo: 'Onda de protestos', texto: 'Panela e cartaz derrubam o PIB. Perca 9% do caixa.', goldPct: -0.09 },
  { id: 'e35', tipo: 'debuff', titulo: 'Golpe frustrado', texto: 'Voce descobriu quem eram seus amigos. Perca 2 tropas e 200.', loseTroops: 2, gold: -200 },
  { id: 'e36', tipo: 'debuff', titulo: 'Reforma tributaria', texto: 'Simplificaram tanto que ninguem entendeu. Pague 6% do patrimonio.', worthPct: -0.06 },
  { id: 'e37', tipo: 'debuff', titulo: 'Investigacao da imprensa', texto: 'Um jornalista insistente. Pague 250 de "assessoria".', gold: -250 },
  { id: 'e38', tipo: 'debuff', titulo: 'Recall de tanques', texto: 'O fabricante esqueceu um parafuso. Perca 2 tropas.', loseTroops: 2 },
  { id: 'e39', tipo: 'debuff', titulo: 'Cortes na educacao', texto: 'Economia agora, mao de obra nunca. Perca uma industria e ganhe 200.', loseFactory: true, gold: 200 },
  { id: 'e40', tipo: 'debuff', titulo: 'Tarifaco do vizinho', texto: 'Livre mercado, exceto quando incomoda. Perca 11% do caixa.', goldPct: -0.11 },
];

export const CARD_BY_ID = new Map(EVENT_CARDS.map((c) => [c.id, c]));
