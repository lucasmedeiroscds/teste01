import Foundation

/// Guarda os alarmes num único JSON no diretório de documentos do app.
///
/// A gravação é atômica porque o processo pode morrer no meio: um JSON
/// truncado apagaria todos os alarmes, e um despertador que perde o alarme da
/// noite é pior que um que demora um pouco para salvar.
@MainActor
final class RepositorioAlarmes: ObservableObject {

    @Published private(set) var alarmes: [Alarme] = []

    static let shared = RepositorioAlarmes()

    private let arquivo: URL = {
        let pasta = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return pasta.appendingPathComponent("alarmes.json")
    }()

    private init() { carregar() }

    private func carregar() {
        guard let dados = try? Data(contentsOf: arquivo),
              let lidos = try? JSONDecoder().decode([Alarme].self, from: dados) else { return }
        alarmes = lidos.map { $0.validado() }
    }

    private func gravar() {
        guard let dados = try? JSONEncoder().encode(alarmes) else { return }
        try? dados.write(to: arquivo, options: .atomic)
    }

    func salvar(_ a: Alarme) {
        let validado = a.validado()
        alarmes.removeAll { $0.id == validado.id }
        alarmes.append(validado)
        alarmes.sort { ($0.hora, $0.minuto) < ($1.hora, $1.minuto) }
        gravar()
    }

    func remover(_ id: Int64) {
        alarmes.removeAll { $0.id == id }
        gravar()
    }

    func porId(_ id: Int64) -> Alarme? { alarmes.first { $0.id == id } }

    /// Id novo baseado no relógio: não colide entre sessões.
    func novoId() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
}
