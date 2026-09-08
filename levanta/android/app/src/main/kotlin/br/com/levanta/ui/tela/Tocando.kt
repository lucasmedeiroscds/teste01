package br.com.levanta.ui.tela

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.levanta.alarme.SessaoDeAlarme
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun TelaTocando(
    estado: SessaoDeAlarme.Estado,
    aoAdiar: () -> Unit,
    aoDesligar: () -> Unit,
) {
    val pulso by rememberInfiniteTransition(label = "pulso").animateFloat(
        initialValue = 1f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "escala",
    )

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(48.dp))
            Text(
                LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")),
                fontSize = 76.sp,
                fontWeight = FontWeight.Light,
                modifier = Modifier.scale(pulso),
            )
            if (estado.alarme.rotulo.isNotBlank()) {
                Text(
                    estado.alarme.rotulo,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "Para desligar",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "${estado.alarme.repeticoes} ${estado.alarme.exercicio.rotulo.lowercase()}",
                fontSize = 30.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                estado.alarme.exercicio.enquadramento,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }

        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = aoDesligar,
                modifier = Modifier.fillMaxWidth().height(64.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                ),
            ) { Text("Desligar", fontSize = 19.sp, fontWeight = FontWeight.Bold) }

            if (estado.podeAdiar) {
                OutlinedButton(
                    onClick = aoAdiar,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    Text(
                        "Soneca de ${estado.alarme.sonecaMinutos} min " +
                            "(${estado.sonecasRestantes} ${if (estado.sonecasRestantes == 1) "restante" else "restantes"})",
                    )
                }
            } else {
                Text(
                    "Acabaram as sonecas. Agora é o exercício.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
