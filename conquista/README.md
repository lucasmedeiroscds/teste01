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
npm install
npm start          # http://localhost:3000
```

Um jogador cria a sala, os outros entram com o código de 4 letras ou pelo link do convite.
De 2 a 6 jogadores por sala.

## Classes

Cada jogador escolhe uma classe no lobby, e cada classe tem uma habilidade:

| Classe | Habilidade | Efeito |
| --- | --- | --- |
| Empresário | **Lavei, sumi** | Paga 10% a menos em todo imposto cobrado pelo banco. |
| Político | **Meu pedaço** | A cada 4 rodadas recebe 10% do próprio patrimônio. |
| Figura religiosa | **Dízimo** | A cada 8 rodadas recolhe 10% do patrimônio de cada adversário (limitado ao caixa de cada um). |

## O mapa

- As **60 maiores economias** (PIB nominal, ordem aproximada do ranking do FMI) desenhadas
  em SVG a partir do Natural Earth. Só esses 60 países existem no jogo.
- O **ouro por rodada** de cada país vem da posição no ranking de produtividade, numa escala
  linear: 1º lugar (Estados Unidos) = **400/rodada**, 60º lugar (Equador) = **100/rodada**.
- O preço de compra é 3,2× a renda por rodada.
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
- **Indústrias:** pequena custa **230** e rende **+35/rodada**; grande custa **500** e rende
  **+75/rodada** (limite de 3 pequenas e 2 grandes por país). Também aumentam o tributo e
  dão bônus de defesa.
- **Guerra:** a qualquer momento do seu turno você ataca a partir de um país seu que faça
  fronteira com o alvo (deixando ao menos 1 tropa para trás). Atacante rola até 3 dados,
  defensor até 2, **empate favorece o defensor**. Zerando as tropas do defensor, o país e as
  indústrias mudam de dono.
- **Tributo:** `renda/4 + 30 por indústria pequena + 60 por grande + 10 por tropa`.
- **Vitória:** controlar **20 dos 60 países**, ser o último em pé, ou ter o maior patrimônio
  ao fim da rodada 40.

## Banco e economia

| Quando | O que acontece |
| --- | --- |
| A cada **2 rodadas** | Inflação: todos perdem **2% do caixa**. |
| A cada **13 rodadas** | Imposto: todos pagam **20% do caixa** ao banco (empresário paga 18%). |
| A cada **4 rodadas** | *Meu pedaço*: político recebe 10% do próprio patrimônio. |
| A cada **8 rodadas** | *Dízimo*: figura religiosa recolhe 10% do patrimônio dos outros. |
| A partir da **rodada 5** | Empréstimos: teto de **600**, **um por vez**, 20% de juros na contratação e mais 10% sobre o saldo devedor a cada 5 rodadas. |

Quem não consegue pagar um tributo quebra e entrega os países ao credor. Quem fica sem
países e sem caixa sai do jogo.

Duas decisões que o enunciado não fechava e que ficaram configuráveis em `src/game.js`
(objeto `RULES`): o imposto da rodada 13 foi implementado como **20% do caixa** (e não 20 de
ouro fixos), e o empréstimo cobra juros (20% na contratação, 10% sobre o saldo a cada 5
rodadas) porque o texto original não definia custo para o dinheiro do banco.

## Estrutura

```
conquista/
├── server.js            # Express + Socket.IO: salas, classes, reconexão, chat
├── src/countries.js     # As 60 economias, ranking, renda/rodada e rotas marítimas
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
- **Mapa pré-processado:** as geometrias são projetadas (Natural Earth 1) em tempo de build,
  então o cliente só carrega um JSON de ~74 KB com os contornos e as fronteiras — nada de
  bibliotecas de mapa no navegador.
- **Reconexão:** cada jogador guarda `playerId` + token no `localStorage`; caiu ou recarregou,
  volta para a mesma partida. No lobby a vaga fica reservada por 30s.
- **Mobile:** mapa com arrastar, pinça e botões de zoom, painel em abas, alvos de toque
  grandes e `safe-area-inset`. No desktop vira duas colunas com o mapa ocupando a altura da tela.

## Publicação

O jogo precisa de um processo Node rodando (não funciona em hospedagem estática como o
GitHub Pages). Qualquer serviço com Node + WebSocket serve: `npm install && npm start`,
respeitando a variável `PORT`.
