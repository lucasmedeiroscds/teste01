import SwiftUI

struct TelaLista: View {
    @EnvironmentObject private var repositorio: RepositorioAlarmes
    @State private var emEdicao: Alarme?
    @State private var criandoNovo = false

    var body: some View {
        NavigationStack {
            List {
                if let (alarme, quando) = proximoAtivo(repositorio.alarmes) {
                    Section {
                        Text("Próximo: \(alarme.horarioFormatado), \(tempoAte(Date(), quando))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                ForEach(repositorio.alarmes) { alarme in
                    LinhaDeAlarme(alarme: alarme) { ligado in
                        var novo = alarme
                        novo.ativo = ligado
                        repositorio.salvar(novo)
                        Task { await Agendador.agendar(novo) }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { emEdicao = alarme }
                }
                .onDelete { indices in
                    for i in indices {
                        let id = repositorio.alarmes[i].id
                        Task { await Agendador.cancelar(id) }
                        repositorio.remover(id)
                    }
                }

                if repositorio.alarmes.isEmpty {
                    Text("Nenhum alarme ainda. Crie um e escolha quantas repetições você vai precisar fazer para conseguir desligar.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Levanta")
            .toolbar {
                Button { criandoNovo = true } label: { Image(systemName: "plus") }
            }
            .sheet(item: $emEdicao) { alarme in
                TelaEditor(original: alarme)
            }
            .sheet(isPresented: $criandoNovo) {
                TelaEditor(original: nil)
            }
        }
    }
}

private struct LinhaDeAlarme: View {
    let alarme: Alarme
    let aoAlternar: (Bool) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(alarme.horarioFormatado)
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(alarme.ativo ? .primary : .secondary)
                Text("\(alarme.diasFormatados) · \(alarme.repeticoes) \(alarme.exercicio.rotulo.lowercased())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !alarme.rotulo.isEmpty {
                    Text(alarme.rotulo).font(.caption2).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Toggle("", isOn: Binding(get: { alarme.ativo }, set: aoAlternar))
                .labelsHidden()
        }
        .padding(.vertical, 6)
    }
}
