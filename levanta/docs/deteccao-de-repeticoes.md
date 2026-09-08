# Como uma repetição é detectada

Este documento é o contrato entre as duas plataformas. `Contador.kt` e
`Contador.swift` são a mesma máquina de estados escrita duas vezes; quando um
limiar muda aqui, muda nos dois arquivos e nos dois conjuntos de teste.

## O caminho de um quadro

```
câmera  →  detector de pose  →  adaptador  →  Esqueleto  →  contador  →  Progresso
           ML Kit / Vision      normaliza    13 marcos     histerese     tela + bipe
```

O detector é diferente em cada sistema (ML Kit no Android, Vision no iOS) e
entrega marcos em convenções diferentes. O adaptador — `AnalisadorDePose` nos
dois lados — é o único lugar onde essa diferença existe. Depois dele, tudo é
idêntico.

## Os 13 marcos

Nariz, ombros, cotovelos, pulsos, quadris, joelhos e tornozelos. É a interseção
do que o ML Kit (33 marcos) e o Vision (19 juntas) sabem produzir. Marcos com
confiança abaixo de **0,35** são tratados como não vistos.

## A correção de proporção

As duas bibliotecas devolvem coordenadas normalizadas em 0–1, cada eixo dividido
pela sua própria dimensão. Isso achata a imagem num quadrado e distorce todo
ângulo medido nela: o mesmo agachamento mede valores diferentes conforme o
celular esteja em pé ou deitado.

`Esqueleto.de` multiplica `x` pela proporção largura÷altura, o que devolve a
escala uniforme e faz o ângulo medido bater com o ângulo físico. Há um teste
para isso nos dois lados, e ele verifica também que **sem** a correção os dois
formatos discordam — um teste que não morde não protege nada.

## De exercício a um número

Todo exercício vira um sinal escalar **alto em repouso e baixo no extremo**:

| Exercício | Sinal | Repouso | Extremo | Porta de postura |
|---|---|---|---|---|
| Agachamento | Ângulo do joelho (quadril·joelho·tornozelo) | ≥ 160° | ≤ 100° | Tronco mais vertical que 40° |
| Flexão | Ângulo do cotovelo (ombro·cotovelo·pulso) | ≥ 155° | ≤ 100° | Tronco abaixo de 40° **e** corpo reto (ombro·quadril·joelho ≥ 140°) |
| Abdominal | Ângulo do quadril (ombro·quadril·joelho) | ≥ 130° | ≤ 80° | Pernas deitadas (quadril→tornozelo abaixo de 45°) |
| Polichinelo | Índice de fechamento, 0–100 | ≥ 72 | ≤ 30 | Tronco acima de 55° |

O polichinelo não tem um ângulo único que o descreva, então o sinal combina em
partes iguais **quanto os braços subiram** e **quanto os pés se afastaram**,
cada um dividido pela altura do tronco. Cobrar as duas coisas juntas é o que
impede contar quem só bate palma em cima: com braços perfeitos e pernas paradas
o índice fica em 50, longe dos 30 que abrem a fase extremo. Há um teste para
cada metade.

Dividir pela **altura do tronco**, e não por pixels nem pela largura dos ombros,
faz o movimento contar igual perto e longe da câmera, e mantém a referência
estável quando a pessoa gira um pouco de lado — o que encolheria a largura dos
ombros sem encolher o tronco.

## A máquina de estados

```
PROCURANDO ──(sinal ≥ repouso)──> REPOUSO ──(sinal ≤ extremo)──> EXTREMO
                                     ^                              │
                                     └──────(sinal ≥ repouso)───────┘
                                            +1 repetição
```

Uma repetição é o ciclo inteiro `repouso → extremo → repouso`. Quatro defesas
contra contagem falsa:

1. **Dois limiares separados (histerese).** Para sair do repouso o sinal tem que
   cruzar o limiar do extremo, bem abaixo. Balançar em torno de um único valor
   não gera contagem — meio agachamento a 130° não cruza nem 160° nem 100°.
2. **Tempo mínimo no extremo** (180 ms; 120 no polichinelo). Uma sacudida no
   celular não vira agachamento.
3. **Tempo mínimo do ciclo** (500 ms; 400 no polichinelo).
4. **Porta de postura.** Dobrar o cotovelo sentado na cama tem exatamente a
   mesma leitura de ângulo que uma flexão; o que separa os dois é o tronco estar
   deitado. Cada exercício tem a sua porta, e ela também é o que produz a
   mensagem "ajuste a posição" na tela.

Além disso, o sinal passa por uma **suavização exponencial** (α 0,55) antes de
tudo, e o contador começa em `PROCURANDO`: quem liga a câmera já agachado espera
ficar em pé para a primeira repetição valer inteira.

## Escolha de lado

Quando os dois lados do corpo estão visíveis, o contador tira a média — o que
cancela o ruído de um marco tremendo. Se discordarem em mais de 25°, um dos dois
está sendo mal detectado e ele fica com o **menor** valor, que é o mais próximo
do extremo do movimento e o mais conservador para contar.

## O que ainda não é coberto

- **Roupa larga e pouca luz** degradam a detecção de pose, e não há como o
  contador saber disso além da confiança dos marcos. A mensagem "afaste o
  celular até aparecer o corpo inteiro" é o que a pessoa vê.
- **Flexão de joelhos** (a versão apoiada) reprova na porta de postura, que
  exige o corpo reto do ombro ao joelho. É uma decisão a revisar depois de ver
  gente usando.
- **Nenhum dos limiares foi calibrado com vídeo real.** Eles vêm da geometria do
  movimento e estão validados contra um manequim sintético. O primeiro ajuste
  depois de usar no celular provavelmente é aqui.
