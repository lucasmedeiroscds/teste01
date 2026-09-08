package br.com.levanta.ui.tela

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.core.alarme.diasFormatados
import br.com.levanta.core.alarme.proximoAtivo
import br.com.levanta.core.alarme.tempoAte
import java.time.ZonedDateTime

/** Um aviso de configuração pendente, com o botão que resolve. */
data class Pendencia(val texto: String, val acao: String, val aoTocar: () -> Unit)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaLista(
    alarmes: List<Alarme>,
    pendencias: List<Pendencia>,
    aoAlternar: (Alarme, Boolean) -> Unit,
    aoAbrir: (Alarme?) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Levanta", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { aoAbrir(null) },
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Novo alarme") },
            )
        },
    ) { espaco ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(espaco),
            contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(pendencias) { CartaoDePendencia(it) }

            if (alarmes.isNotEmpty()) {
                item { ProximoAlarme(alarmes) }
            }

            items(alarmes, key = { it.id }) { alarme ->
                CartaoDeAlarme(alarme, aoAlternar = { aoAlternar(alarme, it) }, aoAbrir = { aoAbrir(alarme) })
            }

            if (alarmes.isEmpty()) {
                item { Vazio() }
            }
        }
    }
}

@Composable
private fun ProximoAlarme(alarmes: List<Alarme>) {
    val agora = ZonedDateTime.now()
    val proximo = alarmes.proximoAtivo(agora)
    Text(
        text = proximo?.let { (a, quando) ->
            "Próximo: ${a.horarioFormatado()}, ${tempoAte(agora, quando)}"
        } ?: "Nenhum alarme ligado",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp, bottom = 4.dp),
    )
}

@Composable
private fun CartaoDeAlarme(alarme: Alarme, aoAlternar: (Boolean) -> Unit, aoAbrir: () -> Unit) {
    Card(
        onClick = aoAbrir,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    alarme.horarioFormatado(),
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Light,
                    color = if (alarme.ativo) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "${alarme.diasFormatados()} · ${alarme.repeticoes} ${alarme.exercicio.rotulo.lowercase()}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (alarme.rotulo.isNotBlank()) {
                    Text(
                        alarme.rotulo,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Switch(checked = alarme.ativo, onCheckedChange = aoAlternar)
        }
    }
}

@Composable
private fun CartaoDePendencia(p: Pendencia) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
        ),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
            )
            Spacer(Modifier.width(12.dp))
            Text(
                p.texto,
                Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            TextButton(onClick = p.aoTocar) { Text(p.acao) }
        }
    }
}

@Composable
private fun Vazio() {
    Box(
        Modifier.fillMaxWidth().padding(top = 80.dp).background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Nenhum alarme ainda", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "Crie um e escolha quantas repetições você vai\nprecisar fazer para conseguir desligar.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
