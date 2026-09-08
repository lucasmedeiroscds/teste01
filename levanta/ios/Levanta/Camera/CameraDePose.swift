import AVFoundation
import AudioToolbox
import SwiftUI

/// Liga a câmera, alimenta o contador e publica o progresso para a tela.
///
/// A câmera frontal é a padrão: quem apoia o celular a dois metros precisa ver
/// a própria imagem para se enquadrar. Se não houver frontal, cai para a
/// traseira em vez de falhar.
@MainActor
final class CameraDePose: NSObject, ObservableObject {

    @Published private(set) var repeticoes = 0
    @Published private(set) var amplitude: Float = 0
    @Published private(set) var fase: Fase = .procurando
    @Published private(set) var aviso: Aviso?

    let sessao = AVCaptureSession()

    private var contador: ContadorRepeticoes?
    private var analisador: AnalisadorDePose?
    private var alvo = 0
    private var aoContar: ((Int) -> Void)?
    private let fila = DispatchQueue(label: "levanta.camera")

    func comecar(exercicio: Exercicio, alvo: Int, aoContar: @escaping (Int) -> Void) {
        self.alvo = alvo
        self.aoContar = aoContar
        contador = contadorDe(exercicio)

        let analisador = AnalisadorDePose { [weak self] esqueleto in
            guard let self else { return }
            Task { @MainActor in self.processar(esqueleto) }
        }
        self.analisador = analisador

        AVCaptureDevice.requestAccess(for: .video) { [weak self] permitido in
            guard permitido, let self else { return }
            self.fila.async { self.montarSessao(analisador) }
        }
    }

    func parar() {
        fila.async { [sessao] in
            if sessao.isRunning { sessao.stopRunning() }
        }
    }

    func tocarConclusao() {
        AudioServicesPlaySystemSound(1025)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func processar(_ esqueleto: Esqueleto) {
        guard let contador else { return }
        let p = contador.processar(esqueleto)
        repeticoes = p.repeticoes
        amplitude = p.amplitude
        fase = p.fase
        aviso = p.aviso
        if p.contouAgora {
            // Um bipe e um toque por repetição: a pessoa está olhando para o
            // chão no meio de um agachamento, não para a tela.
            AudioServicesPlaySystemSound(1103)
            UIImpactFeedbackGenerator(style: alvo - p.repeticoes <= 3 ? .heavy : .light).impactOccurred()
            aoContar?(p.repeticoes)
        }
    }

    private nonisolated func montarSessao(_ analisador: AnalisadorDePose) {
        sessao.beginConfiguration()
        sessao.sessionPreset = .high

        let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
            ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
        guard let camera, let entrada = try? AVCaptureDeviceInput(device: camera),
              sessao.canAddInput(entrada) else {
            sessao.commitConfiguration()
            return
        }
        sessao.addInput(entrada)

        let saida = AVCaptureVideoDataOutput()
        // Descartar quadros atrasados é o certo aqui: contar a pose de meio
        // segundo atrás desalinharia a contagem do movimento.
        saida.alwaysDiscardsLateVideoFrames = true
        saida.setSampleBufferDelegate(analisador, queue: fila)
        if sessao.canAddOutput(saida) { sessao.addOutput(saida) }

        sessao.commitConfiguration()
        sessao.startRunning()
    }
}
