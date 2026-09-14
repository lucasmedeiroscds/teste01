# Conquista & Capital

Jogo de tabuleiro **multiplayer** que roda no navegador (PC e celular) em cima de um
**mapa-múndi real** com as **60 maiores economias do mundo**. Mistura a conquista
territorial do **War** (tropas, fronteiras, dados de combate) com a economia do
**Banco Imobiliário** (comprar países, cobrar tributo, construir, pegar empréstimo, falir).

Tempo real via WebSocket, com **servidor autoritativo**: o navegador só desenha o estado
e envia ações — nenhuma regra (nem a rolagem de dado) roda no cliente.

## Como rodar

```bash
cd conquista
npm install        # instala so o que o servidor precisa
npm start          # http://localhost:3000
```

Para rodar os testes, instale também as ferramentas de desenvolvimento:
`npm run install:dev && npm test`.

Um jogador cria a sala, os outros entram com o código de 4 letras ou pelo link do convite.
De 2 a 6 jogadores por sala.

## Classes

Cada jogador escolhe uma classe no lobby, e cada classe tem uma habilidade:

| Classe | Habilidade | Efeito |
| --- | --- | --- |
| Empresário | **Lavei, sumi** | Paga 10% a menos em todo imposto cobrado pelo banco. |
| Político | **Meu pedaço** | A cada 4 rodadas recebe 10% do próprio patrimônio. |
| Figura religiosa | **Dízimo** | A cada 8 rodadas recolhe 10% do patrimônio de cada adversário (limitado ao caixa de cada um). |
| Laranjão | **Testa de ferro** | +1 no dado sempre que invade um território alheio. |

## Jogar sozinho (ou com a mesa incompleta)

No lobby o anfitrião escolhe **quantos bots** entram na partida (até completar 6
participantes). Com 1 humano + 1 bot já dá para começar. Os bots jogam pelo mesmo caminho que
um humano — rolam o dado, andam, compram, constroem, posicionam tropas, invadem, pegam
empréstimo — uma ação a cada 0,7s para dar para acompanhar. Eles também recebem missão
secreta e podem vencer.

## Missões secretas

No início da partida cada jogador recebe **uma das 50 missões** (secretas: o servidor manda
o estado personalizado para cada um, ninguém vê a carta do vizinho). A mesma carta traz
**dois continentes sorteados**, e o sorteio só aceita pares cujo tamanho somado fique entre
8 e 16 países, para os objetivos ficarem comparáveis.

**A partida acaba quando alguém cumpre a própria missão ou domina esses dois continentes.**
No fim, o anfitrião escolhe entre **jogar de novo com a mesma mesa** ou **voltar ao lobby**.
Ficar sem nenhum país elimina o jogador; se sobrar só um, ele vence. Como rede de segurança,
na rodada 40 vence o maior patrimônio.

## Cartas de evento

Uma vez a cada janela de **20 rodadas** — em uma rodada sorteada dentro da janela — **todos**
compram uma carta de evento: 40 cartas, metade a favor, metade contra, todas com o mesmo
humor ácido ("Pacote de estímulo", "CPI instalada", "Offshore descoberta (por você)",
"Sanções ao vizinho"). Os efeitos vão de ouro e tropas a perdão de dívida, isenção de
imposto, indústria de brinde e modificador no dado de invasão.

## O mapa

- As **60 maiores economias** (PIB nominal, ordem aproximada do ranking do FMI) desenhadas
  em SVG a partir do Natural Earth. Só esses 60 países existem no jogo.
- O **ouro por rodada** de cada país vem da posição no ranking de produtividade, numa escala
  linear: 1º lugar (Estados Unidos) = **400/rodada**, 60º lugar (Equador) = **100/rodada**.
- O preço de compra é **5× a renda por rodada** (o 1º do ranking custa 2.000, o 60º custa 500).
- **Todos os 176 países do mundo** aparecem desenhados; os 116 que estão fora da partida ficam
  como cenário apagado, sem dono e sem clique.
- As **fronteiras** são as reais (incluindo corredores por países fora do jogo), mais rotas
  marítimas para ilhas e travessias curtas. O mapa é um grafo conexo: dá para chegar a
  qualquer país a partir de qualquer outro.

## Como se joga

- **Começo:** cada jogador recebe um país aleatório, 1.000 de ouro e 5 tropas nele.
- **Início do turno:** você arrecada o ouro dos seus países e das suas indústrias, mais
  tropas de reforço.
- **Dado:** role 1d6 e ande esse tanto de países pelas fronteiras — você escolhe o caminho,
  país por país, e pode parar antes de gastar todos os passos.
- **Onde você parar:**
  - país **sem dono** → pode comprar;
  - país **seu** → pode construir;
  - país **inimigo** → paga o **tributo** ou **declara guerra**.
- **Vender:** qualquer país seu (menos o último) pode ser vendido **ao banco por 70%** do que
  você investiu nele, ou **oferecido a outro jogador** pelo preço que vocês combinarem — a
  proposta fica de pé por 3 rodadas e quem aceita herda metade das tropas.
- **Indústrias:** pequena custa **230** e rende **+35/rodada**; grande custa **500** e rende
  **+75/rodada**. Cada país aceita no máximo **3 indústrias no total** (e no máximo 2 grandes).
  Cada indústria cobra **20% do que rende em manutenção por rodada** (pequena −7, grande −15),
  então a renda que aparece no painel é sempre a líquida. Indústrias também aumentam o tributo.
- **Tropas (geração do War):** no início do turno você recebe `países / 2` (mínimo 3) mais o
  bônus de cada continente completo, e distribui a reserva onde quiser.
- **Guerra (dado de 12):** a qualquer momento do seu turno, ataque a partir de um país seu com
  2+ tropas contra um vizinho inimigo. Cada lado rola **1d12** e o maior número leva o país —
  **empate favorece o defensor**. Quem vence leva o território com as indústrias e marcha com
  metade das tropas da origem; quem perde o ataque perde 1 tropa. O laranjão soma +1, e cartas
  de evento podem somar ou tirar mais.
- **Tributo:** `renda/4 + 30 por indústria pequena + 60 por grande + 10 por tropa`.
- **Vitória:** cumprir a missão secreta, dominar os dois continentes da carta, ser o último em
  pé — ou, na rodada 40, ter o maior patrimônio.

## Banco e economia

| Quando | O que acontece |
| --- | --- |
| A cada **2 rodadas** | Inflação: todos perdem **2% do caixa**. |
| A cada **13 rodadas** | Imposto: alíquota **progressiva pelo patrimônio** (10% até 5.000; 15% até 15.000; 20% até 40.000; 25% até 100.000; 30% acima disso), cobrada sobre o caixa. O empresário paga 10% a menos. |
| Toda rodada | Manutenção das indústrias: 20% do que cada uma rende. |
| A cada **4 rodadas** | *Meu pedaço*: político recebe 10% do próprio patrimônio. |
| A cada **8 rodadas** | *Dízimo*: figura religiosa recolhe 10% do patrimônio dos outros. |
| 1× a cada **20 rodadas** | Carta de evento para todo mundo, em rodada sorteada. |
| A partir da **rodada 5** | Empréstimos: teto de **600**, **um por vez**, **30% de juros** na contratação, pagos em **10 parcelas** (uma por rodada). |

### O banco e o calote

O empréstimo entra parcelado: você recebe o valor na hora e o banco cobra uma parcela por
rodada, automaticamente. Dá para **escolher não pagar** (botão "Dar o calote") — nesse caso o
saldo devedor **sobe 2% por rodada**. Passando de **10 rodadas** com dívida aberta, o banco
**apreende indústrias** proporcionais ao valor devido (as grandes primeiro), abatendo o que
foi tomado da dívida. Ficar sem caixa na hora da parcela conta como calote.

Quem não consegue pagar um tributo quebra e entrega os países ao credor.

O teto de indústrias por país fica em `RULES.maxFactoriesPerCountry`.

Decisões que o enunciado não fechava, todas configuráveis em `src/game.js` (objeto `RULES`):
o imposto é cobrado **sobre o caixa** com alíquota vinda da faixa de patrimônio (cobrar sobre o
patrimônio levaria à falência quem tem tudo investido); o empréstimo cobra juros (20% na
contratação, 10% sobre o saldo a cada 5 rodadas); a manutenção das indústrias é 20% da renda
delas; e as indústrias deixaram de dar bônus de defesa, já que o combate agora é um duelo de
1d12 puro.

## Estrutura

```
conquista/
├── server.js            # Express + Socket.IO: salas, classes, reconexão, chat
├── src/countries.js     # As 60 economias, continentes, ranking, renda/rodada e rotas marítimas
├── src/missions.js      # As 50 missões secretas (texto + verificação automática)
├── src/cards.js         # As 40 cartas de evento e seus efeitos
├── src/bot.js           # Politica dos bots (usa as mesmas ações de um jogador)
├── src/map.js           # Carrega o mapa gerado
├── src/game.js          # Motor de regras puro: dado, movimento, economia, guerra, vitória
├── tools/build-map.mjs  # Gera public/data/world.json (SVG + fronteiras) do Natural Earth
├── public/              # Cliente: mapa SVG com zoom/arrasto, painéis e abas
└── tests/               # node:test — regras, salas e um teste de ponta a ponta
```

Para regenerar o mapa depois de mexer na lista de países:

```bash
node tools/build-map.mjs
```

## Testes

```bash
npm test          # regras do jogo + fluxo de salas (rápido, sem navegador)
npm run test:e2e  # dois navegadores (desktop + iPhone) na mesma partida (Playwright)
```

O teste de ponta a ponta abre duas sessões reais, escolhe classes, inicia a partida, rola o
dado, anda clicando num país do mapa, abre a ficha de um país e confere que o mapa cabe na
tela do celular sem rolagem lateral.

## Detalhes de implementação

- **Servidor autoritativo:** `src/game.js` não faz I/O e recebe o gerador de números
  aleatórios por parâmetro, o que deixa dados e combate testáveis de forma determinística.
- **Missão é segredo:** o estado é serializado por jogador (`publicState(state, viewerId)`) e o
  servidor envia um pacote diferente para cada socket; as missões e cartas alheias só aparecem
  quando a partida termina.
- **Mapa pré-processado:** as geometrias são projetadas (Natural Earth 1) em tempo de build,
  então o cliente só carrega um JSON de ~74 KB com os contornos e as fronteiras — nada de
  bibliotecas de mapa no navegador.
- **Reconexão:** cada jogador guarda `playerId` + token no `localStorage`; caiu ou recarregou,
  volta para a mesma partida. No lobby a vaga fica reservada por 30s.
- **O mapa conta a história:** a cor do país satura e a borda engrossa conforme a **ocupação
  militar** (tropas), e cada **indústria** vira um prédio desenhado sobre o país (as grandes
  são maiores). Afastado, cada país vira um ponto que cresce com a guarnição.
- **Invasão dá para ver:** ao atacar, sai uma seta animada da origem até o alvo, um pulso no
  país invadido e uma faixa no topo do mapa com os dois dados e o resultado — todo mundo na
  sala vê, não só quem atacou.
- **Janelas do próprio jogo:** empréstimo e venda usam o diálogo do jogo (com o teto de 600
  no próprio controle deslizante), não o `prompt()` do navegador.
- **Mobile:** mapa com arrastar, pinça e botões de zoom, painel em abas, alvos de toque
  grandes e `safe-area-inset`. No desktop vira duas colunas com o mapa ocupando a altura da tela.
- **Equilíbrio medido:** `tests/bot.test.mjs` joga partidas inteiras só com bots; os limiares
  das missões foram calibrados com essas simulações para a partida durar ~25 rodadas em média
  (antes do ajuste, algumas terminavam na rodada 6).

## Publicação

O jogo precisa de um processo Node rodando com WebSocket — não funciona em hospedagem
estática (GitHub Pages) nem em funções serverless (Vercel), onde não há conexão persistente
nem memória compartilhada entre requisições. O passo a passo, incluindo o que seria preciso
mudar para rodar no Vercel, está em [DEPLOY.md](DEPLOY.md). O caminho mais curto é o
`render.yaml` na raiz do repositório: **New → Blueprint** no Render apontando para este
repositório (depois que o código estiver na `main`).
