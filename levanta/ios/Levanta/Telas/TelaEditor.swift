import SwiftUI

struct TelaEditor: View {
    let original: Alarme?

    @EnvironmentObject private var repositorio: RepositorioAlarmes
    @Environment(\.dismiss) private var fechar

    @State private var horario = Date()
    @State private var dias: Set<Int> = []
    @State private var exercicio: Exercicio = .agachamento
    @State private var repeticoes = 20.0
    @State private var soneca = 5.0
    @State private var maxSonecas = 3.0
    @State private var vibrar = true
    @State private var rotulo = ""

    /// Domingo a sábado, na numeração do `Calendar` do iOS.
    private let semana = Array(1...7)

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Horário", selection: $horario, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()

                Section("Repetir") {
                    HStack(spacing: 6) {
                        ForEach(semana, id: \.self) { dia in
                            Button(String(Alarme.abreviacao(dia).prefix(1))) {
                                if dias.contains(dia) { dias.remove(dia) } else { dias.insert(dia) }
                            }
                            .buttonStyle(.plain)
                            .frame(width: 38, height: 38)
                            .background(dias.contains(dia) ? Color.accentColor : Color.secondary.opacity(0.15))
                            .foregroundStyle(dias.contains(dia) ? Color.white : Color.primary)
                            .clipShape(Circle())
                        }
                    }
                    if dias.isEmpty {
                        Text("Sem dia marcado, o alarme toca uma vez e se desliga.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }

                Section("Para desligar, fazer") {
                    ForEach(Exercicio.allCases, id: \.self) { e in
                        Button {
                            exercicio = e
                            repeticoes = Double(e.repeticoesSugeridas)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(e.rotulo).fontWeight(e == exercicio ? .bold : .regular)
                                Text(e.enquadramento).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(e == exercicio ? Color.accentColor.opacity(0.15) : nil)
                    }
                }

                Section("Repetições: \(Int(repeticoes))") {
                    Slider(value: $repeticoes, in: 1...100, step: 1)
                    Text(exercicio.instrucao).font(.caption).foregroundStyle(.secondary)
                }

                Section("Soneca") {
                    Text("Cada soneca adia \(Int(soneca)) min.").font(.caption)
                    Slider(value: $soneca, in: 1...30, step: 1)
                    Text(Int(maxSonecas) == 0
                         ? "Sem soneca: só o exercício desliga."
                         : "No máximo \(Int(maxSonecas)) sonecas; depois só o exercício desliga.")
                        .font(.caption)
                    Slider(value: $maxSonecas, in: 0...10, step: 1)
                }

                Section("Extras") {
                    Toggle("Vibrar", isOn: $vibrar)
                    TextField("Nome do alarme", text: $rotulo)
                }
            }
            .navigationTitle(original == nil ? "Novo alarme" : "Editar alarme")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { fechar() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar", action: salvar)
                }
                if let original {
                    ToolbarItem(placement: .destructiveAction) {
                        Button("Excluir", role: .destructive) {
                            Task { await Agendador.cancelar(original.id) }
                            repositorio.remover(original.id)
                            fechar()
                        }
                    }
                }
            }
            .onAppear(perform: carregar)
        }
    }

    private func carregar() {
        guard let a = original else { return }
        horario = Calendar.current.date(bySettingHour: a.hora, minute: a.minuto, second: 0, of: Date()) ?? Date()
        dias = a.dias
        exercicio = a.exercicio
        repeticoes = Double(a.repeticoes)
        soneca = Double(a.sonecaMinutos)
        maxSonecas = Double(a.maxSonecas)
        vibrar = a.vibrar
        rotulo = a.rotulo
    }

    private func salvar() {
        let partes = Calendar.current.dateComponents([.hour, .minute], from: horario)
        let alarme = Alarme(
            id: original?.id ?? repositorio.novoId(),
            hora: partes.hour ?? 7,
            minuto: partes.minute ?? 0,
            dias: dias,
            ativo: true,
            rotulo: rotulo.trimmingCharacters(in: .whitespaces),
            exercicio: exercicio,
            repeticoes: Int(repeticoes),
            sonecaMinutos: Int(soneca),
            maxSonecas: Int(maxSonecas),
            vibrar: vibrar,
        )
        repositorio.salvar(alarme)
        Task { await Agendador.agendar(alarme) }
        fechar()
    }
}
