package br.com.levanta.core.pose

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

/**
 * Gera esqueletos sintéticos com uma pose exata, para exercitar os contadores
 * sem câmera. Cada função monta os marcos de trás para a frente a partir do
 * ângulo pedido, então o teste pode afirmar "com o joelho a 85° o contador
 * está na fase EXTREMO" sem depender de um vídeo gravado.
 */
object Manequim {

    private const val C = 0.9f  // confiança de todos os marcos gerados
    private fun p(x: Float, y: Float) = Ponto(x, y, C)
    private fun rad(g: Float) = Math.toRadians(g.toDouble())

    /** Em pé de perfil, com o joelho no ângulo pedido (180° = totalmente esticado). */
    fun agachamento(anguloJoelho: Float, instanteMs: Long, proporcao: Float = 1f): Esqueleto {
        val joelho = p(0.50f, 0.60f)
        val tornozelo = p(0.50f, 0.85f)
        val r = rad(anguloJoelho)
        val quadril = p(joelho.x + 0.25f * sin(r).toFloat(), joelho.y + 0.25f * cos(r).toFloat())
        val ombro = p(quadril.x, quadril.y - 0.20f)   // tronco na vertical
        return montar(
            instanteMs, proporcao,
            Marco.OMBRO_ESQ to ombro, Marco.OMBRO_DIR to ombro,
            Marco.QUADRIL_ESQ to quadril, Marco.QUADRIL_DIR to quadril,
            Marco.JOELHO_ESQ to joelho, Marco.JOELHO_DIR to joelho,
            Marco.TORNOZELO_ESQ to tornozelo, Marco.TORNOZELO_DIR to tornozelo,
        )
    }

    /** Em prancha, com o cotovelo no ângulo pedido (180° = braço esticado). */
    fun flexao(anguloCotovelo: Float, instanteMs: Long): Esqueleto {
        val ombro = p(0.35f, 0.50f)
        val quadril = p(0.60f, 0.52f)
        val joelho = p(0.80f, 0.54f)
        val tornozelo = p(0.95f, 0.56f)
        val cotovelo = p(0.35f, 0.62f)
        val r = rad(anguloCotovelo)
        val pulso = p(cotovelo.x + 0.12f * sin(r).toFloat(), cotovelo.y - 0.12f * cos(r).toFloat())
        return montar(
            instanteMs, 1f,
            Marco.OMBRO_ESQ to ombro, Marco.OMBRO_DIR to ombro,
            Marco.COTOVELO_ESQ to cotovelo, Marco.COTOVELO_DIR to cotovelo,
            Marco.PULSO_ESQ to pulso, Marco.PULSO_DIR to pulso,
            Marco.QUADRIL_ESQ to quadril, Marco.QUADRIL_DIR to quadril,
            Marco.JOELHO_ESQ to joelho, Marco.JOELHO_DIR to joelho,
            Marco.TORNOZELO_ESQ to tornozelo, Marco.TORNOZELO_DIR to tornozelo,
        )
    }

    /** Deitado de perfil, com o quadril no ângulo pedido (180° = tronco no chão). */
    fun abdominal(anguloQuadril: Float, instanteMs: Long): Esqueleto {
        val quadril = p(0.55f, 0.75f)
        val joelho = p(0.72f, 0.72f)
        val tornozelo = p(0.85f, 0.78f)
        val base = atan2((joelho.y - quadril.y).toDouble(), (joelho.x - quadril.x).toDouble())
        val alvo = base - rad(anguloQuadril)
        val ombro = p(
            quadril.x + 0.30f * cos(alvo).toFloat(),
            quadril.y + 0.30f * sin(alvo).toFloat(),
        )
        return montar(
            instanteMs, 1f,
            Marco.OMBRO_ESQ to ombro, Marco.OMBRO_DIR to ombro,
            Marco.QUADRIL_ESQ to quadril, Marco.QUADRIL_DIR to quadril,
            Marco.JOELHO_ESQ to joelho, Marco.JOELHO_DIR to joelho,
            Marco.TORNOZELO_ESQ to tornozelo, Marco.TORNOZELO_DIR to tornozelo,
        )
    }

    /**
     * Em pé de frente, com [bracos] e [pernas] de 0 (fechado) a 1 (aberto).
     * Separar os dois eixos permite testar o polichinelo pela metade.
     */
    fun polichinelo(bracos: Float, pernas: Float, instanteMs: Long): Esqueleto {
        val alturaTronco = 0.20f
        val yPulso = 0.60f - alturaTronco * (0.25f + 1.25f * bracos)
        val separacao = alturaTronco * (0.35f + 0.60f * pernas)
        return montar(
            instanteMs, 1f,
            Marco.OMBRO_ESQ to p(0.44f, 0.40f), Marco.OMBRO_DIR to p(0.56f, 0.40f),
            Marco.PULSO_ESQ to p(0.30f, yPulso), Marco.PULSO_DIR to p(0.70f, yPulso),
            Marco.QUADRIL_ESQ to p(0.46f, 0.60f), Marco.QUADRIL_DIR to p(0.54f, 0.60f),
            Marco.JOELHO_ESQ to p(0.46f, 0.75f), Marco.JOELHO_DIR to p(0.54f, 0.75f),
            Marco.TORNOZELO_ESQ to p(0.50f - separacao / 2f, 0.90f),
            Marco.TORNOZELO_DIR to p(0.50f + separacao / 2f, 0.90f),
        )
    }

    /** Como [agachamento], mas em pé e de frente: postura errada para a flexão. */
    fun sentadoNaCama(anguloCotovelo: Float, instanteMs: Long): Esqueleto {
        val base = flexao(anguloCotovelo, instanteMs)
        // Reaproveita os braços e põe o tronco na vertical.
        val ombro = p(0.50f, 0.35f)
        val quadril = p(0.50f, 0.60f)
        val cotovelo = p(0.50f, 0.47f)
        val r = rad(anguloCotovelo)
        val pulso = p(cotovelo.x + 0.12f * sin(r).toFloat(), cotovelo.y - 0.12f * cos(r).toFloat())
        check(base.temTodos(Marco.OMBRO_ESQ))
        return montar(
            instanteMs, 1f,
            Marco.OMBRO_ESQ to ombro, Marco.OMBRO_DIR to ombro,
            Marco.COTOVELO_ESQ to cotovelo, Marco.COTOVELO_DIR to cotovelo,
            Marco.PULSO_ESQ to pulso, Marco.PULSO_DIR to pulso,
            Marco.QUADRIL_ESQ to quadril, Marco.QUADRIL_DIR to quadril,
            Marco.JOELHO_ESQ to p(0.50f, 0.78f), Marco.JOELHO_DIR to p(0.50f, 0.78f),
            Marco.TORNOZELO_ESQ to p(0.50f, 0.95f), Marco.TORNOZELO_DIR to p(0.50f, 0.95f),
        )
    }

    /** Sentado com as pernas na vertical: postura errada para o abdominal. */
    fun sentadoInclinando(anguloQuadril: Float, instanteMs: Long): Esqueleto {
        val quadril = p(0.50f, 0.70f)
        val joelho = p(0.52f, 0.90f)   // perna quase vertical
        val tornozelo = p(0.54f, 0.99f)
        val base = atan2((joelho.y - quadril.y).toDouble(), (joelho.x - quadril.x).toDouble())
        val alvo = base - rad(anguloQuadril)
        val ombro = p(quadril.x + 0.30f * cos(alvo).toFloat(), quadril.y + 0.30f * sin(alvo).toFloat())
        return montar(
            instanteMs, 1f,
            Marco.OMBRO_ESQ to ombro, Marco.OMBRO_DIR to ombro,
            Marco.QUADRIL_ESQ to quadril, Marco.QUADRIL_DIR to quadril,
            Marco.JOELHO_ESQ to joelho, Marco.JOELHO_DIR to joelho,
            Marco.TORNOZELO_ESQ to tornozelo, Marco.TORNOZELO_DIR to tornozelo,
        )
    }

    private fun montar(
        instanteMs: Long,
        proporcao: Float,
        vararg marcos: Pair<Marco, Ponto>,
    ) = Esqueleto.de(marcos.toMap(), proporcao, instanteMs)
}

/**
 * Roda um movimento no contador: desce de [de] até [ate], segura, sobe e segura.
 * Devolve quantas repetições o contador acusou no fim.
 */
fun ContadorRepeticoes.cicloDeAngulo(
    de: Float,
    ate: Float,
    inicioMs: Long,
    quadro: (Float, Long) -> Esqueleto,
    passos: Int = 6,
    espera: Int = 6,
    msPorQuadro: Long = 50,
): Long {
    var t = inicioMs
    fun alimentar(v: Float) {
        processar(quadro(v, t)); t += msPorQuadro
    }
    repeat(passos) { alimentar(de + (ate - de) * (it + 1) / passos) }
    repeat(espera) { alimentar(ate) }
    repeat(passos) { alimentar(ate + (de - ate) * (it + 1) / passos) }
    repeat(espera) { alimentar(de) }
    return t
}
