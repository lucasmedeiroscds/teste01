# Como colocar no ar

O jogo é um servidor Node com **WebSocket** (Socket.IO): as salas vivem na memória do
processo e o estado é empurrado para os jogadores em tempo real. Isso decide onde ele roda.

## Vercel: o que não funciona (e por quê)

O Vercel executa **funções serverless**. Elas não aceitam conexão WebSocket e não compartilham
memória entre invocações — cada requisição pode cair numa instância diferente, e a instância
morre depois de responder. Publicar este código lá do jeito que está resulta em:

- o `socket.io` não consegue estabelecer a conexão (o upgrade para WebSocket é recusado);
- mesmo caindo para *long polling*, cada requisição acha um servidor sem nenhuma sala criada;
- os bots param, porque não existe processo vivo entre as jogadas para eles jogarem.

Para rodar no Vercel de verdade seria preciso **trocar o transporte**: substituir o Socket.IO
por chamadas HTTP com *polling*, guardar o estado das salas num banco externo (Vercel KV /
Upstash Redis) e avançar os bots de forma preguiçosa, a cada requisição de estado. É uma
reescrita da camada de rede — o motor de regras (`src/game.js`) não muda.

## Render (recomendado: WebSocket real, sem alterar o código)

1. Faça login em <https://render.com> com a conta do GitHub.
2. **New → Blueprint** e escolha este repositório (o arquivo `conquista/render.yaml` já está
   pronto: `rootDir` apontando para `conquista/`, build `npm install --omit=dev`, start
   `npm start`, health check em `/healthz`).
3. Confirme. Em poucos minutos sai uma URL `https://conquista-e-capital.onrender.com`.

O plano gratuito hiberna depois de 15 minutos parado: a primeira visita demora ~30s para
acordar o serviço. Partidas em andamento são perdidas se ele hibernar (o estado é em memória).

## Railway / Fly.io (mesma ideia)

Qualquer serviço que rode um processo Node longo serve. Basta apontar para a pasta `conquista`,
usar `npm install --omit=dev` como build, `npm start` como start e respeitar a variável `PORT`.

## Rodando na sua máquina

```bash
cd conquista
npm install --omit=dev
npm start
```

O terminal imprime o endereço local e o da rede (para abrir no celular no mesmo Wi-Fi).
