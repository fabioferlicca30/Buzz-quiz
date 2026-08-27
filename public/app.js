(() => {

  const socket = io();

  let myId = null;
  let myNickname = '';
  let currentRoomCode = null;
  let isHost = false;

  let createSettings = {
    visibility: 'private',
    mode: 'rush',
    difficulty: 'misto',
    category: 'tutte'
  };

  let newQuestionState = {
    difficulty: 'facile',
    correct: 0
  };

  let answered = false;
  let timerInterval = null;
  let hostBubbleTimeout = null;
  let currentEligibleIds = null;
  let sessionGames = 0;

  const $ = id => document.getElementById(id);

  function showScreen(id) {
    document
      .querySelectorAll('.screen')
      .forEach(s => s.classList.remove('active'));

    $(id).classList.add('active');
  }

  function error(id, msg) {
    $(id).textContent = msg || '';
  }

  function showHostLine(text) {

    $('host-text').textContent = text;

    $('host-bubble').classList.remove('hidden');

    clearTimeout(hostBubbleTimeout);

    hostBubbleTimeout = setTimeout(() => {
      $('host-bubble').classList.add('hidden');
    }, 5200);
  }

  function toast(msg) {

    let el = $('toast');

    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }

    Object.assign(el.style, {
      position: 'fixed',
      bottom: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: '#242952',
      padding: '12px 18px',
      borderRadius: '12px',
      border: '1px solid #4b548d'
    });

    el.textContent = msg;
  }

  function setupSegmented(id, setter) {

    document
      .querySelectorAll(`#${id} .seg-btn`)
      .forEach(btn => {

        btn.addEventListener('click', () => {

          document
            .querySelectorAll(`#${id} .seg-btn`)
            .forEach(b => b.classList.remove('active'));

          btn.classList.add('active');

          setter(btn.dataset.value);
        });

      });
  }

  $('btn-goto-create').onclick = () => {

    if (!myNickname)
      myNickname = $('input-nickname').value.trim();

    if (!myNickname)
      return error('home-error', 'Inserisci un nome');

    error('home-error', '');

    showScreen('screen-create');
  };

  $('btn-goto-public').onclick = () => {

    if (!myNickname)
      myNickname = $('input-nickname').value.trim();

    if (!myNickname)
      return error('home-error', 'Inserisci un nome');

    showScreen('screen-public');

    socket.emit('lobby:list', res => {
      renderPublic(res.lobbies);
    });
  };

  $('btn-goto-join').onclick = () => {

    if (!myNickname)
      myNickname = $('input-nickname').value.trim();

    if (!myNickname)
      return error('home-error', 'Inserisci un nome');

    showScreen('screen-join');
  };

  $('btn-goto-newquestion').onclick = () => {
    showScreen('screen-newquestion');
  };

  $('btn-create-back').onclick = () => showScreen('screen-home');
  $('btn-public-back').onclick = () => showScreen('screen-home');
  $('btn-join-back').onclick = () => showScreen('screen-home');
  $('btn-nq-back').onclick = () => showScreen('screen-home');
  $('btn-home-final').onclick = () => showScreen('screen-home');

  setupSegmented(
    'opt-visibility',
    v => createSettings.visibility = v
  );

  setupSegmented(
    'opt-mode',
    v => createSettings.mode = v
  );

  setupSegmented(
    'opt-difficulty',
    v => createSettings.difficulty = v
  );

  setupSegmented(
    'nq-difficulty',
    v => newQuestionState.difficulty = v
  );

  setupSegmented(
    'nq-correct',
    v => newQuestionState.correct = Number(v)
  );

  $('select-category').onchange = e => {
    createSettings.category = e.target.value;
  };

  $('btn-create-confirm').onclick = () => {

    myNickname =
      $('input-nickname').value.trim() ||
      myNickname;

    if (!myNickname)
      return error('create-error', 'Inserisci un nome');

    socket.emit(
      'lobby:create',
      {
        ...createSettings,
        nickname: myNickname
      },
      res => {

        if (res.error)
          return error('create-error', res.error);

        currentRoomCode = res.code;
        isHost = true;

        renderLobby(res.summary);
        showScreen('screen-lobby');
      }
    );
  };

  $('btn-join-confirm').onclick = () => {

    const code =
      $('input-code')
        .value
        .trim()
        .toUpperCase();

    if (code.length !== 5)
      return error(
        'join-error',
        'Il codice deve avere 5 caratteri'
      );

    socket.emit(
      'lobby:join',
      {
        code,
        nickname: myNickname
      },
      res => {

        if (res.error)
          return error('join-error', res.error);

        currentRoomCode = res.code;
        isHost = false;

        renderLobby(res.summary);
        showScreen('screen-lobby');
      }
    );
  };

  $('btn-nq-submit').onclick = () => {

    const category =
      $('nq-category').value.trim();

    const text =
      $('nq-text').value.trim();

    const answers =
      [0, 1, 2, 3]
        .map(i => $('nq-a' + i).value.trim());

    if (
      !category ||
      !text ||
      answers.some(a => !a)
    ) {
      return error(
        'nq-error',
        'Compila tutti i campi'
      );
    }

    fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category,
        difficulty: newQuestionState.difficulty,
        text,
        answers,
        correctIndex: newQuestionState.correct
      })
    })
      .then(r =>
        r.json().then(data => ({
          ok: r.ok,
          data
        }))
      )
      .then(({ ok, data }) => {

        if (!ok)
          return error(
            'nq-error',
            data.error || 'Errore'
          );

        error('nq-error', '');

        $('nq-success').textContent =
          'Domanda salvata!';

        [
          'nq-text',
          'nq-a0',
          'nq-a1',
          'nq-a2',
          'nq-a3'
        ].forEach(id => {
          $(id).value = '';
        });

        loadCategories();
      })
      .catch(() => {
        error(
          'nq-error',
          'Errore di connessione'
        );
      });
  };

  function renderLobby(s) {

    $('lobby-code-wrap')
      .classList
      .toggle(
        'hidden',
        s.visibility !== 'private'
      );

    $('lobby-code').textContent = s.code;

    $('lobby-settings').textContent =
      `${s.mode === 'rush' ? 'Rush' : 'Classica'} · ` +
      `${s.difficulty} · ${s.category} · ` +
      `Partite sessione: ${s.sessionGames || 0}`;

    $('lobby-players').innerHTML =
      s.players
        .map(p => `
          <li>
            <span>
              ${p.nickname}
              ${p.connected ? '' : ' (disconnesso)'}
            </span>

            ${p.isHost
              ? '<span class="host-tag">HOST</span>'
              : ''}
          </li>
        `)
        .join('');

    $('btn-start-game')
      .classList
      .toggle('hidden', !isHost);

    $('lobby-wait-msg')
      .classList
      .toggle('hidden', isHost);
  }

  $('btn-start-game').onclick = () => {

    socket.emit(
      'lobby:start',
      res => {
        if (res.error)
          error('lobby-error', res.error);
      }
    );
  };

  function renderPublic(lobbies) {

    $('public-list').innerHTML =
      lobbies.length
        ? lobbies.map(l => `
          <div class="lobby-item">

            <span>
              <strong>${l.code}</strong><br>
              <span class="muted">
                ${l.players} giocatori ·
                ${l.mode} ·
                ${l.category}
              </span>
            </span>

            <button
              onclick="window.joinPublic('${l.code}')">
              Unisciti
            </button>

          </div>
        `).join('')
        : '<p class="muted">Nessuna partita aperta.</p>';
  }

  window.joinPublic = code => {

    socket.emit(
      'lobby:join',
      {
        code,
        nickname: myNickname
      },
      res => {

        if (res.error)
          return toast(res.error);

        currentRoomCode = res.code;
        isHost = false;

        renderLobby(res.summary);
        showScreen('screen-lobby');
      }
    );
  };

  socket.on(
    'lobby:publicList',
    renderPublic
  );

  socket.on(
    'lobby:update',
    s => {

      if (s.code === currentRoomCode)
        renderLobby(s);
    }
  );

  socket.on(
    'host:say',
    d => showHostLine(d.text)
  );

  function stopTimer() {

    if (timerInterval)
      clearInterval(timerInterval);

    timerInterval = null;
  }

  function startTimer(ms) {

    stopTimer();

    const end =
      Date.now() + ms;

    const fill =
      $('timer-fill');

    timerInterval =
      setInterval(() => {

        const rem =
          Math.max(
            0,
            end - Date.now()
          );

        fill.style.width =
          (rem / ms * 100) + '%';

        if (!rem)
          stopTimer();

      }, 80);
  }

  function renderMini(scoreboard) {

    $('mini-scoreboard').innerHTML =
      scoreboard
        .map((p, i) => `
          <div
            class="row ${p.id === myId ? 'me' : ''}">
            <span>
              ${i + 1}.
              ${p.nickname}
              ${p.eliminated ? ' ❌' : ''}
            </span>

            <span>
              ${p.score} pt
            </span>
          </div>
        `)
        .join('');
  }

  socket.on(
    'game:question',
    q => {

      showScreen('screen-game');

      answered = false;
      currentEligibleIds = q.eligibleIds;

      $('game-phase-label').textContent =
        q.phase === 'elimination'
          ? 'ELIMINAZIONE'
          : 'FASE 1';

      $('game-progress').textContent =
        q.phase === 'elimination'
          ? `Turno ${q.eliminationRound}`
          : `Domanda ${q.index + 1}/${q.total}`;

      $('game-category').textContent =
        `${q.category} · ${q.difficulty}`;

      $('question-text').textContent =
        q.text;

      $('elimination-head')
        .classList
        .toggle(
          'hidden',
          q.phase !== 'elimination'
        );

      if (q.phase === 'elimination') {

        $('remaining-count').textContent =
          `${q.eligibleIds.length} ancora in gioco`;
      }

      const eligible =
        !q.eligibleIds ||
        q.eligibleIds.includes(myId);

      $('spectator-banner')
        .classList
        .toggle('hidden', eligible);

      document
        .querySelectorAll('.answer-btn')
        .forEach((b, i) => {

          b.textContent =
            q.answers[i];

          b.disabled =
            !eligible;

          b.classList.remove(
            'correct',
            'wrong-pick',
            'selected'
          );
        });

      startTimer(q.timeLimitMs);
    }
  );

  document
    .querySelectorAll('.answer-btn')
    .forEach(b => {

      b.onclick = () => {

        if (answered)
          return;

        const eligible =
          !currentEligibleIds ||
          currentEligibleIds.includes(myId);

        if (!eligible)
          return;

        answered = true;

        socket.emit(
          'game:answer',
          {
            answerIndex:
              Number(b.dataset.idx)
          }
        );

        document
          .querySelectorAll('.answer-btn')
          .forEach(x => {
            x.disabled = true;
          });

        b.classList.add('selected');
      };
    });

  socket.on(
    'game:questionResult',
    data => {

      stopTimer();

      document
        .querySelectorAll('.answer-btn')
        .forEach((b, i) => {

          if (i === data.correctIndex)
            b.classList.add('correct');
        });

      const mine =
        data.results.find(
          r => r.id === myId
        );

      if (
        mine &&
        mine.answerIndex !== null &&
        mine.answerIndex !== data.correctIndex
      ) {

        document
          .querySelectorAll('.answer-btn')
          [mine.answerIndex]
          .classList
          .add('wrong-pick');
      }

      if (data.scoreboard)
        renderMini(data.scoreboard);
    }
  );

  socket.on(
    'phase1:end',
    data => {

      showScreen('screen-phase1end');

      $('phase1-standings').innerHTML =
        data.standings
          .map(p => `
            <li>
              <strong>
                ${p.nickname}
              </strong>
              — ${p.score} pt
            </li>
          `)
          .join('');
    }
  );

  socket.on(
    'elimination:start',
    data => {

      showScreen('screen-elimination');

      renderLive(
        data.activeIds,
        []
      );
    }
  );

  socket.on(
    'elimination:roundResult',
    data => {

      renderLive(
        data.survivors.concat(
          data.eliminated
        ),
        data.eliminated
      );

      if (data.allWrong) {

        showHostLine(
          'Tutti hanno sbagliato. Nessuno eliminato. Si continua.'
        );
      }
    }
  );

  function renderLive(ids, out) {

    const set =
      new Set(out);

    $('elimination-live-list').innerHTML =
      ids
        .map(id => `
          <div
            class="live-row ${
              set.has(id) ? 'out' : ''
            }">

            <span>
              👤
              ${id === myId
                ? 'Tu'
                : 'Giocatore'}
            </span>

            <span>
              ${
                set.has(id)
                  ? '❌ FUORI'
                  : '🟢 IN GIOCO'
              }
            </span>

          </div>
        `)
        .join('');
  }

  socket.on(
    'session:update',
    d => {
      sessionGames =
        d.gameNumber || sessionGames;
    }
  );

  $('btn-next-game').onclick = () => {

    socket.emit(
      'session:nextGame',
      res => {

        if (res.error)
          toast(res.error);
      }
    );
  };

  socket.on(
    'game:final',
    data => {

      showScreen('screen-final');

      $('final-winner').textContent =
        data.championName
          ? `${data.championName} 🎉`
          : 'Nessun vincitore';

      const gameRank =
        data.gameStandings;

      $('game-awards').innerHTML =
        gameRank
          .map((p, i) => `
            <div class="${
              i === 0
                ? 'gold'
                : i === 1
                  ? 'silver'
                  : i === 2
                    ? 'bronze'
                    : ''
            }">

              <span>
                ${i + 1}.
                ${p.nickname}
              </span>

              <strong>
                ${
                  i === 0
                    ? '+1000'
                    : i === 1
                      ? '+500'
                      : i === 2
                        ? '+250'
                        : '+0'
                }
              </strong>

            </div>
          `)
          .join('');

      $('final-standings').innerHTML =
        data.sessionStandings
          .map((p, i) => `
            <li>
              <strong>
                ${p.nickname}
              </strong>
              —
              ${p.sessionScore}
              punti sessione
            </li>
          `)
          .join('');

      $('btn-next-game')
        .classList
        .toggle(
          'hidden',
          !isHost
        );
    }
  );

  socket.on(
    'error',
    d => toast(
      d.message || 'Errore'
    )
  );

  socket.on(
    'connect',
    () => {
      myId = socket.id;
    }
  );

  function loadCategories() {

    fetch('/api/categories')
      .then(r => r.json())
      .then(({ categories }) => {

        $('select-category').innerHTML =
          '<option value="tutte">Tutte</option>' +
          categories
            .map(c =>
              `<option>${c}</option>`
            )
            .join('');
      })
      .catch(() => {});
  }

  loadCategories();

})();
