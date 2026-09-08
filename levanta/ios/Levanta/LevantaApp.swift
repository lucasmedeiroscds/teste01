import SwiftUI
import UserNotifications

@main
struct LevantaApp: App {
    @UIApplicationDelegateAdaptor(Delegado.self) var delegado
    @StateObject private var repositorio = RepositorioAlarmes.shared
    @StateObject private var tocador = TocadorDeAlarme.shared

    var body: some Scene {
        WindowGroup {
            ZStack {
                TelaLista()
                // A tela do alarme cobre tudo enquanto houver alarme tocando.
                if tocador.estado != nil {
                    TelaTocando().transition(.opacity)
                }
            }
            .environmentObject(repositorio)
            .environmentObject(tocador)
            .preferredColorScheme(tocador.estado != nil ? .dark : nil)
        }
    }
}

/// Recebe a notificação do alarme e liga o tocador.
///
/// Sem isto, tocar na notificação abriria o app sem alarme nenhum na tela: a
/// notificação é só o gatilho, o alarme de verdade acontece dentro do app.
final class Delegado: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(_ app: UIApplication,
                     didFinishLaunchingWithOptions opcoes: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task {
            _ = await Agendador.pedirAutorizacao()
            await Agendador.reagendarTodos(RepositorioAlarmes.shared.alarmes)
        }
        return true
    }

    /// Com o app aberto, mostra o alerta e já começa a tocar.
    func userNotificationCenter(_ centro: UNUserNotificationCenter,
                                willPresent notificacao: UNNotification) async
        -> UNNotificationPresentationOptions {
        await ligarAlarme(de: notificacao.request.content.userInfo)
        return [.banner]
    }

    func userNotificationCenter(_ centro: UNUserNotificationCenter,
                                didReceive resposta: UNNotificationResponse) async {
        await ligarAlarme(de: resposta.notification.request.content.userInfo)
    }

    @MainActor
    private func ligarAlarme(de info: [AnyHashable: Any]) async {
        guard let id = info["alarmeId"] as? Int64 ?? (info["alarmeId"] as? NSNumber)?.int64Value,
              let alarme = RepositorioAlarmes.shared.porId(id) else { return }
        // Já tocando: a corrente de notificações não pode reiniciar a sessão e
        // zerar as repetições que a pessoa já fez.
        guard TocadorDeAlarme.shared.estado == nil else { return }
        TocadorDeAlarme.shared.iniciar(alarme, veioDaSoneca: false)

        if alarme.repetido {
            await Agendador.agendar(alarme)
        } else {
            var desligado = alarme
            desligado.ativo = false
            RepositorioAlarmes.shared.salvar(desligado)
        }
    }
}
