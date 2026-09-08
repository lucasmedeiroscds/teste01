package br.com.levanta.core.pose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class GeometriaTest {

    private fun p(x: Float, y: Float) = Ponto(x, y, 1f)

    @Test
    fun `angulo reto vale 90 graus`() {
        assertEquals(90f, angulo(p(0f, 1f), p(0f, 0f), p(1f, 0f))!!, 0.01f)
    }

    @Test
    fun `angulo raso vale 180 graus`() {
        assertEquals(180f, angulo(p(-1f, 0f), p(0f, 0f), p(1f, 0f))!!, 0.01f)
    }

    @Test
    fun `angulo com ponto ausente e nulo`() {
        assertNull(angulo(p(0f, 0f), null, p(1f, 1f)))
    }

    @Test
    fun `angulo com vertice coincidente e nulo`() {
        assertNull(angulo(p(0f, 0f), p(0f, 0f), p(1f, 1f)))
    }

    @Test
    fun `inclinacao distingue tronco em pe de tronco deitado`() {
        assertEquals(90f, inclinacao(p(0.5f, 0.2f), p(0.5f, 0.6f))!!, 0.01f)
        assertEquals(0f, inclinacao(p(0.2f, 0.5f), p(0.6f, 0.5f))!!, 0.01f)
    }

    /**
     * A mesma perna, filmada em retrato e em paisagem, tem que medir o mesmo
     * ângulo de joelho.
     *
     * A plataforma entrega `x` e `y` divididos por larguras diferentes, o que
     * achata a pose de um jeito diferente em cada formato. Multiplicar `x` de
     * volta pela proporção desfaz exatamente esse achatamento, e as duas
     * leituras voltam a bater com o ângulo físico. Sem a correção o mesmo
     * agachamento mede dezenas de graus a mais deitado do que em pé — e cruza
     * ou não o limiar de 100° dependendo de como o celular está apoiado.
     */
    @Test
    fun `proporcao da imagem nao muda o angulo medido`() {
        // Uma perna em pixels, a mesma nos dois enquadramentos.
        val quadril = 300f to 200f
        val joelho = 300f to 450f
        val tornozelo = 420f to 640f

        fun anguloEm(largura: Float, altura: Float, corrigir: Boolean): Float {
            fun normalizar(ponto: Pair<Float, Float>) = p(ponto.first / largura, ponto.second / altura)
            val e = Esqueleto.de(
                mapOf(
                    Marco.QUADRIL_ESQ to normalizar(quadril),
                    Marco.JOELHO_ESQ to normalizar(joelho),
                    Marco.TORNOZELO_ESQ to normalizar(tornozelo),
                ),
                if (corrigir) largura / altura else 1f,
                0,
            )
            return angulo(e.ponto(Marco.QUADRIL_ESQ), e.ponto(Marco.JOELHO_ESQ), e.ponto(Marco.TORNOZELO_ESQ))!!
        }

        val fisico = angulo(p(quadril.first, quadril.second), p(joelho.first, joelho.second), p(tornozelo.first, tornozelo.second))!!
        assertEquals(fisico, anguloEm(720f, 1280f, corrigir = true), 0.01f)
        assertEquals(fisico, anguloEm(1280f, 720f, corrigir = true), 0.01f)

        // E o teste morde: sem a correção os dois formatos discordam.
        val semCorrecaoRetrato = anguloEm(720f, 1280f, corrigir = false)
        val semCorrecaoPaisagem = anguloEm(1280f, 720f, corrigir = false)
        assertTrue(
            kotlin.math.abs(semCorrecaoRetrato - semCorrecaoPaisagem) > 20f,
            "sem correção os formatos deveriam divergir bastante",
        )
    }

    @Test
    fun `marco pouco confiavel conta como ausente`() {
        val e = Esqueleto.de(mapOf(Marco.NARIZ to Ponto(0.5f, 0.5f, 0.1f)), 1f, 0)
        assertNull(e.ponto(Marco.NARIZ))
        assertEquals(0f, e.confiancaMedia(Marco.NARIZ))
    }
}

class AgachamentoTest {

    private fun ciclos(quantos: Int, ate: Float = 80f): ContadorRepeticoes {
        val c = ContadorAgachamento()
        var t = 0L
        // Um quadro em pé para o contador sair de PROCURANDO.
        c.processar(Manequim.agachamento(178f, t)); t += 50
        repeat(quantos) { t = c.cicloDeAngulo(178f, ate, t, Manequim::agachamento) }
        return c
    }

    @Test
    fun `um agachamento completo conta uma repeticao`() {
        assertEquals(1, ciclos(1).processar(Manequim.agachamento(178f, 10_000)).repeticoes)
    }

    @Test
    fun `dez agachamentos contam dez`() {
        assertEquals(10, ciclos(10).processar(Manequim.agachamento(178f, 60_000)).repeticoes)
    }

    /** 130° não cruza o limiar de 100°: é meio agachamento e não vale. */
    @Test
    fun `agachamento pela metade nao conta`() {
        assertEquals(0, ciclos(3, ate = 130f).processar(Manequim.agachamento(178f, 60_000)).repeticoes)
    }

    @Test
    fun `agachamento pela metade pede para descer mais`() {
        val c = ContadorAgachamento()
        var t = 0L
        c.processar(Manequim.agachamento(178f, t)); t += 50
        repeat(10) { c.processar(Manequim.agachamento(130f, t)); t += 50 }
        assertSame(Aviso.DESCA_MAIS, c.processar(Manequim.agachamento(130f, t)).aviso)
    }

    /** Sacudir o celular gera um ciclo rápido demais para ser um agachamento. */
    @Test
    fun `movimento rapido demais nao conta`() {
        val c = ContadorAgachamento()
        var t = 0L
        c.processar(Manequim.agachamento(178f, t)); t += 20
        // Ciclo inteiro em 160 ms, abaixo dos 500 ms mínimos.
        c.cicloDeAngulo(178f, 80f, t, Manequim::agachamento, passos = 2, espera = 2, msPorQuadro = 20)
        val fim = c.processar(Manequim.agachamento(178f, 5_000))
        assertEquals(0, fim.repeticoes)
    }

    @Test
    fun `quem comeca ja agachado so conta o ciclo inteiro seguinte`() {
        val c = ContadorAgachamento()
        var t = 0L
        // Começa embaixo e sobe: metade de um agachamento, não conta.
        repeat(8) { c.processar(Manequim.agachamento(80f, t)); t += 50 }
        repeat(8) { c.processar(Manequim.agachamento(178f, t)); t += 50 }
        assertEquals(0, c.processar(Manequim.agachamento(178f, t)).repeticoes)
        // Agora um agachamento de verdade.
        t = c.cicloDeAngulo(178f, 80f, t, Manequim::agachamento)
        assertEquals(1, c.processar(Manequim.agachamento(178f, t)).repeticoes)
    }

    /** Tremer em torno de um limiar não pode virar contagem. */
    @Test
    fun `oscilacao em torno do limiar nao conta`() {
        val c = ContadorAgachamento()
        var t = 0L
        c.processar(Manequim.agachamento(178f, t)); t += 50
        repeat(40) {
            c.processar(Manequim.agachamento(if (it % 2 == 0) 163f else 157f, t)); t += 50
        }
        assertEquals(0, c.processar(Manequim.agachamento(178f, t)).repeticoes)
    }

    @Test
    fun `contouAgora dispara uma vez por repeticao`() {
        val c = ContadorAgachamento()
        var t = 0L
        var disparos = 0
        c.processar(Manequim.agachamento(178f, t)); t += 50
        repeat(3) {
            val fim = c.cicloDeAngulo(178f, 80f, t, Manequim::agachamento)
            // Reconta alimentando quadro a quadro para observar cada resultado.
            t = fim
        }
        // Refaz o mesmo movimento observando o sinal de cada quadro.
        val d = ContadorAgachamento()
        var u = 0L
        d.processar(Manequim.agachamento(178f, u)); u += 50
        repeat(3) {
            for (v in listOf(150f, 120f, 90f, 80f, 80f, 80f, 80f, 90f, 120f, 150f, 178f, 178f)) {
                if (d.processar(Manequim.agachamento(v, u)).contouAgora) disparos++
                u += 60
            }
        }
        assertEquals(3, disparos)
        assertEquals(3, d.processar(Manequim.agachamento(178f, u)).repeticoes)
    }

    @Test
    fun `reiniciar zera a contagem e a fase`() {
        val c = ciclos(4)
        c.reiniciar()
        val p = c.processar(Manequim.agachamento(178f, 99_000))
        assertEquals(0, p.repeticoes)
        assertSame(Fase.REPOUSO, p.fase)
    }

    @Test
    fun `corpo fora de quadro avisa em vez de quebrar`() {
        val c = ContadorAgachamento()
        val vazio = Esqueleto.de(emptyMap(), 1f, 0)
        val p = c.processar(vazio)
        assertSame(Aviso.CORPO_FORA_DE_QUADRO, p.aviso)
        assertSame(Fase.PROCURANDO, p.fase)
        assertEquals(0, p.repeticoes)
    }

    @Test
    fun `amplitude vai de zero em pe a um agachado`() {
        val c = ContadorAgachamento()
        assertEquals(0f, c.processar(Manequim.agachamento(178f, 0)).amplitude, 0.02f)
        var t = 50L
        repeat(10) { c.processar(Manequim.agachamento(70f, t)); t += 50 }
        assertEquals(1f, c.processar(Manequim.agachamento(70f, t)).amplitude, 0.02f)
    }
}

class FlexaoTest {

    @Test
    fun `flexao completa conta`() {
        val c = ContadorFlexao()
        var t = 0L
        c.processar(Manequim.flexao(175f, t)); t += 50
        t = c.cicloDeAngulo(175f, 80f, t, Manequim::flexao)
        assertEquals(1, c.processar(Manequim.flexao(175f, t)).repeticoes)
    }

    /** Dobrar o cotovelo sentado na cama não é flexão: o tronco está em pé. */
    @Test
    fun `dobrar o braco fora da prancha e recusado`() {
        val c = ContadorFlexao()
        var t = 0L
        var contadas = 0
        repeat(3) {
            for (v in listOf(175f, 140f, 100f, 80f, 80f, 100f, 140f, 175f)) {
                val p = c.processar(Manequim.sentadoNaCama(v, t))
                contadas = p.repeticoes
                assertSame(Aviso.POSICAO_INVALIDA, p.aviso)
                t += 60
            }
        }
        assertEquals(0, contadas)
    }
}

class AbdominalTest {

    @Test
    fun `abdominal completo conta`() {
        val c = ContadorAbdominal()
        var t = 0L
        c.processar(Manequim.abdominal(150f, t)); t += 50
        t = c.cicloDeAngulo(150f, 60f, t, Manequim::abdominal)
        assertEquals(1, c.processar(Manequim.abdominal(150f, t)).repeticoes)
    }

    @Test
    fun `sentado com as pernas na vertical e recusado`() {
        val c = ContadorAbdominal()
        var t = 0L
        repeat(2) {
            for (v in listOf(150f, 110f, 70f, 60f, 70f, 110f, 150f)) {
                assertSame(Aviso.POSICAO_INVALIDA, c.processar(Manequim.sentadoInclinando(v, t)).aviso)
                t += 60
            }
        }
        assertEquals(0, c.processar(Manequim.sentadoInclinando(150f, t)).repeticoes)
    }
}

class PolichineloTest {

    private fun ciclo(c: ContadorRepeticoes, bracos: Float, pernas: Float, de: Long): Long {
        var t = de
        fun alimentar(b: Float, p: Float) { c.processar(Manequim.polichinelo(b, p, t)); t += 50 }
        repeat(5) { alimentar(bracos * (it + 1) / 5, pernas * (it + 1) / 5) }
        repeat(5) { alimentar(bracos, pernas) }
        repeat(5) { alimentar(bracos * (4 - it) / 5, pernas * (4 - it) / 5) }
        repeat(5) { alimentar(0f, 0f) }
        return t
    }

    @Test
    fun `polichinelo completo conta`() {
        val c = ContadorPolichinelo()
        var t = 0L
        c.processar(Manequim.polichinelo(0f, 0f, t)); t += 50
        t = ciclo(c, 1f, 1f, t)
        assertEquals(1, c.processar(Manequim.polichinelo(0f, 0f, t)).repeticoes)
    }

    @Test
    fun `quinze polichinelos contam quinze`() {
        val c = ContadorPolichinelo()
        var t = 0L
        c.processar(Manequim.polichinelo(0f, 0f, t)); t += 50
        repeat(15) { t = ciclo(c, 1f, 1f, t) }
        assertEquals(15, c.processar(Manequim.polichinelo(0f, 0f, t)).repeticoes)
    }

    /**
     * Só bater palma em cima, sem abrir as pernas, deixa o índice de fechamento
     * em 50 — longe dos 30 que abrem a fase EXTREMO.
     */
    @Test
    fun `so os bracos nao conta`() {
        val c = ContadorPolichinelo()
        var t = 0L
        c.processar(Manequim.polichinelo(0f, 0f, t)); t += 50
        repeat(4) { t = ciclo(c, 1f, 0f, t) }
        assertEquals(0, c.processar(Manequim.polichinelo(0f, 0f, t)).repeticoes)
    }

    @Test
    fun `so as pernas nao conta`() {
        val c = ContadorPolichinelo()
        var t = 0L
        c.processar(Manequim.polichinelo(0f, 0f, t)); t += 50
        repeat(4) { t = ciclo(c, 0f, 1f, t) }
        assertEquals(0, c.processar(Manequim.polichinelo(0f, 0f, t)).repeticoes)
    }

    @Test
    fun `deitado e recusado`() {
        val c = ContadorPolichinelo()
        val deitado = Manequim.flexao(175f, 0)
        assertSame(Aviso.POSICAO_INVALIDA, c.processar(deitado).aviso)
    }
}

class FabricaTest {

    @Test
    fun `cada exercicio tem contador e sugestao de repeticoes`() {
        for (e in Exercicio.entries) {
            assertSame(e, contadorDe(e).exercicio)
            assertTrue(e.repeticoesSugeridas in 1..100, "sugestão fora da faixa em $e")
            assertTrue(e.instrucao.isNotBlank() && e.enquadramento.isNotBlank())
        }
    }
}
