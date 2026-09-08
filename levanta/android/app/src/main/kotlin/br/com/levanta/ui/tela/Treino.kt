package br.com.levanta.ui.tela

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import br.com.levanta.alarme.SessaoDeAlarme
import br.com.levanta.camera.AnalisadorDePose
import br.com.levanta.camera.Retorno
import br.com.levanta.core.pose.Aviso
import br.com.levanta.core.pose.Fase
import br.com.levanta.core.pose.contadorDe
import kotlinx.coroutines.delay
import java.util.concurrent.Executors

@Composable
fun TelaTreino(
    estado: SessaoDeAlarme.Estado,
    aoConcluir: () -> Unit,
    aoDesistir: () -> Unit,
) {
    val contexto = LocalContext.current
    val dono = LocalLifecycleOwner.current
    val alvo = estado.alarme.repeticoes
    val retorno = remember { Retorno(contexto) }

    var feitas by remember { mutableIntStateOf(0) }
    var amplitude by remember { mutableStateOf(0f) }
    var aviso by remember { mutableStateOf<Aviso?>(null) }
    var fase by remember { mutableStateOf(Fase.PROCURANDO) }
    var concluido by remember { mutableStateOf(false) }

    val contador = remember(estado.alarme.id) { contadorDe(estado.alarme.exercicio) }
    val executor = remember { Executors.newSingleThreadExecutor() }

    val analisador = remember {
        AnalisadorDePose { esqueleto ->
            val p = contador.processar(esqueleto)
            feitas = p.repeticoes
            amplitude = p.amplitude
            aviso = p.aviso
            fase = p.fase
            if (p.contouAgora) {
                retorno.repeticao(p.repeticoes, alvo)
                SessaoDeAlarme.registrarRepeticoes(p.repeticoes)
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            analisador.encerrar()
            executor.shutdown()
            retorno.encerrar()
        }
    }

    // Uma pausa curta entre bater a meta e a tela sumir: dá tempo de ver o
    // "pronto" e de ouvir o retorno final, em vez de o app fechar na cara.
    LaunchedEffect(feitas >= alvo) {
        if (feitas >= alvo && !concluido) {
            concluido = true
            retorno.conclusao()
            delay(1200)
            aoConcluir()
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        VisorDaCamera(contexto, dono, analisador, executor)
        Escurecimento()

        Column(
            Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Cabecalho(estado, feitas, alvo)
            Orientacao(aviso, fase, concluido, estado)
            Rodape(aoDesistir)
        }

        BarraDeAmplitude(amplitude, Modifier.align(Alignment.CenterEnd))
    }
}

@Composable
private fun VisorDaCamera(
    contexto: Context,
    dono: androidx.lifecycle.LifecycleOwner,
    analisador: AnalisadorDePose,
    executor: java.util.concurrent.ExecutorService,
) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            val visor = PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            }
            val futuro = ProcessCameraProvider.getInstance(ctx)
            futuro.addListener({
                val provedor = futuro.get()
                val previa = Preview.Builder().build().also { it.surfaceProvider = visor.surfaceProvider }
                val analise = ImageAnalysis.Builder()
                    // Descartar quadros atrasados é o certo aqui: contar a pose
                    // de meio segundo atrás desalinharia a contagem do movimento.
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(executor, analisador) }
                runCatching {
                    provedor.unbindAll()
                    provedor.bindToLifecycle(dono, CameraSelector.DEFAULT_FRONT_CAMERA, previa, analise)
                }.onFailure {
                    // Sem câmera frontal (ou ocupada): tenta a traseira.
                    runCatching {
                        provedor.bindToLifecycle(dono, CameraSelector.DEFAULT_BACK_CAMERA, previa, analise)
                    }
                }
            }, ContextCompat.getMainExecutor(ctx))
            visor
        },
    )
}

/** Um véu escuro sobre a imagem: os números por cima precisam ser legíveis. */
@Composable
private fun Escurecimento() {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)))
}

@Composable
private fun Cabecalho(estado: SessaoDeAlarme.Estado, feitas: Int, alvo: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            estado.alarme.exercicio.rotulo.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = Color.White.copy(alpha = 0.75f),
        )
        Text(
            "$feitas",
            fontSize = 108.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "de $alvo",
            fontSize = 22.sp,
            color = Color.White.copy(alpha = 0.8f),
        )
        Spacer(Modifier.height(12.dp))
        Box(
            Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
                .background(Color.White.copy(alpha = 0.2f)),
        ) {
            val progresso by animateFloatAsState(
                targetValue = (feitas.toFloat() / alvo).coerceIn(0f, 1f),
                animationSpec = tween(280),
                label = "progresso",
            )
            Box(
                Modifier.fillMaxWidth(progresso).fillMaxHeight()
                    .clip(RoundedCornerShape(3.dp))
                    .background(MaterialTheme.colorScheme.primary),
            )
        }
    }
}

@Composable
private fun Orientacao(aviso: Aviso?, fase: Fase, concluido: Boolean, estado: SessaoDeAlarme.Estado) {
    val texto = when {
        concluido -> "Pronto! Alarme desligado."
        aviso != null -> aviso.mensagem
        fase == Fase.PROCURANDO -> "Procurando você…"
        else -> estado.alarme.exercicio.instrucao
    }
    val cor by animateColorAsState(
        when {
            concluido -> MaterialTheme.colorScheme.secondary
            aviso != null -> MaterialTheme.colorScheme.primary
            else -> Color.White
        },
        label = "cor do aviso",
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (fase == Fase.PROCURANDO && !concluido) {
            CircularProgressIndicator(
                Modifier.size(26.dp),
                color = Color.White.copy(alpha = 0.6f),
                strokeWidth = 2.dp,
            )
            Spacer(Modifier.height(14.dp))
        }
        Text(
            texto,
            color = cor,
            fontSize = 19.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * A saída de emergência.
 *
 * Um despertador que não pode ser desligado é perigoso: quem se machucou, está
 * doente ou está com o celular sem bateria não deveria ficar preso ao alarme.
 * O botão existe, mas exige segurar por cinco segundos — atrito suficiente para
 * não ser o caminho fácil às seis da manhã.
 */
@Composable
private fun Rodape(aoDesistir: () -> Unit) {
    var segurando by remember { mutableStateOf(false) }
    var restante by remember { mutableIntStateOf(SEGUNDOS_PARA_DESISTIR) }

    LaunchedEffect(segurando) {
        if (!segurando) { restante = SEGUNDOS_PARA_DESISTIR; return@LaunchedEffect }
        while (restante > 0) { delay(1000); restante-- }
        aoDesistir()
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (segurando) {
            Button(
                onClick = { segurando = false },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            ) { Text("Soltando em $restante… toque para cancelar") }
        } else {
            TextButton(onClick = { segurando = true }) {
                Text(
                    "Não consigo agora",
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 14.sp,
                )
            }
        }
    }
}

/** Mostra o quanto o movimento atual já foi, para a pessoa saber se desceu o suficiente. */
@Composable
private fun BarraDeAmplitude(amplitude: Float, modifier: Modifier = Modifier) {
    val altura by animateFloatAsState(amplitude.coerceIn(0f, 1f), tween(120), label = "amplitude")
    Box(
        modifier.padding(end = 14.dp).width(8.dp).height(190.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(Color.White.copy(alpha = 0.18f)),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(
            Modifier.fillMaxWidth().fillMaxHeight(altura)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.primary),
        )
    }
}

@Composable
fun TelaSemCamera(aoPedirDeNovo: () -> Unit, aoDesistir: () -> Unit) {
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("A câmera é o botão de desligar", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Spacer(Modifier.height(12.dp))
        Text(
            "O app conta as repetições vendo você se mexer. Nada é gravado " +
                "nem enviado: as imagens são analisadas no próprio aparelho e descartadas.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))
        Button(onClick = aoPedirDeNovo, Modifier.fillMaxWidth().height(56.dp)) {
            Text("Permitir a câmera")
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = aoDesistir) { Text("Desligar o alarme sem exercício") }
    }
}

private const val SEGUNDOS_PARA_DESISTIR = 5
