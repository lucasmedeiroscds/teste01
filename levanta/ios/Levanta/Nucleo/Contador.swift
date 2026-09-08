import Foundation

/// Os exercícios que desligam o alarme.
enum Exercicio: String, CaseIterable, Codable {
    case agachamento, flexao, polichinelo, abdominal

    var rotulo: String {
        switch self {
        case .agachamento: "Agachamento"
        case .flexao: "Flexão de braço"
        case .polichinelo: "Polichinelo"
        case .abdominal: "Abdominal"
        }
    }

    var instrucao: String {
        switch self {
        case .agachamento: "Desça até a coxa ficar paralela ao chão e volte a ficar em pé."
        case .flexao: "Desça até o cotovelo fechar e empurre até esticar o braço."
        case .polichinelo: "Abra braços e pernas ao mesmo tempo e feche de volta."
        case .abdominal: "Suba até o tronco chegar perto dos joelhos e volte a deitar."
        }
    }

    var enquadramento: String {
        switch self {
        case .agachamento: "Apoie o celular no chão ou numa cadeira, a uns 2 metros, com o corpo inteiro na tela."
        case .flexao: "Deite o celular de lado, no chão, a uns 2 metros, filmando você de perfil."
        case .polichinelo: "Celular em pé a uns 2,5 metros — precisa caber você de braços abertos."
        case .abdominal: "Celular de lado, no chão, filmando você de perfil com os joelhos dobrados."
        }
    }

    var repeticoesSugeridas: Int {
        switch self {
        case .agachamento: 20
        case .flexao: 10
        case .polichinelo: 30
        case .abdominal: 20
        }
    }
}

/// Em que ponto do movimento o corpo está.
enum Fase { case procurando, repouso, extremo }

/// O que a tela precisa dizer para a pessoa acertar o movimento.
enum Aviso: String {
    case corpoForaDeQuadro = "Afaste o celular até aparecer o corpo inteiro"
    case posicaoInvalida = "Ajuste a posição para o exercício escolhido"
    case descaMais = "Desça mais"
    case subaMais = "Volte à posição inicial"
    case maisDevagar = "Mais devagar, o movimento não contou"

    var mensagem: String { rawValue }
}

/// O resultado de processar um quadro.
struct Progresso {
    let repeticoes: Int
    let fase: Fase
    /// 0 no repouso, 1 no extremo — alimenta a barra de amplitude da tela.
    let amplitude: Float
    let aviso: Aviso?
    /// `true` só no quadro exato em que a repetição fechou.
    let contouAgora: Bool
}

/// Conta repetições a partir de um sinal escalar com histerese.
///
/// Todo exercício vira um único número que é **alto em repouso e baixo no
/// extremo** do movimento. Uma repetição é o ciclo `repouso → extremo →
/// repouso`. Os dois limiares separados impedem meia repetição de contar, e os
/// tempos mínimos impedem uma sacudida do celular de virar agachamento.
///
/// Esta é a tradução literal de `Contador.kt`: mesmos limiares, mesma
/// suavização, mesmos tempos. As duas versões são exercitadas pelos mesmos
/// casos de teste para não divergirem com o tempo.
class ContadorRepeticoes {
    let exercicio: Exercicio

    init(exercicio: Exercicio) { self.exercicio = exercicio }

    // Pontos de extensão das subclasses.
    func sinal(_ e: Esqueleto) -> Float? { nil }
    func postura(_ e: Esqueleto) -> Aviso? { nil }
    var limiarRepouso: Float { 0 }
    var limiarExtremo: Float { 0 }
    var suavizacao: Float { 0.55 }
    var msNoExtremo: Int64 { 180 }
    var msPorRepeticao: Int64 { 500 }

    private(set) var repeticoes = 0
    private var fase: Fase = .procurando
    private var suave: Float?
    private var entrouNoExtremoMs: Int64 = 0
    private var saiuDoRepousoMs: Int64 = 0
    private var avisoPendente: Aviso?

    func reiniciar() {
        repeticoes = 0
        fase = .procurando
        suave = nil
        entrouNoExtremoMs = 0
        saiuDoRepousoMs = 0
        avisoPendente = nil
    }

    func processar(_ e: Esqueleto) -> Progresso {
        guard let bruto = sinal(e) else {
            suave = nil
            return Progresso(repeticoes: repeticoes, fase: .procurando, amplitude: 0,
                             aviso: .corpoForaDeQuadro, contouAgora: false)
        }
        if let erro = postura(e) {
            suave = nil
            return Progresso(repeticoes: repeticoes, fase: .procurando, amplitude: 0,
                             aviso: erro, contouAgora: false)
        }

        let v = suave.map { $0 + suavizacao * (bruto - $0) } ?? bruto
        suave = v

        let amplitude = 1 - faixa(v, limiarExtremo, limiarRepouso)
        var contou = false

        switch fase {
        case .procurando:
            // Só entra no ciclo pelo repouso: quem começa a filmar já agachado
            // espera ficar em pé para a primeira repetição valer inteira.
            if v >= limiarRepouso {
                fase = .repouso
                avisoPendente = nil
            } else {
                avisoPendente = .subaMais
            }

        case .repouso:
            if v <= limiarExtremo {
                fase = .extremo
                entrouNoExtremoMs = e.instanteMs
                if saiuDoRepousoMs == 0 { saiuDoRepousoMs = e.instanteMs }
                avisoPendente = nil
            } else if v < limiarRepouso {
                if saiuDoRepousoMs == 0 { saiuDoRepousoMs = e.instanteMs }
                avisoPendente = .descaMais
            } else {
                saiuDoRepousoMs = 0
                avisoPendente = nil
            }

        case .extremo:
            if v >= limiarRepouso {
                let tempoNoExtremo = e.instanteMs - entrouNoExtremoMs
                let tempoDoCiclo = e.instanteMs - saiuDoRepousoMs
                if tempoNoExtremo >= msNoExtremo && tempoDoCiclo >= msPorRepeticao {
                    repeticoes += 1
                    contou = true
                    avisoPendente = nil
                } else {
                    avisoPendente = .maisDevagar
                }
                fase = .repouso
                saiuDoRepousoMs = 0
            } else {
                avisoPendente = nil
            }
        }

        return Progresso(repeticoes: repeticoes, fase: fase, amplitude: amplitude,
                         aviso: avisoPendente, contouAgora: contou)
    }

    /// Escolhe entre esquerda e direita o lado mais visível, e mede o sinal nele.
    func melhorLado(_ e: Esqueleto, _ medir: (Esqueleto, Lado) -> Float?) -> Float? {
        let esq = medir(e, .esquerdo)
        let dir = medir(e, .direito)
        guard let esq else { return dir }
        guard let dir else { return esq }
        // Os dois lados visíveis: a média cancela o ruído de um marco tremendo.
        return abs(esq - dir) <= 25 ? (esq + dir) / 2 : min(esq, dir)
    }
}

/// Fábrica: o contador certo para o exercício escolhido.
func contadorDe(_ exercicio: Exercicio) -> ContadorRepeticoes {
    switch exercicio {
    case .agachamento: ContadorAgachamento()
    case .flexao: ContadorFlexao()
    case .polichinelo: ContadorPolichinelo()
    case .abdominal: ContadorAbdominal()
    }
}
