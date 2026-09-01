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

## O que o app faz para se explicar sozinho

Ninguém lê manual de aplicativo. Estas quatro coisas existem para o Giro ser
entendido de relance:

**Dados de exemplo com um toque.** Quem abre pela primeira vez vê zeros — e para
descobrir o que o app faz, precisaria antes digitar. O botão do estado vazio
enche a tela com um mês fictício de trabalho: gráficos, custos, provisões,
tudo funcionando. Enquanto o exemplo está ligado há uma faixa fixa avisando, e o
seu primeiro lançamento de verdade apaga o exemplo inteiro antes de gravar, para
nunca haver número de brincadeira misturado com o seu.

**Comparação com o passado.** "R$ 187 na semana" não diz se foi bom. Ao lado do
número aparece a variação contra a referência certa — e a referência acompanha o
ciclo do período, não os dias corridos: hoje contra o mesmo dia da semana
passada, a semana contra a semana anterior, o mês contra o mesmo intervalo do
mês passado. Comparar terça-feira com domingo mostraria uma queda que é do
calendário, não sua. Sem base suficiente dos dois lados, nenhuma seta aparece;
e variação acima do dobro vira multiplicador (`3,5x`), porque `248%` obriga o
leitor a fazer conta.

**Leitura em português embaixo do número.** `R$ 0,49/km` não significa nada
sozinho; `Rodar 100 km custa R$ 48,72, mesmo sem receber nada` significa. Cada
cartão principal traz essa linha.

**Primeiros passos que se marcam sozinhos.** O estado vazio é uma lista de três
etapas que vão sendo riscadas conforme a pessoa configura os custos e lança o
primeiro dia.

## Movimento

A animação existe para explicar, não para enfeitar: o número sobe contando
porque é um acumulado, a barra cresce a partir da linha de base porque é dali
que ela é medida, a tela entra deslizando porque você mudou de lugar. Nada passa
de meio segundo, nada fica em laço, e tudo é desligado por completo em
`prefers-reduced-motion` — verificado em teste.

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

## Celular: Chrome, Firefox e Safari

O app foi testado em viewport de celular nos três motores que importam —
Chromium (Chrome Android), Gecko (Firefox Android) e WebKit (Safari iOS) — e
ajustado para as diferenças reais entre eles:

- **Safari.** `backdrop-filter` sem prefixo só existe a partir do Safari 18, e
  `color-mix()` a partir do 16.2. As barras superior e inferior por isso têm
  fundo sólido por padrão e só ficam translúcidas dentro de um `@supports` que
  exige as duas coisas — no iOS antigo elas continuam legíveis em vez de
  transparentes. `<select>` e campos de data recebem `appearance: none`, sem o
  que o iOS descarta borda, fundo e cantos arredondados.
- **Toque, nos três.** `:hover` gruda em tela de toque: o botão fica aceso
  depois do toque. Todo `:hover` está isolado em `@media (hover: hover) and
  (pointer: fine)` e no lugar dele o toque tem resposta em `:active`.
- **Carrossel.** No celular, um toque disparava `pointerenter` e o `pointerleave`
  podia nunca chegar — o cronômetro de 60 s congelava para sempre. Agora o gesto
  do toque é outro: segurar pausa, soltar volta a contar, e **arrastar para o
  lado troca de dica**. A pausa por foco só vale quando o foco veio do teclado
  (`:focus-visible`), senão tocar em "próxima" travaria o rodízio.
- **Tooltip dos gráficos.** Dependia de `pointermove`, então não existia no dedo.
  Agora abre no toque, acompanha o arrasto e se fecha sozinho — sem fechar no
  `pointerleave`, que no toque dispara logo depois do `pointerup`.
- **Alvos de toque.** Os pontinhos do carrossel eram 7×7 px; hoje têm 24 px de
  altura de área tocável com o ponto visual dentro, e ganham a linha inteira em
  tela estreita em vez de quebrar em duas fileiras.
- **Teclado do celular.** Com um campo em foco, a barra inferior sai da frente.
- **Alturas.** `100dvh` com `100%` de reserva, para a barra de endereço do
  Safari não cortar o rodapé.

APIs modernas usadas com alternativa: `ResizeObserver` (cai em `resize`),
`matchMedia.addEventListener` (cai em `addListener`, Safari ≤ 13) e
`Blob.text()` (cai em `FileReader`, Safari ≤ 13).

## Versão em arquivo único

```bash
npm i esbuild
node giro/tools/bundle.mjs          # minificado
node giro/tools/bundle.mjs --dev    # legível, para depurar
```

Gera `giro/dist/giro.html` — a aplicação inteira num HTML só, com CSS e
JavaScript embutidos, cerca de 138 KB (43 KB comprimido). Serve para hospedar
em qualquer lugar que aceite um arquivo solto, e é a única forma de abrir o app
direto do disco, já que sem servidor os módulos ES não carregam. O
`giro/dist/giro.body.html` é o mesmo conteúdo sem `<head>`, para plataformas que
fornecem o próprio.

## Testes

```bash
# funções puras (só Node, sem dependências)
node giro/tests/finance.test.mjs      # motor de cálculo
node giro/tests/util.test.mjs         # leitura de números digitados
node giro/tests/periodo.test.mjs      # janelas de período e comparação

# navegador de verdade
npm i -D playwright
npx playwright install chromium firefox webkit
npx playwright install-deps                 # Linux
python3 -m http.server 8899 &               # na raiz do repositório

node giro/tests/e2e.test.mjs                # fluxo completo, Chromium desktop
node giro/tests/interacao.test.mjs          # exemplo, comparação, animação, atalhos
node giro/tests/mobile.test.mjs             # celular nos três motores
node giro/tests/bundle.test.mjs             # o arquivo único bate com o modular
```

O teste ponta a ponta exercita o onboarding, o lançamento de turnos e
abastecimentos, os gráficos e seus tooltips, os três vereditos da calculadora de
corrida, o recálculo ao vivo dos custos, o carrossel (60 s, pausa, navegação,
reinício do cronômetro), a importação de CSV com auto-mapeamento, a persistência
após recarregar, os dois temas e a ausência de rolagem horizontal em 390 px.

O teste móvel roda em Chrome Android, Safari iOS e Firefox Android e cobre o que
está descrito na seção acima. O de empacotamento confere que os três motores
produzem exatamente os mesmos números a partir do arquivo único.

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
│       ├── demo.js              mês de exemplo, isolado dos dados reais
│       ├── anim.js              contagem de números e entradas curtas
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
├── tools/
│   └── bundle.mjs               gera a versão em arquivo único
├── dist/                        saída do empacotador
└── tests/
    ├── finance.test.mjs         motor de cálculo
    ├── util.test.mjs            leitura de números digitados
    ├── periodo.test.mjs         janelas de período e comparação
    ├── e2e.test.mjs             fluxo completo em Chromium
    ├── interacao.test.mjs       exemplo, comparação, animação, atalhos
    ├── mobile.test.mjs          celular nos três motores
    └── bundle.test.mjs          paridade do arquivo único
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
