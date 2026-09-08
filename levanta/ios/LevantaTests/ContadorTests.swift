import XCTest
@testable import Levanta

final class GeometriaTests: XCTestCase {

    private func p(_ x: Float, _ y: Float) -> Ponto { Ponto(x: x, y: y, confianca: 1) }

    func testAnguloRetoVale90Graus() {
        XCTAssertEqual(angulo(p(0, 1), p(0, 0), p(1, 0))!, 90, accuracy: 0.01)
    }

    func testAnguloRasoVale180Graus() {
        XCTAssertEqual(angulo(p(-1, 0), p(0, 0), p(1, 0))!, 180, accuracy: 0.01)
    }

    func testAnguloComPontoAusenteEhNulo() {
        XCTAssertNil(angulo(p(0, 0), nil, p(1, 1)))
    }

    func testInclinacaoDistingueTroncoEmPeDeDeitado() {
        XCTAssertEqual(inclinacao(p(0.5, 0.2), p(0.5, 0.6))!, 90, accuracy: 0.01)
        XCTAssertEqual(inclinacao(p(0.2, 0.5), p(0.6, 0.5))!, 0, accuracy: 0.01)
    }

    /// A mesma perna, filmada em retrato e em paisagem, mede o mesmo ângulo.
    /// Sem a correção de proporção as duas leituras divergem dezenas de graus,
    /// e o mesmo agachamento cruza ou não o limiar conforme o celular esteja
    /// apoiado em pé ou deitado.
    func testProporcaoDaImagemNaoMudaOAnguloMedido() {
        let quadril: (Float, Float) = (300, 200)
        let joelho: (Float, Float) = (300, 450)
        let tornozelo: (Float, Float) = (420, 640)

        func anguloEm(_ largura: Float, _ altura: Float, corrigir: Bool) -> Float {
            func normalizar(_ q: (Float, Float)) -> Ponto {
                Ponto(x: q.0 / largura, y: q.1 / altura, confianca: 1)
            }
            let e = Esqueleto(marcos: [
                .quadrilEsq: normalizar(quadril),
                .joelhoEsq: normalizar(joelho),
                .tornozeloEsq: normalizar(tornozelo),
            ], proporcao: corrigir ? largura / altura : 1, instanteMs: 0)
            return angulo(e.ponto(.quadrilEsq), e.ponto(.joelhoEsq), e.ponto(.tornozeloEsq))!
        }

        let fisico = angulo(p(quadril.0, quadril.1), p(joelho.0, joelho.1), p(tornozelo.0, tornozelo.1))!
        XCTAssertEqual(fisico, anguloEm(720, 1280, corrigir: true), accuracy: 0.01)
        XCTAssertEqual(fisico, anguloEm(1280, 720, corrigir: true), accuracy: 0.01)
        // E o teste morde: sem a correção os dois formatos discordam.
        XCTAssertGreaterThan(abs(anguloEm(720, 1280, corrigir: false) - anguloEm(1280, 720, corrigir: false)), 20)
    }

    func testMarcoPoucoConfiavelContaComoAusente() {
        let e = Esqueleto(marcos: [.nariz: Ponto(x: 0.5, y: 0.5, confianca: 0.1)],
                          proporcao: 1, instanteMs: 0)
        XCTAssertNil(e.ponto(.nariz))
    }
}

final class AgachamentoTests: XCTestCase {

    private func ciclos(_ quantos: Int, ate: Float = 80) -> ContadorRepeticoes {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        _ = c.processar(Manequim.agachamento(178, t)); t += 50
        for _ in 0..<quantos {
            t = c.cicloDeAngulo(de: 178, ate: ate, inicioMs: t, quadro: { Manequim.agachamento($0, $1) })
        }
        return c
    }

    func testUmAgachamentoCompletoContaUmaRepeticao() {
        XCTAssertEqual(ciclos(1).processar(Manequim.agachamento(178, 10_000)).repeticoes, 1)
    }

    func testDezAgachamentosContamDez() {
        XCTAssertEqual(ciclos(10).processar(Manequim.agachamento(178, 60_000)).repeticoes, 10)
    }

    /// 130° não cruza o limiar de 100°: é meio agachamento e não vale.
    func testAgachamentoPelaMetadeNaoConta() {
        XCTAssertEqual(ciclos(3, ate: 130).processar(Manequim.agachamento(178, 60_000)).repeticoes, 0)
    }

    func testAgachamentoPelaMetadePedeParaDescerMais() {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        _ = c.processar(Manequim.agachamento(178, t)); t += 50
        for _ in 0..<10 { _ = c.processar(Manequim.agachamento(130, t)); t += 50 }
        XCTAssertEqual(c.processar(Manequim.agachamento(130, t)).aviso, .descaMais)
    }

    /// Sacudir o celular gera um ciclo rápido demais para ser um agachamento.
    func testMovimentoRapidoDemaisNaoConta() {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        _ = c.processar(Manequim.agachamento(178, t)); t += 20
        _ = c.cicloDeAngulo(de: 178, ate: 80, inicioMs: t, quadro: { Manequim.agachamento($0, $1) },
                            passos: 2, espera: 2, msPorQuadro: 20)
        XCTAssertEqual(c.processar(Manequim.agachamento(178, 5_000)).repeticoes, 0)
    }

    func testQuemComecaJaAgachadoSoContaOCicloInteiroSeguinte() {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        for _ in 0..<8 { _ = c.processar(Manequim.agachamento(80, t)); t += 50 }
        for _ in 0..<8 { _ = c.processar(Manequim.agachamento(178, t)); t += 50 }
        XCTAssertEqual(c.processar(Manequim.agachamento(178, t)).repeticoes, 0)
        t = c.cicloDeAngulo(de: 178, ate: 80, inicioMs: t, quadro: { Manequim.agachamento($0, $1) })
        XCTAssertEqual(c.processar(Manequim.agachamento(178, t)).repeticoes, 1)
    }

    /// Tremer em torno de um limiar não pode virar contagem.
    func testOscilacaoEmTornoDoLimiarNaoConta() {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        _ = c.processar(Manequim.agachamento(178, t)); t += 50
        for i in 0..<40 {
            _ = c.processar(Manequim.agachamento(i % 2 == 0 ? 163 : 157, t)); t += 50
        }
        XCTAssertEqual(c.processar(Manequim.agachamento(178, t)).repeticoes, 0)
    }

    func testContouAgoraDisparaUmaVezPorRepeticao() {
        let c = ContadorAgachamento()
        var t: Int64 = 0
        var disparos = 0
        _ = c.processar(Manequim.agachamento(178, t)); t += 50
        for _ in 0..<3 {
            for v: Float in [150, 120, 90, 80, 80, 80, 80, 90, 120, 150, 178, 178] {
                if c.processar(Manequim.agachamento(v, t)).contouAgora { disparos += 1 }
                t += 60
            }
        }
        XCTAssertEqual(disparos, 3)
        XCTAssertEqual(c.processar(Manequim.agachamento(178, t)).repeticoes, 3)
    }

    func testReiniciarZeraAContagem() {
        let c = ciclos(4)
        c.reiniciar()
        let p = c.processar(Manequim.agachamento(178, 99_000))
        XCTAssertEqual(p.repeticoes, 0)
        XCTAssertEqual(p.fase, .repouso)
    }

    func testCorpoForaDeQuadroAvisaEmVezDeQuebrar() {
        let c = ContadorAgachamento()
        let p = c.processar(Esqueleto(marcos: [:], proporcao: 1, instanteMs: 0))
        XCTAssertEqual(p.aviso, .corpoForaDeQuadro)
        XCTAssertEqual(p.fase, .procurando)
        XCTAssertEqual(p.repeticoes, 0)
    }

    func testAmplitudeVaiDeZeroEmPeAUmAgachado() {
        let c = ContadorAgachamento()
        XCTAssertEqual(c.processar(Manequim.agachamento(178, 0)).amplitude, 0, accuracy: 0.02)
        var t: Int64 = 50
        for _ in 0..<10 { _ = c.processar(Manequim.agachamento(70, t)); t += 50 }
        XCTAssertEqual(c.processar(Manequim.agachamento(70, t)).amplitude, 1, accuracy: 0.02)
    }
}

final class OutrosExerciciosTests: XCTestCase {

    func testFlexaoCompletaConta() {
        let c = ContadorFlexao()
        var t: Int64 = 0
        _ = c.processar(Manequim.flexao(175, t)); t += 50
        t = c.cicloDeAngulo(de: 175, ate: 80, inicioMs: t, quadro: { Manequim.flexao($0, $1) })
        XCTAssertEqual(c.processar(Manequim.flexao(175, t)).repeticoes, 1)
    }

    /// Dobrar o cotovelo sentado na cama não é flexão: o tronco está em pé.
    func testDobrarOBracoForaDaPranchaEhRecusado() {
        let c = ContadorFlexao()
        var t: Int64 = 0
        for _ in 0..<3 {
            for v: Float in [175, 140, 100, 80, 80, 100, 140, 175] {
                XCTAssertEqual(c.processar(Manequim.sentadoNaCama(v, t)).aviso, .posicaoInvalida)
                t += 60
            }
        }
        XCTAssertEqual(c.repeticoes, 0)
    }

    func testAbdominalCompletoConta() {
        let c = ContadorAbdominal()
        var t: Int64 = 0
        _ = c.processar(Manequim.abdominal(150, t)); t += 50
        t = c.cicloDeAngulo(de: 150, ate: 60, inicioMs: t, quadro: { Manequim.abdominal($0, $1) })
        XCTAssertEqual(c.processar(Manequim.abdominal(150, t)).repeticoes, 1)
    }

    func testSentadoComPernasNaVerticalEhRecusado() {
        let c = ContadorAbdominal()
        var t: Int64 = 0
        for _ in 0..<2 {
            for v: Float in [150, 110, 70, 60, 70, 110, 150] {
                XCTAssertEqual(c.processar(Manequim.sentadoInclinando(v, t)).aviso, .posicaoInvalida)
                t += 60
            }
        }
        XCTAssertEqual(c.repeticoes, 0)
    }
}

final class PolichineloTests: XCTestCase {

    private func ciclo(_ c: ContadorRepeticoes, bracos: Float, pernas: Float, de: Int64) -> Int64 {
        var t = de
        func alimentar(_ b: Float, _ p: Float) {
            _ = c.processar(Manequim.polichinelo(b, p, t)); t += 50
        }
        for i in 1...5 { alimentar(bracos * Float(i) / 5, pernas * Float(i) / 5) }
        for _ in 0..<5 { alimentar(bracos, pernas) }
        for i in 0..<5 { alimentar(bracos * Float(4 - i) / 5, pernas * Float(4 - i) / 5) }
        for _ in 0..<5 { alimentar(0, 0) }
        return t
    }

    func testPolichineloCompletoConta() {
        let c = ContadorPolichinelo()
        var t: Int64 = 0
        _ = c.processar(Manequim.polichinelo(0, 0, t)); t += 50
        t = ciclo(c, bracos: 1, pernas: 1, de: t)
        XCTAssertEqual(c.processar(Manequim.polichinelo(0, 0, t)).repeticoes, 1)
    }

    func testQuinzePolichinelosContamQuinze() {
        let c = ContadorPolichinelo()
        var t: Int64 = 0
        _ = c.processar(Manequim.polichinelo(0, 0, t)); t += 50
        for _ in 0..<15 { t = ciclo(c, bracos: 1, pernas: 1, de: t) }
        XCTAssertEqual(c.processar(Manequim.polichinelo(0, 0, t)).repeticoes, 15)
    }

    /// Só bater palma em cima deixa o índice de fechamento em 50 — longe dos 30
    /// que abrem a fase extremo.
    func testSoOsBracosNaoConta() {
        let c = ContadorPolichinelo()
        var t: Int64 = 0
        _ = c.processar(Manequim.polichinelo(0, 0, t)); t += 50
        for _ in 0..<4 { t = ciclo(c, bracos: 1, pernas: 0, de: t) }
        XCTAssertEqual(c.processar(Manequim.polichinelo(0, 0, t)).repeticoes, 0)
    }

    func testSoAsPernasNaoConta() {
        let c = ContadorPolichinelo()
        var t: Int64 = 0
        _ = c.processar(Manequim.polichinelo(0, 0, t)); t += 50
        for _ in 0..<4 { t = ciclo(c, bracos: 0, pernas: 1, de: t) }
        XCTAssertEqual(c.processar(Manequim.polichinelo(0, 0, t)).repeticoes, 0)
    }

    func testDeitadoEhRecusado() {
        XCTAssertEqual(ContadorPolichinelo().processar(Manequim.flexao(175, 0)).aviso, .posicaoInvalida)
    }
}

final class FabricaTests: XCTestCase {
    func testCadaExercicioTemContadorESugestao() {
        for e in Exercicio.allCases {
            XCTAssertEqual(contadorDe(e).exercicio, e)
            XCTAssertTrue((1...100).contains(e.repeticoesSugeridas))
            XCTAssertFalse(e.instrucao.isEmpty)
            XCTAssertFalse(e.enquadramento.isEmpty)
        }
    }
}
