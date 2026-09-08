package br.com.levanta.camera

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import br.com.levanta.core.pose.Esqueleto
import br.com.levanta.core.pose.Marco
import br.com.levanta.core.pose.Ponto
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions

/**
 * Traduz cada quadro da câmera num [Esqueleto] e entrega ao chamador.
 *
 * O ML Kit devolve 33 marcos em pixels da imagem original; aqui eles viram os
 * 13 marcos normalizados que o motor de contagem entende, no mesmo formato que
 * o adaptador do iOS produz a partir do Vision. Toda a diferença entre as duas
 * plataformas termina neste arquivo.
 */
class AnalisadorDePose(
    private val aoDetectar: (Esqueleto) -> Unit,
) : ImageAnalysis.Analyzer {

    private val detector = PoseDetection.getClient(
        PoseDetectorOptions.Builder()
            // STREAM_MODE reaproveita o resultado anterior para rastrear entre
            // quadros: é bem mais estável em vídeo que SINGLE_IMAGE_MODE, e a
            // estabilidade é o que impede o contador de tremer no limiar.
            .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
            .build(),
    )

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imagem: ImageProxy) {
        val quadro = imagem.image
        if (quadro == null) { imagem.close(); return }

        val giro = imagem.imageInfo.rotationDegrees
        val entrada = InputImage.fromMediaImage(quadro, giro)
        // Depois do giro, largura e altura trocam de lugar em 90° e 270°.
        val largura = if (giro == 90 || giro == 270) imagem.height else imagem.width
        val altura = if (giro == 90 || giro == 270) imagem.width else imagem.height

        detector.process(entrada)
            .addOnSuccessListener { pose ->
                aoDetectar(converter(pose, largura.toFloat(), altura.toFloat()))
            }
            .addOnCompleteListener { imagem.close() }
    }

    fun encerrar() = detector.close()

    private fun converter(pose: Pose, largura: Float, altura: Float): Esqueleto {
        val marcos = HashMap<Marco, Ponto>(EQUIVALENCIAS.size)
        for ((meu, doMlKit) in EQUIVALENCIAS) {
            val m = pose.getPoseLandmark(doMlKit) ?: continue
            marcos[meu] = Ponto(
                x = m.position.x / largura,
                y = m.position.y / altura,
                confianca = m.inFrameLikelihood,
            )
        }
        return Esqueleto.de(marcos, largura / altura, System.currentTimeMillis())
    }

    private companion object {
        val EQUIVALENCIAS = mapOf(
            Marco.NARIZ to PoseLandmark.NOSE,
            Marco.OMBRO_ESQ to PoseLandmark.LEFT_SHOULDER,
            Marco.OMBRO_DIR to PoseLandmark.RIGHT_SHOULDER,
            Marco.COTOVELO_ESQ to PoseLandmark.LEFT_ELBOW,
            Marco.COTOVELO_DIR to PoseLandmark.RIGHT_ELBOW,
            Marco.PULSO_ESQ to PoseLandmark.LEFT_WRIST,
            Marco.PULSO_DIR to PoseLandmark.RIGHT_WRIST,
            Marco.QUADRIL_ESQ to PoseLandmark.LEFT_HIP,
            Marco.QUADRIL_DIR to PoseLandmark.RIGHT_HIP,
            Marco.JOELHO_ESQ to PoseLandmark.LEFT_KNEE,
            Marco.JOELHO_DIR to PoseLandmark.RIGHT_KNEE,
            Marco.TORNOZELO_ESQ to PoseLandmark.LEFT_ANKLE,
            Marco.TORNOZELO_DIR to PoseLandmark.RIGHT_ANKLE,
        )
    }
}
