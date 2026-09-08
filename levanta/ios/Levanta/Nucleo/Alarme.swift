import Foundation

/// Um alarme configurado.
///
/// `dias` vazio significa alarme de uma vez só: toca no próximo horário e se
/// desativa. Com dias marcados ele se repete toda semana.
///
/// `dias` usa a numeração do `Calendar` do iOS: 1 = domingo ... 7 = sábado.
struct Alarme: Codable, Identifiable, Equatable {
    let id: Int64
    var hora: Int
    var minuto: Int
    var dias: Set<Int> = []
    var ativo: Bool = true
    var rotulo: String = ""
    var exercicio: Exercicio = .agachamento
    var repeticoes: Int = 20
    var sonecaMinutos: Int = 5
    /// Quantas sonecas antes de o botão sumir. 0 tira a soneca do alarme.
    var maxSonecas: Int = 3
    var vibrar: Bool = true
    var volume: Float = 1

    var repetido: Bool { !dias.isEmpty }

    var horarioFormatado: String { String(format: "%02d:%02d", hora, minuto) }

    /// Corrige valores fora de faixa em vez de falhar: um alarme lido de um
    /// arquivo antigo ou corrompido vale mais consertado que descartado.
    func validado() -> Alarme {
        var a = self
        a.hora = min(max(hora, 0), 23)
        a.minuto = min(max(minuto, 0), 59)
        a.repeticoes = min(max(repeticoes, 1), 500)
        a.sonecaMinutos = min(max(sonecaMinutos, 1), 60)
        a.maxSonecas = min(max(maxSonecas, 0), 20)
        a.volume = min(max(volume, 0), 1)
        return a
    }
}

extension Alarme {
    /// Quando este alarme toca pela próxima vez, a partir de `agora`.
    ///
    /// O resultado é sempre estritamente depois de `agora`: um alarme das 7:00
    /// consultado exatamente às 7:00 aponta para o dia seguinte, senão o
    /// reagendamento feito logo após tocar devolveria o mesmo instante e o
    /// alarme entraria em laço.
    ///
    /// Usa `nextDate(after:matching:)` do `Calendar`, que já resolve a virada do
    /// horário de verão — inclusive uma hora que não existe no dia da mudança.
    func proximoDisparo(agora: Date = Date(), calendario: Calendar = .current) -> Date? {
        if repetido {
            return dias
                .compactMap { dia -> Date? in
                    var componentes = DateComponents()
                    componentes.hour = hora
                    componentes.minute = minuto
                    componentes.second = 0
                    componentes.weekday = dia
                    return calendario.nextDate(after: agora, matching: componentes,
                                               matchingPolicy: .nextTime)
                }
                .min()
        }
        var componentes = DateComponents()
        componentes.hour = hora
        componentes.minute = minuto
        componentes.second = 0
        return calendario.nextDate(after: agora, matching: componentes, matchingPolicy: .nextTime)
    }

    /// "Seg, Qua, Sex", "Todo dia", "Dias úteis", "Fim de semana" ou "Uma vez".
    var diasFormatados: String {
        guard repetido else { return "Uma vez" }
        if dias.count == 7 { return "Todo dia" }
        if dias == Set(2...6) { return "Dias úteis" }
        if dias == Set([1, 7]) { return "Fim de semana" }
        return dias.sorted().map(Alarme.abreviacao).joined(separator: ", ")
    }

    static func abreviacao(_ dia: Int) -> String {
        ["", "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dia]
    }
}

/// O próximo alarme a tocar entre os ativos, ou `nil` se não houver nenhum.
func proximoAtivo(_ alarmes: [Alarme], agora: Date = Date()) -> (Alarme, Date)? {
    alarmes
        .filter(\.ativo)
        .compactMap { a in a.proximoDisparo(agora: agora).map { (a, $0) } }
        .min { $0.1 < $1.1 }
}

/// "em 7 h 20 min" — o aviso que aparece ao ligar um alarme.
func tempoAte(_ agora: Date, _ disparo: Date) -> String {
    let minutos = Int(disparo.timeIntervalSince(agora) / 60)
    let dias = minutos / 1440
    let horas = (minutos % 1440) / 60
    let min = minutos % 60
    var texto = "em "
    if dias > 0 { texto += "\(dias) \(dias == 1 ? "dia" : "dias") " }
    if horas > 0 { texto += "\(horas) h " }
    if dias == 0 { texto += "\(min) min" }
    return texto.trimmingCharacters(in: .whitespaces)
}
