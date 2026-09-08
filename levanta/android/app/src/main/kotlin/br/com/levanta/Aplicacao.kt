package br.com.levanta

import android.app.Application
import br.com.levanta.alarme.Agendador
import br.com.levanta.dados.RepositorioAlarmes

/**
 * Reagenda os alarmes toda vez que o processo sobe.
 *
 * O receptor de boot cobre o reinício do aparelho, mas o processo também é
 * morto por falta de memória e por atualização do app, e nesses casos ninguém
 * mais reagenda. Fazer isso na largada é barato e fecha o buraco.
 */
class Aplicacao : Application() {
    override fun onCreate() {
        super.onCreate()
        val repositorio = RepositorioAlarmes.de(this)
        Agendador.reagendarTodos(this, repositorio.alarmes.value)
    }
}
