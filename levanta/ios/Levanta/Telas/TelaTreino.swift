import AVFoundation
import SwiftUI

/// A tela do exercício: câmera aberta, contando as repetições que desligam o alarme.
struct TelaTreino: View {
    let estado: TocadorDeAlarme.Estado

    @EnvironmentObject private var tocador: TocadorDeAlarme
    @StateObject private var camera = CameraDePose()
    @State private var segurandoDesistir = false
    @State private var restante = segundosParaDesistir
    @State private var concluido = false

    private static let segundosParaDesistir = 5
    private var segundosParaDesistir: Int { Self.segundosParaDesistir }

    private var alvo: Int { estado.alarme.repeticoes }

    var body: some View {
        ZStack {
            VisorDaCamera(sessao: camera.sessao)
                .ignoresSafeArea()
            Color.black.opacity(0.35).ignoresSafeArea()

            VStack {
                cabecalho
                Spacer()
                orientacao
                Spacer()
                rodape
            }
            .padding(24)

            HStack {
                Spacer()
                BarraDeAmplitude(amplitude: camera.amplitude)
                    .padding(.trailing, 14)
            }
        }
        .onAppear {
            camera.comecar(exercicio: estado.alarme.exercicio, alvo: alvo) { feitas in
                tocador.registrarRepeticoes(feitas)
            }
        }
        .onDisappear { camera.parar() }
        .onChange(of: camera.repeticoes) { _, feitas in
            guard feitas >= alvo, !concluido else { return }
            concluido = true
            camera.tocarConclusao()
            // Uma pausa curta: dá tempo de ver o "pronto" antes de a tela sumir.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { tocador.parar() }
        }
    }

    private var cabecalho: some View {
        VStack(spacing: 4) {
            Text(estado.alarme.exercicio.rotulo.uppercased())
                .font(.caption).foregroundStyle(.white.opacity(0.75))
            Text("\(camera.repeticoes)")
                .font(.system(size: 108, weight: .bold))
                .foregroundStyle(.white)
            Text("de \(alvo)").font(.title3).foregroundStyle(.white.opacity(0.8))
            ProgressView(value: min(Double(camera.repeticoes) / Double(alvo), 1))
                .tint(.orange)
                .padding(.top, 10)
        }
    }

    private var orientacao: some View {
        VStack(spacing: 14) {
            if camera.fase == .procurando && !concluido {
                ProgressView().tint(.white.opacity(0.6))
            }
            Text(textoDeOrientacao)
                .font(.headline)
                .foregroundStyle(concluido ? .green : (camera.aviso != nil ? .orange : .white))
                .multilineTextAlignment(.center)
        }
    }

    private var textoDeOrientacao: String {
        if concluido { return "Pronto! Alarme desligado." }
        if let aviso = camera.aviso { return aviso.mensagem }
        if camera.fase == .procurando { return "Procurando você…" }
        return estado.alarme.exercicio.instrucao
    }

    /// A saída de emergência.
    ///
    /// Um despertador que não pode ser desligado é perigoso: quem se machucou
    /// ou está doente não deveria ficar preso ao alarme. O botão existe, mas
    /// exige segurar cinco segundos — atrito suficiente para não ser o caminho
    /// fácil às seis da manhã.
    private var rodape: some View {
        Group {
            if segurandoDesistir {
                Button("Soltando em \(restante)… toque para cancelar") {
                    segurandoDesistir = false
                    restante = segundosParaDesistir
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
                    guard segurandoDesistir else { return }
                    restante -= 1
                    if restante <= 0 { tocador.parar() }
                }
            } else {
                Button("Não consigo agora") { segurandoDesistir = true }
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.55))
            }
        }
    }
}

/// Mostra o quanto o movimento atual já foi, para a pessoa saber se desceu o suficiente.
private struct BarraDeAmplitude: View {
    let amplitude: Float

    var body: some View {
        GeometryReader { geo in
            VStack {
                Spacer()
                RoundedRectangle(cornerRadius: 4)
                    .fill(.orange)
                    .frame(height: geo.size.height * CGFloat(max(0, min(1, amplitude))))
            }
        }
        .frame(width: 8, height: 190)
        .background(Color.white.opacity(0.18))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .animation(.easeOut(duration: 0.12), value: amplitude)
    }
}

/// A prévia da câmera, embrulhada para o SwiftUI.
private struct VisorDaCamera: UIViewRepresentable {
    let sessao: AVCaptureSession

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        let camada = AVCaptureVideoPreviewLayer(session: sessao)
        camada.videoGravity = .resizeAspectFill
        view.layer.addSublayer(camada)
        context.coordinator.camada = camada
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {
        context.coordinator.camada?.frame = view.bounds
    }

    func makeCoordinator() -> Coordenador { Coordenador() }

    final class Coordenador { var camada: AVCaptureVideoPreviewLayer? }
}
