import Foundation
import UserNotifications

/// Agenda os alarmes como notificações locais.
///
/// ## O limite honesto do iOS
///
/// O iOS não deixa um app de terceiros executar código na hora marcada com o
/// aparelho bloqueado — só o Relógio da Apple tem esse privilégio. O que existe
/// é a notificação local, e ela toca no máximo **30 segundos** de som.
///
/// Daí as duas defesas deste arquivo:
///
/// 1. **Corrente de notificações.** Cada alarme vira `repeticoesDaCorrente`
///    notificações seguidas, espaçadas de 30 s. Na prática o alarme insiste por
///    alguns minutos em vez de dar um bipe só.
/// 2. **Som de alarme crítico**, quando o app tem a autorização da Apple
///    (`criticalAlert`): toca mesmo no silencioso e no Foco. Sem essa
///    autorização — que exige pedido justificado à Apple — o alarme respeita o
///    modo silencioso, e é preciso avisar isso ao usuário.
///
/// Enquanto o app está aberto em primeiro plano, o `TocadorDeAlarme` assume e
/// toca em laço, sem limite de 30 s. Por isso a tela do alarme mantém o som
/// mesmo depois de a notificação acabar.
enum Agendador {

    /// Quantas notificações encadeadas por disparo, de 30 s cada.
    static let repeticoesDaCorrente = 10

    static func pedirAutorizacao() async -> Bool {
        let centro = UNUserNotificationCenter.current()
        var opcoes: UNAuthorizationOptions = [.alert, .sound, .badge]
        // O alerta crítico só é concedido a apps com a permissão especial da
        // Apple; pedir sem ela simplesmente não concede, e não quebra nada.
        opcoes.insert(.criticalAlert)
        return (try? await centro.requestAuthorization(options: opcoes)) ?? false
    }

    static func agendar(_ alarme: Alarme) async {
        await cancelar(alarme.id)
        guard alarme.ativo, let primeiro = alarme.proximoDisparo() else { return }

        let centro = UNUserNotificationCenter.current()
        for i in 0..<repeticoesDaCorrente {
            let quando = primeiro.addingTimeInterval(Double(i) * 30)
            let conteudo = UNMutableNotificationContent()
            conteudo.title = alarme.rotulo.isEmpty ? "Hora de levantar" : alarme.rotulo
            conteudo.body = "\(alarme.repeticoes) \(alarme.exercicio.rotulo.lowercased()) para desligar"
            conteudo.sound = .defaultCriticalSound(withAudioVolume: alarme.volume)
            conteudo.interruptionLevel = .critical
            conteudo.userInfo = ["alarmeId": alarme.id]
            conteudo.categoryIdentifier = categoria

            let partes = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: quando)
            let gatilho = UNCalendarNotificationTrigger(dateMatching: partes, repeats: false)
            let pedido = UNNotificationRequest(identifier: identificador(alarme.id, i), content: conteudo, trigger: gatilho)
            try? await centro.add(pedido)
        }
    }

    static func cancelar(_ id: Int64) async {
        let ids = (0..<repeticoesDaCorrente).map { identificador(id, $0) }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
    }

    /// Soneca: uma corrente nova daqui a `minutos`, sem mexer no alarme salvo.
    static func adiar(_ alarme: Alarme, minutos: Int) async {
        let centro = UNUserNotificationCenter.current()
        for i in 0..<repeticoesDaCorrente {
            let conteudo = UNMutableNotificationContent()
            conteudo.title = "Soneca acabou"
            conteudo.body = "\(alarme.repeticoes) \(alarme.exercicio.rotulo.lowercased()) para desligar"
            conteudo.sound = .defaultCriticalSound(withAudioVolume: alarme.volume)
            conteudo.interruptionLevel = .critical
            conteudo.userInfo = ["alarmeId": alarme.id]

            let atraso = Double(minutos * 60) + Double(i) * 30
            let gatilho = UNTimeIntervalNotificationTrigger(timeInterval: atraso, repeats: false)
            let pedido = UNNotificationRequest(
                identifier: "soneca-\(alarme.id)-\(i)", content: conteudo, trigger: gatilho,
            )
            try? await centro.add(pedido)
        }
    }

    static func reagendarTodos(_ alarmes: [Alarme]) async {
        for a in alarmes { await agendar(a) }
    }

    static let categoria = "ALARME"

    private static func identificador(_ id: Int64, _ i: Int) -> String { "alarme-\(id)-\(i)" }
}
