import AVFoundation
import Vision

/// Traduz cada quadro da câmera num `Esqueleto` e entrega ao chamador.
///
/// O Vision devolve juntas em coordenadas normalizadas com a origem no canto
/// **inferior** esquerdo; o motor de contagem trabalha com a origem no canto
/// superior, como o ML Kit. A inversão de `y` acontece aqui, e é toda a
/// diferença entre as duas plataformas.
final class AnalisadorDePose: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {

    private let aoDetectar: (Esqueleto) -> Void
    private let pedido = VNDetectHumanBodyPoseRequest()
    private let fila = DispatchQueue(label: "levanta.pose")

    init(aoDetectar: @escaping (Esqueleto) -> Void) {
        self.aoDetectar = aoDetectar
    }

    func captureOutput(_ output: AVCaptureOutput,
                       didOutput amostra: CMSampleBuffer,
                       from conexao: AVCaptureConnection) {
        guard let buffer = CMSampleBufferGetImageBuffer(amostra) else { return }
        let largura = Float(CVPixelBufferGetWidth(buffer))
        let altura = Float(CVPixelBufferGetHeight(buffer))

        let manipulador = VNImageRequestHandler(cvPixelBuffer: buffer, orientation: .up, options: [:])
        do {
            try manipulador.perform([pedido])
            guard let observacao = pedido.results?.first else { return }
            if let esqueleto = converter(observacao, largura: largura, altura: altura) {
                aoDetectar(esqueleto)
            }
        } catch {
            // Um quadro perdido não é erro: o próximo chega em 33 ms.
        }
    }

    private func converter(_ o: VNHumanBodyPoseObservation,
                           largura: Float, altura: Float) -> Esqueleto? {
        guard let juntas = try? o.recognizedPoints(.all) else { return nil }
        var marcos: [Marco: Ponto] = [:]
        for (meu, doVision) in Self.equivalencias {
            guard let j = juntas[doVision], j.confidence > 0 else { continue }
            marcos[meu] = Ponto(
                x: Float(j.location.x),
                // O Vision cresce `y` para cima; o motor espera para baixo.
                y: 1 - Float(j.location.y),
                confianca: Float(j.confidence),
            )
        }
        let agora = Int64(Date().timeIntervalSince1970 * 1000)
        return Esqueleto(marcos: marcos, proporcao: largura / altura, instanteMs: agora)
    }

    private static let equivalencias: [Marco: VNHumanBodyPoseObservation.JointName] = [
        .nariz: .nose,
        .ombroEsq: .leftShoulder, .ombroDir: .rightShoulder,
        .cotoveloEsq: .leftElbow, .cotoveloDir: .rightElbow,
        .pulsoEsq: .leftWrist, .pulsoDir: .rightWrist,
        .quadrilEsq: .leftHip, .quadrilDir: .rightHip,
        .joelhoEsq: .leftKnee, .joelhoDir: .rightKnee,
        .tornozeloEsq: .leftAnkle, .tornozeloDir: .rightAnkle,
    ]
}
