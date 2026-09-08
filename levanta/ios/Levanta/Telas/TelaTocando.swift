import SwiftUI

/// A tela que cobre o app enquanto o alarme toca.
struct TelaTocando: View {
    @EnvironmentObject private var tocador: TocadorDeAlarme
    @State private var indoParaOTreino = false
    @State private var pulso = false

    var body: some View {
        if let estado = tocador.estado {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 0) {
                    Spacer()
                    Text(Date(), format: .dateTime.hour().minute())
                        .font(.system(size: 76, weight: .light))
                        .foregroundStyle(.white)
                        .scaleEffect(pulso ? 1.06 : 1)
                        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulso)
                    if !estado.alarme.rotulo.isEmpty {
                        Text(estado.alarme.rotulo).font(.title3).foregroundStyle(.orange)
                    }

                    Spacer()

                    Text("Para desligar").font(.caption).foregroundStyle(.white.opacity(0.6))
                    Text("\(estado.alarme.repeticoes) \(estado.alarme.exercicio.rotulo.lowercased())")
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text(estado.alarme.exercicio.enquadramento)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                        .padding(.horizontal, 24)

                    Spacer()

                    VStack(spacing: 12) {
                        Button {
                            tocador.abaixar()
                            indoParaOTreino = true
                        } label: {
                            Text("Desligar")
                                .font(.title3.bold())
                                .frame(maxWidth: .infinity, minHeight: 60)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)

                        if estado.podeAdiar {
                            Button {
                                Task { await tocador.adiar() }
                            } label: {
                                Text("Soneca de \(estado.alarme.sonecaMinutos) min (\(estado.sonecasRestantes) \(estado.sonecasRestantes == 1 ? "restante" : "restantes"))")
                                    .frame(maxWidth: .infinity, minHeight: 52)
                            }
                            .buttonStyle(.bordered)
                            .tint(.white)
                        } else {
                            Text("Acabaram as sonecas. Agora é o exercício.")
                                .font(.subheadline)
                                .foregroundStyle(.orange)
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.bottom, 32)
                }
            }
            .onAppear { pulso = true }
            .fullScreenCover(isPresented: $indoParaOTreino) {
                TelaTreino(estado: estado)
            }
        }
    }
}
