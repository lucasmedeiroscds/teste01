package br.com.levanta.ui

import android.Manifest
import android.app.KeyguardManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import br.com.levanta.alarme.ServicoDeAlarme
import br.com.levanta.alarme.SessaoDeAlarme
import br.com.levanta.ui.tela.TelaSemCamera
import br.com.levanta.ui.tela.TelaTreino
import br.com.levanta.ui.tema.TemaLevanta

/**
 * A tela do exercício: câmera aberta, contando as repetições que desligam o
 * alarme.
 *
 * Continua por cima da tela de bloqueio, como a [TocandoActivity] — quem
 * desbloqueou para desligar o alarme não deveria precisar desbloquear de novo
 * no meio dos agachamentos.
 */
class TreinoActivity : ComponentActivity() {

    override fun onCreate(estado: Bundle?) {
        super.onCreate(estado)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            getSystemService(KeyguardManager::class.java).requestDismissKeyguard(this, null)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Sair pelo Voltar seria a forma mais fácil de escapar do exercício.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = Unit
        })
        enableEdgeToEdge()

        setContent {
            val sessao by SessaoDeAlarme.estado.collectAsState()
            var temCamera by remember {
                mutableStateOf(
                    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                        PackageManager.PERMISSION_GRANTED,
                )
            }
            val pedir = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { concedida -> temCamera = concedida }

            LaunchedEffect(Unit) {
                if (!temCamera) pedir.launch(Manifest.permission.CAMERA)
            }

            TemaLevanta(forcarEscuro = true) {
                val atual = sessao
                when {
                    atual == null -> finish()
                    !temCamera -> TelaSemCamera(
                        aoPedirDeNovo = { pedir.launch(Manifest.permission.CAMERA) },
                        aoDesistir = { desligarAlarme() },
                    )
                    else -> TelaTreino(
                        estado = atual,
                        aoConcluir = { desligarAlarme() },
                        aoDesistir = { desligarAlarme() },
                    )
                }
            }
        }
    }

    private fun desligarAlarme() {
        ServicoDeAlarme.enviar(this, ServicoDeAlarme.ACAO_PARAR)
        finishAffinity()
    }

}
