/* Cliente de "Conquista & Capital". Toda a regra vive no servidor: aqui so desenhamos
   o estado recebido e enviamos acoes. Funciona com mouse (PC) e toque (celular). */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const money = (v) => `$${Number(v || 0).toLocaleString('pt-BR')}`;
  const STORE = 'cc:session';

  const socket = io();
  let me = null;      // { code, playerId, token }
  let room = null;    // estado completo da sala
  let selected = null; // indice da casa selecionada
  let attackFrom = null; // origem escolhida para o ataque livre

  // ------------------------------------------------------------ helpers
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  }
  function send(event, payload) {
    return new Promise((resolve) => socket.emit(event, payload, (res) => {
      if (res && res.ok === false && res.error) toast(res.error);
      resolve(res || { ok: true });
    }));
  }
  const game = () => room?.game || null;
  const myPlayer = () => game()?.players.find((p) => p.id === me?.playerId) || null;
  const isMyTurn = () => game() && game().currentId === me?.playerId && game().phase !== 'ended';
  const playerById = (id) => game()?.players.find((p) => p.id === id) || null;

  // --------------------------------------------------------------- menu
  const savedName = localStorage.getItem('cc:name') || '';
  $('#input-name').value = savedName;
  const urlCode = new URLSearchParams(location.search).get('sala');
  if (urlCode) $('#input-code').value = urlCode.toUpperCase();

  $('#btn-create').addEventListener('click', async () => {
    const name = $('#input-name').value.trim();
    localStorage.setItem('cc:name', name);
    await send('createRoom', { name });
  });
  $('#btn-join').addEventListener('click', async () => {
    const name = $('#input-name').value.trim();
    const code = $('#input-code').value.trim().toUpperCase();
    if (code.length !== 4) return toast('Digite o codigo de 4 letras.');
    localStorage.setItem('cc:name', name);
    await send('joinRoom', { code, name });
  });
  $('#input-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

  // -------------------------------------------------------------- lobby
  $('#btn-start').addEventListener('click', () => send('start'));
  $('#btn-leave').addEventListener('click', () => { localStorage.removeItem(STORE); location.href = location.pathname; });
  $('#btn-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?sala=${room.code}`;
    const data = { title: 'Conquista & Capital', text: `Entre na minha sala: ${room.code}`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); toast('Link copiado!'); }
    } catch { toast(url); }
  });

  // --------------------------------------------------------------- abas
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
      for (const p of document.querySelectorAll('.tabpane')) {
        p.classList.toggle('active', p.id === `pane-${tab.dataset.tab}`);
      }
    });
  }
  $('#btn-help').addEventListener('click', () => {
    openModal('Regras rapidas', `
      <ul>
        <li><b>Turno:</b> role os dados, ande, resolva a casa e encerre o turno. Dupla joga de novo.</li>
        <li><b>Casa livre:</b> compre o territorio (entra com 1 tropa).</li>
        <li><b>Casa inimiga:</b> pague o tributo <i>ou</i> ataque a partir de um territorio seu com fronteira.</li>
        <li><b>Casa sua:</b> construa fortaleza (ate 3): dobra o tributo e da bonus de defesa nos dados.</li>
        <li><b>Tropas:</b> a reserva chega no inicio do turno (territorios + continentes completos) e pode
          ser posicionada em qualquer territorio seu, a qualquer momento do seu turno. Tambem da para
          recrutar pagando.</li>
        <li><b>Combate:</b> atacante rola ate 3 dados (precisa deixar 1 tropa na origem), defensor ate 2.
          Empate favorece o defensor. Zerando as tropas do defensor, o territorio muda de dono.</li>
        <li><b>Vitoria:</b> 15 dos 24 territorios, ultimo em pe, ou maior patrimonio na rodada 40.</li>
      </ul>`);
  });
  function openModal(title, html) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal').hidden = false;
  }
  $('#modal-close').addEventListener('click', () => { $('#modal').hidden = true; });

  // --------------------------------------------------------------- chat
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#chat-input').value.trim();
    if (!text) return;
    socket.emit('chat', { text });
    $('#chat-input').value = '';
  });
  socket.on('chat', ({ name, text }) => {
    const li = el('li', '', `${name}: ${text}`);
    $('#chat-log').prepend(li);
  });

  // ------------------------------------------------------------- socket
  socket.on('joined', (payload) => {
    me = payload;
    localStorage.setItem(STORE, JSON.stringify(payload));
  });
  socket.on('room', (view) => {
    room = view;
    render();
  });
  socket.on('connect', () => {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.code) send('rejoin', saved).then((res) => { if (!res.ok) localStorage.removeItem(STORE); });
  });

  // ------------------------------------------------------------ render
  function render() {
    if (!room) return show('screen-menu');
    if (room.status === 'lobby') { renderLobby(); return show('screen-lobby'); }
    show('screen-game');
    renderGame();
  }

  function renderLobby() {
    $('#lobby-code').textContent = room.code;
    const ul = $('#lobby-players');
    ul.innerHTML = '';
    room.members.forEach((m, i) => {
      const li = el('li', m.online ? '' : 'offline');
      const dot = el('span', 'dot');
      dot.style.background = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'][i % 6];
      li.append(dot, el('span', 'grow', m.name + (m.id === room.hostId ? ' (anfitriao)' : '')));
      if (m.id === me?.playerId) li.append(el('span', 'meta', 'voce'));
      ul.append(li);
    });
    const host = room.hostId === me?.playerId;
    $('#btn-start').disabled = !host || room.members.length < 2;
    $('#lobby-hint').textContent = host
      ? (room.members.length < 2 ? 'Aguardando pelo menos mais um jogador...' : 'Tudo pronto, comece quando quiser.')
      : 'Aguardando o anfitriao iniciar a partida.';
  }

  function renderGame() {
    const g = game();
    if (!g) return;
    const cur = playerById(g.currentId);
    const turn = $('#turn-label');
    turn.innerHTML = '';
    const dot = el('span', 'dot');
    dot.style.background = cur?.color || '#fff';
    turn.append(dot, el('span', '', g.winner
      ? `${playerById(g.winner.id)?.name} venceu!`
      : (isMyTurn() ? 'Sua vez' : `Vez de ${cur?.name || '—'}`)));
    $('#round-label').textContent = `Rodada ${g.round}/${g.config.maxRounds}`;
    renderBoard(g);
    renderMeBar(g);
    renderActions(g);
    renderTileBox(g);
    renderPlayers(g);
    renderLog(g);
    if (g.winner && !renderGame._announced) {
      renderGame._announced = true;
      const w = playerById(g.winner.id);
      openModal('Fim de jogo', `<p><b>${w?.name}</b> venceu a partida.</p><p class="hint">${g.winner.reason}.</p>`);
    }
  }

  function renderBoard(g) {
    const board = $('#board');
    board.innerHTML = '';
    for (const t of g.tiles) {
      const tile = el('div', 'tile' + (t.type === 'land' ? '' : ' special'));
      tile.style.gridRow = String(t.row);
      tile.style.gridColumn = String(t.col);
      tile.dataset.index = String(t.index);
      if (t.type === 'land') {
        const band = el('div', 'band');
        band.style.background = continentColor(t.cont);
        tile.append(band);
        const owner = playerById(t.ownerId);
        if (owner) {
          tile.classList.add('owned');
          tile.style.borderColor = owner.color;
          tile.style.background = `linear-gradient(180deg, ${owner.color}22, #131a33)`;
        }
        tile.append(el('div', 'nm', t.name));
        const stat = el('div', 'stat');
        if (t.forts) stat.append(el('span', 'forts', '▲'.repeat(t.forts) + ' '));
        stat.append(el('span', '', owner ? `trib ${money(t.tribute)}` : money(t.price)));
        tile.append(stat);
        if (t.troops) tile.append(el('div', 'troops', `⚔${t.troops}`));
      } else {
        tile.append(el('div', 'nm', t.name));
      }
      const pawns = el('div', 'pawns');
      for (const p of g.players) {
        if (!p.alive || p.pos !== t.index) continue;
        const pw = el('span', 'pawn');
        pw.style.background = p.color;
        pawns.append(pw);
      }
      tile.append(pawns);
      if (selected === t.index) tile.classList.add('sel');
      if (g.pending?.kind === 'enemy' && g.pending.tileId === t.index) tile.classList.add('target');
      if (attackFrom != null && canAttackPair(g, attackFrom, t.index)) tile.classList.add('reach');
      tile.addEventListener('click', () => { selectTile(t.index); });
      board.append(tile);
    }
    board.append(renderCenter(g));
  }

  function renderCenter(g) {
    const c = el('div', 'center');
    c.append(el('div', 'title', 'CONQUISTA & CAPITAL'));
    if (g.dice) {
      const d = el('div', 'dice');
      d.append(el('div', 'die', String(g.dice[0])), el('div', 'die', String(g.dice[1])));
      c.append(d);
    }
    if (g.combat) {
      const from = g.tiles[g.combat.from];
      const to = g.tiles[g.combat.to];
      c.append(el('div', 'battle',
        `${from.name} → ${to.name}: ${g.combat.attRolls.join('-')} x ${g.combat.defRolls.join('-')}`));
      c.append(el('div', 'battle', g.combat.captured
        ? 'Territorio conquistado!'
        : `atacante -${g.combat.attLoss} / defensor -${g.combat.defLoss}`));
    }
    if (g.card) c.append(el('div', 'battle', `Conselho: ${g.card.text}`));
    const leader = [...g.players].filter((p) => p.alive).sort((a, b) => b.lands - a.lands)[0];
    if (leader) c.append(el('div', '', `Meta: ${g.config.targetLands} territorios — lider: ${leader.name} (${leader.lands})`));
    return c;
  }

  const CONT_COLORS = {
    na: '#ef4444', sa: '#f59e0b', eu: '#3b82f6', af: '#22c55e', as: '#a855f7', oc: '#14b8a6',
  };
  const continentColor = (c) => CONT_COLORS[c] || '#64748b';

  function renderMeBar(g) {
    const p = myPlayer();
    const bar = $('#me-bar');
    bar.innerHTML = '';
    if (!p) return;
    const chips = [
      ['Caixa', money(p.money)],
      ['Reserva', `${p.reserve} tropas`],
      ['Territorios', `${p.lands}/${g.config.targetLands}`],
      ['Patrimonio', money(p.worth)],
    ];
    for (const [k, v] of chips) {
      const chip = el('span', 'chip');
      chip.innerHTML = `${k}: <b>${v}</b>`;
      bar.append(chip);
    }
    if (!p.alive) bar.append(el('span', 'chip', 'Eliminado'));
  }

  function actionBtn(label, handler, cls = '') {
    const b = el('button', `btn ${cls}`, label);
    b.addEventListener('click', handler);
    return b;
  }

  function renderActions(g) {
    const box = $('#action-box');
    box.innerHTML = '';
    const p = myPlayer();
    if (!p) return;
    if (g.winner) {
      box.append(el('div', 'box-title', 'Partida encerrada'));
      return;
    }
    if (!p.alive) {
      box.append(el('div', 'box-title', 'Voce foi eliminado — assista ao desfecho.'));
      return;
    }
    if (!isMyTurn()) {
      box.append(el('div', 'box-title', `Aguardando ${playerById(g.currentId)?.name}...`));
      const offline = !room.members.find((m) => m.id === g.currentId)?.online;
      if (offline && room.hostId === me.playerId) {
        box.append(actionBtn('Jogador ausente: remover da partida', () => send('skipOffline'), 'danger'));
      }
      return;
    }

    if (g.phase === 'roll') {
      box.append(actionBtn('🎲 Rolar os dados', () => send('action', { type: 'roll' }), 'primary big'));
      return;
    }

    const pend = g.pending;
    if (pend?.kind === 'buy') {
      const t = g.tiles[pend.tileId];
      box.append(el('div', 'box-title', `${t.name} esta livre`));
      const row = el('div', 'row');
      row.append(actionBtn(`Comprar por ${money(t.price)}`, () => send('action', { type: 'buy' }), 'primary'));
      row.append(actionBtn('Deixar passar', () => send('action', { type: 'skip' })));
      box.append(row);
    } else if (pend?.kind === 'own') {
      const t = g.tiles[pend.tileId];
      box.append(el('div', 'box-title', `${t.name} — ${t.forts}/3 fortalezas`));
      const row = el('div', 'row');
      const b = actionBtn(`Construir fortaleza (${money(t.fortCost)})`, () => send('action', { type: 'fortify' }), 'primary');
      b.disabled = t.forts >= 3 || p.money < t.fortCost;
      row.append(b, actionBtn('Nao construir', () => send('action', { type: 'skip' })));
      box.append(row);
    } else if (pend?.kind === 'enemy') {
      const t = g.tiles[pend.tileId];
      const owner = playerById(t.ownerId);
      box.append(el('div', 'box-title', `Invasao em ${t.name} (${owner?.name})`));
      box.append(el('div', 'hint', `Defesa: ${t.troops} tropas, ${t.forts} fortaleza(s). Tributo: ${money(pend.tribute)}.`));
      const origins = attackOrigins(g, t.index);
      if (origins.length) {
        box.append(el('div', 'box-title', 'Atacar a partir de:'));
        const row = el('div', 'row');
        for (const o of origins) {
          row.append(actionBtn(`⚔ Atacar de ${o.name} (${o.troops})`,
            () => send('action', { type: 'attack', from: o.index }), 'danger'));
        }
        box.append(row);
      } else {
        box.append(el('div', 'hint', 'Sem fronteira propria com 2+ tropas: so resta pagar.'));
      }
      box.append(actionBtn(`Pagar tributo ${money(pend.tribute)}`, () => send('action', { type: 'tribute' }), 'primary'));
    } else if (pend?.kind === 'command') {
      box.append(el('div', 'box-title', 'Quartel-General: ataque livre'));
      box.append(el('div', 'hint', attackFrom == null
        ? 'Toque em um territorio seu com 2+ tropas para escolher a origem.'
        : `Origem: ${g.tiles[attackFrom].name}. Agora toque em um vizinho inimigo.`));
      box.append(actionBtn('Abrir mao do ataque', () => { attackFrom = null; send('action', { type: 'skip' }); }));
    }

    // Acoes disponiveis a qualquer momento do turno.
    box.append(el('div', 'box-title', 'Tropas'));
    const row2 = el('div', 'row');
    const recruit = actionBtn(`Recrutar 1 tropa (${money(g.config.recruitCost)})`,
      () => send('action', { type: 'recruit', count: 1 }));
    recruit.disabled = p.money < g.config.recruitCost;
    row2.append(recruit);
    row2.append(actionBtn('Posicionar reserva', () => {
      toast(selected != null ? 'Use os botoes do territorio abaixo.' : 'Toque em um territorio seu no tabuleiro.');
    }, 'ghost'));
    box.append(row2);

    const endRow = el('div', 'row');
    endRow.append(actionBtn('Encerrar turno ▶', () => { attackFrom = null; send('action', { type: 'endTurn' }); }, 'primary big'));
    box.append(endRow);
    box.append(actionBtn('Abandonar a partida', () => {
      if (confirm('Abandonar a partida? Seus territorios ficam neutros.')) send('surrender');
    }, 'ghost tiny'));
  }

  function attackOrigins(g, targetIndex) {
    const adj = g.adjacency[targetIndex] || [];
    return adj
      .map((i) => g.tiles[i])
      .filter((t) => t.ownerId === me.playerId && t.troops >= 2);
  }
  function canAttackPair(g, from, to) {
    const f = g.tiles[from];
    const t = g.tiles[to];
    if (!f || !t || t.type !== 'land' || !t.ownerId || t.ownerId === me.playerId) return false;
    return (g.adjacency[from] || []).includes(to) && f.troops >= 2;
  }

  function selectTile(index) {
    const g = game();
    if (!g) return;
    if (isMyTurn() && g.pending?.kind === 'command') {
      const t = g.tiles[index];
      if (attackFrom != null && canAttackPair(g, attackFrom, index)) {
        send('action', { type: 'attack', from: attackFrom, to: index });
        attackFrom = null;
        selected = index;
        return;
      }
      if (t.ownerId === me.playerId && t.troops >= 2) {
        attackFrom = index;
        selected = index;
        renderGame();
        return;
      }
    }
    selected = selected === index ? null : index;
    renderGame();
  }

  function renderTileBox(g) {
    const box = $('#tile-box');
    box.innerHTML = '';
    if (selected == null) return;
    const t = g.tiles[selected];
    box.append(el('div', 'box-title', t.name));
    if (t.type !== 'land') {
      box.append(el('div', 'hint', t.desc || 'Casa especial.'));
      return;
    }
    const owner = playerById(t.ownerId);
    box.append(el('div', 'hint',
      `${continentName(t.cont)} • preco ${money(t.price)} • tributo base ${money(t.rent)}`));
    box.append(el('div', 'hint', owner
      ? `Dono: ${owner.name} • ${t.troops} tropa(s) • ${t.forts} fortaleza(s) • tributo atual ${money(t.tribute)}`
      : 'Territorio livre.'));

    const p = myPlayer();
    if (!p?.alive || !isMyTurn()) return;

    if (t.ownerId === me.playerId && p.reserve > 0) {
      const row = el('div', 'row');
      for (const n of [1, 3, 5]) {
        if (p.reserve < n) continue;
        row.append(actionBtn(`+${n} tropa${n > 1 ? 's' : ''}`, () => send('action', { type: 'deploy', tileId: t.index, count: n })));
      }
      if (p.reserve > 5) {
        row.append(actionBtn(`+${p.reserve} (tudo)`, () => send('action', { type: 'deploy', tileId: t.index, count: p.reserve })));
      }
      box.append(row);
    }
    if (t.ownerId && t.ownerId !== me.playerId) {
      const origins = attackOrigins(g, t.index).filter(() => g.pending?.kind === 'command' || g.pending?.tileId === t.index);
      if (origins.length) {
        const row = el('div', 'row');
        for (const o of origins) {
          row.append(actionBtn(`Atacar de ${o.name}`, () => send('action', {
            type: 'attack', from: o.index, to: t.index,
          }), 'danger'));
        }
        box.append(row);
      }
    }
  }
  const CONT_NAMES = {
    na: 'America do Norte', sa: 'America do Sul', eu: 'Europa', af: 'Africa', as: 'Asia', oc: 'Oceania',
  };
  const continentName = (c) => CONT_NAMES[c] || '';

  function renderPlayers(g) {
    const ul = $('#game-players');
    ul.innerHTML = '';
    for (const p of g.players) {
      const member = room.members.find((m) => m.id === p.id);
      const li = el('li', [p.alive ? '' : 'dead', member?.online ? '' : 'offline'].join(' ').trim());
      const dot = el('span', 'dot');
      dot.style.background = p.color;
      li.append(dot, el('span', 'grow', p.name + (p.id === g.currentId ? ' ⏳' : '') + (p.id === me?.playerId ? ' (voce)' : '')));
      const meta = el('span', 'meta');
      meta.innerHTML = `${money(p.money)}<br>${p.lands} territorios • ${p.reserve} reserva`;
      li.append(meta);
      ul.append(li);
    }
  }

  function renderLog(g) {
    const ul = $('#log');
    ul.innerHTML = '';
    for (const entry of g.log) ul.append(el('li', entry.kind, entry.text));
  }

  show('screen-menu');
})();
