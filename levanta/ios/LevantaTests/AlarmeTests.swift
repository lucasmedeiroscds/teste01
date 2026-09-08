import XCTest
@testable import Levanta

final class ProximoDisparoTests: XCTestCase {

    private var calendario: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/Sao_Paulo")!
        return c
    }()

    private func em(_ texto: String, fuso: String = "America/Sao_Paulo") -> Date {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        f.timeZone = TimeZone(identifier: fuso)!
        return f.date(from: texto)!
    }

    private func alarme(_ hora: Int, _ minuto: Int, dias: Set<Int> = []) -> Alarme {
        Alarme(id: 1, hora: hora, minuto: minuto, dias: dias)
    }

    func testAlarmeUnicoMaisTardeHojeTocaHoje() {
        let agora = em("2026-09-08T06:00")   // terça
        XCTAssertEqual(alarme(7, 30).proximoDisparo(agora: agora, calendario: calendario), em("2026-09-08T07:30"))
    }

    func testAlarmeUnicoJaPassadoTocaAmanha() {
        let agora = em("2026-09-08T09:00")
        XCTAssertEqual(alarme(7, 30).proximoDisparo(agora: agora, calendario: calendario), em("2026-09-09T07:30"))
    }

    /// Consultado no instante exato do disparo, aponta para o próximo. Se
    /// apontasse para agora, o reagendamento feito logo depois de tocar
    /// devolveria o mesmo instante e o alarme entraria em laço.
    func testAlarmeNoInstanteExatoApontaParaOProximo() {
        let agora = em("2026-09-08T07:30")
        XCTAssertEqual(alarme(7, 30).proximoDisparo(agora: agora, calendario: calendario), em("2026-09-09T07:30"))
    }

    func testAlarmeSemanalPulaParaOProximoDiaMarcado() {
        let agora = em("2026-09-08T09:00")   // terça de manhã
        // 2 = segunda, 4 = quarta, 6 = sexta na numeração do Calendar.
        let a = alarme(7, 0, dias: [2, 4, 6])
        XCTAssertEqual(a.proximoDisparo(agora: agora, calendario: calendario), em("2026-09-09T07:00"))
    }

    func testAlarmeSemanalNoProprioDiaAntesDaHoraTocaHoje() {
        let agora = em("2026-09-09T05:00")   // quarta de madrugada
        XCTAssertEqual(alarme(7, 0, dias: [4]).proximoDisparo(agora: agora, calendario: calendario),
                       em("2026-09-09T07:00"))
    }

    func testAlarmeDeUmUnicoDiaVoltaEmSeteDias() {
        let agora = em("2026-09-09T08:00")   // quarta, já passou
        XCTAssertEqual(alarme(7, 0, dias: [4]).proximoDisparo(agora: agora, calendario: calendario),
                       em("2026-09-16T07:00"))
    }

    func testViradaDeAno() {
        XCTAssertEqual(alarme(6, 0).proximoDisparo(agora: em("2026-12-31T23:59"), calendario: calendario),
                       em("2027-01-01T06:00"))
    }

    /// No horário de verão americano de 2026 os relógios pulam das 2h para as
    /// 3h do dia 8 de março. Um alarme das 2:30 não existe nesse dia: o
    /// calendário empurra para a frente em vez de devolver um instante inválido.
    func testHoraInexistenteNaViradaDoHorarioDeVeraoEhEmpurrada() {
        var novaYork = Calendar(identifier: .gregorian)
        novaYork.timeZone = TimeZone(identifier: "America/New_York")!
        let agora = em("2026-03-08T01:00", fuso: "America/New_York")
        let disparo = alarme(2, 30).proximoDisparo(agora: agora, calendario: novaYork)!
        XCTAssertGreaterThan(disparo, agora)
        XCTAssertEqual(novaYork.component(.hour, from: disparo), 3)
    }

    func testProximoAtivoIgnoraOsDesligados() {
        let agora = em("2026-09-08T06:00")
        let cedo = Alarme(id: 1, hora: 6, minuto: 30)
        let tarde = Alarme(id: 2, hora: 8, minuto: 0)
        let desligadoMaisCedo = Alarme(id: 3, hora: 6, minuto: 10, ativo: false)
        let (a, _) = proximoAtivo([tarde, desligadoMaisCedo, cedo], agora: agora)!
        XCTAssertEqual(a.id, 1)
    }

    func testListaSemAlarmeAtivoNaoTemProximo() {
        XCTAssertNil(proximoAtivo([Alarme(id: 1, hora: 6, minuto: 0, ativo: false)], agora: em("2026-09-08T06:00")))
        XCTAssertNil(proximoAtivo([], agora: em("2026-09-08T06:00")))
    }
}

final class FormatacaoTests: XCTestCase {

    func testHorarioSempreComDoisDigitos() {
        XCTAssertEqual(Alarme(id: 1, hora: 7, minuto: 5).horarioFormatado, "07:05")
        XCTAssertEqual(Alarme(id: 1, hora: 23, minuto: 59).horarioFormatado, "23:59")
    }

    func testDiasGanhamNomeCurtoEmPortugues() {
        func f(_ dias: Set<Int>) -> String {
            Alarme(id: 1, hora: 7, minuto: 0, dias: dias).diasFormatados
        }
        XCTAssertEqual(f([]), "Uma vez")
        XCTAssertEqual(f(Set(1...7)), "Todo dia")
        XCTAssertEqual(f(Set(2...6)), "Dias úteis")
        XCTAssertEqual(f([1, 7]), "Fim de semana")
        XCTAssertEqual(f([1, 2, 6]), "Dom, Seg, Sex")
    }

    func testTempoAteODisparoEmPalavras() {
        let base = Date(timeIntervalSince1970: 1_700_000_000)
        XCTAssertEqual(tempoAte(base, base.addingTimeInterval(7 * 3600 + 20 * 60)), "em 7 h 20 min")
        XCTAssertEqual(tempoAte(base, base.addingTimeInterval(45 * 60)), "em 45 min")
        XCTAssertEqual(tempoAte(base, base.addingTimeInterval(2 * 86400 + 3600)), "em 2 dias 1 h")
    }
}

final class ValidacaoTests: XCTestCase {

    /// Um alarme lido de um arquivo antigo ou corrompido vale mais consertado
    /// que descartado: o `validado()` puxa os valores para dentro da faixa.
    func testValoresForaDaFaixaSaoCorrigidos() {
        let bagunca = Alarme(id: 1, hora: 40, minuto: 99, repeticoes: 0,
                             sonecaMinutos: 0, maxSonecas: 50, volume: 3).validado()
        XCTAssertEqual(bagunca.hora, 23)
        XCTAssertEqual(bagunca.minuto, 59)
        XCTAssertEqual(bagunca.repeticoes, 1)
        XCTAssertEqual(bagunca.sonecaMinutos, 1)
        XCTAssertEqual(bagunca.maxSonecas, 20)
        XCTAssertEqual(bagunca.volume, 1)
    }

    func testAlarmeSobreviveAoJSON() throws {
        let original = Alarme(id: 42, hora: 6, minuto: 15, dias: [2, 4],
                              rotulo: "Academia", exercicio: .polichinelo, repeticoes: 30)
        let dados = try JSONEncoder().encode(original)
        XCTAssertEqual(try JSONDecoder().decode(Alarme.self, from: dados), original)
    }
}
