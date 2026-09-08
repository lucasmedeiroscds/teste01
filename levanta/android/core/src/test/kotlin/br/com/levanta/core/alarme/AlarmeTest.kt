package br.com.levanta.core.alarme

import br.com.levanta.core.pose.Exercicio
import java.time.DayOfWeek
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProximoDisparoTest {

    private val saoPaulo: ZoneId = ZoneId.of("America/Sao_Paulo")

    private fun em(texto: String, zona: ZoneId = saoPaulo): ZonedDateTime =
        java.time.LocalDateTime.parse(texto).atZone(zona)

    private fun alarme(hora: Int, minuto: Int, vararg dias: DayOfWeek) =
        Alarme(id = 1, hora = hora, minuto = minuto, dias = dias.toSet())

    @Test
    fun `alarme unico mais tarde hoje toca hoje`() {
        val agora = em("2026-09-08T06:00")            // terça
        assertEquals(em("2026-09-08T07:30"), alarme(7, 30).proximoDisparo(agora))
    }

    @Test
    fun `alarme unico ja passado hoje toca amanha`() {
        val agora = em("2026-09-08T09:00")
        assertEquals(em("2026-09-09T07:30"), alarme(7, 30).proximoDisparo(agora))
    }

    /**
     * Consultado no instante exato do disparo o alarme aponta para o dia
     * seguinte. Se apontasse para agora, o reagendamento feito logo depois de
     * tocar devolveria o mesmo instante e o alarme entraria em laço.
     */
    @Test
    fun `alarme consultado no instante exato aponta para o proximo`() {
        val agora = em("2026-09-08T07:30")
        assertEquals(em("2026-09-09T07:30"), alarme(7, 30).proximoDisparo(agora))
    }

    @Test
    fun `alarme semanal pula para o proximo dia marcado`() {
        val agora = em("2026-09-08T09:00")            // terça de manhã
        val a = alarme(7, 0, DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY)
        assertEquals(em("2026-09-09T07:00"), a.proximoDisparo(agora))   // quarta
    }

    @Test
    fun `alarme semanal no proprio dia antes da hora toca hoje`() {
        val agora = em("2026-09-09T05:00")            // quarta de madrugada
        val a = alarme(7, 0, DayOfWeek.WEDNESDAY)
        assertEquals(em("2026-09-09T07:00"), a.proximoDisparo(agora))
    }

    @Test
    fun `alarme de um unico dia da semana volta em sete dias`() {
        val agora = em("2026-09-09T08:00")            // quarta, já passou
        val a = alarme(7, 0, DayOfWeek.WEDNESDAY)
        assertEquals(em("2026-09-16T07:00"), a.proximoDisparo(agora))
    }

    @Test
    fun `alarme de todo dia toca amanha quando ja passou`() {
        val agora = em("2026-09-08T08:00")
        val a = Alarme(id = 1, hora = 7, minuto = 0, dias = DayOfWeek.entries.toSet())
        assertEquals(em("2026-09-09T07:00"), a.proximoDisparo(agora))
    }

    @Test
    fun `virada de mes e de ano`() {
        assertEquals(
            em("2027-01-01T06:00"),
            alarme(6, 0).proximoDisparo(em("2026-12-31T23:59")),
        )
    }

    /**
     * No horário de verão americano de 2026 os relógios pulam das 2h para as 3h
     * do dia 8 de março. Um alarme das 2:30 não existe nesse dia: o fuso
     * empurra para as 3:30, em vez de o app agendar um instante impossível.
     */
    @Test
    fun `hora que nao existe na virada do horario de verao e empurrada para a frente`() {
        val novaYork = ZoneId.of("America/New_York")
        val agora = em("2026-03-08T01:00", novaYork)
        val disparo = alarme(2, 30).proximoDisparo(agora)
        assertTrue(disparo.isAfter(agora), "o disparo tem que ficar no futuro")
        assertEquals(3, disparo.hour)
        assertEquals(30, disparo.minute)
    }

    @Test
    fun `proximo ativo escolhe o alarme mais proximo e ignora os desligados`() {
        val agora = em("2026-09-08T06:00")
        val cedo = Alarme(id = 1, hora = 6, minuto = 30)
        val tarde = Alarme(id = 2, hora = 8, minuto = 0)
        val desligadoMaisCedo = Alarme(id = 3, hora = 6, minuto = 10, ativo = false)
        val (alarme, quando) = listOf(tarde, desligadoMaisCedo, cedo).proximoAtivo(agora)!!
        assertEquals(1L, alarme.id)
        assertEquals(em("2026-09-08T06:30"), quando)
    }

    @Test
    fun `lista sem alarme ativo nao tem proximo`() {
        assertNull(listOf(Alarme(id = 1, hora = 6, minuto = 0, ativo = false)).proximoAtivo(em("2026-09-08T06:00")))
        assertNull(emptyList<Alarme>().proximoAtivo(em("2026-09-08T06:00")))
    }
}

class FormatacaoTest {

    private val zona: ZoneId = ZoneId.of("America/Sao_Paulo")
    private fun em(t: String) = java.time.LocalDateTime.parse(t).atZone(zona)

    @Test
    fun `horario sempre com dois digitos`() {
        assertEquals("07:05", Alarme(id = 1, hora = 7, minuto = 5).horarioFormatado())
        assertEquals("23:59", Alarme(id = 1, hora = 23, minuto = 59).horarioFormatado())
    }

    @Test
    fun `dias ganham nome curto em portugues`() {
        fun a(vararg d: DayOfWeek) = Alarme(id = 1, hora = 7, minuto = 0, dias = d.toSet()).diasFormatados()
        assertEquals("Uma vez", a())
        assertEquals("Todo dia", a(*DayOfWeek.entries.toTypedArray()))
        assertEquals(
            "Dias úteis",
            a(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY),
        )
        assertEquals("Fim de semana", a(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY))
        // Domingo abre a semana, como no calendário brasileiro.
        assertEquals("Dom, Seg, Sex", a(DayOfWeek.MONDAY, DayOfWeek.FRIDAY, DayOfWeek.SUNDAY))
    }

    @Test
    fun `tempo ate o disparo em palavras`() {
        assertEquals("em 7 h 20 min", tempoAte(em("2026-09-08T22:40"), em("2026-09-09T06:00")))
        assertEquals("em 45 min", tempoAte(em("2026-09-08T06:00"), em("2026-09-08T06:45")))
        assertEquals("em 2 dias 1 h", tempoAte(em("2026-09-08T06:00"), em("2026-09-10T07:00")))
    }
}

class ValidacaoTest {

    @Test
    fun `horario invalido e recusado na construcao`() {
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = 24, minuto = 0) }
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = 7, minuto = 60) }
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = -1, minuto = 0) }
    }

    @Test
    fun `repeticoes e soneca fora da faixa sao recusadas`() {
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = 7, minuto = 0, repeticoes = 0) }
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = 7, minuto = 0, sonecaMinutos = 0) }
        assertFailsWith<IllegalArgumentException> { Alarme(id = 1, hora = 7, minuto = 0, maxSonecas = 21) }
    }

    @Test
    fun `repeticoes seguem a sugestao do exercicio por padrao`() {
        val a = Alarme(id = 1, hora = 7, minuto = 0, exercicio = Exercicio.POLICHINELO)
        assertEquals(Exercicio.POLICHINELO.repeticoesSugeridas, a.repeticoes)
    }
}
