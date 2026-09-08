package br.com.levanta.alarme

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import br.com.levanta.R
import br.com.levanta.core.alarme.Alarme
import br.com.levanta.dados.RepositorioAlarmes
import br.com.levanta.ui.TocandoActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Mantém o alarme tocando enquanto o exercício não termina.
 *
 * É um serviço em primeiro plano, e não só uma notificação, porque é ele que
 * segura o processo vivo: o som, a vibração e o estado da sessão precisam
 * sobreviver ao usuário sair da tela do alarme, girar o celular ou abrir a
 * câmera. A notificação com `fullScreenIntent` é o que traz a tela de volta
 * por cima da tela de bloqueio.
 */
class ServicoDeAlarme : Service() {

    private var tocador: MediaPlayer? = null
    private var vibrador: Vibrator? = null
    private var travaDeCpu: PowerManager.WakeLock? = null
    private var limite: CountDownTimer? = null
    private val escopo = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACAO_TOCAR -> tocar(
                intent.getLongExtra(ReceptorDeAlarme.EXTRA_ID, -1L),
                intent.getBooleanExtra(ReceptorDeAlarme.EXTRA_SONECA, false),
            )
            ACAO_ADIAR -> adiar()
            ACAO_ABAIXAR -> tocador?.setVolume(VOLUME_TREINO, VOLUME_TREINO)
            ACAO_PARAR -> desligar()
            else -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun tocar(id: Long, veioDaSoneca: Boolean) {
        val alarme = RepositorioAlarmes.de(this).porId(id)
        if (alarme == null) {
            Log.w(TAG, "alarme $id não existe mais; ignorando o disparo")
            stopSelf()
            return
        }

        if (!veioDaSoneca) SessaoDeAlarme.zerarSonecas(id)
        SessaoDeAlarme.iniciar(alarme, SessaoDeAlarme.sonecasDe(id))

        iniciarEmPrimeiroPlano(NOTIFICACAO, notificacao(alarme))
        segurarCpu()
        tocarSom(alarme)
        vibrar(alarme)
        armarLimite()
        prepararProximoDisparo(alarme)
        abrirTela()
    }

    /**
     * Já deixa o próximo disparo agendado assim que este toca.
     *
     * `setAlarmClock` agenda um disparo só, então um alarme de segunda a sexta
     * que não for reagendado agora nunca mais toca. Fazer isso aqui, e não
     * quando o usuário desliga o alarme, garante que o de amanhã existe mesmo
     * se a pessoa ignorar este até o fim.
     */
    private fun prepararProximoDisparo(alarme: Alarme) {
        escopo.launch {
            val repositorio = RepositorioAlarmes.de(this@ServicoDeAlarme)
            if (alarme.repetido) {
                Agendador.agendar(this@ServicoDeAlarme, alarme)
            } else {
                repositorio.salvar(alarme.copy(ativo = false))
                Agendador.cancelar(this@ServicoDeAlarme, alarme.id)
            }
        }
    }

    private fun tocarSom(alarme: Alarme) {
        val som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: return
        tocador = MediaPlayer().apply {
            // USAGE_ALARM manda o som para o canal de alarme: toca mesmo no
            // silencioso e no Não Perturbe, que é o comportamento esperado de
            // um despertador.
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            setDataSource(this@ServicoDeAlarme, som)
            isLooping = true
            setVolume(alarme.volume, alarme.volume)
            setOnErrorListener { _, o, e -> Log.e(TAG, "erro no som: $o/$e"); true }
            prepare()
            start()
        }
        // Se o volume de alarme do sistema estiver no zero, o despertador seria
        // mudo. Sobe para pelo menos metade.
        val audio = getSystemService(AudioManager::class.java)
        val maximo = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        if (audio.getStreamVolume(AudioManager.STREAM_ALARM) < maximo / 2) {
            runCatching { audio.setStreamVolume(AudioManager.STREAM_ALARM, maximo / 2, 0) }
        }
    }

    private fun vibrar(alarme: Alarme) {
        if (!alarme.vibrar) return
        vibrador = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION") getSystemService(Vibrator::class.java)
        }
        val padrao = longArrayOf(0, 500, 500)
        vibrador?.vibrate(VibrationEffect.createWaveform(padrao, 0))
    }

    private fun segurarCpu() {
        travaDeCpu = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "levanta:alarme")
            .apply { acquire(LIMITE_MS) }
    }

    /**
     * Um despertador que toca para sempre esvazia a bateria de quem esqueceu o
     * celular em casa. Depois de 15 minutos ele silencia sozinho — o alarme de
     * amanhã já está agendado.
     */
    private fun armarLimite() {
        limite?.cancel()
        limite = object : CountDownTimer(LIMITE_MS, LIMITE_MS) {
            override fun onTick(restante: Long) = Unit
            override fun onFinish() {
                Log.i(TAG, "limite de $LIMITE_MS ms atingido; silenciando")
                desligar()
            }
        }.also { it.start() }
    }

    private fun abrirTela() {
        startActivity(
            Intent(this, TocandoActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }

    private fun adiar() {
        val estado = SessaoDeAlarme.estado.value ?: return desligar()
        SessaoDeAlarme.contarSoneca(estado.alarme.id)
        Agendador.adiar(this, estado.alarme, estado.alarme.sonecaMinutos)
        desligar()
    }

    private fun desligar() {
        limite?.cancel(); limite = null
        runCatching { tocador?.stop() }
        tocador?.release(); tocador = null
        vibrador?.cancel(); vibrador = null
        travaDeCpu?.let { if (it.isHeld) it.release() }
        travaDeCpu = null
        SessaoDeAlarme.encerrar()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        escopo.cancel()
        super.onDestroy()
    }

    private fun notificacao(alarme: Alarme): Notification {
        criarCanal()
        val abrir = PendingIntent.getActivity(
            this, 0,
            Intent(this, TocandoActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val texto = "${alarme.repeticoes} ${alarme.exercicio.rotulo.lowercase()} para desligar"
        val construtor = NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_alarme)
            .setContentTitle(alarme.rotulo.ifBlank { "Hora de levantar" })
            .setContentText(texto)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(abrir)
            // Esta é a linha que faz a tela do alarme aparecer sozinha por cima
            // da tela de bloqueio, em vez de virar só um aviso no topo.
            .setFullScreenIntent(abrir, true)

        val estado = SessaoDeAlarme.estado.value
        if (estado == null || estado.podeAdiar) {
            construtor.addAction(
                R.drawable.ic_soneca,
                "Soneca",
                PendingIntent.getService(
                    this, 1,
                    Intent(this, ServicoDeAlarme::class.java).setAction(ACAO_ADIAR),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )
        }
        return construtor.build()
    }

    private fun criarCanal() {
        val canal = NotificationChannel(CANAL, "Alarme tocando", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "O despertador enquanto está tocando"
            // O som é do MediaPlayer, no canal de alarme; o canal fica mudo
            // para não haver dois sons ao mesmo tempo.
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setBypassDnd(true)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }

    /**
     * Do Android 10 em diante o serviço precisa declarar o tipo no momento de
     * subir; `mediaPlayback` é o tipo que cobre tocar áudio continuamente.
     */
    private fun iniciarEmPrimeiroPlano(id: Int, notificacao: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(id, notificacao, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(id, notificacao)
        }
    }

    companion object {
        private const val TAG = "ServicoDeAlarme"
        private const val CANAL = "alarme_tocando"
        private const val NOTIFICACAO = 1
        private const val LIMITE_MS = 15 * 60 * 1000L
        /** Durante o exercício o som abaixa para o contador poder dar retorno sonoro. */
        private const val VOLUME_TREINO = 0.35f

        const val ACAO_TOCAR = "br.com.levanta.TOCAR"
        const val ACAO_ADIAR = "br.com.levanta.ADIAR"
        const val ACAO_PARAR = "br.com.levanta.PARAR"
        const val ACAO_ABAIXAR = "br.com.levanta.ABAIXAR"

        fun enviar(contexto: Context, acao: String) {
            contexto.startService(Intent(contexto, ServicoDeAlarme::class.java).setAction(acao))
        }
    }
}
