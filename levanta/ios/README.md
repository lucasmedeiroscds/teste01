# Levanta — iOS

O mesmo app do Android, com o motor de contagem traduzido para Swift.

## Gerar o projeto e rodar

```bash
brew install xcodegen
xcodegen generate          # cria Levanta.xcodeproj a partir do project.yml
open Levanta.xcodeproj
```

Testes do motor, sem aparelho:

```bash
xcodebuild test -scheme Levanta -destination 'platform=iOS Simulator,name=iPhone 15'
```

Falta um arquivo de som `alarme.caf` (ou `.m4a`) dentro de `Levanta/` — qualquer
som de despertador em laço serve. Sem ele o app abre, agenda e conta, mas não
toca nada.

## O limite honesto do iOS

O iOS **não** deixa um app de terceiros executar código na hora marcada com o
aparelho bloqueado. Só o Relógio da Apple tem esse privilégio. O que existe para
todo mundo é a notificação local, e ela toca no máximo **30 segundos**.

Este app faz o que dá para fazer dentro da regra:

| Situação | O que acontece |
|---|---|
| App aberto na frente | Toca em laço, sem limite, e continua durante o exercício. |
| App fechado ou tela bloqueada | Corrente de 10 notificações espaçadas de 30 s — na prática, uns 5 minutos de insistência. Tocar em qualquer uma abre o app e o alarme de verdade começa. |
| Silencioso / Foco ativo | Só toca se o app tiver a autorização de **alerta crítico** da Apple. Ela é pedida caso a caso em [developer.apple.com/contact/request/notifications-critical-alerts](https://developer.apple.com/contact/request/notifications-critical-alerts); sem ela o alarme respeita o silencioso. |

O modo de fundo `audio`, declarado no `project.yml`, é o que permite ao som
continuar com a tela apagada depois que o app já está tocando.

**Consequência prática:** no Android o alarme é confiável como o do sistema; no
iOS ele é confiável com o app aberto e "razoável" com ele fechado. Vale dizer
isso ao usuário na primeira execução em vez de deixá-lo descobrir dormindo
demais.
