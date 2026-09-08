package br.com.levanta

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import br.com.levanta.alarme.Agendador
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.dados.RepositorioAlarmes
import br.com.levanta.ui.tela.Pendencia
import br.com.levanta.ui.tela.TelaEditor
import br.com.levanta.ui.tela.TelaLista
import br.com.levanta.ui.tema.TemaLevanta
import kotlinx.coroutines.launch

/** Onde o alvo da navegação para: a lista ou o editor de um alarme. */
private sealed interface Destino {
    data object Lista : Destino
    data class Editor(val alarme: Alarme?) : Destino
}

class MainActivity : ComponentActivity() {

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(estado: Bundle?) {
        super.onCreate(estado)
        enableEdgeToEdge()
        val repositorio = RepositorioAlarmes.de(this)

        setContent {
            val alarmes by repositorio.alarmes.collectAsState()
            var destino by remember { mutableStateOf<Destino>(Destino.Lista) }
            val pendencias = pendenciasDeConfiguracao()

            TemaLevanta {
                when (val d = destino) {
                    Destino.Lista -> TelaLista(
                        alarmes = alarmes,
                        pendencias = pendencias,
                        aoAlternar = { alarme, ligado ->
                            lifecycleScope.launch {
                                val novo = alarme.copy(ativo = ligado)
                                repositorio.salvar(novo)
                                Agendador.agendar(this@MainActivity, novo)
                            }
                        },
                        aoAbrir = { destino = Destino.Editor(it) },
                    )

                    is Destino.Editor -> TelaEditor(
                        original = d.alarme,
                        aoSalvar = { editado ->
                            lifecycleScope.launch {
                                val comId = if (editado.id == 0L) {
                                    editado.copy(id = repositorio.novoId())
                                } else {
                                    editado
                                }
                                repositorio.salvar(comId)
                                Agendador.agendar(this@MainActivity, comId)
                                destino = Destino.Lista
                            }
                        },
                        aoRemover = d.alarme?.let { alvo ->
                            {
                                lifecycleScope.launch {
                                    Agendador.cancelar(this@MainActivity, alvo.id)
                                    repositorio.remover(alvo.id)
                                    destino = Destino.Lista
                                }
                                Unit
                            }
                        },
                        aoVoltar = { destino = Destino.Lista },
                    )
                }
            }
        }
    }

    /**
     * As permissões sem as quais o despertador simplesmente não toca.
     *
     * São verificadas de novo a cada volta para a tela porque o usuário as
     * concede numa tela do sistema, fora do app: sem reavaliar no `ON_RESUME`,
     * o aviso continuaria lá depois de já ter sido resolvido.
     */
    @Composable
    private fun pendenciasDeConfiguracao(): List<Pendencia> {
        var versao by remember { mutableStateOf(0) }
        val dono = LocalLifecycleOwner.current
        val notificacoes = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { versao++ }

        LaunchedEffect(dono) {
            val observador = LifecycleEventObserver { _, evento ->
                if (evento == Lifecycle.Event.ON_RESUME) versao++
            }
            dono.lifecycle.addObserver(observador)
        }

        // `versao` entra na chave para a lista ser recalculada a cada retorno.
        return remember(versao) {
            buildList {
                if (!Agendador.podeAgendarExato(this@MainActivity)) {
                    add(
                        Pendencia(
                            "O Android está bloqueando alarmes exatos. Sem isso o despertador atrasa ou não toca.",
                            "Permitir",
                        ) { abrirAlarmesExatos() },
                    )
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) !=
                    android.content.pm.PackageManager.PERMISSION_GRANTED
                ) {
                    add(
                        Pendencia(
                            "Sem permissão de notificação a tela do alarme não aparece sozinha.",
                            "Permitir",
                        ) { notificacoes.launch(Manifest.permission.POST_NOTIFICATIONS) },
                    )
                }
                if (!semRestricaoDeBateria()) {
                    add(
                        Pendencia(
                            "A economia de bateria pode adiar o alarme. Recomendado liberar o Levanta.",
                            "Liberar",
                        ) { abrirIsencaoDeBateria() },
                    )
                }
            }
        }
    }

    private fun semRestricaoDeBateria(): Boolean =
        getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    private fun abrirAlarmesExatos() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching {
                startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")),
                )
            }.onFailure { abrirDetalhesDoApp() }
        }
    }

    @Suppress("BatteryLife")   // Um despertador é o caso de uso legítimo desta isenção.
    private fun abrirIsencaoDeBateria() {
        runCatching {
            startActivity(
                Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:$packageName"),
                ),
            )
        }.onFailure { abrirDetalhesDoApp() }
    }

    private fun abrirDetalhesDoApp() {
        startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")),
        )
    }
}

/** Atalho usado pelos receptores para checar permissão sem repetir o `checkSelfPermission`. */
fun Context.temPermissao(nome: String): Boolean =
    ContextCompat.checkSelfPermission(this, nome) == android.content.pm.PackageManager.PERMISSION_GRANTED
