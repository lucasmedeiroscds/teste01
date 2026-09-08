package br.com.levanta.ui

import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import br.com.levanta.alarme.ServicoDeAlarme
import br.com.levanta.alarme.SessaoDeAlarme
import br.com.levanta.ui.tela.TelaTocando
import br.com.levanta.ui.tema.TemaLevanta

/**
 * A tela que aparece quando o alarme toca.
 *
 * Ela precisa surgir sozinha por cima da tela de bloqueio, com o aparelho no
 * bolso e a tela apagada — daí os três pedidos ao sistema no [onCreate]: acordar
 * a tela, aparecer sobre o bloqueio e pedir ao teclado de bloqueio que saia da
 * frente. Sem eles a pessoa ouviria o alarme mas encontraria só a tela de senha.
 */
class TocandoActivity : ComponentActivity() {

    override fun onCreate(estado: Bundle?) {
        super.onCreate(estado)
        mostrarSobreOBloqueio()
        bloquearVoltar()
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContent {
            val sessao by SessaoDeAlarme.estado.collectAsState()
            TemaLevanta(forcarEscuro = true) {
                val atual = sessao
                if (atual == null) {
                    // O alarme já foi desligado por outro caminho (notificação,
                    // limite de 15 min): não há nada a mostrar.
                    finish()
                } else {
                    TelaTocando(
                        estado = atual,
                        aoAdiar = {
                            ServicoDeAlarme.enviar(this, ServicoDeAlarme.ACAO_ADIAR)
                            finish()
                        },
                        aoDesligar = {
                            ServicoDeAlarme.enviar(this, ServicoDeAlarme.ACAO_ABAIXAR)
                            startActivity(Intent(this, TreinoActivity::class.java))
                        },
                    )
                }
            }
        }
    }

    /**
     * O botão Voltar não pode escapar do alarme.
     *
     * Um retorno habilitado que não faz nada é o jeito atual de segurar o
     * gesto: sobrescrever `onBackPressed` está obsoleto e quebra o "voltar
     * preditivo" do Android 14.
     */
    private fun bloquearVoltar() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = Unit
        })
    }

    private fun mostrarSobreOBloqueio() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            getSystemService(KeyguardManager::class.java).requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

}
