package br.com.levanta.dados

import android.content.Context
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.core.pose.Exercicio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File
import java.time.DayOfWeek

/** Forma serializada de [Alarme] — enums viram texto para o arquivo sobreviver a atualizações. */
@Serializable
private data class AlarmeSalvo(
    val id: Long,
    val hora: Int,
    val minuto: Int,
    val dias: List<Int> = emptyList(),
    val ativo: Boolean = true,
    val rotulo: String = "",
    val exercicio: String = Exercicio.AGACHAMENTO.name,
    val repeticoes: Int = 20,
    val sonecaMinutos: Int = 5,
    val maxSonecas: Int = 3,
    val vibrar: Boolean = true,
    val volume: Float = 1f,
) {
    fun paraAlarme() = Alarme(
        id = id,
        hora = hora,
        minuto = minuto,
        dias = dias.mapNotNull { d -> DayOfWeek.entries.firstOrNull { it.value == d } }.toSet(),
        ativo = ativo,
        rotulo = rotulo,
        exercicio = Exercicio.entries.firstOrNull { it.name == exercicio } ?: Exercicio.AGACHAMENTO,
        repeticoes = repeticoes.coerceIn(1, 500),
        sonecaMinutos = sonecaMinutos.coerceIn(1, 60),
        maxSonecas = maxSonecas.coerceIn(0, 20),
        vibrar = vibrar,
        volume = volume.coerceIn(0f, 1f),
    )

    companion object {
        fun de(a: Alarme) = AlarmeSalvo(
            id = a.id, hora = a.hora, minuto = a.minuto,
            dias = a.dias.map { it.value }.sorted(),
            ativo = a.ativo, rotulo = a.rotulo, exercicio = a.exercicio.name,
            repeticoes = a.repeticoes, sonecaMinutos = a.sonecaMinutos,
            maxSonecas = a.maxSonecas, vibrar = a.vibrar, volume = a.volume,
        )
    }
}

/**
 * Guarda os alarmes num único JSON no armazenamento privado do app.
 *
 * A gravação é atômica — escreve num arquivo temporário e renomeia — porque o
 * processo pode morrer no meio: um JSON truncado apagaria todos os alarmes da
 * pessoa, e um despertador que perde o alarme da noite é pior que um que
 * demora um pouco para salvar.
 */
class RepositorioAlarmes private constructor(contexto: Context) {

    private val arquivo = File(contexto.filesDir, "alarmes.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val trava = Mutex()

    private val _alarmes = MutableStateFlow(carregar())
    val alarmes: StateFlow<List<Alarme>> = _alarmes.asStateFlow()

    private fun carregar(): List<Alarme> = runCatching {
        if (!arquivo.exists()) return emptyList()
        json.decodeFromString(SERIALIZADOR, arquivo.readText()).map { it.paraAlarme() }
    }.getOrElse { emptyList() }

    private suspend fun gravar(lista: List<Alarme>) = withContext(Dispatchers.IO) {
        trava.withLock {
            val temp = File(arquivo.parentFile, "${arquivo.name}.tmp")
            temp.writeText(json.encodeToString(SERIALIZADOR, lista.map { AlarmeSalvo.de(it) }))
            temp.renameTo(arquivo)
        }
        _alarmes.value = lista
    }

    suspend fun salvar(a: Alarme) {
        val lista = _alarmes.value.filterNot { it.id == a.id } + a
        gravar(lista.sortedWith(compareBy({ it.hora }, { it.minuto })))
    }

    suspend fun remover(id: Long) = gravar(_alarmes.value.filterNot { it.id == id })

    fun porId(id: Long): Alarme? = _alarmes.value.firstOrNull { it.id == id }

    /** Id novo baseado no relógio: não colide entre sessões nem depois de desinstalar. */
    fun novoId(): Long = System.currentTimeMillis()

    companion object {
        private val SERIALIZADOR = ListSerializer(AlarmeSalvo.serializer())

        @Volatile private var instancia: RepositorioAlarmes? = null

        fun de(contexto: Context): RepositorioAlarmes =
            instancia ?: synchronized(this) {
                instancia ?: RepositorioAlarmes(contexto.applicationContext).also { instancia = it }
            }
    }
}
