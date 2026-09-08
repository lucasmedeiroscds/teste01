package br.com.levanta.alarme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import br.com.levanta.dados.RepositorioAlarmes

/**
 * Reagenda tudo depois de reiniciar o aparelho, de atualizar o app e de mudar
 * o fuso ou a hora do sistema.
 *
 * O AlarmManager esquece todos os alarmes ao desligar o celular: sem este
 * receptor, quem reinicia o aparelho à noite acorda sem despertador.
 */
class ReceptorDeBoot : BroadcastReceiver() {

    override fun onReceive(contexto: Context, intent: Intent) {
        val relevante = intent.action in setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            "android.intent.action.QUICKBOOT_POWERON",
        )
        if (!relevante) return
        val alarmes = RepositorioAlarmes.de(contexto).alarmes.value
        Log.i("ReceptorDeBoot", "${intent.action}: reagendando ${alarmes.size} alarmes")
        Agendador.reagendarTodos(contexto, alarmes)
    }
}
