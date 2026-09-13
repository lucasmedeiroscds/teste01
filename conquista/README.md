# Conquista & Capital

Jogo de tabuleiro **multiplayer** que roda no navegador (PC e celular) e mistura os dois
clássicos: a **conquista territorial do War** (tropas, fronteiras, dados de combate, bônus
por continente) com a **economia do Banco Imobiliário** (andar pelo tabuleiro, comprar
territórios, cobrar tributo, construir e falir).

Tudo em tempo real via WebSocket, com **servidor autoritativo**: o navegador só desenha o
estado e envia ações — nenhuma regra (nem a rolagem de dados) roda no cliente.

## Como rodar

```bash
cd conquista
npm install
npm start          # http://localhost:3000
```

Abra o endereço em dois navegadores (ou no celular, na mesma rede, usando o IP do micro).
Um jogador cria a sala, os outros entram com o código de 4 letras ou pelo link do convite.
De 2 a 6 comandantes por sala.

## O jogo em 1 minuto

O tabuleiro é um anel de **28 casas**: 4 casas especiais e **24 territórios** divididos em
**6 continentes** de 4 territórios.

| Fase | O que acontece |
| --- | --- |
| Início do turno | Você recebe dinheiro e tropas: base + por território + bônus de cada continente completo. |
| Dados | Role 2 dados e ande. Dupla joga de novo (3 duplas seguidas = motim, perde a vez). Passar pela Base Aliada dá $200 e 1 tropa. |
| Casa livre | Compre o território pelo preço da casa (entra com 1 tropa). |
| Casa sua | Construa uma **fortaleza** (até 3): dobra o tributo e dá bônus nos dados de defesa. |
| Casa inimiga | **Pague o tributo** ou **declare guerra**: ataque a partir de um território seu que faça fronteira com o alvo. |
| Quando quiser | Posicione a reserva em qualquer território seu e recrute tropas pagando $100 cada. |

**Combate (War):** o atacante rola até 3 dados (precisa deixar 1 tropa na origem), o defensor
até 2, cada fortaleza soma +1 nos dados do defensor (máx. +2). Compara-se o maior com o maior;
**empate favorece o defensor**. Zerando as tropas do defensor, o território muda de dono e as
tropas atacantes ocupam o lugar.

**Tributo (Banco Imobiliário):** `aluguel base × (1 + fortalezas) × 2 se o dono tiver o
continente inteiro + $15 por tropa no território`. Sem dinheiro para pagar, o devedor **fale**
e entrega todos os territórios ao credor.

**Casas especiais:** Base Aliada ($200 + 2 tropas), Quartel-General (3 tropas + um ataque
livre a partir de qualquer fronteira sua), Zona Neutra (2 tropas) e Conselho de Guerra
(carta de evento — dinheiro, tropas, impostos...).

**Vitória:** controlar **15 dos 24 territórios**, ser o último comandante em pé, ou ter o
maior patrimônio ao fim da rodada 40.

## Estrutura

```
conquista/
├── server.js          # Express + Socket.IO: salas, reconexão, chat, broadcast do estado
├── src/board.js       # Tabuleiro: casas, continentes, fronteiras e cartas
├── src/game.js        # Motor de regras puro (sem I/O) — dados, economia, combate, vitória
├── public/            # Cliente: HTML, CSS responsivo e a lógica de tela
└── tests/             # node:test — regras, servidor e um teste de ponta a ponta
```

## Testes

```bash
npm test        # regras do jogo + fluxo de salas (rápido, sem navegador)
npm run test:e2e  # dois navegadores (desktop + iPhone) jogando na mesma sala (Playwright)
```

O teste de ponta a ponta abre duas sessões reais, cria a sala, entra pelo link, inicia a
partida, rola os dados e confere que o tabuleiro cabe na tela do celular sem rolagem lateral.

## Detalhes de implementação

- **Servidor autoritativo:** `src/game.js` não faz I/O e recebe o gerador de números
  aleatórios por parâmetro, o que deixa todo o combate testável de forma determinística.
- **Reconexão:** cada jogador guarda `playerId` + token no `localStorage`; caiu a conexão ou
  recarregou a página, ele volta para a mesma sala e para a mesma partida. No lobby a vaga
  fica reservada por 30s.
- **Jogador ausente:** o anfitrião pode remover da partida quem está offline na vez dele.
- **Mobile:** layout em coluna (tabuleiro + abas Ações/Jogadores/Histórico/Chat), alvos de
  toque grandes, `safe-area-inset` para o notch e zero rolagem horizontal. No desktop vira
  duas colunas com o tabuleiro ocupando a altura da tela.

## Publicação

O jogo precisa de um processo Node rodando (não funciona em hospedagem estática como o
GitHub Pages). Qualquer serviço com suporte a Node + WebSocket serve: basta `npm install &&
npm start` e respeitar a variável `PORT`.
