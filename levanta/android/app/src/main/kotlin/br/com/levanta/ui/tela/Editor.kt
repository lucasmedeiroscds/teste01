package br.com.levanta.ui.tela

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.core.alarme.abreviacao
import br.com.levanta.core.pose.Exercicio
import java.time.DayOfWeek
import kotlin.math.roundToInt

/** Domingo a sábado, na ordem do calendário brasileiro. */
private val SEMANA = listOf(
    DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaEditor(
    original: Alarme?,
    aoSalvar: (Alarme) -> Unit,
    aoRemover: (() -> Unit)?,
    aoVoltar: () -> Unit,
) {
    val base = original ?: Alarme(id = 0, hora = 7, minuto = 0)
    val relogio = rememberTimePickerState(base.hora, base.minuto, is24Hour = true)
    var dias by remember { mutableStateOf(base.dias) }
    var exercicio by remember { mutableStateOf(base.exercicio) }
    var repeticoes by remember { mutableFloatStateOf(base.repeticoes.toFloat()) }
    var soneca by remember { mutableFloatStateOf(base.sonecaMinutos.toFloat()) }
    var maxSonecas by remember { mutableFloatStateOf(base.maxSonecas.toFloat()) }
    var vibrar by remember { mutableStateOf(base.vibrar) }
    var rotulo by remember { mutableStateOf(base.rotulo) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (original == null) "Novo alarme" else "Editar alarme") },
                navigationIcon = {
                    IconButton(onClick = aoVoltar) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    if (aoRemover != null) {
                        IconButton(onClick = aoRemover) {
                            Icon(Icons.Default.Delete, contentDescription = "Excluir alarme")
                        }
                    }
                },
            )
        },
    ) { espaco ->
        Column(
            Modifier.fillMaxSize().padding(espaco).verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                TimePicker(state = relogio)
            }

            Secao("Repetir") {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SEMANA.forEach { dia ->
                        FilterChip(
                            selected = dia in dias,
                            onClick = { dias = if (dia in dias) dias - dia else dias + dia },
                            label = { Text(abreviacao(dia).take(1)) },
                            shape = CircleShape,
                            modifier = Modifier.size(42.dp),
                        )
                    }
                }
                if (dias.isEmpty()) {
                    Texto("Sem dia marcado, o alarme toca uma vez e se desliga.")
                }
            }

            Secao("Para desligar, fazer") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Exercicio.entries.forEach { e ->
                        CartaoDeExercicio(
                            exercicio = e,
                            selecionado = e == exercicio,
                            aoTocar = {
                                exercicio = e
                                repeticoes = e.repeticoesSugeridas.toFloat()
                            },
                        )
                    }
                }
            }

            Secao("Repetições: ${repeticoes.roundToInt()}") {
                Slider(
                    value = repeticoes,
                    onValueChange = { repeticoes = it },
                    valueRange = 1f..100f,
                    steps = 98,
                )
                Texto(exercicio.instrucao)
            }

            Secao("Soneca") {
                Texto("Cada soneca adia ${soneca.roundToInt()} min.")
                Slider(value = soneca, onValueChange = { soneca = it }, valueRange = 1f..30f, steps = 28)
                Texto(
                    if (maxSonecas.roundToInt() == 0) "Sem soneca: só o exercício desliga."
                    else "No máximo ${maxSonecas.roundToInt()} sonecas; depois só o exercício desliga.",
                )
                Slider(value = maxSonecas, onValueChange = { maxSonecas = it }, valueRange = 0f..10f, steps = 9)
            }

            Secao("Extras") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Vibrar", Modifier.weight(1f))
                    Switch(checked = vibrar, onCheckedChange = { vibrar = it })
                }
                OutlinedTextField(
                    value = rotulo,
                    onValueChange = { rotulo = it.take(40) },
                    label = { Text("Nome do alarme") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Button(
                onClick = {
                    aoSalvar(
                        base.copy(
                            hora = relogio.hour,
                            minuto = relogio.minute,
                            dias = dias,
                            ativo = true,
                            rotulo = rotulo.trim(),
                            exercicio = exercicio,
                            repeticoes = repeticoes.roundToInt(),
                            sonecaMinutos = soneca.roundToInt(),
                            maxSonecas = maxSonecas.roundToInt(),
                            vibrar = vibrar,
                        ),
                    )
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text("Salvar alarme") }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CartaoDeExercicio(exercicio: Exercicio, selecionado: Boolean, aoTocar: () -> Unit) {
    Card(
        onClick = aoTocar,
        colors = CardDefaults.cardColors(
            containerColor = if (selecionado) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                exercicio.rotulo,
                fontWeight = if (selecionado) FontWeight.Bold else FontWeight.Normal,
                color = if (selecionado) MaterialTheme.colorScheme.onPrimaryContainer
                else MaterialTheme.colorScheme.onSurface,
            )
            Text(
                exercicio.enquadramento,
                style = MaterialTheme.typography.bodySmall,
                color = if (selecionado) MaterialTheme.colorScheme.onPrimaryContainer
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun Secao(titulo: String, conteudo: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(titulo, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        conteudo()
    }
}

@Composable
private fun Texto(t: String) = Text(
    t,
    style = MaterialTheme.typography.bodySmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
)
