package br.com.levanta.alarme

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import br.com.levanta.MainActivity
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.core.alarme.proximoDisparo
import java.time.ZonedDateTime

/**
 * Põe e tira alarmes do [AlarmManager].
 *
 * Usa `setAlarmClock`, e não `setExact`, de propósito: é a única variante que o
 * Android trata como despertador de verdade. Ela fura o Doze mesmo com o
 * aparelho parado a noite inteira, aparece como o próximo despertador do
 * sistema e acende o ícone de alarme na barra de status. `setExact` e
 * `setExactAndAllowWhileIdle` podem ser adiadas pelo sistema — num app de
 * despertador, atrasar é falhar.
 */
object Agendador {

    private const val TAG = "Agendador"

    fun agendar(contexto: Context, alarme: Alarme, agora: ZonedDateTime = ZonedDateTime.now()) {
        if (!alarme.ativo) { cancelar(contexto, alarme.id); return }
        val gerente = contexto.getSystemService(AlarmManager::class.java)
        if (!podeAgendarExato(contexto)) {
            Log.w(TAG, "sem permissão de alarme exato; alarme ${alarme.id} não foi agendado")
            return
        }
        val quando = alarme.proximoDisparo(agora).toInstant().toEpochMilli()
        gerente.setAlarmClock(
            AlarmManager.AlarmClockInfo(quando, aberturaDoApp(contexto, alarme.id)),
            disparo(contexto, alarme.id),
        )
        Log.i(TAG, "alarme ${alarme.id} agendado para ${alarme.proximoDisparo(agora)}")
    }

    fun cancelar(contexto: Context, id: Long) {
        contexto.getSystemService(AlarmManager::class.java).cancel(disparo(contexto, id))
    }

    /** Reagenda tudo: usado depois do boot, de atualizar o app e de trocar o fuso. */
    fun reagendarTodos(contexto: Context, alarmes: List<Alarme>) {
        val agora = ZonedDateTime.now()
        alarmes.forEach { if (it.ativo) agendar(contexto, it, agora) else cancelar(contexto, it.id) }
    }

    /** Soneca: um disparo avulso daqui a [minutos], sem mexer no alarme salvo. */
    fun adiar(contexto: Context, alarme: Alarme, minutos: Int) {
        val gerente = contexto.getSystemService(AlarmManager::class.java)
        val quando = System.currentTimeMillis() + minutos * 60_000L
        val intent = disparo(contexto, alarme.id, soneca = true)
        if (podeAgendarExato(contexto)) {
            gerente.setAlarmClock(AlarmManager.AlarmClockInfo(quando, aberturaDoApp(contexto, alarme.id)), intent)
        } else {
            gerente.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, intent)
        }
    }

    fun podeAgendarExato(contexto: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            contexto.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

    private fun disparo(contexto: Context, id: Long, soneca: Boolean = false): PendingIntent {
        val intent = Intent(contexto, ReceptorDeAlarme::class.java).apply {
            action = ReceptorDeAlarme.ACAO_DISPARAR
            putExtra(ReceptorDeAlarme.EXTRA_ID, id)
            putExtra(ReceptorDeAlarme.EXTRA_SONECA, soneca)
            // O id vira parte da Uri: sem isso o PendingIntent de dois alarmes
            // diferentes seria considerado o mesmo e um sobrescreveria o outro.
            data = android.net.Uri.parse("levanta://alarme/$id")
        }
        return PendingIntent.getBroadcast(
            contexto, id.toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** Para onde o usuário vai ao tocar no ícone de despertador do sistema. */
    private fun aberturaDoApp(contexto: Context, id: Long): PendingIntent {
        val intent = Intent(contexto, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            contexto, id.toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
