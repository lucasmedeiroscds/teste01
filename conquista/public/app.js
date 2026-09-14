/* Cliente de "Conquista & Capital". As regras vivem no servidor: aqui desenhamos o
   mapa-mundi, o estado recebido, e enviamos acoes. Mouse no PC, toque no celular. */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const gold = (v) => `${Number(v || 0).toLocaleString('pt-BR')} ouro`;
  const STORE = 'cc:session';

  const socket = io();
  let me = null;        // { code, playerId, token }
  let room = null;      // estado da sala
  let world = null;     // mapa-mundi (paths + vizinhos)
  let selected = null;  // id do pais selecionado
  const view = { x: 0, y: 0, w: 1000, h: 520 };

  // ------------------------------------------------------------- helpers
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
  const countryById = (id) => game()?.countries.find((c) => c.id === id) || null;
  const mapById = (id) => world?.byId.get(id) || null;
  const neighborsOf = (id) => mapById(id)?.neighbors || [];

  async function loadWorld() {
    if (world) return world;
    const data = await (await fetch('data/world.json')).json();
    world = data;
    world.byId = new Map(data.countries.map((c) => [c.id, c]));
    window.__world = world; // util para depuracao e testes automatizados
    return world;
  }

  // ---------------------------------------------------------------- menu
  $('#input-name').value = localStorage.getItem('cc:name') || '';
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

  const RULES_HTML = `
    <ul>
      <li><b>Classes:</b> <b>Empresario</b> (“Lavei, sumi”) paga 10% a menos de imposto;
        <b>Politico</b> (“Meu pedaco”) embolsa 10% do proprio patrimonio a cada 4 rodadas;
        <b>Figura religiosa</b> (“Dizimo”) recolhe 10% do patrimonio dos outros a cada 8 rodadas;
        <b>Laranjao</b> (“Testa de ferro”) soma +1 no dado quando invade.</li>
      <li><b>Missao secreta:</b> cada jogador recebe uma das 50 missoes no inicio, com dois continentes
        sorteados na mesma carta. Cumprir a missao <i>ou</i> dominar esses dois continentes acaba o jogo.</li>
      <li><b>Comeco:</b> um pais aleatorio para cada um. O pais rende de 100 a 400 de ouro por rodada
        conforme a posicao no ranking mundial de produtividade.</li>
      <li><b>Turno:</b> role o dado e ande esse tanto de paises pelas fronteiras (pode parar antes).
        Onde parar: pais livre = comprar; pais seu = construir; pais inimigo = pagar tributo ou guerra.</li>
      <li><b>Guerra (dado de 12):</b> ataque de um pais seu com 2+ tropas contra um vizinho inimigo.
        Cada lado rola 1d12 e o maior numero leva o pais — empate defende. Perdeu? -1 tropa.
        Venceu? metade das tropas marcha para o pais conquistado.</li>
      <li><b>Tropas (estilo War):</b> a cada turno voce recebe paises/2 (minimo 3) mais o bonus de
        cada continente completo, e distribui onde quiser.</li>
      <li><b>Industrias:</b> pequena 230 (+35/rodada), grande 500 (+75/rodada), no maximo 3 por pais.
        Cada uma custa 20% do que rende em <b>manutencao</b> por rodada.</li>
      <li><b>Banco:</b> inflacao de 2% a cada 2 rodadas; imposto a cada 13 rodadas com <b>aliquota
        progressiva</b> (10% a 30% conforme o patrimonio); emprestimo a partir da rodada 5, teto 600,
        um por vez, com juros.</li>
      <li><b>Cartas de evento:</b> uma vez a cada 20 rodadas (em rodada sorteada) todo mundo compra uma
        carta — pode salvar ou arruinar.</li>
      <li><b>Eliminacao:</b> ficou sem nenhum pais, esta fora.</li>
    </ul>`;
  $('#rules-text').innerHTML = RULES_HTML;

  // -------------------------------------------------------------- lobby
  $('#btn-start').addEventListener('click', () => send('start'));
  $('#btn-leave').addEventListener('click', () => { localStorage.removeItem(STORE); location.href = location.pathname; });
  $('#btn-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?sala=${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Conquista & Capital', text: `Sala ${room.code}`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado!'); }
    } catch { toast(url); }
  });

  // --------------------------------------------------------------- abas
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
      for (const p of document.querySelectorAll('.tabpane')) p.classList.toggle('active', p.id === `pane-${tab.dataset.tab}`);
    });
  }
  $('#btn-help').addEventListener('click', () => openModal('Regras', RULES_HTML));
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
  socket.on('chat', ({ name, text }) => $('#chat-log').prepend(el('li', '', `${name}: ${text}`)));

  // ------------------------------------------------------------- socket
  socket.on('joined', (payload) => {
    me = payload;
    localStorage.setItem(STORE, JSON.stringify(payload));
  });
  socket.on('room', async (viewData) => {
    room = viewData;
    window.__ccRoom = viewData; // util para depuracao e testes automatizados
    if (room.game) await loadWorld();
    render();
  });
  socket.on('connect', () => {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.code) send('rejoin', saved).then((res) => { if (!res.ok) localStorage.removeItem(STORE); });
  });

  // -------------------------------------------------------------- mapa
  const map = $('#map');
  let redrawPending = false;
  function applyView(redraw = true) {
    map.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    // As etiquetas e marcadores dependem do zoom, entao o mapa e redesenhado (1x por frame).
    if (!redraw || redrawPending || !game()) return;
    redrawPending = true;
    requestAnimationFrame(() => { redrawPending = false; if (game()) renderMap(game()); });
  }
  // A janela do mapa acompanha o formato da area disponivel (o celular tem um recorte
  // mais alto que o desktop), por isso a altura da viewBox vem da propria tela.
  const aspect = () => {
    const r = map.getBoundingClientRect();
    return r.width && r.height ? Math.min(1.2, Math.max(0.3, r.height / r.width)) : 0.52;
  };
  const clampView = () => {
    view.w = Math.min(1000, Math.max(120, view.w));
    view.h = view.w * aspect();
    view.x = Math.min(1000 - view.w, Math.max(0, view.x));
    view.y = view.h >= 520 ? (520 - view.h) / 2 : Math.min(520 - view.h, Math.max(0, view.y));
  };
  function zoomAt(factor, fx = 0.5, fy = 0.5) {
    const px = view.x + view.w * fx;
    const py = view.y + view.h * fy;
    view.w *= factor;
    view.h = view.w * aspect();
    view.x = px - view.w * fx;
    view.y = py - view.h * fy;
    clampView();
    applyView();
  }
  function centerOn(countryId, width = 330) {
    const c = mapById(countryId);
    if (!c) return;
    view.w = width;
    view.h = width * aspect();
    view.x = c.cx - view.w / 2;
    view.y = c.cy - view.h / 2;
    clampView();
    applyView();
  }
  const fitWorld = () => { view.w = 1000; view.x = 0; view.y = 0; clampView(); applyView(); };
  window.addEventListener('resize', () => { clampView(); applyView(); });
  $('#zoom-in').addEventListener('click', () => zoomAt(0.7));
  $('#zoom-out').addEventListener('click', () => zoomAt(1.4));
  $('#zoom-reset').addEventListener('click', fitWorld);
  $('#zoom-me').addEventListener('click', () => { const p = myPlayer(); if (p) centerOn(p.pos); });

  // Arrastar para mover o mapa e pinca/roda para o zoom. Nao usamos setPointerCapture:
  // com a captura ligada o clique passa a ser entregue ao <svg>, e os paises nunca
  // receberiam o evento de selecao.
  const pointers = new Map();
  let dragStart = null;
  let dragged = false;
  let pinchStart = null;
  map.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pointers.size === 1) dragStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: view.w };
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = map.getBoundingClientRect();
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0) {
        view.w = pinchStart.w * (pinchStart.dist / dist);
        clampView();
        applyView();
        dragged = true;
      }
      return;
    }
    if (!dragStart) return;
    if (Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y) > 8) dragged = true;
    if (!dragged) return;
    view.x = dragStart.vx - (e.clientX - dragStart.x) * (view.w / rect.width);
    view.y = dragStart.vy - (e.clientY - dragStart.y) * (view.h / rect.height);
    clampView();
    applyView();
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!pointers.size) dragStart = null;
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  map.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = map.getBoundingClientRect();
    zoomAt(e.deltaY > 0 ? 1.15 : 0.87, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  }, { passive: false });

  function onCountryClick(id) {
    if (dragged) return;
    const g = game();
    if (g && isMyTurn() && g.phase === 'move' && neighborsOf(myPlayer().pos).includes(id)) {
      selected = id;
      send('action', { type: 'move', to: id });
      return;
    }
    selected = selected === id ? null : id;
    render();
  }

  // ------------------------------------------------------------ render
  function render() {
    if (!room) return show('screen-menu');
    if (room.status === 'lobby') { renderLobby(); return show('screen-lobby'); }
    show('screen-game');
    renderGame();
  }

  function renderLobby() {
    $('#lobby-code').textContent = room.code;
    const picker = $('#class-picker');
    picker.innerHTML = '';
    const myMember = room.members.find((m) => m.id === me?.playerId);
    for (const c of room.classes) {
      const card = el('button', 'class-card' + (myMember?.cls === c.id ? ' on' : ''));
      card.append(el('b', '', c.name), el('span', 'ability', `“${c.ability}”`), el('span', 'desc', c.desc));
      card.addEventListener('click', () => send('setClass', { cls: c.id }));
      picker.append(card);
    }
    const ul = $('#lobby-players');
    ul.innerHTML = '';
    room.members.forEach((m, i) => {
      const li = el('li', m.online ? '' : 'offline');
      const dot = el('span', 'dot');
      dot.style.background = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'][i % 6];
      const cls = room.classes.find((c) => c.id === m.cls);
      li.append(dot, el('span', 'grow', m.name + (m.id === room.hostId ? ' (anfitriao)' : '')));
      li.append(el('span', 'meta', cls ? `${cls.name}\n${cls.ability}` : ''));
      ul.append(li);
    });
    const host = room.hostId === me?.playerId;
    const bots = $('#bots-box');
    bots.innerHTML = '';
    const vagas = room.maxPlayers - room.members.length;
    if (host) {
      bots.append(el('div', 'box-title', 'Bots na partida'));
      bots.append(el('div', 'hint', 'Da para jogar sozinho contra eles ou completar a mesa.'));
      const row = el('div', 'row');
      for (let n = 0; n <= vagas; n++) {
        const b = el('button', 'btn' + (room.botCount === n ? ' primary' : ''), n === 0 ? 'Sem bots' : `${n} bot${n > 1 ? 's' : ''}`);
        b.addEventListener('click', () => send('setBots', { count: n }));
        row.append(b);
      }
      bots.append(row);
    } else if (room.botCount) {
      bots.append(el('div', 'hint', `O anfitriao adicionou ${room.botCount} bot(s) a partida.`));
    }

    const total = room.members.length + room.botCount;
    $('#btn-start').disabled = !host || total < 2;
    $('#lobby-hint').textContent = host
      ? (total < 2
        ? 'Chame mais alguem ou adicione um bot para comecar.'
        : `Tudo pronto: ${room.members.length} humano(s) e ${room.botCount} bot(s).`)
      : 'Aguardando o anfitriao iniciar a partida.';
  }

  function renderGame() {
    const g = game();
    if (!g || !world) return;
    const cur = playerById(g.currentId);
    const turn = $('#turn-label');
    turn.innerHTML = '';
    const dot = el('span', 'dot');
    dot.style.background = cur?.color || '#fff';
    turn.append(dot, el('span', '', g.winner
      ? `${playerById(g.winner.id)?.name} venceu!`
      : (isMyTurn() ? 'Sua vez' : `Vez de ${cur?.name || '—'}`)));
    $('#round-label').textContent = `Rodada ${g.round}/${g.config.maxRounds}`;
    renderMap(g);
    renderStatus(g);
    renderMeBar(g);
    renderMission(g);
    renderActions(g);
    renderCountryBox(g);
    renderPlayers(g);
    renderLog(g);
    const minhaCarta = myPlayer()?.card;
    if (minhaCarta && minhaCarta.id !== renderGame._cardId) {
      renderGame._cardId = minhaCarta.id;
      openModal(`Carta de evento — ${minhaCarta.titulo}`,
        `<p>${minhaCarta.texto}</p><p class="hint">Efeito: ${minhaCarta.resumo || 'nenhum'}.</p>`);
    }
    if (g.winner && !renderGame._done) {
      renderGame._done = true;
      const w = playerById(g.winner.id);
      openModal('Fim de jogo', `<p><b>${w?.name}</b> (${w?.className}) venceu.</p><p class="hint">${g.winner.reason}.</p>`);
    }
    if (!renderGame._centered) { renderGame._centered = true; const p = myPlayer(); if (p) centerOn(p.pos, 420); }
  }

  function renderMap(g) {
    map.innerHTML = '';
    applyView(false); // sem redraw: senao o proprio desenho pediria outro desenho
    const ocean = svgEl('rect', { x: 0, y: 0, width: 1000, height: 520, class: 'ocean' });
    map.append(ocean);
    const mine = myPlayer();
    const movable = isMyTurn() && g.phase === 'move' && mine ? neighborsOf(mine.pos) : [];
    const attackTargets = g.pending?.kind === 'enemy' ? [g.pending.countryId] : [];

    const scale = view.w / 1000;
    const labels = [];
    for (const geo of world.countries) {
      const c = countryById(geo.id);
      const owner = c?.ownerId ? playerById(c.ownerId) : null;
      const path = svgEl('path', { d: geo.path, class: 'country', 'data-id': geo.id });
      const cont = g.continents?.[geo.cont];
      if (!owner && cont) {
        path.style.fill = cont.color;
        path.style.fillOpacity = '0.22';
      }
      if (owner) {
        // style inline: a regra CSS .country{fill} venceria um atributo fill.
        // A saturacao e a espessura da borda crescem com a ocupacao militar.
        const ocupacao = Math.min(1, (c.troops || 0) / 12);
        path.style.fill = owner.color;
        path.style.fillOpacity = String(0.45 + ocupacao * 0.45);
        path.style.strokeWidth = String(0.5 + ocupacao * 1.6);
        path.classList.add('owned');
      }
      if (selected === geo.id) path.classList.add('sel');
      if (movable.includes(geo.id)) path.classList.add('reach');
      if (attackTargets.includes(geo.id)) path.classList.add('target');
      path.addEventListener('click', () => onCountryClick(geo.id));
      map.append(path);

      if (c?.ownerId || selected === geo.id || view.w < 420) {
        labels.push({ geo, c, owner });
      }
    }

    // Etiquetas e marcadores por cima de todos os paises.
    for (const { geo, c, owner } of labels) {
      const grp = svgEl('g', { class: 'marker', transform: `translate(${geo.cx} ${geo.cy})` });
      if (owner && scale > 0.55) {
        // Bem afastado os selos se amontoam: um ponto da cor do dono, que cresce com as tropas.
        const r = 2.4 + Math.min(1, c.troops / 15) * 3;
        grp.append(svgEl('circle', { cx: 0, cy: 0, r, fill: owner.color, stroke: '#0b1020', 'stroke-width': 1 }));
        if (c.small + c.large) {
          grp.append(svgEl('rect', {
            x: r + 1, y: -2.4, width: 2.2 + (c.small + c.large), height: 4.8, rx: 1,
            fill: '#ffc447', stroke: '#0b1020', 'stroke-width': .6,
          }));
        }
      } else if (owner) {
        const badge = svgEl('g', { class: 'badge' });
        badge.setAttribute('transform', `scale(${Math.max(0.45, scale)})`);
        badge.append(svgEl('rect', {
          x: -13, y: -7, width: 26, height: 14, rx: 7,
          fill: '#0b1020', 'fill-opacity': .82, stroke: owner.color,
          'stroke-width': 1 + Math.min(1, c.troops / 12) * 1.5,
        }));
        const t = svgEl('text', { y: 4, 'text-anchor': 'middle', class: 'badge-text' });
        t.textContent = `⚔${c.troops}`;
        badge.append(t);
        // Industrias: um predio por industria (as grandes sao maiores e mais claras).
        const predios = [
          ...Array.from({ length: c.large }, () => ({ w: 7, h: 10, fill: '#ffd166' })),
          ...Array.from({ length: c.small }, () => ({ w: 5, h: 6, fill: '#f0a91c' })),
        ];
        const largura = predios.reduce((a, x) => a + x.w + 1.5, -1.5);
        let x = -largura / 2;
        for (const p of predios) {
          badge.append(svgEl('rect', {
            x, y: 18 - p.h, width: p.w, height: p.h, rx: 1,
            fill: p.fill, stroke: '#0b1020', 'stroke-width': .9,
          }));
          // chamine, so para o predio parecer industria mesmo
          badge.append(svgEl('rect', {
            x: x + p.w - 2.2, y: 18 - p.h - 2.4, width: 1.6, height: 2.6,
            fill: p.fill, stroke: '#0b1020', 'stroke-width': .5,
          }));
          x += p.w + 1.5;
        }
        grp.append(badge);
      }
      if (view.w < 420 || selected === geo.id) {
        const name = svgEl('text', { y: -12 * Math.max(0.45, scale), 'text-anchor': 'middle', class: 'country-name' });
        name.textContent = geo.name;
        name.setAttribute('transform', `scale(${Math.max(0.45, scale)})`);
        grp.append(name);
      }
      grp.addEventListener('click', () => onCountryClick(geo.id));
      map.append(grp);
    }

    // Pecas dos jogadores.
    const byPos = new Map();
    for (const p of g.players) {
      if (!p.alive) continue;
      const list = byPos.get(p.pos) || [];
      list.push(p);
      byPos.set(p.pos, list);
    }
    for (const [pos, list] of byPos) {
      const geo = mapById(pos);
      if (!geo) continue;
      list.forEach((p, i) => {
        const r = 5 * Math.max(0.5, scale);
        const pawn = svgEl('circle', {
          cx: geo.cx + (i - (list.length - 1) / 2) * r * 2.4,
          cy: geo.cy + 11 * Math.max(0.45, scale),
          r,
          fill: p.color,
          class: 'pawn' + (p.id === g.currentId ? ' active' : ''),
        });
        map.append(pawn);
      });
    }
  }

  function renderStatus(g) {
    const box = $('#map-status');
    const linhas = [];
    if (g.combat) {
      const from = countryById(g.combat.from);
      const to = countryById(g.combat.to);
      const ataque = g.combat.bonus
        ? `${g.combat.attDie}+${g.combat.bonus}=${g.combat.attTotal}`
        : `${g.combat.attDie}`;
      linhas.push(`⚔ ${from.name} → ${to.name}: ${ataque} x ${g.combat.defDie} • ` +
        (g.combat.captured ? `conquistado (${g.combat.moved} tropas marcharam)` : 'defesa segurou, -1 tropa'));
    }
    if (g.phase === 'move' && isMyTurn()) {
      linhas.push(`Passos restantes: ${g.moves} — toque num pais vizinho destacado`);
    } else if (g.dice && g.phase !== 'roll' && !linhas.length) {
      linhas.push(`Dado: ${g.dice[0]}`);
    }
    box.textContent = linhas.join('\n');
    box.hidden = !linhas.length;
  }

  function renderMeBar(g) {
    const p = myPlayer();
    const bar = $('#me-bar');
    bar.innerHTML = '';
    if (!p) return;
    const chips = [
      ['Caixa', gold(p.gold)],
      ['Renda liquida', `+${p.income}/rodada`],
      ['Manutencao', `-${p.upkeep}/rodada`],
      ['Paises', `${p.lands}`],
      ['Tropas', `${p.reserve} na reserva`],
      ['Patrimonio', gold(p.worth)],
      ['Imposto', `${Math.round(p.taxRate * 100)}% na proxima cobranca`],
    ];
    if (p.attackBonus) chips.push(['Dado de invasao', `+${p.attackBonus}`]);
    if (p.loan) chips.push(['Divida', `${gold(p.loan.debt)} (parcela ${p.loan.parcela}${p.loan.autoPay ? '' : ' — em calote'})`]);
    if (p.taxFree) chips.push(['Isencao', 'proximo imposto']);
    for (const [k, v] of chips) {
      const chip = el('span', 'chip');
      chip.innerHTML = `${k}: <b>${v}</b>`;
      bar.append(chip);
    }
    const cls = el('span', 'chip cls');
    cls.innerHTML = `${p.className}: <b>${p.ability}</b>`;
    bar.append(cls);
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
    if (g.winner) return box.append(el('div', 'box-title', 'Partida encerrada'));
    if (!p.alive) return box.append(el('div', 'box-title', 'Voce quebrou — assista ao desfecho.'));
    if (!isMyTurn()) {
      box.append(el('div', 'box-title', `Aguardando ${playerById(g.currentId)?.name}...`));
      const ehBot = room.botIds?.includes(g.currentId);
      const offline = !ehBot && !room.members.find((m) => m.id === g.currentId)?.online;
      if (offline && room.hostId === me.playerId) {
        box.append(actionBtn('Jogador ausente: remover da partida', () => send('skipOffline'), 'danger'));
      }
      return;
    }

    if (g.phase === 'roll') {
      box.append(actionBtn('🎲 Rolar o dado', () => send('action', { type: 'roll' }), 'primary big'));
    } else if (g.phase === 'move') {
      box.append(el('div', 'box-title', `Movimento: ${g.moves} passo(s)`));
      box.append(el('div', 'hint', 'Toque num pais vizinho destacado no mapa para avancar.'));
      const row = el('div', 'row');
      for (const id of neighborsOf(p.pos).slice(0, 8)) {
        const c = countryById(id);
        row.append(actionBtn(c.name, () => send('action', { type: 'move', to: id })));
      }
      box.append(row);
      box.append(actionBtn('Parar aqui', () => send('action', { type: 'stop' }), 'primary'));
    }

    const pend = g.pending;
    if (pend?.kind === 'buy') {
      const c = countryById(pend.countryId);
      box.append(el('div', 'box-title', `${c.name} esta sem dono`));
      box.append(el('div', 'hint', `${c.rank}o no ranking mundial • rende ${c.income}/rodada`));
      const row = el('div', 'row');
      const buy = actionBtn(`Comprar por ${gold(c.price)}`, () => send('action', { type: 'buy' }), 'primary');
      buy.disabled = p.gold < c.price;
      row.append(buy, actionBtn('Deixar passar', () => send('action', { type: 'skip' })));
      box.append(row);
    } else if (pend?.kind === 'own') {
      const c = countryById(pend.countryId);
      box.append(el('div', 'box-title', `${c.name} — seu territorio`));
      box.append(buildRow(g, p, c));
      box.append(actionBtn('Ok', () => send('action', { type: 'skip' })));
    } else if (pend?.kind === 'enemy') {
      const c = countryById(pend.countryId);
      const owner = playerById(c.ownerId);
      box.append(el('div', 'box-title', `Desembarque em ${c.name} (${owner?.name})`));
      box.append(el('div', 'hint',
        `Defesa: ${c.troops} tropa(s), ${c.small + c.large} industria(s). Tributo: ${gold(pend.tribute)}.`));
      const origins = attackOrigins(g, c.id);
      if (origins.length) {
        const row = el('div', 'row');
        for (const o of origins) {
          row.append(actionBtn(`⚔ Atacar de ${o.name} (${o.troops})`,
            () => send('action', { type: 'attack', from: o.id }), 'danger'));
        }
        box.append(row);
      } else {
        box.append(el('div', 'hint', 'Voce nao tem fronteira com 2+ tropas aqui: so resta pagar.'));
      }
      const pay = actionBtn(`Pagar tributo ${gold(pend.tribute)}`, () => send('action', { type: 'tribute' }), 'primary');
      box.append(pay);
    }

    if (g.phase !== 'roll') {
      box.append(el('div', 'box-title', 'Banco'));
      const row = el('div', 'row');
      if (p.loan) {
        const l = p.loan;
        box.append(el('div', 'hint',
          `Divida ${gold(l.debt)} • parcela ${gold(l.parcela)}/rodada • ${l.pagas} paga(s), ${l.atrasos} atrasada(s). ` +
          `Depois de ${g.config.loanSeizeAfter} rodadas com divida aberta o banco apreende industrias.`));
        row.append(actionBtn(`Quitar tudo (${gold(l.debt)})`, () => send('action', { type: 'repay' })));
        row.append(actionBtn(`Pagar parcela (${gold(l.parcela)})`,
          () => send('action', { type: 'repay', amount: l.parcela })));
        row.append(actionBtn(l.autoPay ? 'Dar o calote (juros +2%/rodada)' : 'Voltar a pagar as parcelas',
          () => send('action', { type: 'loanAutoPay', on: !l.autoPay }), l.autoPay ? 'danger' : ''));
      } else {
        const canLoan = g.round >= g.config.loanFromRound;
        const b = actionBtn(`Pegar emprestimo (ate ${g.config.loanMax})`, () => askLoan(g));
        b.disabled = !canLoan;
        row.append(b);
        if (!canLoan) box.append(el('div', 'hint', `Emprestimos liberam na rodada ${g.config.loanFromRound}.`));
      }
      const recruit = actionBtn(`Recrutar tropa (${g.config.recruitCost})`, () => send('action', { type: 'recruit', count: 1 }));
      recruit.disabled = p.gold < g.config.recruitCost;
      row.append(recruit);
      box.append(row);
      box.append(actionBtn('Encerrar turno ▶', () => send('action', { type: 'endTurn' }), 'primary big'));
      box.append(actionBtn('Desistir da partida', () => {
        if (confirm('Desistir? Seus paises ficam neutros.')) send('surrender');
      }, 'ghost tiny'));
    }
  }

  function askLoan(g) {
    const raw = prompt(
      `Quanto quer pegar emprestado? Ate ${g.config.loanMax}, com ${g.config.loanInterest * 100}% de juros, ` +
      `pago em ${g.config.loanInstallments} parcelas (uma por rodada).`,
      String(g.config.loanMax));
    if (raw == null) return;
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) return toast('Valor invalido.');
    send('action', { type: 'loan', amount });
  }

  function buildRow(g, p, c) {
    const wrap = el('div', 'action-box');
    const total = c.small + c.large;
    const teto = g.config.maxFactoriesPerCountry;
    wrap.append(el('div', 'hint', `Industrias: ${total}/${teto} (ate ${g.config.factories.large.max} grandes)`));
    const row = el('div', 'row');
    for (const size of ['small', 'large']) {
      const spec = g.config.factories[size];
      const b = actionBtn(`${spec.label} (${spec.cost}) +${spec.income}/rodada`,
        () => send('action', { type: 'build', countryId: c.id, size }), 'primary');
      b.disabled = p.gold < spec.cost || c[size] >= spec.max || total >= teto;
      row.append(b);
    }
    wrap.append(row);
    return wrap;
  }

  function attackOrigins(g, targetId) {
    return neighborsOf(targetId)
      .map((id) => countryById(id))
      .filter((c) => c && c.ownerId === me.playerId && c.troops >= 2);
  }

  function renderCountryBox(g) {
    const box = $('#tile-box');
    box.innerHTML = '';
    if (!selected) return;
    const c = countryById(selected);
    const geo = mapById(selected);
    if (!c || !geo) return;
    const owner = c.ownerId ? playerById(c.ownerId) : null;
    box.append(el('div', 'box-title', c.name));
    box.append(el('div', 'hint',
      `${g.continents?.[c.cont]?.name || ''} • ${c.rank}o no ranking • ${c.income}/rodada • ` +
      `preco ${gold(c.price)} • fronteiras: ${geo.neighbors.length}`));
    box.append(el('div', 'hint', owner
      ? `Dono: ${owner.name} • ${c.troops} tropa(s) • industrias ${c.small + c.large}/${g.config.maxFactoriesPerCountry} ` +
        `(${c.small} pequena(s), ${c.large} grande(s)) • tributo ${gold(c.tribute)}`
      : 'Sem dono.'));

    const p = myPlayer();
    if (!p?.alive || !isMyTurn() || g.phase === 'roll') return;
    if (c.ownerId && c.ownerId !== me.playerId) {
      const origins = attackOrigins(g, c.id);
      if (origins.length) {
        box.append(el('div', 'box-title', 'Guerra'));
        const row = el('div', 'row');
        for (const o of origins) {
          row.append(actionBtn(`⚔ Atacar de ${o.name} (${o.troops})`,
            () => send('action', { type: 'attack', from: o.id, to: c.id }), 'danger'));
        }
        box.append(row);
      } else {
        box.append(el('div', 'hint', 'Para atacar, voce precisa de um pais vizinho com 2+ tropas.'));
      }
    }
    if (c.ownerId === me.playerId) {
      if (p.reserve > 0) {
        const row = el('div', 'row');
        for (const n of [1, 3, 5]) {
          if (p.reserve < n) continue;
          row.append(actionBtn(`+${n} tropa${n > 1 ? 's' : ''}`,
            () => send('action', { type: 'deploy', countryId: c.id, count: n })));
        }
        if (p.reserve > 5) {
          row.append(actionBtn(`+${p.reserve} (tudo)`,
            () => send('action', { type: 'deploy', countryId: c.id, count: p.reserve })));
        }
        box.append(row);
      }
      box.append(buildRow(g, p, c));
    }
  }

  function renderMission(g) {
    const box = $('#mission-box');
    box.innerHTML = '';
    const p = myPlayer();
    if (!p?.mission) {
      box.append(el('div', 'hint', 'Sua missao aparece aqui quando a partida comeca.'));
      return;
    }
    const card = el('div', 'card mission');
    card.append(el('div', 'box-title', 'Missao secreta'));
    card.append(el('h3', '', p.mission.titulo));
    card.append(el('p', '', p.mission.texto));
    card.append(el('div', 'box-title', 'Ou conquiste estes dois continentes'));
    const row = el('div', 'row');
    for (const key of p.mission.continentes) {
      const cont = g.continents[key];
      const total = g.countries.filter((c) => c.cont === key).length;
      const meus = g.countries.filter((c) => c.cont === key && c.ownerId === p.id).length;
      const chip = el('span', 'chip');
      chip.style.borderColor = cont.color;
      chip.innerHTML = `${cont.name}: <b>${meus}/${total}</b> (+${cont.bonus} tropas)`;
      row.append(chip);
    }
    card.append(row);
    card.append(el('div', 'hint',
      `Reforcos por turno: ${p.reinforcements.total} (${p.reinforcements.base} por paises + ${p.reinforcements.bonus} de continente). ` +
      `Conquistas na guerra: ${p.conquistas}. Adversarios eliminados: ${p.eliminados}.`));
    box.append(card);

    if (p.card) {
      const evento = el('div', 'card');
      evento.append(el('div', 'box-title', `Ultima carta de evento (${p.card.tipo === 'buff' ? 'a favor' : 'contra'})`));
      evento.append(el('b', '', p.card.titulo));
      evento.append(el('p', '', p.card.texto));
      evento.append(el('div', 'hint', `Efeito: ${p.card.resumo || 'nenhum'}`));
      box.append(evento);
    }

    const info = el('div', 'card');
    info.append(el('div', 'box-title', 'Continentes'));
    for (const [key, cont] of Object.entries(g.continents)) {
      const total = g.countries.filter((c) => c.cont === key).length;
      const donos = new Map();
      for (const c of g.countries.filter((x) => x.cont === key && x.ownerId)) {
        donos.set(c.ownerId, (donos.get(c.ownerId) || 0) + 1);
      }
      const linha = el('div', 'hint');
      const dono = [...donos.entries()].sort((a, b) => b[1] - a[1])[0];
      const nomeDono = dono ? `${playerById(dono[0])?.name} lidera com ${dono[1]}` : 'ninguem por la';
      linha.innerHTML = `<b style="color:${cont.color}">${cont.name}</b> — ${total} paises, +${cont.bonus} tropas • ${nomeDono}`;
      info.append(linha);
    }
    box.append(info);
  }

  function renderPlayers(g) {
    const ul = $('#game-players');
    ul.innerHTML = '';
    for (const p of g.players) {
      const member = room.members.find((m) => m.id === p.id);
      const ehBot = room.botIds?.includes(p.id);
      const li = el('li', [p.alive ? '' : 'dead', (member?.online || ehBot) ? '' : 'offline'].join(' ').trim());
      const dot = el('span', 'dot');
      dot.style.background = p.color;
      li.append(dot, el('span', 'grow',
        `${p.name}${ehBot ? ' 🤖' : ''}${p.id === g.currentId ? ' ⏳' : ''}${p.id === me?.playerId ? ' (voce)' : ''}` +
        `\n${p.className} — “${p.ability}”`));
      const meta = el('span', 'meta');
      meta.innerHTML = `${gold(p.gold)}<br>${p.lands} paises • +${p.income}/rodada` +
        `<br>${p.conquistas} conquista(s)${p.loan ? ` • divida ${p.loan.debt}` : ''}`;
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
