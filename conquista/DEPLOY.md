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
`npm install`, start `npm start`, health check em `/healthz`, Node 22, plano free.

> **Por que `npm install` simples basta:** o `conquista/.npmrc` fixa `omit=dev`, então nenhuma
> instalação no servidor puxa as dependências de desenvolvimento — em especial o **Playwright**,
> que baixaria centenas de MB de navegador e derruba o build no plano gratuito. Para rodar os
> testes na sua máquina, use `npm run install:dev` (ou `npm install --include=dev`).

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
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/healthz`
   - **Instance Type**: Free
3. Criar. Em poucos minutos sai uma URL `https://<nome>.onrender.com`.

Não é preciso configurar `PORT`: o servidor usa a porta que o Render injeta.

### Se o build falhar

| Erro no log do Render | O que é | Como resolver |
| --- | --- | --- |
| `npm error enoent Could not read package.json` | O build rodou na raiz do repositório, não na pasta do jogo | Já coberto: existe um `package.json` na raiz que instala e inicia o jogo sozinho. Se o erro persistir, confira **Root Directory** = `conquista` |
| `No render.yaml found` no Blueprint | O Blueprint lê o arquivo do **branch padrão** (`main`), e o código ainda está no branch da PR | Faça o merge da PR, ou use a Opção B (Web Service apontando para o branch) |
| Build trava ou falha baixando navegador (`playwright`, `Downloading Chromium`) | A instalação puxou as dependências de teste | Já coberto pelo `conquista/.npmrc` (`omit=dev`). Se ainda acontecer, adicione a variável de ambiente `NPM_CONFIG_OMIT=dev` no serviço |
| `Cannot find module 'express'` ao iniciar | O build não instalou as dependências | **Build Command** = `npm install` |
| `Exited with status 1` logo após "Build successful" | Comando de start errado | **Start Command** = `npm start` |

O repositório funciona nas duas configurações: com **Root Directory** `conquista` (o
recomendado) ou com ele vazio — nesse caso o `package.json` da raiz delega a instalação e o
start para a pasta do jogo.

O plano gratuito hiberna depois de 15 minutos parado: a primeira visita demora ~30s para
acordar o serviço. Partidas em andamento se perdem se ele hibernar, porque o estado das salas
vive na memória do processo.

## Railway / Fly.io (mesma ideia)

Qualquer serviço que rode um processo Node longo serve. Basta apontar para a pasta `conquista`,
usar `npm install --omit=dev` como build, `npm start` como start e respeitar a variável `PORT`.

## Rodando na sua máquina

```bash
cd conquista
npm install          # so o que o servidor precisa
npm start
```

Para rodar a suíte de testes (Playwright incluído): `npm run install:dev && npm test`.

O terminal imprime o endereço local e o da rede (para abrir no celular no mesmo Wi-Fi).
