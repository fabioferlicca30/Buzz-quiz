(() => {
  const socket = io();

  // ---- Stato locale --------------------------------------------------
  let myId = null;
  let myNickname = '';
  let currentRoomCode = null;
  let isHost = false;
  let createSettings = { visibility: 'private', mode: 'rush', difficulty: 'misto' };
  let newQuestionState = { difficulty: 'facile', correct: 0 };
  let playersById = new Map(); // id -> nickname (aggiornata da lobby/scoreboard)
  let currentEligibleIds = null;
  let currentCorrectIndex = null;
  let answered = false;
  let timerInterval = null;
  let hostBubbleTimeout = null;
  let bracketRounds = [];

  // ---- Helpers UI ------------------------------------------------------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '';
  }

  function showHostLine(text) {
    const bubble = document.getElementById('host-bubble');
    const textEl = document.getElementById('host-text');
    textEl.textContent = text;
    bubble.classList.remove('hidden');
    clearTimeout(hostBubbleTimeout);
    hostBubbleTimeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
  }

  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position = 'fixed';
      el.style.bottom = '20px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.background = '#262852';
      el.style.color = '#fff';
      el.style.padding = '10px 18px';
      el.style.borderRadius = '10px';
      el.style.zIndex = '200';
      el.style.fontSize = '0.85rem';
      el.style.maxWidth = '90%';
      el.style.textAlign = 'center';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._hideTimeout);
    el._hideTimeout = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function requireNickname() {
    const val = document.getElementById('input-nickname').value.trim();
    if (!val) {
      setError('home-error', 'Inserisci prima il tuo nome');
      showScreen('screen-home');
      return null;
    }
    myNickname = val;
    return val;
  }

  // ---- Caricamento categorie -------------------------------------------
  function loadCategories() {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        const select = document.getElementById('select-category');
        const datalist = document.getElementById('nq-category-list');
        select.innerHTML = '<option value="tutte">Tutte</option>';
        datalist.innerHTML = '';
        data.categories.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          select.appendChild(opt);
          const dopt = document.createElement('option');
          dopt.value = c;
          datalist.appendChild(dopt);
        });
      })
      .catch(() => {});
  }

  // ---- Segmented controls generiche ------------------------------------
  function wireSegmented(containerId, onChange) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.value);
      });
    });
  }

  wireSegmented('opt-visibility', (v) => (createSettings.visibility = v));
  wireSegmented('opt-mode', (v) => (createSettings.mode = v));
  wireSegmented('opt-difficulty', (v) => (createSettings.difficulty = v));
  wireSegmented('nq-difficulty', (v) => (newQuestionState.difficulty = v));
  wireSegmented('nq-correct', (v) => (newQuestionState.correct = parseInt(v, 10)));

  // ---- Navigazione -------------------------------------------------------
  document.getElementById('btn-goto-create').addEventListener('click', () => {
    if (!requireNickname()) return;
    setError('create-error', '');
    showScreen('screen-create');
  });
  document.getElementById('btn-create-back').addEventListener('click', () => showScreen('screen-home'));

  document.getElementById('btn-goto-public').addEventListener('click', () => {
    if (!requireNickname()) return;
    showScreen('screen-public');
    refreshPublicList();
  });
  document.getElementById('btn-public-back').addEventListener('click', () => showScreen('screen-home'));

  document.getElementById('btn-goto-join').addEventListener('click', () => {
    if (!requireNickname()) return;
    setError('join-error', '');
    showScreen('screen-join');
  });
  document.getElementById('btn-join-back').addEventListener('click', () => showScreen('screen-home'));

  document.getElementById('btn-goto-newquestion').addEventListener('click', () => {
    setError('nq-error', '');
    document.getElementById('nq-success').textContent = '';
    showScreen('screen-newquestion');
  });
  document.getElementById('btn-nq-back').addEventListener('click', () => showScreen('screen-home'));

  document.getElementById('btn-play-again').addEventListener('click', () => location.reload());

  // ---- Creazione partita ---------------------------------------------
  document.getElementById('btn-create-confirm').addEventListener('click', () => {
    const category = document.getElementById('select-category').value;
    socket.emit(
      'lobby:create',
      { nickname: myNickname, visibility: createSettings.visibility, mode: createSettings.mode, difficulty: createSettings.difficulty, category },
      (res) => {
        if (res.error) return setError('create-error', res.error);
        currentRoomCode = res.code;
        isHost = true;
        renderLobby(res.summary);
        showScreen('screen-lobby');
      }
    );
  });

  // ---- Unione con codice ------------------------------------------------
  document.getElementById('btn-join-confirm').addEventListener('click', () => {
    const code = document.getElementById('input-code').value.trim().toUpperCase();
    if (!code) return setError('join-error', 'Inserisci un codice valido');
    socket.emit('lobby:join', { code, nickname: myNickname }, (res) => {
      if (res.error) return setError('join-error', res.error);
      currentRoomCode = res.code;
      isHost = false;
      renderLobby(res.summary);
      showScreen('screen-lobby');
    });
  });

  // ---- Partite pubbliche --------------------------------------------
  function refreshPublicList() {
    socket.emit('lobby:list', (res) => renderPublicList(res.lobbies || []));
  }

  function renderPublicList(lobbies) {
    const el = document.getElementById('public-list');
    if (!lobbies.length) {
      el.innerHTML = '<p class="muted">Nessuna partita pubblica al momento. Creane una tu!</p>';
      return;
    }
    el.innerHTML = '';
    lobbies.forEach((l) => {
      const div = document.createElement('div');
      div.className = 'lobby-item';
      div.innerHTML = `<div><strong>${l.players} giocatori</strong><br/><span class="muted">${l.mode === 'rush' ? 'Rush' : 'Classica'} · ${l.difficulty} · ${l.category}</span></div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Unisciti';
      btn.addEventListener('click', () => {
        socket.emit('lobby:join', { code: l.code, nickname: myNickname }, (res) => {
          if (res.error) return toast(res.error);
          currentRoomCode = res.code;
          isHost = false;
          renderLobby(res.summary);
          showScreen('screen-lobby');
        });
      });
      div.appendChild(btn);
      el.appendChild(div);
    });
  }

  socket.on('lobby:publicList', (lobbies) => {
    if (document.getElementById('screen-public').classList.contains('active')) {
      renderPublicList(lobbies);
    }
  });

  // ---- Creazione domanda ------------------------------------------------
  document.getElementById('btn-nq-submit').addEventListener('click', () => {
    const category = document.getElementById('nq-category').value.trim();
    const text = document.getElementById('nq-text').value.trim();
    const answers = [0, 1, 2, 3].map((i) => document.getElementById('nq-a' + i).value.trim());
    if (!category || !text || answers.some((a) => !a)) {
      return setError('nq-error', 'Compila tutti i campi');
    }
    fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, difficulty: newQuestionState.difficulty, text, answers, correctIndex: newQuestionState.correct }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return setError('nq-error', data.error || 'Errore');
        setError('nq-error', '');
        document.getElementById('nq-success').textContent = 'Domanda salvata, grazie!';
        document.getElementById('nq-text').value = '';
        [0, 1, 2, 3].forEach((i) => (document.getElementById('nq-a' + i).value = ''));
        loadCategories();
      })
      .catch(() => setError('nq-error', 'Errore di connessione'));
  });

  // ---- Lobby --------------------------------------------------------
  function renderLobby(summary) {
    const codeWrap = document.getElementById('lobby-code-wrap');
    if (summary.visibility === 'private') {
      codeWrap.classList.remove('hidden');
      document.getElementById('lobby-code').textContent = summary.code;
    } else {
      codeWrap.classList.add('hidden');
    }
    const modeLabel = summary.mode === 'rush' ? 'Rush (velocità)' : 'Classica (10s, punti fissi)';
    document.getElementById('lobby-settings').textContent =
      `${summary.visibility === 'public' ? 'Partita aperta' : 'Partita chiusa'} · ${modeLabel} · Livello: ${summary.difficulty} · Categoria: ${summary.category}`;

    const list = document.getElementById('lobby-players');
    list.innerHTML = '';
    summary.players.forEach((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.nickname}${p.connected ? '' : ' (disconnesso)'}</span>${p.isHost ? '<span class="host-tag">HOST</span>' : ''}`;
      list.appendChild(li);
    });

    const startBtn = document.getElementById('btn-start-game');
    const waitMsg = document.getElementById('lobby-wait-msg');
    if (isHost) {
      startBtn.classList.remove('hidden');
      waitMsg.classList.add('hidden');
    } else {
      startBtn.classList.add('hidden');
      waitMsg.classList.remove('hidden');
    }
  }

  socket.on('lobby:update', (summary) => {
    if (summary.code !== currentRoomCode) return;
    renderLobby(summary);
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    socket.emit('lobby:start', (res) => {
      if (res.error) setError('lobby-error', res.error);
      else setError('lobby-error', '');
    });
  });

  // ---- Presentatore -------------------------------------------------
  socket.on('host:say', (data) => showHostLine(data.text));

  // ---- Domande / gameplay --------------------------------------------
  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function startTimer(durationMs) {
    stopTimer();
    const endTs = Date.now() + durationMs;
    const fill = document.getElementById('timer-fill');
    fill.style.width = '100%';
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, endTs - Date.now());
      const pct = (remaining / durationMs) * 100;
      fill.style.width = pct + '%';
      if (remaining <= 0) stopTimer();
    }, 100);
  }

  socket.on('game:question', (q) => {
    showScreen('screen-game');
    answered = false;
    currentEligibleIds = q.eligibleIds;
    currentCorrectIndex = null;

    document.getElementById('game-phase-label').textContent = q.phase === 'tournament' ? 'Torneo' : 'Fase 1';
    document.getElementById('game-progress').textContent = `Domanda ${q.index + 1}/${q.total}`;
    document.getElementById('game-category').textContent = `${q.category} · ${q.difficulty}`;
    document.getElementById('question-text').textContent = q.text;

    const banner = document.getElementById('tournament-match-banner');
    const spectatorBanner = document.getElementById('spectator-banner');
    const iAmEligible = !currentEligibleIds || currentEligibleIds.includes(myId);

    if (q.match) {
      banner.classList.remove('hidden');
      banner.textContent = `${q.match.a} 🆚 ${q.match.b}`;
    } else {
      banner.classList.add('hidden');
    }

    if (!iAmEligible) {
      spectatorBanner.classList.remove('hidden');
    } else {
      spectatorBanner.classList.add('hidden');
    }

    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, i) => {
      btn.textContent = q.answers[i];
      btn.classList.remove('correct', 'wrong-pick', 'selected');
      btn.disabled = !iAmEligible;
    });

    startTimer(q.timeLimitMs);
  });

  document.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (answered) return;
      const iAmEligible = !currentEligibleIds || currentEligibleIds.includes(myId);
      if (!iAmEligible) return;
      answered = true;
      const idx = parseInt(btn.dataset.idx, 10);
      socket.emit('game:answer', { answerIndex: idx });
      document.querySelectorAll('.answer-btn').forEach((b) => (b.disabled = true));
      btn.classList.add('selected');
    });
  });

  function renderMiniScoreboard(scoreboard) {
    scoreboard.forEach((p) => playersById.set(p.id, p.nickname));
    const el = document.getElementById('mini-scoreboard');
    el.innerHTML = '';
    scoreboard.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'row' + (p.id === myId ? ' me' : '');
      row.innerHTML = `<span>${i + 1}. ${p.nickname}${p.eliminated ? ' ❌' : ''}</span><span>${p.score} pt</span>`;
      el.appendChild(row);
    });
  }

  socket.on('game:questionResult', (data) => {
    stopTimer();
    currentCorrectIndex = data.correctIndex;
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, i) => {
      if (i === data.correctIndex) btn.classList.add('correct');
    });
    const mine = data.results.find((r) => r.id === myId);
    if (mine && mine.answerIndex !== null && mine.answerIndex !== data.correctIndex) {
      buttons[mine.answerIndex].classList.add('wrong-pick');
    }
    if (data.scoreboard) renderMiniScoreboard(data.scoreboard);
  });

  // ---- Fine fase 1 -----------------------------------------------------
  socket.on('phase1:end', (data) => {
    showScreen('screen-phase1end');
    const list = document.getElementById('phase1-standings');
    list.innerHTML = '';
    data.standings.forEach((p) => {
      playersById.set(p.id, p.nickname);
      const li = document.createElement('li');
      const qualified = data.qualifiers.includes(p.id);
      li.innerHTML = `${p.nickname} — ${p.score} pt ${qualified ? '✅ al torneo' : '❌ eliminato'}`;
      list.appendChild(li);
    });
  });

  // ---- Torneo ---------------------------------------------------------
  socket.on('tournament:start', () => {
    bracketRounds = [];
  });

  socket.on('tournament:round', (data) => {
    bracketRounds.push({ round: data.round, difficulty: data.difficulty, pairs: data.pairs, results: [] });
    renderBracket();
    showScreen('screen-tournament');
  });

  socket.on('tournament:matchResult', (data) => {
    const last = bracketRounds[bracketRounds.length - 1];
    if (last) last.results.push(data);
    renderBracket();
  });

  function renderBracket() {
    const el = document.getElementById('bracket-view');
    el.innerHTML = '';
    bracketRounds.forEach((r) => {
      const roundDiv = document.createElement('div');
      roundDiv.className = 'round';
      roundDiv.innerHTML = `<h3>Turno ${r.round} — livello ${r.difficulty}</h3>`;
      r.pairs.forEach((pair, i) => {
        const pairDiv = document.createElement('div');
        pairDiv.className = 'pair';
        const a = pair.a || 'BYE';
        const b = pair.b || 'BYE';
        pairDiv.innerHTML = `<span>${a}</span><span>vs</span><span>${b}</span>`;
        roundDiv.appendChild(pairDiv);
      });
      el.appendChild(roundDiv);
    });
  }

  // ---- Finale -----------------------------------------------------------
  socket.on('game:final', (data) => {
    showScreen('screen-final');
    document.getElementById('final-winner').textContent = data.championName ? `${data.championName} 🎉` : 'Nessun vincitore';
    const list = document.getElementById('final-standings');
    list.innerHTML = '';
    data.standings.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = `${p.nickname} — ${p.score} pt`;
      list.appendChild(li);
    });
  });

  socket.on('error', (data) => toast(data.message || 'Errore'));

  socket.on('connect', () => {
    myId = socket.id;
  });

  loadCategories();
})();
