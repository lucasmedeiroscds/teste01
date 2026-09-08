import Foundation

/// Os treze marcos do corpo que o contador usa.
///
/// É a interseção do que o Vision (iOS) e o ML Kit Pose (Android) sabem
/// produzir, para que o mesmo motor de contagem rode idêntico nas duas
/// plataformas. A ordem e os nomes espelham `Marco.kt` de propósito: quando um
/// limiar muda de um lado, o outro tem o mesmo arquivo para mudar.
enum Marco: CaseIterable {
    case nariz
    case ombroEsq, ombroDir
    case cotoveloEsq, cotoveloDir
    case pulsoEsq, pulsoDir
    case quadrilEsq, quadrilDir
    case joelhoEsq, joelhoDir
    case tornozeloEsq, tornozeloDir
}

enum Lado { case esquerdo, direito }

/// Um ponto do corpo em coordenadas já corrigidas pela proporção da imagem.
///
/// A origem é o canto superior esquerdo e `y` cresce para baixo — convenção do
/// ML Kit. O Vision entrega o oposto (origem embaixo, `y` para cima), então o
/// adaptador da câmera inverte o eixo antes de construir o esqueleto.
struct Ponto {
    let x: Float
    let y: Float
    let confianca: Float
}

/// Um quadro de pose: os marcos detectados e o instante em que foram vistos.
struct Esqueleto {
    /// Abaixo disto o marco é tratado como não visto.
    static let confiancaMinima: Float = 0.35

    private let marcos: [Marco: Ponto]
    let instanteMs: Int64

    /// Monta um esqueleto a partir de marcos normalizados em 0...1, corrigindo
    /// `x` pela proporção (largura ÷ altura da imagem).
    ///
    /// Sem essa correção a imagem fica achatada num quadrado e todo ângulo sai
    /// distorcido: o mesmo agachamento mediria valores diferentes conforme o
    /// celular estivesse em pé ou deitado.
    init(marcos: [Marco: Ponto], proporcao: Float, instanteMs: Int64) {
        let p = proporcao > 0 ? proporcao : 1
        self.marcos = marcos.mapValues { Ponto(x: $0.x * p, y: $0.y, confianca: $0.confianca) }
        self.instanteMs = instanteMs
    }

    /// O ponto, ou `nil` se ausente ou pouco confiável.
    func ponto(_ m: Marco) -> Ponto? {
        guard let p = marcos[m], p.confianca >= Esqueleto.confiancaMinima else { return nil }
        return p
    }

    func temTodos(_ ms: Marco...) -> Bool { ms.allSatisfy { ponto($0) != nil } }
}

/// Ângulo em graus no vértice `b`, entre 0 e 180. `nil` se algum ponto faltar.
func angulo(_ a: Ponto?, _ b: Ponto?, _ c: Ponto?) -> Float? {
    guard let a, let b, let c else { return nil }
    let abx = a.x - b.x, aby = a.y - b.y
    let cbx = c.x - b.x, cby = c.y - b.y
    let normas = (abx * abx + aby * aby).squareRoot() * (cbx * cbx + cby * cby).squareRoot()
    guard normas > 1e-6 else { return nil }
    let cosseno = max(-1, min(1, (abx * cbx + aby * cby) / normas))
    return acos(cosseno) * 180 / .pi
}

/// Distância euclidiana entre dois pontos. `nil` se algum faltar.
func distancia(_ a: Ponto?, _ b: Ponto?) -> Float? {
    guard let a, let b else { return nil }
    let dx = a.x - b.x, dy = a.y - b.y
    return (dx * dx + dy * dy).squareRoot()
}

/// Inclinação do segmento a→b em relação à horizontal, de 0 a 90 graus.
/// Perto de 0 o tronco está deitado; perto de 90, em pé.
func inclinacao(_ a: Ponto?, _ b: Ponto?) -> Float? {
    guard let a, let b else { return nil }
    let dx = abs(a.x - b.x), dy = abs(a.y - b.y)
    guard dx > 1e-6 || dy > 1e-6 else { return nil }
    return atan2(dy, dx) * 180 / .pi
}

/// Ponto médio entre dois pontos, com a menor das duas confianças.
func medio(_ a: Ponto?, _ b: Ponto?) -> Ponto? {
    guard let a, let b else { return nil }
    return Ponto(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, confianca: min(a.confianca, b.confianca))
}

/// Reescala `v` do intervalo [de, ate] para 0...1, saturando fora dele.
func faixa(_ v: Float, _ de: Float, _ ate: Float) -> Float {
    guard abs(ate - de) > 1e-6 else { return 0 }
    return max(0, min(1, (v - de) / (ate - de)))
}
