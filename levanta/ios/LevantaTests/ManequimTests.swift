import XCTest
@testable import Levanta

/// Gera esqueletos sintéticos com uma pose exata, para exercitar os contadores
/// sem câmera. É a tradução literal do `Manequim.kt` do Android: os mesmos
/// números entram nos dois motores, então uma divergência entre plataformas
/// aparece como teste vermelho e não como bug no celular de alguém.
enum Manequim {

    private static let confianca: Float = 0.9
    private static func p(_ x: Float, _ y: Float) -> Ponto {
        Ponto(x: x, y: y, confianca: confianca)
    }
    private static func rad(_ g: Float) -> Float { g * .pi / 180 }

    /// Em pé de perfil, com o joelho no ângulo pedido (180° = totalmente esticado).
    static func agachamento(_ anguloJoelho: Float, _ instanteMs: Int64, proporcao: Float = 1) -> Esqueleto {
        let joelho = p(0.50, 0.60)
        let tornozelo = p(0.50, 0.85)
        let r = rad(anguloJoelho)
        let quadril = p(joelho.x + 0.25 * sin(r), joelho.y + 0.25 * cos(r))
        let ombro = p(quadril.x, quadril.y - 0.20)
        return Esqueleto(marcos: [
            .ombroEsq: ombro, .ombroDir: ombro,
            .quadrilEsq: quadril, .quadrilDir: quadril,
            .joelhoEsq: joelho, .joelhoDir: joelho,
            .tornozeloEsq: tornozelo, .tornozeloDir: tornozelo,
        ], proporcao: proporcao, instanteMs: instanteMs)
    }

    /// Em prancha, com o cotovelo no ângulo pedido (180° = braço esticado).
    static func flexao(_ anguloCotovelo: Float, _ instanteMs: Int64) -> Esqueleto {
        let ombro = p(0.35, 0.50), quadril = p(0.60, 0.52)
        let joelho = p(0.80, 0.54), tornozelo = p(0.95, 0.56)
        let cotovelo = p(0.35, 0.62)
        let r = rad(anguloCotovelo)
        let pulso = p(cotovelo.x + 0.12 * sin(r), cotovelo.y - 0.12 * cos(r))
        return Esqueleto(marcos: [
            .ombroEsq: ombro, .ombroDir: ombro,
            .cotoveloEsq: cotovelo, .cotoveloDir: cotovelo,
            .pulsoEsq: pulso, .pulsoDir: pulso,
            .quadrilEsq: quadril, .quadrilDir: quadril,
            .joelhoEsq: joelho, .joelhoDir: joelho,
            .tornozeloEsq: tornozelo, .tornozeloDir: tornozelo,
        ], proporcao: 1, instanteMs: instanteMs)
    }

    /// Deitado de perfil, com o quadril no ângulo pedido (180° = tronco no chão).
    static func abdominal(_ anguloQuadril: Float, _ instanteMs: Int64) -> Esqueleto {
        let quadril = p(0.55, 0.75), joelho = p(0.72, 0.72), tornozelo = p(0.85, 0.78)
        let base = atan2(joelho.y - quadril.y, joelho.x - quadril.x)
        let alvo = base - rad(anguloQuadril)
        let ombro = p(quadril.x + 0.30 * cos(alvo), quadril.y + 0.30 * sin(alvo))
        return Esqueleto(marcos: [
            .ombroEsq: ombro, .ombroDir: ombro,
            .quadrilEsq: quadril, .quadrilDir: quadril,
            .joelhoEsq: joelho, .joelhoDir: joelho,
            .tornozeloEsq: tornozelo, .tornozeloDir: tornozelo,
        ], proporcao: 1, instanteMs: instanteMs)
    }

    /// Em pé de frente, com braços e pernas de 0 (fechado) a 1 (aberto).
    static func polichinelo(_ bracos: Float, _ pernas: Float, _ instanteMs: Int64) -> Esqueleto {
        let alturaTronco: Float = 0.20
        let yPulso = 0.60 - alturaTronco * (0.25 + 1.25 * bracos)
        let separacao = alturaTronco * (0.35 + 0.60 * pernas)
        return Esqueleto(marcos: [
            .ombroEsq: p(0.44, 0.40), .ombroDir: p(0.56, 0.40),
            .pulsoEsq: p(0.30, yPulso), .pulsoDir: p(0.70, yPulso),
            .quadrilEsq: p(0.46, 0.60), .quadrilDir: p(0.54, 0.60),
            .joelhoEsq: p(0.46, 0.75), .joelhoDir: p(0.54, 0.75),
            .tornozeloEsq: p(0.50 - separacao / 2, 0.90),
            .tornozeloDir: p(0.50 + separacao / 2, 0.90),
        ], proporcao: 1, instanteMs: instanteMs)
    }

    /// Sentado na cama dobrando o braço: postura errada para a flexão.
    static func sentadoNaCama(_ anguloCotovelo: Float, _ instanteMs: Int64) -> Esqueleto {
        let ombro = p(0.50, 0.35), quadril = p(0.50, 0.60), cotovelo = p(0.50, 0.47)
        let r = rad(anguloCotovelo)
        let pulso = p(cotovelo.x + 0.12 * sin(r), cotovelo.y - 0.12 * cos(r))
        return Esqueleto(marcos: [
            .ombroEsq: ombro, .ombroDir: ombro,
            .cotoveloEsq: cotovelo, .cotoveloDir: cotovelo,
            .pulsoEsq: pulso, .pulsoDir: pulso,
            .quadrilEsq: quadril, .quadrilDir: quadril,
            .joelhoEsq: p(0.50, 0.78), .joelhoDir: p(0.50, 0.78),
            .tornozeloEsq: p(0.50, 0.95), .tornozeloDir: p(0.50, 0.95),
        ], proporcao: 1, instanteMs: instanteMs)
    }

    /// Sentado com as pernas na vertical: postura errada para o abdominal.
    static func sentadoInclinando(_ anguloQuadril: Float, _ instanteMs: Int64) -> Esqueleto {
        let quadril = p(0.50, 0.70), joelho = p(0.52, 0.90), tornozelo = p(0.54, 0.99)
        let base = atan2(joelho.y - quadril.y, joelho.x - quadril.x)
        let alvo = base - rad(anguloQuadril)
        let ombro = p(quadril.x + 0.30 * cos(alvo), quadril.y + 0.30 * sin(alvo))
        return Esqueleto(marcos: [
            .ombroEsq: ombro, .ombroDir: ombro,
            .quadrilEsq: quadril, .quadrilDir: quadril,
            .joelhoEsq: joelho, .joelhoDir: joelho,
            .tornozeloEsq: tornozelo, .tornozeloDir: tornozelo,
        ], proporcao: 1, instanteMs: instanteMs)
    }
}

extension ContadorRepeticoes {
    /// Roda um movimento: desce de `de` até `ate`, segura, sobe e segura.
    @discardableResult
    func cicloDeAngulo(de: Float, ate: Float, inicioMs: Int64,
                       quadro: (Float, Int64) -> Esqueleto,
                       passos: Int = 6, espera: Int = 6, msPorQuadro: Int64 = 50) -> Int64 {
        var t = inicioMs
        func alimentar(_ v: Float) {
            _ = processar(quadro(v, t))
            t += msPorQuadro
        }
        for i in 1...passos { alimentar(de + (ate - de) * Float(i) / Float(passos)) }
        for _ in 0..<espera { alimentar(ate) }
        for i in 1...passos { alimentar(ate + (de - ate) * Float(i) / Float(passos)) }
        for _ in 0..<espera { alimentar(de) }
        return t
    }
}
