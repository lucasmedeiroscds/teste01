package br.com.levanta.camera

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * O retorno de cada repetição: um bipe e um toque de vibração.
 *
 * Existe porque a pessoa está olhando para o chão no meio de um agachamento, e
 * não para a tela: sem confirmação sonora ela não sabe se a repetição contou e
 * acaba fazendo o dobro. O bipe sobe de tom conforme a série avança e fecha com
 * um acorde na última.
 */
class Retorno(contexto: Context) {

    private val tons = runCatching {
        // STREAM_ALARM: o mesmo canal do despertador, então o bipe é audível
        // mesmo com o celular no silencioso.
        ToneGenerator(AudioManager.STREAM_ALARM, 85)
    }.getOrNull()

    private val vibrador = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        contexto.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION") contexto.getSystemService(Vibrator::class.java)
    }

    fun repeticao(feitas: Int, alvo: Int) {
        val faltamPoucas = alvo - feitas in 1..3
        tons?.startTone(
            if (faltamPoucas) ToneGenerator.TONE_PROP_BEEP2 else ToneGenerator.TONE_PROP_BEEP,
            120,
        )
        vibrador?.vibrate(VibrationEffect.createOneShot(45, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    fun conclusao() {
        tons?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 700)
        vibrador?.vibrate(
            VibrationEffect.createWaveform(longArrayOf(0, 120, 90, 120, 90, 260), -1),
        )
    }

    fun encerrar() {
        tons?.release()
    }
}
