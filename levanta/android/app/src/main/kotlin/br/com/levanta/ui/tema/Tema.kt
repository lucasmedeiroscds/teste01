package br.com.levanta.ui.tema

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Laranja de amanhecer sobre azul de madrugada: o app é usado no escuro, com
// os olhos recém-abertos, então o contraste vem do tom e não do branco puro.
private val Laranja = Color(0xFFFF7A1A)
private val LaranjaEscuro = Color(0xFFC44F00)
private val Noite = Color(0xFF0E1424)
private val NoiteClara = Color(0xFF1A2338)
private val Verde = Color(0xFF34D07F)

private val Escuro = darkColorScheme(
    primary = Laranja,
    onPrimary = Color(0xFF1A0A00),
    primaryContainer = LaranjaEscuro,
    onPrimaryContainer = Color(0xFFFFEDE0),
    secondary = Verde,
    onSecondary = Color(0xFF00301A),
    background = Noite,
    onBackground = Color(0xFFE6EAF2),
    surface = Noite,
    onSurface = Color(0xFFE6EAF2),
    surfaceVariant = NoiteClara,
    onSurfaceVariant = Color(0xFFB6C0D4),
    error = Color(0xFFFF6B6B),
)

private val Claro = lightColorScheme(
    primary = LaranjaEscuro,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE1CC),
    onPrimaryContainer = Color(0xFF3A1600),
    secondary = Color(0xFF12794A),
    onSecondary = Color.White,
    background = Color(0xFFFBF9F7),
    onBackground = Color(0xFF1B1B1D),
    surface = Color(0xFFFBF9F7),
    onSurface = Color(0xFF1B1B1D),
    surfaceVariant = Color(0xFFEDE7E1),
    onSurfaceVariant = Color(0xFF4C4640),
)

/**
 * O tema do app.
 *
 * [forcarEscuro] existe para as telas que aparecem de madrugada: a do alarme
 * tocando e a do treino ficam escuras mesmo com o sistema no tema claro, para
 * não jogar uma tela branca inteira na cara de quem acabou de acordar.
 */
@Composable
fun TemaLevanta(
    forcarEscuro: Boolean = false,
    conteudo: @Composable () -> Unit,
) {
    val escuro = forcarEscuro || isSystemInDarkTheme()
    val cores = if (escuro) Escuro else Claro
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val janela = (atividadeDe(view) ?: return@SideEffect).window
            janela.statusBarColor = cores.background.toArgb()
            janela.navigationBarColor = cores.background.toArgb()
            WindowCompat.getInsetsController(janela, view).apply {
                isAppearanceLightStatusBars = !escuro
                isAppearanceLightNavigationBars = !escuro
            }
        }
    }
    MaterialTheme(colorScheme = cores, content = conteudo)
}

/** Sobe a cadeia de contextos até a Activity dona desta view. */
private fun atividadeDe(view: android.view.View): Activity? {
    var c = view.context
    while (c is android.content.ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    return null
}
