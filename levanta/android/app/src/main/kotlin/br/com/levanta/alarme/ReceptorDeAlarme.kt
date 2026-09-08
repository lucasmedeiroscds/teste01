package br.com.levanta.alarme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Recebe o disparo do AlarmManager e passa a bola ao serviço em primeiro plano. */
class ReceptorDeAlarme : BroadcastReceiver() {

    override fun onReceive(contexto: Context, intent: Intent) {
        if (intent.action != ACAO_DISPARAR) return
        val id = intent.getLongExtra(EXTRA_ID, -1L)
        if (id < 0) return
        Log.i("ReceptorDeAlarme", "disparo do alarme $id")

        // O receptor tem poucos segundos de vida; tudo o que dura é do serviço.
        val paraOServico = Intent(contexto, ServicoDeAlarme::class.java).apply {
            action = ServicoDeAlarme.ACAO_TOCAR
            putExtra(EXTRA_ID, id)
            putExtra(EXTRA_SONECA, intent.getBooleanExtra(EXTRA_SONECA, false))
        }
        contexto.startForegroundService(paraOServico)
    }

    companion object {
        const val ACAO_DISPARAR = "br.com.levanta.DISPARAR"
        const val EXTRA_ID = "alarme_id"
        const val EXTRA_SONECA = "veio_da_soneca"
    }
}
