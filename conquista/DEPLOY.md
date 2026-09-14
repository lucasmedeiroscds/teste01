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

O `render.yaml` na **raiz do repositório** já descreve o serviço: `rootDir: conquista`, build
`npm install --omit=dev`, start `npm start`, health check em `/healthz`, Node 22, plano free.

### Opção A — depois de juntar o código na `main` (mais simples)

1. Faça o merge da PR do jogo na `main`.
2. Entre em <https://render.com> com a conta do GitHub.
3. **New → Blueprint**, escolha este repositório e confirme. O Render lê o `render.yaml`
   sozinho e cria o serviço.

### Opção B — sem esperar o merge, direto do branch

O Blueprint lê o `render.yaml` do branch padrão do repositório, então antes do merge use o
caminho manual:

1. **New → Web Service** e conecte este repositório.
2. Preencha:
   - **Branch**: `claude/multiplayer-board-game-gizo7o`
   - **Root Directory**: `conquista`
   - **Build Command**: `npm install --omit=dev`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/healthz`
   - **Instance Type**: Free
3. Criar. Em poucos minutos sai uma URL `https://<nome>.onrender.com`.

Não é preciso configurar `PORT`: o servidor usa a porta que o Render injeta.

O plano gratuito hiberna depois de 15 minutos parado: a primeira visita demora ~30s para
acordar o serviço. Partidas em andamento se perdem se ele hibernar, porque o estado das salas
vive na memória do processo.

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
