package br.com.levanta.core.alarme

import br.com.levanta.core.pose.Exercicio
import java.time.DayOfWeek
import java.time.LocalTime
import java.time.ZonedDateTime

/**
 * Um alarme configurado.
 *
 * [dias] vazio significa alarme de uma vez só: toca no próximo horário e se
 * desativa. Com dias marcados ele se repete toda semana.
 */
data class Alarme(
    val id: Long,
    val hora: Int,
    val minuto: Int,
    val dias: Set<DayOfWeek> = emptySet(),
    val ativo: Boolean = true,
    val rotulo: String = "",
    val exercicio: Exercicio = Exercicio.AGACHAMENTO,
    val repeticoes: Int = exercicio.repeticoesSugeridas,
    val sonecaMinutos: Int = 5,
    /** Quantas sonecas antes de o botão sumir. 0 tira a soneca do alarme. */
    val maxSonecas: Int = 3,
    val vibrar: Boolean = true,
    val volume: Float = 1f,
) {
    init {
        require(hora in 0..23) { "hora fora de 0..23: $hora" }
        require(minuto in 0..59) { "minuto fora de 0..59: $minuto" }
        require(repeticoes in 1..500) { "repetições fora de 1..500: $repeticoes" }
        require(sonecaMinutos in 1..60) { "soneca fora de 1..60: $sonecaMinutos" }
        require(maxSonecas in 0..20) { "máximo de sonecas fora de 0..20: $maxSonecas" }
    }

    val horario: LocalTime get() = LocalTime.of(hora, minuto)

    val repetido: Boolean get() = dias.isNotEmpty()

    /** "07:30" */
    fun horarioFormatado(): String = "%02d:%02d".format(hora, minuto)
}

/**
 * Quando este alarme toca pela próxima vez, a partir de [agora].
 *
 * O resultado é sempre estritamente depois de [agora]: um alarme das 7:00
 * consultado exatamente às 7:00 aponta para o dia seguinte, senão o alarme que
 * acabou de tocar seria reagendado para o mesmo instante e tocaria em laço.
 *
 * O cálculo monta a data e só então aplica o fuso, em vez de trocar a hora de
 * um instante já datado. É o que faz o alarme se comportar na virada do
 * horário de verão: numa hora que não existe o próprio fuso empurra para a hora
 * seguinte, em vez de o alarme cair num instante inválido.
 */
fun Alarme.proximoDisparo(agora: ZonedDateTime): ZonedDateTime {
    val zona = agora.zone
    fun em(dias: Long): ZonedDateTime = agora.toLocalDate().plusDays(dias).atTime(horario).atZone(zona)

    if (!repetido) {
        val hoje = em(0)
        return if (hoje.isAfter(agora)) hoje else em(1)
    }
    for (d in 0L..7L) {
        val candidato = em(d)
        if (candidato.isAfter(agora) && candidato.dayOfWeek in dias) return candidato
    }
    // Inalcançável: sete dias cobrem toda a semana. Mantido para o compilador.
    error("nenhum dia da semana casou para o alarme $id")
}

/** O próximo alarme a tocar entre os ativos, ou `null` se não houver nenhum. */
fun List<Alarme>.proximoAtivo(agora: ZonedDateTime): Pair<Alarme, ZonedDateTime>? =
    filter { it.ativo }
        .map { it to it.proximoDisparo(agora) }
        .minByOrNull { it.second }

/** "Seg, Qua, Sex", "Todo dia", "Dias úteis", "Fim de semana" ou a data única. */
fun Alarme.diasFormatados(): String {
    if (!repetido) return "Uma vez"
    if (dias.size == 7) return "Todo dia"
    val uteis = setOf(
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY,
    )
    if (dias == uteis) return "Dias úteis"
    if (dias == setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)) return "Fim de semana"
    return DayOfWeek.entries
        .filter { it in dias }
        .sortedBy { (it.value % 7) }   // domingo primeiro, como no calendário brasileiro
        .joinToString(", ") { abreviacao(it) }
}

fun abreviacao(d: DayOfWeek): String = when (d) {
    DayOfWeek.SUNDAY -> "Dom"
    DayOfWeek.MONDAY -> "Seg"
    DayOfWeek.TUESDAY -> "Ter"
    DayOfWeek.WEDNESDAY -> "Qua"
    DayOfWeek.THURSDAY -> "Qui"
    DayOfWeek.FRIDAY -> "Sex"
    DayOfWeek.SATURDAY -> "Sáb"
}

/** "em 7 h 20 min" — o aviso que aparece ao ligar um alarme. */
fun tempoAte(agora: ZonedDateTime, disparo: ZonedDateTime): String {
    val minutos = java.time.Duration.between(agora, disparo).toMinutes()
    val dias = minutos / 1440
    val horas = (minutos % 1440) / 60
    val min = minutos % 60
    return buildString {
        append("em ")
        if (dias > 0) append("$dias ${if (dias == 1L) "dia" else "dias"} ")
        if (horas > 0) append("$horas h ")
        if (dias == 0L) append("$min min")
    }.trim()
}
