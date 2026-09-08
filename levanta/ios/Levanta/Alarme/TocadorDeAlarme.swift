import AVFoundation
import UIKit

/// Toca o alarme enquanto o app está na frente, e mantém o estado da sessão.
///
/// A notificação do iOS dá 30 segundos de som por vez. Assim que o app abre,
/// este tocador assume: uma `AVAudioSession` na categoria `.playback` com
/// `.duckOthers`, tocando em laço, sem limite de tempo e sem parar quando a
/// tela apaga. É o que faz o alarme continuar durante os agachamentos.
@MainActor
final class TocadorDeAlarme: ObservableObject {

    struct Estado: Equatable {
        var alarme: Alarme
        var sonecasUsadas: Int
        var repeticoesFeitas: Int = 0

        var podeAdiar: Bool { sonecasUsadas < alarme.maxSonecas }
        var sonecasRestantes: Int { max(0, alarme.maxSonecas - sonecasUsadas) }
    }

    @Published private(set) var estado: Estado?

    private var tocador: AVAudioPlayer?
    private var vibracao: Timer?
    private var sonecasPorAlarme: [Int64: Int] = [:]

    static let shared = TocadorDeAlarme()
    private init() {}

    func iniciar(_ alarme: Alarme, veioDaSoneca: Bool) {
        if !veioDaSoneca { sonecasPorAlarme[alarme.id] = 0 }
        estado = Estado(alarme: alarme, sonecasUsadas: sonecasPorAlarme[alarme.id] ?? 0)
        UIApplication.shared.isIdleTimerDisabled = true
        tocar(volume: alarme.volume, vibrar: alarme.vibrar)
    }

    /// Durante o exercício o som abaixa, para o bipe de cada repetição ser
    /// audível por cima do alarme.
    func abaixar() {
        tocador?.setVolume(0.35, fadeDuration: 0.4)
    }

    func registrarRepeticoes(_ feitas: Int) {
        estado?.repeticoesFeitas = feitas
    }

    func adiar() async {
        guard let atual = estado else { return }
        sonecasPorAlarme[atual.alarme.id] = atual.sonecasUsadas + 1
        await Agendador.adiar(atual.alarme, minutos: atual.alarme.sonecaMinutos)
        parar()
    }

    func parar() {
        tocador?.stop()
        tocador = nil
        vibracao?.invalidate()
        vibracao = nil
        estado = nil
        UIApplication.shared.isIdleTimerDisabled = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func tocar(volume: Float, vibrar: Bool) {
        let sessao = AVAudioSession.sharedInstance()
        // .playback com .duckOthers: toca com a tela apagada, abaixa o que
        // estiver tocando em vez de matar, e ignora o botão de silencioso.
        try? sessao.setCategory(.playback, mode: .default, options: [.duckOthers])
        try? sessao.setActive(true)

        guard let url = Bundle.main.url(forResource: "alarme", withExtension: "caf")
            ?? Bundle.main.url(forResource: "alarme", withExtension: "m4a") else { return }
        tocador = try? AVAudioPlayer(contentsOf: url)
        tocador?.numberOfLoops = -1
        tocador?.volume = volume
        tocador?.play()

        guard vibrar else { return }
        vibracao = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { _ in
            Task { @MainActor in
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            }
        }
    }
}
