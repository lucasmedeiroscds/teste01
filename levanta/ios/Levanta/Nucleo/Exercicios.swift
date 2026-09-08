import Foundation

/// Eixo do tronco: do meio dos ombros ao meio do quadril.
private func tronco(_ e: Esqueleto) -> (ombro: Ponto, quadril: Ponto)? {
    guard let ombro = medio(e.ponto(.ombroEsq), e.ponto(.ombroDir)),
          let quadril = medio(e.ponto(.quadrilEsq), e.ponto(.quadrilDir)) else { return nil }
    return (ombro, quadril)
}

/// Agachamento — ângulo do joelho (quadril · joelho · tornozelo).
///
/// Em pé passa de 170°; na coxa paralela ao chão fica perto de 80°. Os limiares
/// em 160° e 100° exigem um agachamento fundo: parar a meio caminho, por volta
/// de 130°, não cruza nenhum dos dois e não conta.
final class ContadorAgachamento: ContadorRepeticoes {
    init() { super.init(exercicio: .agachamento) }

    override var limiarRepouso: Float { 160 }
    override var limiarExtremo: Float { 100 }

    override func sinal(_ e: Esqueleto) -> Float? {
        melhorLado(e) { esq, lado in
            switch lado {
            case .esquerdo: angulo(esq.ponto(.quadrilEsq), esq.ponto(.joelhoEsq), esq.ponto(.tornozeloEsq))
            case .direito: angulo(esq.ponto(.quadrilDir), esq.ponto(.joelhoDir), esq.ponto(.tornozeloDir))
            }
        }
    }

    /// De pé: o tronco tem que estar mais vertical que horizontal.
    override func postura(_ e: Esqueleto) -> Aviso? {
        guard let t = tronco(e), let inc = inclinacao(t.ombro, t.quadril) else { return .corpoForaDeQuadro }
        return inc < 40 ? .posicaoInvalida : nil
    }
}

/// Flexão de braço — ângulo do cotovelo (ombro · cotovelo · pulso).
final class ContadorFlexao: ContadorRepeticoes {
    init() { super.init(exercicio: .flexao) }

    override var limiarRepouso: Float { 155 }
    override var limiarExtremo: Float { 100 }

    override func sinal(_ e: Esqueleto) -> Float? {
        melhorLado(e) { esq, lado in
            switch lado {
            case .esquerdo: angulo(esq.ponto(.ombroEsq), esq.ponto(.cotoveloEsq), esq.ponto(.pulsoEsq))
            case .direito: angulo(esq.ponto(.ombroDir), esq.ponto(.cotoveloDir), esq.ponto(.pulsoDir))
            }
        }
    }

    /// Prancha: tronco quase horizontal e quadril alinhado com ombro e joelho.
    /// Sem isso, dobrar o cotovelo sentado na cama contaria como flexão.
    override func postura(_ e: Esqueleto) -> Aviso? {
        guard let t = tronco(e), let inc = inclinacao(t.ombro, t.quadril) else { return .corpoForaDeQuadro }
        if inc > 40 { return .posicaoInvalida }
        let joelho = medio(e.ponto(.joelhoEsq), e.ponto(.joelhoDir))
        if let corpoReto = angulo(t.ombro, t.quadril, joelho), corpoReto < 140 { return .posicaoInvalida }
        return nil
    }
}

/// Abdominal — ângulo do quadril (ombro · quadril · joelho).
final class ContadorAbdominal: ContadorRepeticoes {
    init() { super.init(exercicio: .abdominal) }

    override var limiarRepouso: Float { 130 }
    override var limiarExtremo: Float { 80 }

    override func sinal(_ e: Esqueleto) -> Float? {
        melhorLado(e) { esq, lado in
            switch lado {
            case .esquerdo: angulo(esq.ponto(.ombroEsq), esq.ponto(.quadrilEsq), esq.ponto(.joelhoEsq))
            case .direito: angulo(esq.ponto(.ombroDir), esq.ponto(.quadrilDir), esq.ponto(.joelhoDir))
            }
        }
    }

    /// No chão: as pernas ficam deitadas o movimento inteiro. É o que distingue
    /// um abdominal de alguém sentado se inclinando para a frente, que produz a
    /// mesma leitura de quadril com as pernas na vertical.
    override func postura(_ e: Esqueleto) -> Aviso? {
        guard let quadril = medio(e.ponto(.quadrilEsq), e.ponto(.quadrilDir)),
              let tornozelo = medio(e.ponto(.tornozeloEsq), e.ponto(.tornozeloDir)),
              let inc = inclinacao(quadril, tornozelo) else { return .corpoForaDeQuadro }
        return inc > 45 ? .posicaoInvalida : nil
    }
}

/// Polichinelo — índice de fechamento de 0 a 100, alto com o corpo fechado.
///
/// Não existe um ângulo único que descreva o movimento, então o sinal combina
/// em partes iguais quanto os braços subiram e quanto os pés se afastaram.
/// Cobrar as duas coisas juntas impede contar quem só bate palma em cima ou só
/// arrasta os pés. As duas medidas são divididas pela altura do tronco: assim o
/// movimento conta igual perto ou longe da câmera, e a referência continua
/// estável mesmo quando a pessoa gira um pouco de lado.
final class ContadorPolichinelo: ContadorRepeticoes {
    init() { super.init(exercicio: .polichinelo) }

    override var limiarRepouso: Float { 72 }
    override var limiarExtremo: Float { 30 }
    override var suavizacao: Float { 0.6 }
    override var msNoExtremo: Int64 { 120 }
    override var msPorRepeticao: Int64 { 400 }

    override func sinal(_ e: Esqueleto) -> Float? {
        guard let t = tronco(e),
              let alturaTronco = distancia(t.ombro, t.quadril), alturaTronco > 1e-4,
              let pulso = medio(e.ponto(.pulsoEsq), e.ponto(.pulsoDir)),
              let tornozeloEsq = e.ponto(.tornozeloEsq),
              let tornozeloDir = e.ponto(.tornozeloDir),
              let separacao = distancia(tornozeloEsq, tornozeloDir) else { return nil }

        // Braço no quadril dá ~0; acima da cabeça, ~2 alturas de tronco.
        let bracos = faixa((t.quadril.y - pulso.y) / alturaTronco, 0.25, 1.5)
        // Pés juntos dão ~0,2 de tronco entre eles; abertos, ~1,0.
        let pernas = faixa(separacao / alturaTronco, 0.35, 0.95)

        return 100 * (1 - (bracos + pernas) / 2)
    }

    /// Em pé, de frente para a câmera.
    override func postura(_ e: Esqueleto) -> Aviso? {
        guard let t = tronco(e), let inc = inclinacao(t.ombro, t.quadril) else { return .corpoForaDeQuadro }
        return inc < 55 ? .posicaoInvalida : nil
    }
}
