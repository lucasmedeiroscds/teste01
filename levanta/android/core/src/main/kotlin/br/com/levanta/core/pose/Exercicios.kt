package br.com.levanta.core.pose

import br.com.levanta.core.pose.Marco.COTOVELO_DIR
import br.com.levanta.core.pose.Marco.COTOVELO_ESQ
import br.com.levanta.core.pose.Marco.JOELHO_DIR
import br.com.levanta.core.pose.Marco.JOELHO_ESQ
import br.com.levanta.core.pose.Marco.OMBRO_DIR
import br.com.levanta.core.pose.Marco.OMBRO_ESQ
import br.com.levanta.core.pose.Marco.PULSO_DIR
import br.com.levanta.core.pose.Marco.PULSO_ESQ
import br.com.levanta.core.pose.Marco.QUADRIL_DIR
import br.com.levanta.core.pose.Marco.QUADRIL_ESQ
import br.com.levanta.core.pose.Marco.TORNOZELO_DIR
import br.com.levanta.core.pose.Marco.TORNOZELO_ESQ

/** Fábrica: o contador certo para o exercício escolhido. */
fun contadorDe(exercicio: Exercicio): ContadorRepeticoes = when (exercicio) {
    Exercicio.AGACHAMENTO -> ContadorAgachamento()
    Exercicio.FLEXAO -> ContadorFlexao()
    Exercicio.POLICHINELO -> ContadorPolichinelo()
    Exercicio.ABDOMINAL -> ContadorAbdominal()
}

/** Eixo do tronco: do meio dos ombros ao meio do quadril. */
private fun tronco(e: Esqueleto): Pair<Ponto, Ponto>? {
    val ombro = medio(e.ponto(OMBRO_ESQ), e.ponto(OMBRO_DIR)) ?: return null
    val quadril = medio(e.ponto(QUADRIL_ESQ), e.ponto(QUADRIL_DIR)) ?: return null
    return ombro to quadril
}

/**
 * Agachamento — ângulo do joelho (quadril · joelho · tornozelo).
 *
 * Em pé passa de 170°; na coxa paralela ao chão fica perto de 80°. Os limiares
 * ficam em 160° e 100°, então o agachamento tem que ser fundo de verdade: parar
 * a meio caminho, por volta de 130°, não cruza nenhum dos dois e não conta.
 */
class ContadorAgachamento : ContadorRepeticoes(Exercicio.AGACHAMENTO) {
    override val limiarRepouso = 160f
    override val limiarExtremo = 100f

    override fun sinal(e: Esqueleto) = melhorLado(e) { esq, lado ->
        when (lado) {
            Lado.ESQUERDO -> angulo(esq.ponto(QUADRIL_ESQ), esq.ponto(JOELHO_ESQ), esq.ponto(TORNOZELO_ESQ))
            Lado.DIREITO -> angulo(esq.ponto(QUADRIL_DIR), esq.ponto(JOELHO_DIR), esq.ponto(TORNOZELO_DIR))
        }
    }

    /** De pé: o tronco tem que estar mais vertical que horizontal. */
    override fun postura(e: Esqueleto): Aviso? {
        val (ombro, quadril) = tronco(e) ?: return Aviso.CORPO_FORA_DE_QUADRO
        val inc = inclinacao(ombro, quadril) ?: return Aviso.CORPO_FORA_DE_QUADRO
        return if (inc < 40f) Aviso.POSICAO_INVALIDA else null
    }
}

/**
 * Flexão de braço — ângulo do cotovelo (ombro · cotovelo · pulso).
 *
 * Braço estendido fica acima de 165°; peito perto do chão, abaixo de 90°.
 */
class ContadorFlexao : ContadorRepeticoes(Exercicio.FLEXAO) {
    override val limiarRepouso = 155f
    override val limiarExtremo = 100f

    override fun sinal(e: Esqueleto) = melhorLado(e) { esq, lado ->
        when (lado) {
            Lado.ESQUERDO -> angulo(esq.ponto(OMBRO_ESQ), esq.ponto(COTOVELO_ESQ), esq.ponto(PULSO_ESQ))
            Lado.DIREITO -> angulo(esq.ponto(OMBRO_DIR), esq.ponto(COTOVELO_DIR), esq.ponto(PULSO_DIR))
        }
    }

    /**
     * Prancha: tronco quase horizontal e quadril alinhado com ombro e joelho.
     * Sem isso, dobrar o cotovelo sentado na cama contaria como flexão.
     */
    override fun postura(e: Esqueleto): Aviso? {
        val (ombro, quadril) = tronco(e) ?: return Aviso.CORPO_FORA_DE_QUADRO
        val inc = inclinacao(ombro, quadril) ?: return Aviso.CORPO_FORA_DE_QUADRO
        if (inc > 40f) return Aviso.POSICAO_INVALIDA
        val joelho = medio(e.ponto(JOELHO_ESQ), e.ponto(JOELHO_DIR))
        val corpoReto = angulo(ombro, quadril, joelho)
        return if (corpoReto != null && corpoReto < 140f) Aviso.POSICAO_INVALIDA else null
    }
}

/**
 * Abdominal — ângulo do quadril (ombro · quadril · joelho).
 *
 * Deitado passa de 130°; com o tronco em cima, perto dos joelhos, cai abaixo
 * de 70°.
 */
class ContadorAbdominal : ContadorRepeticoes(Exercicio.ABDOMINAL) {
    override val limiarRepouso = 130f
    override val limiarExtremo = 80f

    override fun sinal(e: Esqueleto) = melhorLado(e) { esq, lado ->
        when (lado) {
            Lado.ESQUERDO -> angulo(esq.ponto(OMBRO_ESQ), esq.ponto(QUADRIL_ESQ), esq.ponto(JOELHO_ESQ))
            Lado.DIREITO -> angulo(esq.ponto(OMBRO_DIR), esq.ponto(QUADRIL_DIR), esq.ponto(JOELHO_DIR))
        }
    }

    /**
     * No chão: as pernas ficam deitadas o movimento inteiro, então a linha
     * quadril→tornozelo é o que distingue um abdominal de alguém sentado se
     * inclinando para a frente — nesse caso a mesma leitura de quadril
     * apareceria com as pernas na vertical.
     */
    override fun postura(e: Esqueleto): Aviso? {
        val quadril = medio(e.ponto(QUADRIL_ESQ), e.ponto(QUADRIL_DIR)) ?: return Aviso.CORPO_FORA_DE_QUADRO
        val tornozelo = medio(e.ponto(TORNOZELO_ESQ), e.ponto(TORNOZELO_DIR)) ?: return Aviso.CORPO_FORA_DE_QUADRO
        val inc = inclinacao(quadril, tornozelo) ?: return Aviso.CORPO_FORA_DE_QUADRO
        return if (inc > 45f) Aviso.POSICAO_INVALIDA else null
    }
}

/**
 * Polichinelo — índice de fechamento de 0 a 100, alto com o corpo fechado.
 *
 * Não existe um ângulo único que descreva o movimento, então o sinal combina
 * duas medidas em partes iguais: quanto os braços subiram e quanto os pés se
 * afastaram. Cobrar as duas juntas é o que impede contar quem só bate palma em
 * cima ou só arrasta os pés.
 *
 * As duas medidas são divididas pela altura do tronco, e não por pixels ou pela
 * largura dos ombros: assim o mesmo movimento conta igual perto ou longe da
 * câmera, e a altura do tronco continua estável mesmo quando a pessoa gira um
 * pouco de lado, o que encolheria a largura dos ombros.
 */
class ContadorPolichinelo : ContadorRepeticoes(Exercicio.POLICHINELO) {
    override val limiarRepouso = 72f
    override val limiarExtremo = 30f
    override val suavizacao = 0.6f
    override val msNoExtremo = 120L
    override val msPorRepeticao = 400L

    override fun sinal(e: Esqueleto): Float? {
        val (ombro, quadril) = tronco(e) ?: return null
        val alturaTronco = distancia(ombro, quadril) ?: return null
        if (alturaTronco < 1e-4f) return null

        val pulso = medio(e.ponto(PULSO_ESQ), e.ponto(PULSO_DIR)) ?: return null
        val tornozeloEsq = e.ponto(TORNOZELO_ESQ) ?: return null
        val tornozeloDir = e.ponto(TORNOZELO_DIR) ?: return null

        // Braço no quadril dá ~0; acima da cabeça, ~2 alturas de tronco.
        val bracos = faixa((quadril.y - pulso.y) / alturaTronco, 0.25f, 1.5f)
        // Pés juntos dão ~0,2 de tronco entre eles; abertos, ~1,0.
        val pernas = faixa((distancia(tornozeloEsq, tornozeloDir) ?: return null) / alturaTronco, 0.35f, 0.95f)

        return 100f * (1f - (bracos + pernas) / 2f)
    }

    /** Em pé, de frente para a câmera. */
    override fun postura(e: Esqueleto): Aviso? {
        val (ombro, quadril) = tronco(e) ?: return Aviso.CORPO_FORA_DE_QUADRO
        val inc = inclinacao(ombro, quadril) ?: return Aviso.CORPO_FORA_DE_QUADRO
        return if (inc < 55f) Aviso.POSICAO_INVALIDA else null
    }
}
