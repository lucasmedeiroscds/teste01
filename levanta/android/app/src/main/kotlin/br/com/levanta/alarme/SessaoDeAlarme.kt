package br.com.levanta.alarme

import br.com.levanta.core.alarme.Alarme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * O alarme que está tocando agora, compartilhado entre o serviço e as telas.
 *
 * Vive em memória de propósito: se o processo morre, não há alarme tocando —
 * o [ServicoDeAlarme] em primeiro plano é o que mantém o processo vivo, e sem
 * ele não há sessão a restaurar.
 */
object SessaoDeAlarme {

    data class Estado(
        val alarme: Alarme,
        val sonecasUsadas: Int,
        /** Repetições já validadas nesta tentativa de desligar. */
        val repeticoesFeitas: Int = 0,
    ) {
        val podeAdiar: Boolean get() = sonecasUsadas < alarme.maxSonecas
        val sonecasRestantes: Int get() = (alarme.maxSonecas - sonecasUsadas).coerceAtLeast(0)
    }

    private val _estado = MutableStateFlow<Estado?>(null)
    val estado: StateFlow<Estado?> = _estado.asStateFlow()

    fun iniciar(alarme: Alarme, sonecasUsadas: Int) {
        _estado.value = Estado(alarme, sonecasUsadas)
    }

    fun registrarRepeticoes(feitas: Int) {
        _estado.value = _estado.value?.copy(repeticoesFeitas = feitas)
    }

    fun encerrar() {
        _estado.value = null
    }

    /** Quantas sonecas cada alarme já gastou, para o contador não zerar a cada disparo. */
    private val sonecas = mutableMapOf<Long, Int>()

    fun sonecasDe(id: Long): Int = sonecas[id] ?: 0
    fun contarSoneca(id: Long) { sonecas[id] = sonecasDe(id) + 1 }
    fun zerarSonecas(id: Long) { sonecas.remove(id) }
}
