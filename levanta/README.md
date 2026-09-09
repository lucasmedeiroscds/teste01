# Levanta

Despertador que só desliga com exercício físico. Quando o alarme toca, a tela
normal aparece com soneca e desligar; ao tocar em **Desligar**, a câmera abre e
conta as repetições do exercício escolhido. O som só para quando a contagem
chega ao número configurado.

Nativo nas duas plataformas: Kotlin + Jetpack Compose no Android, Swift + SwiftUI
no iOS. Quatro exercícios: **agachamento, flexão de braço, polichinelo e
abdominal**.

Tudo roda no aparelho. Nenhum quadro de vídeo é gravado, salvo ou enviado a
lugar nenhum — a imagem entra no detector de pose e é descartada.

---

## Estado de cada parte

| | Android | iOS |
|---|---|---|
| Motor de contagem | ✅ 45 testes passando | ✅ mesmos casos, em XCTest |
| App compila | ✅ APK gerado, lint limpo | ⚠️ nunca compilado — exige Mac |
| Rodou num aparelho | ❌ **nunca** | ❌ nunca |
| Alarme confiável com a tela bloqueada | ✅ `setAlarmClock` + serviço em primeiro plano | ⚠️ limitado pelo iOS — veja [ios/README.md](ios/README.md) |

**O que isso quer dizer.** O motor de contagem está testado de verdade: 45
testes exercitam cada exercício contra um manequim sintético, incluindo os casos
que **não** podem contar. O app Android compila, passa no lint e produz APK.
Mas nada disso foi executado num celular — o contêiner onde foi construído não
tem emulador. Os limiares de ângulo vêm da geometria do movimento, não de vídeo
real; espere ajustar alguns na primeira semana de uso.

---

## Instalar no Android

O APK de depuração já vem assinado e instala direto:

```bash
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-arm64-v8a-debug.apk
```

Quase todo celular atual é `arm64-v8a`. Se o seu for antigo, use
`app-armeabi-v7a-debug.apk`; na dúvida, `app-universal-debug.apk` (92 MB, contém
as duas).

### Quando algo quebrar no aparelho

Se o app fechar sozinho, o primeiro passo é descartar o R8 — a minificação do
build de release remove código que o ML Kit carrega por reflexão, e uma regra
faltando no `proguard-rules.pro` aparece como crash só no aparelho:

```bash
./gradlew :app:assembleDiagnostico
adb install -r app/build/outputs/apk/diagnostico/app-arm64-v8a-diagnostico.apk
adb logcat -s AndroidRuntime ServicoDeAlarme Agendador
```

A variante `diagnostico` é depurável, **sem minificação nenhuma** e assinada com
a chave de depuração. Ela usa o id `br.com.levanta.diagnostico`, então convive
com a versão normal no mesmo celular. Se o problema some nela, é regra de
ProGuard faltando; se continua, é bug de verdade.

Ela também comprime as bibliotecas nativas dentro do APK, o que a derruba de
38 MB para 23 MB — útil para transferir à mão, por WhatsApp ou cabo. O custo é
o sistema extrair os `.so` na instalação: ocupa mais espaço no aparelho e abre
um pouco mais devagar. O release mantém o padrão descomprimido, que é o certo
para uso normal.

### Se a instalação falhar

| O que aparece | O que é |
|---|---|
| "Instalação bloqueada" / "fontes desconhecidas" | Libere a permissão **para o app que abriu o arquivo** (Chrome, Arquivos, WhatsApp) — não é uma permissão global. |
| "App não instalado" | Já existe uma versão com o mesmo id e assinatura diferente. Desinstale a anterior primeiro. |
| "Aplicativo prejudicial bloqueado" | Play Protect reclamando de APK fora da loja. Em Play Store → perfil → Play Protect, desative temporariamente. |
| Nada acontece ao tocar | O arquivo veio incompleto, ou o gerenciador de arquivos não abre `.apk`. Confira o tamanho e abra pelo app **Arquivos** do sistema. |

Sem cabo: copie o APK para o celular e abra pelo gerenciador de arquivos,
liberando "instalar de fontes desconhecidas".

Requer Android 8 (API 26) ou mais novo.

### Na primeira abertura

A tela inicial mostra o que ainda falta liberar, com o botão que leva direto à
configuração:

- **Alarmes exatos** — sem isso o Android pode adiar o alarme. Em Android 13+ a
  permissão vem concedida na instalação (`USE_EXACT_ALARM`, a permissão prevista
  para apps de despertador).
- **Notificações** — é o que faz a tela do alarme aparecer sozinha por cima da
  tela de bloqueio.
- **Economia de bateria** — recomendado liberar o Levanta. Xiaomi, Samsung,
  Oppo e Motorola têm camadas próprias que matam apps em segundo plano de forma
  mais agressiva que o Android puro; nelas, vale também marcar o app como
  "sem restrições" ou "início automático".

A câmera só é pedida no primeiro exercício, não na instalação.

## Compilar o iOS

Precisa de um Mac. Veja [ios/README.md](ios/README.md) — inclusive a explicação
honesta de por que um despertador de terceiros no iOS não é tão confiável quanto
no Android.

---

## Como funciona o alarme no Android

O ponto difícil de um despertador não é tocar um som: é garantir que o sistema
não adie o disparo enquanto o celular passa a noite parado.

- **`AlarmManager.setAlarmClock`**, e não `setExact`. É a única variante tratada
  como despertador de verdade: fura o modo Doze, aparece como "próximo alarme"
  do sistema e acende o ícone na barra de status. `setExact` pode ser adiada — e
  num despertador, atrasar é falhar.
- **Serviço em primeiro plano** segura o processo enquanto o alarme toca. É ele
  que mantém som, vibração e a contagem vivos quando a pessoa gira o celular ou
  a tela apaga no meio dos agachamentos.
- **Notificação com `fullScreenIntent`** é o que traz a tela do alarme por cima
  do bloqueio, junto de `showWhenLocked` e `turnScreenOn` na Activity.
- **O próximo disparo é agendado assim que o alarme toca**, não quando o usuário
  o desliga. `setAlarmClock` agenda um disparo só; um alarme de segunda a sexta
  que dependesse do desligamento nunca mais tocaria se a pessoa ignorasse este.
- **Receptor de boot** reagenda tudo depois de reiniciar o aparelho, atualizar o
  app ou mudar o fuso — o AlarmManager esquece os alarmes ao desligar o celular.
- **Limite de 15 minutos.** Um despertador que toca para sempre esvazia a
  bateria de quem esqueceu o celular em casa. Passado o limite, ele silencia
  sozinho; o alarme de amanhã já está agendado.
- **O som abaixa para 35% durante o exercício**, para o bipe de cada repetição
  ser audível por cima do alarme.

## A saída de emergência

O botão **"Não consigo agora"** desliga o alarme sem exercício, mas exige
segurar cinco segundos.

Isso é deliberado. Um despertador que não pode ser desligado é perigoso: quem se
machucou, está doente ou está com alguém dormindo do lado precisa de uma saída.
Os cinco segundos são atrito suficiente para não virar o caminho fácil às seis
da manhã, sem transformar o app numa armadilha.

Pela mesma lógica, o botão Voltar não fecha nem a tela do alarme nem a do treino.

## Como a contagem funciona

Resumo: cada exercício vira um número que é alto em repouso e baixo no extremo
do movimento, e uma repetição é o ciclo inteiro entre os dois. Dois limiares
separados impedem meia repetição de contar, tempos mínimos impedem sacudir o
celular, e uma "porta de postura" separa uma flexão de alguém dobrando o
cotovelo sentado na cama.

O detalhe completo — os ângulos de cada exercício, a correção de proporção da
imagem e o que ainda não é coberto — está em
[docs/deteccao-de-repeticoes.md](docs/deteccao-de-repeticoes.md).

---

## Rodar os testes

```bash
cd android
./gradlew :core:test          # 45 testes, JVM pura, sem emulador
./gradlew :app:lintDebug
```

O módulo `:core` é Kotlin puro, sem uma linha de Android: é o que permite testar
o motor de contagem e o agendamento na JVM. Os testes usam um **manequim
sintético** que monta esqueletos com uma pose exata, então dá para afirmar "com
o joelho a 85° o contador está na fase extremo" sem depender de vídeo gravado.

Os testes que mais importam são os negativos:

- meio agachamento (130°) não conta;
- sacudir o celular (ciclo de 160 ms) não conta;
- oscilar em torno do limiar não conta;
- polichinelo só com os braços não conta, e só com as pernas também não;
- dobrar o cotovelo sentado na cama não vira flexão;
- sentar e inclinar com as pernas na vertical não vira abdominal;
- quem começa já agachado não ganha meia repetição de graça.

## Estrutura

```
levanta/
├── docs/deteccao-de-repeticoes.md   o contrato entre as duas plataformas
├── android/
│   ├── core/                        Kotlin puro — testável sem emulador
│   │   ├── pose/                    Esqueleto, geometria, contadores
│   │   └── alarme/                  modelo do alarme e próximo disparo
│   └── app/
│       ├── alarme/                  agendador, receptores, serviço
│       ├── camera/                  adaptador do ML Kit e retorno sonoro
│       ├── dados/                   persistência em JSON atômico
│       └── ui/                      Compose: lista, editor, alarme, treino
└── ios/
    ├── Levanta/Nucleo/              a mesma lógica, em Swift
    ├── Levanta/Alarme/              notificações, tocador, repositório
    ├── Levanta/Camera/              adaptador do Vision
    ├── Levanta/Telas/               SwiftUI
    └── LevantaTests/                os mesmos casos de teste
```

## Limites conhecidos

- **Nada disso rodou num celular.** É o próximo passo, e é onde os limiares vão
  precisar de ajuste.
- **Roupa larga e pouca luz** degradam a detecção de pose. O app avisa quando
  não enxerga o corpo, mas não tem como compensar.
- **Flexão de joelhos** (a versão apoiada) é recusada pela porta de postura, que
  exige o corpo reto do ombro ao joelho.
- **Um espelho ou uma foto grande** na cena pode gerar uma segunda pose; o
  detector fica com a mais proeminente, o que costuma bastar, mas não é uma
  garantia.
- **O APK tem 39 MB** porque o modelo de pose do ML Kit vem embutido. É o preço
  de funcionar sem internet.
- **O som do alarme é o toque padrão do sistema.** Escolher outro ainda não está
  na tela de edição.
