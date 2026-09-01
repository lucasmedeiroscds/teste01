# Giro — gestão financeira para quem roda

Site para entregadores e motoristas de aplicativo descobrirem **quanto sobra de
verdade** de cada dia rodado. Estático, sem build, sem back-end, sem cadastro:
abre no navegador e funciona.

Público: entregador de moto ou bike, motorista de app, quem faz frete e mototáxi.
Tudo em português do Brasil, pensado para ser preenchido no celular, com uma mão,
no fim do turno.

---

## A pergunta das APIs — resposta curta

> **Nenhuma das grandes plataformas de entrega e transporte que operam no Brasil
> publica hoje uma API que permita a um entregador ou motorista autorizar um app
> de terceiros a ler os PRÓPRIOS ganhos.**

As APIs públicas existem, mas atendem o outro lado do balcão. Levantamento por
plataforma:

| Plataforma | O que a API pública cobre | Para quem roda |
|---|---|---|
| **iFood** | Portal do Desenvolvedor com APIs de Merchant, Catálogo, Pedido e Financeiro para **estabelecimentos**; integração para operadores logísticos (empresas). | Sem escopo de "entregador lê os próprios ganhos". |
| **Uber / Uber Eats** | Rides, Eats (lado do restaurante), Uber Direct, Uber for Business. | A antiga **Driver API** (escopos `partner.trips` / `partner.payments`), que permitia exatamente isso, foi **descontinuada** e não está aberta. Em compensação, o motorista consegue **baixar o próprio extrato em CSV** no portal de parceiros. |
| **99** | Integrações de 99 Empresas (contratos corporativos). | Nada para o motorista pessoa física. |
| **Rappi** | Rappi Partners (lojas) e Rappi Entregas para empresas. | Sem acesso programático aos ganhos do entregador. |
| **Loggi** | API de envios para embarcadores. | Nada para o entregador parceiro. |

**Consequência de projeto.** Prometer "conectar sua conta do iFood" seria mentira,
então o Giro não tem esse botão. Ele faz o que dá para fazer bem:

1. **Importa extrato em CSV** — auto-detecta as colunas, deixa você corrigir o
   mapeamento e mostra uma prévia antes de gravar. Serve para o extrato da Uber,
   para o extrato do banco e para qualquer planilha própria.
2. **Lançamento manual rápido** — uma linha por dia, com prévia do líquido ao vivo
   enquanto você digita.
3. **Porta aberta para o futuro** — o contrato `ConectorAdapter` está escrito em
   [`assets/js/connectors/registry.js`](assets/js/connectors/registry.js). Se
   alguma plataforma abrir a API, é só implementar a interface.

**Open Finance Brasil** é o único caminho hoje capaz de automatizar de verdade:
os repasses caem na conta bancária e, com consentimento do titular, uma
instituição participante lê esses lançamentos por API oficial e regulada. Só que
consumir essas APIs exige ser instituição autorizada pelo Banco Central — o que
um site que roda no navegador do usuário não pode ser. Fica registrado como
direção para uma versão com servidor, não como promessa.

---

## O que o site faz

**Painel** — resultado do dia, da semana ou do mês: quanto sobrou, R$ por hora e
por km líquidos, custo por km, ponto de equilíbrio diário, gráfico de resultado
por dia, de onde veio o dinheiro por aplicativo, para onde foi cada real, e
quanto separar antes de gastar.

**Lançar** — entrada rápida do turno (bruto, gorjeta, km, tempo, corridas, gastos)
com prévia do líquido ao vivo. Aba de abastecimento que mede o **km/L real** pelo
método do tanque cheio, em vez de aceitar o número do manual.

**Vale a pena?** — a calculadora que decide uma corrida antes de aceitar. Entra
valor oferecido, km até a coleta, km da entrega, volta e tempo; sai o líquido, o
R$/hora, o R$/km e **o valor mínimo que a corrida teria que pagar**. Inclui uma
tabela de regra de bolso para decidir sem abrir o app.

**Custos** — veículo, combustível, custos fixos mensais e a tabela de manutenção
por quilômetro. É a página que faz todo o resto dizer a verdade.

**Relatórios** — fechamento do mês em formato de demonstrativo, semana a semana
com **mediana** (não média), desempenho por aplicativo com a margem em cada km, e
exportação em CSV.

**Conexões** — o quadro de APIs acima, o importador de CSV e o backup dos dados.

**Dicas** — carrossel com 16 dicas de gestão financeira, **uma por vez, 60
segundos de tela cada**, mais o texto completo de todas para ler de uma vez.

---

## O modelo de custo

Três camadas, porque misturá-las é o que faz o entregador achar que ganha bem:

```
1. Custo variável por km   combustível + manutenção + depreciação
                           combustível/km = preço do litro ÷ km por litro
                           manutenção/km  = Σ (custo do item ÷ intervalo em km)
                           depreciação/km = (valor − valor na troca) ÷ km de vida útil

2. Custo fixo              corre no calendário, você rodando ou não

3. Gastos do turno         alimentação, pedágio, estacionamento, lavagem
```

O custo fixo é alocado de **duas maneiras diferentes, de propósito**:

- **no resultado** (quanto sobrou de verdade) → pelo calendário do período:
  `custo fixo mensal × dias corridos ÷ 30,44`. Custo fixo não espera você
  trabalhar para acontecer.
- **na meta e na calculadora de corrida** → por dia trabalhado planejado:
  `custo fixo mensal ÷ dias que você pretende rodar`. É assim que se decide se
  uma corrida paga a própria fatia.

**Provisões.** Manutenção e depreciação saem do **quilômetro rodado**, não de um
percentual chutado — é a conta precisa. Reserva de emergência, descanso e imposto
saem do líquido, por percentual configurável. A ponte que fecha a conta:

```
caixa em conta = bruto − combustível − custos fixos − gastos do turno
livre para usar = caixa em conta − (manutenção + troca + emergência + descanso + imposto)
```

---

## Rodar localmente

O site usa módulos ES nativos, então precisa ser servido por HTTP —
abrir o `index.html` direto pelo `file://` não funciona.

```bash
# na raiz do repositório
python3 -m http.server 8899
# depois: http://localhost:8899/giro/
```

Em produção é só publicar a pasta: não há passo de build, dependência ou
processo de servidor.

## Testes

```bash
# motor de cálculo e leitura de números (só Node, sem dependências)
node giro/tests/finance.test.mjs
node giro/tests/util.test.mjs

# ponta a ponta num Chromium real
npm i -D playwright && npx playwright install chromium
python3 -m http.server 8899 &        # na raiz do repositório
node giro/tests/e2e.test.mjs         # gera capturas em ./shots
```

O teste ponta a ponta exercita o onboarding, o lançamento de turnos e
abastecimentos, os gráficos e seus tooltips, os três vereditos da calculadora de
corrida, o recálculo ao vivo dos custos, o carrossel (60 s, pausa, navegação,
reinício do cronômetro), a importação de CSV com auto-mapeamento, a persistência
após recarregar, os dois temas e a ausência de rolagem horizontal em 390 px.

---

## Estrutura

```
giro/
├── index.html
├── assets/
│   ├── css/app.css              tokens, layout e componentes
│   └── js/
│       ├── app.js               casca, rotas, tema, primeira configuração
│       ├── store.js             estado + persistência em localStorage
│       ├── finance.js           motor de cálculo (funções puras)
│       ├── charts.js            gráficos em SVG, sem biblioteca
│       ├── carousel.js          carrossel de dicas, 60 s por dica
│       ├── tips.js              conteúdo das dicas
│       ├── periodo.js           recortes de hoje / semana / mês
│       ├── util.js              formatação pt-BR, datas, DOM, ícones
│       ├── connectors/
│       │   ├── registry.js      plataformas, status e o contrato ConectorAdapter
│       │   └── csv.js           leitor de CSV, auto-mapeamento e conversão
│       └── views/               painel, lancar, corrida, custos,
│                                relatorios, conexoes, dicas
└── tests/
    ├── finance.test.mjs
    └── e2e.test.mjs
```

## Dados e privacidade

Tudo fica no `localStorage` do navegador. Nada é enviado para servidor nenhum,
não há cadastro, login nem telemetria. O outro lado disso é que limpar os dados
do navegador ou trocar de aparelho leva o histórico junto — por isso a aba
Conexões tem backup em JSON e exportação em CSV.

## Acessibilidade e apresentação

Navegação por teclado em todo o app, foco visível, `aria-live` nas áreas que
mudam sozinhas, alvos de toque de no mínimo 44 px, e campos com `font-size: 16px`
para o iOS não dar zoom. O carrossel tem `aria-roledescription`, setas do teclado,
botão de pausa e respeita `prefers-reduced-motion`.

Tema claro e escuro, ambos desenhados (o escuro não é o claro invertido). A
paleta categórica dos gráficos foi validada para daltonismo — pior par adjacente
com ΔE 9,1 no claro e 8,4 no escuro (alvo ≥ 8) — e toda cor de identidade vem
acompanhada de legenda, rótulo direto e tabela equivalente, para que a informação
nunca dependa só de distinguir cores.

## Limites conhecidos

- Não existe integração automática com iFood, Uber, 99 ou Rappi, pelo motivo
  explicado acima. O importador de CSV e o lançamento manual são o caminho.
- O importador foi testado com CSV genérico e com o formato de extrato de
  corridas; extratos com layout muito fora do comum podem exigir ajustar o
  mapeamento de colunas na mão — a tela já existe para isso.
- Os valores de referência de manutenção e depreciação são pontos de partida,
  não verdade absoluta. Revise-os com as suas notas de posto e de oficina.
- As dicas são orientação geral de organização financeira. Para decisão
  tributária e previdenciária, confirme com um contador.
