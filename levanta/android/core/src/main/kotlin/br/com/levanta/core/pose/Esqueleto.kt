package br.com.levanta.core.pose

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.hypot
import kotlin.math.min

/**
 * Os treze marcos do corpo que o contador usa.
 *
 * É a interseção do que o ML Kit Pose (33 marcos, Android) e o Vision
 * (19 juntas, iOS) sabem produzir, para que o mesmo motor de contagem
 * rode idêntico nas duas plataformas.
 */
enum class Marco {
    NARIZ,
    OMBRO_ESQ, OMBRO_DIR,
    COTOVELO_ESQ, COTOVELO_DIR,
    PULSO_ESQ, PULSO_DIR,
    QUADRIL_ESQ, QUADRIL_DIR,
    JOELHO_ESQ, JOELHO_DIR,
    TORNOZELO_ESQ, TORNOZELO_DIR,
}

/** Lado do corpo. O contador escolhe o mais visível a cada quadro. */
enum class Lado { ESQUERDO, DIREITO }

/**
 * Um ponto do corpo em coordenadas já corrigidas pela proporção da imagem.
 *
 * `x` e `y` saem normalizados em 0..1 pela plataforma, o que achata a imagem
 * num quadrado e distorce todo ângulo medido nela. [Esqueleto.de] devolve o `x`
 * multiplicado pela proporção largura/altura, restaurando a escala real — sem
 * isso um agachamento filmado em retrato mede um ângulo de joelho diferente do
 * mesmo agachamento filmado em paisagem.
 *
 * A origem é o canto superior esquerdo e `y` cresce para baixo, convenção do
 * ML Kit; o adaptador do iOS inverte o eixo do Vision antes de chegar aqui.
 */
data class Ponto(val x: Float, val y: Float, val confianca: Float)

/** Um quadro de pose: os marcos detectados e o instante em que foram vistos. */
class Esqueleto private constructor(
    private val marcos: Map<Marco, Ponto>,
    val instanteMs: Long,
) {
    companion object {
        /** Abaixo disto o marco é tratado como não visto. */
        const val CONFIANCA_MINIMA = 0.35f

        /**
         * Monta um esqueleto a partir de marcos normalizados em 0..1,
         * corrigindo `x` pela [proporcao] (largura ÷ altura da imagem).
         */
        fun de(marcos: Map<Marco, Ponto>, proporcao: Float, instanteMs: Long): Esqueleto {
            val p = if (proporcao > 0f) proporcao else 1f
            return Esqueleto(marcos.mapValues { (_, v) -> v.copy(x = v.x * p) }, instanteMs)
        }
    }

    /** O ponto, ou `null` se ausente ou pouco confiável. */
    fun ponto(m: Marco): Ponto? = marcos[m]?.takeIf { it.confianca >= CONFIANCA_MINIMA }

    /** Todos os marcos existem e são confiáveis? */
    fun temTodos(vararg ms: Marco): Boolean = ms.all { ponto(it) != null }

    /** Confiança média dos marcos pedidos; 0 se algum faltar. */
    fun confiancaMedia(vararg ms: Marco): Float {
        var soma = 0f
        for (m in ms) soma += (ponto(m) ?: return 0f).confianca
        return soma / ms.size
    }
}

/** Ângulo em graus no vértice [b], entre 0 e 180. `null` se algum ponto faltar. */
fun angulo(a: Ponto?, b: Ponto?, c: Ponto?): Float? {
    if (a == null || b == null || c == null) return null
    val abx = a.x - b.x; val aby = a.y - b.y
    val cbx = c.x - b.x; val cby = c.y - b.y
    val normas = hypot(abx, aby) * hypot(cbx, cby)
    if (normas < 1e-6f) return null
    val cos = ((abx * cbx + aby * cby) / normas).coerceIn(-1f, 1f)
    return Math.toDegrees(acos(cos).toDouble()).toFloat()
}

/** Distância euclidiana entre dois pontos. `null` se algum faltar. */
fun distancia(a: Ponto?, b: Ponto?): Float? {
    if (a == null || b == null) return null
    return hypot(a.x - b.x, a.y - b.y)
}

/**
 * Inclinação do segmento a→b em relação à horizontal, de 0 a 90 graus.
 * Serve para saber se o tronco está deitado (perto de 0) ou em pé (perto de 90).
 */
fun inclinacao(a: Ponto?, b: Ponto?): Float? {
    if (a == null || b == null) return null
    val dx = abs(a.x - b.x); val dy = abs(a.y - b.y)
    if (dx < 1e-6f && dy < 1e-6f) return null
    return Math.toDegrees(kotlin.math.atan2(dy, dx).toDouble()).toFloat()
}

/** Ponto médio entre dois pontos, com a menor das duas confianças. */
fun medio(a: Ponto?, b: Ponto?): Ponto? {
    if (a == null || b == null) return null
    return Ponto((a.x + b.x) / 2f, (a.y + b.y) / 2f, min(a.confianca, b.confianca))
}

/** Reescala [v] do intervalo [de, ate] para 0..1, saturando fora dele. */
fun faixa(v: Float, de: Float, ate: Float): Float {
    if (abs(ate - de) < 1e-6f) return 0f
    return ((v - de) / (ate - de)).coerceIn(0f, 1f)
}
