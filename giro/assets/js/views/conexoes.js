/* Conexões: o que dá para automatizar hoje, o que não dá, e por quê.
 * Sem promessa de integração que não existe. */

import { getState, addTurnos, exportJSON, importJSON, resetAll } from '../store.js';
import { PLATAFORMAS, OPEN_FINANCE, nomeApp, corApp } from '../connectors/registry.js';
import { parseCSV, sugerirMapeamento, converter, CAMPOS, turnosParaCSV } from '../connectors/csv.js';
import { money, n0, n1, esc, icon, toast, download, todayISO, dayMonth } from '../util.js';

let arquivo = null;   // { nome, headers, rows, mapa, opcoes }

export function render(root) {
  const s = getState();

  root.innerHTML = `
  <div class="view-head">
    <h1>Conexões</h1>
    <p>A pergunta honesta é: dá para o site puxar seus ganhos direto do iFood, da Uber, da 99 ou do Rappi? A resposta curta está logo abaixo, e ela muda como este app funciona.</p>
  </div>

  <div class="card">
    <div class="card-head"><h2>O estado real das APIs</h2></div>
    <div class="note note-warning">
      <strong>Nenhuma dessas plataformas oferece hoje uma API pública que permita a você autorizar um app de terceiros a ler os seus próprios ganhos.</strong>
      As APIs que elas publicam existem — mas atendem o outro lado do balcão: restaurante, loja, embarcador, empresa.
    </div>
    <p class="small muted" style="margin-top:12px">
      Por isso o Giro não tem um botão de "conectar conta" que não conectaria nada. Ele faz o que é possível fazer bem:
      importa o extrato que a própria plataforma deixa você baixar, aceita qualquer planilha por CSV, e tem um lançamento manual
      que leva vinte segundos por dia. A arquitetura já está pronta para uma API de verdade — o contrato de conexão está escrito
      em <code>connectors/registry.js</code>, esperando alguém abrir a porta.
    </p>
  </div>

  <div class="card">
    <div class="card-head"><h2>Plataforma por plataforma</h2></div>
    <div class="conn">
      ${PLATAFORMAS.map((p) => `
        <div class="conn-item">
          <span class="conn-logo" style="background:${corApp(p.id)}">${esc(p.sigla)}</span>
          <div class="conn-body">
            <div class="row" style="gap:8px">
              <h3>${esc(p.nome)}</h3>
              <span class="badge ${p.status.badge}">${esc(p.status.rotulo)}</span>
            </div>
            <p style="margin-top:5px"><b>API pública:</b> ${esc(p.apiPublica)}</p>
            <p><b>Para quem roda:</b> ${esc(p.paraQuemRoda)}</p>
            <details style="margin-top:8px">
              <summary class="small" style="cursor:pointer;color:var(--accent)">Como trazer esses ganhos para o Giro</summary>
              <ol class="small muted" style="margin:8px 0 0;padding-left:20px">
                ${p.comoTrazer.map((li) => `<li style="margin-bottom:4px">${esc(li)}</li>`).join('')}
              </ol>
            </details>
          </div>
        </div>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Importar extrato ou planilha</h2><span class="small dim">CSV · lido no seu aparelho</span></div>
    <p class="small muted" style="margin-bottom:14px">
      Serve para o extrato do portal de parceiros da Uber, para o extrato do seu banco e para qualquer planilha sua.
      O Giro tenta adivinhar as colunas, mostra uma prévia e só grava depois que você confirmar.
    </p>

    <div class="field">
      <label for="arq">Arquivo CSV</label>
      <input type="file" id="arq" accept=".csv,.txt,text/csv,text/plain">
    </div>

    <div id="mapeamento">${arquivo ? mapeamentoHTML(arquivo) : ''}</div>
  </div>

  <div class="card">
    <div class="card-head"><h2>${esc(OPEN_FINANCE.nome)}</h2><span class="badge">caminho futuro</span></div>
    <p class="small muted">${esc(OPEN_FINANCE.resumo)}</p>
    <div class="note" style="margin-top:12px"><b>Limite:</b> ${esc(OPEN_FINANCE.limite)}</div>
    <p class="small muted" style="margin-top:12px">${esc(OPEN_FINANCE.alternativa)}</p>
  </div>

  <div class="card">
    <div class="card-head"><h2>Seus dados</h2><span class="badge badge-good">só no seu aparelho</span></div>
    <p class="small muted" style="margin-bottom:14px">
      O Giro guarda tudo no armazenamento do navegador. Nada é enviado para servidor nenhum — o que também significa que,
      se você limpar os dados do navegador ou trocar de aparelho, o histórico vai junto. Faça backup de vez em quando.
    </p>
    <div class="row">
      <button class="btn btn-ghost btn-sm" data-export-json>${icon('download')} Backup completo (JSON)</button>
      <button class="btn btn-ghost btn-sm" data-export-csv>${icon('download')} Lançamentos (CSV)</button>
      <label class="btn btn-ghost btn-sm" style="cursor:pointer">
        ${icon('upload')} Restaurar backup
        <input type="file" accept=".json,application/json" data-import-json hidden>
      </label>
      <button class="btn btn-danger btn-sm" data-reset>${icon('trash')} Apagar tudo</button>
    </div>
    <p class="tiny dim" style="margin-top:10px">${s.turnos.length} lançamento(s) e ${s.abastecimentos.length} abastecimento(s) guardados.</p>
  </div>`;

  bind(root);
}

/* ---------- importador ---------- */

function mapeamentoHTML(a) {
  const { turnos, avisos } = converter(a.rows, a.mapa, a.opcoes);
  const previa = turnos.slice(0, 6);

  return `
  <div class="note note-accent" style="margin-bottom:14px">
    <b>${esc(a.nome)}</b> — ${a.rows.length} linha(s), ${a.headers.length} coluna(s).
  </div>

  <div class="fields-2">
    <div class="field">
      <label for="imp-app">Estes ganhos são de</label>
      <select id="imp-app">
        ${PLATAFORMAS.map((p) => `<option value="${p.id}" ${a.opcoes.app === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="imp-dist">Distância no arquivo está em</label>
      <select id="imp-dist">
        <option value="km" ${a.opcoes.distancia === 'km' ? 'selected' : ''}>Quilômetros</option>
        <option value="milhas" ${a.opcoes.distancia === 'milhas' ? 'selected' : ''}>Milhas</option>
      </select>
    </div>
  </div>

  <p class="field-label" style="margin-bottom:8px">De qual coluna vem cada informação</p>
  <div class="fields-2">
    ${CAMPOS.map((c) => `
      <div class="field">
        <label for="map-${c.id}">${esc(c.nome)}${c.obrigatorio ? ' *' : ''}</label>
        <select id="map-${c.id}" data-map="${c.id}">
          <option value="">— não tem —</option>
          ${a.headers.map((h) => `<option value="${esc(h)}" ${a.mapa[c.id] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}
        </select>
      </div>`).join('')}
  </div>

  <div class="checkline">
    <input type="checkbox" id="imp-agrupar" ${a.opcoes.agruparPorDia ? 'checked' : ''}>
    <label for="imp-agrupar">Somar as corridas do mesmo dia num único lançamento<br>
      <span class="hint">Recomendado. O Giro trabalha por jornada, não por corrida.</span></label>
  </div>

  ${avisos.length ? `<div class="note note-warning" style="margin-bottom:14px">
    ${avisos.map((v) => `<div>${esc(v)}</div>`).join('')}
  </div>` : ''}

  ${previa.length ? `
    <p class="field-label" style="margin-bottom:8px">Prévia — ${turnos.length} lançamento(s) serão criados</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th class="n">Bruto</th><th class="n">Gorjeta</th><th class="n">Km</th><th class="n">Horas</th><th class="n">Corridas</th></tr></thead>
        <tbody>
          ${previa.map((t) => `<tr>
            <td>${dayMonth(t.data)}</td>
            <td class="n">${money(t.bruto)}</td>
            <td class="n">${money(t.gorjeta)}</td>
            <td class="n">${n1(t.km)}</td>
            <td class="n">${n1(t.horas)}</td>
            <td class="n">${n0(t.corridas)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${turnos.length > previa.length ? `<p class="tiny dim" style="margin-top:8px">…e mais ${turnos.length - previa.length}.</p>` : ''}
    <div class="row" style="margin-top:14px">
      <button class="btn btn-primary" data-confirmar>${icon('check')} Importar ${turnos.length} lançamento(s)</button>
      <button class="btn btn-ghost" data-cancelar>Cancelar</button>
    </div>`
  : '<div class="empty">Nenhuma linha pôde ser lida com esse mapeamento. Confira as colunas de data e de valor.</div>'}`;
}

/* ---------- eventos ---------- */

function bind(root) {
  const campoArquivo = root.querySelector('#arq');
  const host = root.querySelector('#mapeamento');

  campoArquivo?.addEventListener('change', async () => {
    const f = campoArquivo.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Arquivo muito grande (máximo 8 MB).', 'error'); return; }
    try {
      const texto = await f.text();
      const { headers, rows } = parseCSV(texto);
      if (!headers.length || !rows.length) { toast('Não encontrei linhas de dados nesse arquivo.', 'error'); return; }
      arquivo = {
        nome: f.name,
        headers,
        rows,
        mapa: sugerirMapeamento(headers),
        opcoes: { app: 'uber', agruparPorDia: true, distancia: 'km', tempo: 'auto' },
      };
      host.innerHTML = mapeamentoHTML(arquivo);
      bindMapeamento(root);
    } catch (err) {
      console.error(err);
      toast('Não consegui ler o arquivo.', 'error');
    }
  });

  if (arquivo) bindMapeamento(root);

  root.querySelector('[data-export-json]')?.addEventListener('click', () => {
    download(`giro-backup-${todayISO()}.json`, exportJSON(), 'application/json');
    toast('Backup gerado.', 'good');
  });

  root.querySelector('[data-export-csv]')?.addEventListener('click', () => {
    const s = getState();
    if (!s.turnos.length) { toast('Nada para exportar ainda.', 'error'); return; }
    download(`giro-lancamentos-${todayISO()}.csv`, turnosParaCSV(s.turnos, nomeApp), 'text/csv;charset=utf-8');
    toast('CSV gerado.', 'good');
  });

  root.querySelector('[data-import-json]')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm('Restaurar um backup substitui todos os dados atuais. Continuar?')) { e.target.value = ''; return; }
    try {
      importJSON(await f.text());
      toast('Backup restaurado.', 'good');
      render(root);
    } catch (err) {
      console.error(err);
      toast('Arquivo de backup inválido.', 'error');
    }
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    if (!confirm('Isso apaga lançamentos, custos e configurações deste aparelho. Não dá para desfazer. Continuar?')) return;
    if (!confirm('Tem certeza mesmo? Se ainda não fez backup, cancele e faça primeiro.')) return;
    resetAll();
    arquivo = null;
    toast('Tudo apagado.');
    render(root);
  });
}

function bindMapeamento(root) {
  const host = root.querySelector('#mapeamento');
  const redesenhar = () => { host.innerHTML = mapeamentoHTML(arquivo); bindMapeamento(root); };

  host.querySelectorAll('[data-map]').forEach((sel) => {
    sel.addEventListener('change', () => { arquivo.mapa[sel.dataset.map] = sel.value; redesenhar(); });
  });
  host.querySelector('#imp-app')?.addEventListener('change', (e) => { arquivo.opcoes.app = e.target.value; redesenhar(); });
  host.querySelector('#imp-dist')?.addEventListener('change', (e) => { arquivo.opcoes.distancia = e.target.value; redesenhar(); });
  host.querySelector('#imp-agrupar')?.addEventListener('change', (e) => { arquivo.opcoes.agruparPorDia = e.target.checked; redesenhar(); });
  host.querySelector('[data-cancelar]')?.addEventListener('click', () => { arquivo = null; render(root); });

  host.querySelector('[data-confirmar]')?.addEventListener('click', () => {
    const { turnos } = converter(arquivo.rows, arquivo.mapa, arquivo.opcoes);
    if (!turnos.length) { toast('Nada para importar.', 'error'); return; }
    addTurnos(turnos);
    toast(`${turnos.length} lançamento(s) importado(s).`, 'good');
    arquivo = null;
    render(root);
  });
}

export const meta = { titulo: 'Conexões' };
