package br.com.levanta.core.pose

import kotlin.math.abs

/** Os exercícios que desligam o alarme. */
enum class Exercicio(val rotulo: String, val instrucao: String, val enquadramento: String) {
    AGACHAMENTO(
        rotulo = "Agachamento",
        instrucao = "Desça até a coxa ficar paralela ao chão e volte a ficar em pé.",
        enquadramento = "Apoie o celular no chão ou numa cadeira, a uns 2 metros, com o corpo inteiro na tela.",
    ),
    FLEXAO(
        rotulo = "Flexão de braço",
        instrucao = "Desça até o cotovelo fechar e empurre até esticar o braço.",
        enquadramento = "Deite o celular de lado, no chão, a uns 2 metros, filmando você de perfil.",
    ),
    POLICHINELO(
        rotulo = "Polichinelo",
        instrucao = "Abra braços e pernas ao mesmo tempo e feche de volta.",
        enquadramento = "Celular em pé a uns 2,5 metros — precisa caber você de braços abertos.",
    ),
    ABDOMINAL(
        rotulo = "Abdominal",
        instrucao = "Suba até o tronco chegar perto dos joelhos e volte a deitar.",
        enquadramento = "Celular de lado, no chão, filmando você de perfil com os joelhos dobrados.",
    );

    val repeticoesSugeridas: Int
        get() = when (this) {
            AGACHAMENTO -> 20
            FLEXAO -> 10
            POLICHINELO -> 30
            ABDOMINAL -> 20
        }
}

/** Em que ponto do movimento o corpo está. */
enum class Fase {
    /** Ainda não deu para ler a pose. */
    PROCURANDO,

    /** Posição de partida: em pé, braço esticado, deitado, corpo fechado. */
    REPOUSO,

    /** Ponto extremo do movimento: agachado, peito no chão, tronco em cima, corpo aberto. */
    EXTREMO,
}

/** O que a tela precisa dizer para a pessoa acertar o movimento. */
enum class Aviso(val mensagem: String) {
    CORPO_FORA_DE_QUADRO("Afaste o celular até aparecer o corpo inteiro"),
    POSICAO_INVALIDA("Ajuste a posição para o exercício escolhido"),
    DESCA_MAIS("Desça mais"),
    SUBA_MAIS("Volte à posição inicial"),
    MAIS_DEVAGAR("Mais devagar, o movimento não contou"),
}

/** O resultado de processar um quadro. */
data class Progresso(
    val repeticoes: Int,
    val fase: Fase,
    /** 0 no repouso, 1 no extremo — alimenta a barra de progresso do movimento. */
    val amplitude: Float,
    val aviso: Aviso?,
    /** `true` só no quadro exato em que a repetição fechou. */
    val contouAgora: Boolean,
)

/**
 * Conta repetições a partir de um sinal escalar com histerese.
 *
 * Todo exercício aqui vira um único número que é **alto em repouso e baixo no
 * extremo** do movimento: o ângulo do joelho no agachamento, o do cotovelo na
 * flexão, o do quadril no abdominal, e um índice de fechamento no polichinelo.
 * Uma repetição é o ciclo completo `repouso → extremo → repouso`.
 *
 * Os dois limiares separados são o que impede meia repetição de contar: para
 * sair do repouso o sinal tem que cruzar [limiarExtremo], bem abaixo de
 * [limiarRepouso], então balançar em torno de um único valor não gera contagem.
 * Além disso a repetição só fecha se o extremo tiver durado [msNoExtremo] e o
 * ciclo inteiro [msPorRepeticao] — uma sacudida rápida do celular não vira
 * agachamento.
 */
abstract class ContadorRepeticoes(val exercicio: Exercicio) {

    /** O sinal do quadro, alto em repouso e baixo no extremo. `null` se não der para medir. */
    protected abstract fun sinal(e: Esqueleto): Float?

    /** Postura errada para este exercício (deitado quando devia estar em pé, etc). */
    protected open fun postura(e: Esqueleto): Aviso? = null

    protected abstract val limiarRepouso: Float
    protected abstract val limiarExtremo: Float

    /** Peso do quadro novo na suavização exponencial. Menor = mais estável, mais atrasado. */
    protected open val suavizacao: Float = 0.55f

    /** Tempo mínimo no extremo para o movimento valer. */
    protected open val msNoExtremo: Long = 180

    /** Tempo mínimo do ciclo inteiro. */
    protected open val msPorRepeticao: Long = 500

    private var repeticoes = 0
    private var fase = Fase.PROCURANDO
    private var suave: Float? = null
    private var entrouNoExtremoMs = 0L
    private var saiuDoRepousoMs = 0L
    private var avisoPendente: Aviso? = null

    fun reiniciar() {
        repeticoes = 0
        fase = Fase.PROCURANDO
        suave = null
        entrouNoExtremoMs = 0
        saiuDoRepousoMs = 0
        avisoPendente = null
    }

    fun processar(e: Esqueleto): Progresso {
        val bruto = sinal(e)
        if (bruto == null) {
            suave = null
            return Progresso(repeticoes, Fase.PROCURANDO, 0f, Aviso.CORPO_FORA_DE_QUADRO, false)
        }
        postura(e)?.let { erro ->
            suave = null
            return Progresso(repeticoes, Fase.PROCURANDO, 0f, erro, false)
        }

        val v = suave?.let { it + suavizacao * (bruto - it) } ?: bruto
        suave = v

        val amplitude = 1f - faixa(v, limiarExtremo, limiarRepouso)
        var contou = false

        when (fase) {
            Fase.PROCURANDO -> {
                // Só entra no ciclo pelo repouso: quem começa a filmar já agachado
                // espera ficar em pé para a primeira repetição valer inteira.
                if (v >= limiarRepouso) {
                    fase = Fase.REPOUSO
                    avisoPendente = null
                } else {
                    avisoPendente = Aviso.SUBA_MAIS
                }
            }

            Fase.REPOUSO -> {
                if (v <= limiarExtremo) {
                    fase = Fase.EXTREMO
                    entrouNoExtremoMs = e.instanteMs
                    if (saiuDoRepousoMs == 0L) saiuDoRepousoMs = e.instanteMs
                    avisoPendente = null
                } else if (v < limiarRepouso) {
                    // Saiu do repouso mas ainda não chegou ao extremo.
                    if (saiuDoRepousoMs == 0L) saiuDoRepousoMs = e.instanteMs
                    avisoPendente = Aviso.DESCA_MAIS
                } else {
                    saiuDoRepousoMs = 0L
                    avisoPendente = null
                }
            }

            Fase.EXTREMO -> {
                if (v >= limiarRepouso) {
                    val tempoNoExtremo = e.instanteMs - entrouNoExtremoMs
                    val tempoDoCiclo = e.instanteMs - saiuDoRepousoMs
                    if (tempoNoExtremo >= msNoExtremo && tempoDoCiclo >= msPorRepeticao) {
                        repeticoes++
                        contou = true
                        avisoPendente = null
                    } else {
                        avisoPendente = Aviso.MAIS_DEVAGAR
                    }
                    fase = Fase.REPOUSO
                    saiuDoRepousoMs = 0L
                } else {
                    avisoPendente = null
                }
            }
        }

        return Progresso(repeticoes, fase, amplitude, avisoPendente, contou)
    }

    /** Escolhe entre esquerda e direita o lado mais visível, e mede o sinal nele. */
    protected fun melhorLado(e: Esqueleto, medir: (Esqueleto, Lado) -> Float?): Float? {
        val esq = medir(e, Lado.ESQUERDO)
        val dir = medir(e, Lado.DIREITO)
        if (esq == null) return dir
        if (dir == null) return esq
        // Os dois lados visíveis: a média cancela o ruído de um marco tremendo.
        return if (abs(esq - dir) <= 25f) (esq + dir) / 2f else minOf(esq, dir)
    }
}
