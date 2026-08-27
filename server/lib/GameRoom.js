const questionBank = require('./QuestionBank');
const host = require('./Host');

const PHASE1_QUESTIONS = 10;
const QUESTION_TIME_MS = 10000;
const RESULT_PAUSE_MS = 3500;
const BIG_PAUSE_MS = 5000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function roundDifficulty(baseDifficulty, roundIndex) {

  const order = [
    'facile',
    'medio',
    'difficile'
  ];

  if (baseDifficulty === 'misto') {

    return order[
      Math.min(
        order.length - 1,
        Math.floor(roundIndex / 3)
      )
    ];
  }

  const idx =
    order.indexOf(baseDifficulty);

  return order[
    Math.min(
      order.length - 1,
      Math.max(0, idx) +
      Math.floor(roundIndex / 2)
    )
  ];
}

class GameRoom {

  constructor(code, hostSocketId, settings) {

    this.code = code;

    this.visibility =
      settings.visibility === 'public'
        ? 'public'
        : 'private';

    this.mode =
      settings.mode === 'classic'
        ? 'classic'
        : 'rush';

    this.difficulty =
      settings.difficulty || 'misto';

    this.category =
      settings.category || 'tutte';

    this.hostSocketId =
      hostSocketId;

    this.players = new Map();

    this.state = 'lobby';

    this.usedQuestionIds =
      new Set();

    this.currentQuestion = null;

    this.acceptingAnswers = false;

    this.currentAnswers =
      new Map();

    this.questionStartTs = 0;

    this.phase1Index = 0;

    this.eliminationRound = 0;

    this.activeIds =
      new Set();

    this.eliminationOrder =
      [];

    this.sessionGames = 0;

    this.gameRunning = false;

    this.lastLeaderId = null;

    this.createdAt = Date.now();
  }

  addPlayer(socketId, nickname) {

    this.players.set(
      socketId,
      {
        id: socketId,
        nickname: nickname.slice(0, 16),
        score: 0,
        sessionScore: 0,
        connected: true,
        isHost:
          socketId === this.hostSocketId,
        qualified: false,
        eliminated: false,
        gamePlacement: null
      }
    );
  }

  get playerList() {
    return [
      ...this.players.values()
    ];
  }

  get connectedCount() {

    return this.playerList
      .filter(p => p.connected)
      .length;
  }

  publicSummary() {

    return {
      code: this.code,
      visibility: this.visibility,
      mode: this.mode,
      difficulty: this.difficulty,
      category: this.category,
      state: this.state,
      sessionGames: this.sessionGames,

      players:
        this.playerList.map(p => ({
          nickname: p.nickname,
          isHost: p.isHost,
          connected: p.connected
        }))
    };
  }

  scoreboard() {

    return this.playerList
      .slice()
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.sessionScore - a.sessionScore
      )
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        sessionScore: p.sessionScore,
        connected: p.connected,
        eliminated: p.eliminated
      }));
  }

  sessionScoreboard() {

    return this.playerList
      .slice()
      .sort(
        (a, b) =>
          b.sessionScore - a.sessionScore ||
          (a.gamePlacement || 999) -
          (b.gamePlacement || 999)
      )
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        sessionScore: p.sessionScore,
        connected: p.connected
      }));
  }

  resetForNewGame() {

    this.usedQuestionIds.clear();

    this.currentQuestion = null;

    this.currentAnswers =
      new Map();

    this.acceptingAnswers = false;

    this.phase1Index = 0;

    this.eliminationRound = 0;

    this.activeIds =
      new Set();

    this.eliminationOrder =
      [];

    this.lastLeaderId = null;

    this.playerList.forEach(p => {

      p.score = 0;
      p.qualified = false;
      p.eliminated = false;
      p.gamePlacement = null;

    });
  }

  submitAnswer(socketId, answerIndex) {

    if (
      !this.acceptingAnswers ||
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex > 3
    ) {
      return;
    }

    if (
      this.currentAnswers.has(socketId)
    ) {
      return;
    }

    const player =
      this.players.get(socketId);

    if (
      !player ||
      !player.connected
    ) {
      return;
    }

    if (
      this.state === 'elimination' &&
      !this.activeIds.has(socketId)
    ) {
      return;
    }

    const elapsedMs =
      Math.max(
        0,
        Date.now() -
        this.questionStartTs
      );

    this.currentAnswers.set(
      socketId,
      {
        answerIndex,
        elapsedMs
      }
    );
  }

  async run(io) {

    if (this.gameRunning)
      return;

    this.gameRunning = true;

    this.sessionGames += 1;

    this.resetForNewGame();

    this.state = 'phase1';

    io.to(this.code).emit(
      'session:update',
      {
        gameNumber:
          this.sessionGames,

        standings:
          this.sessionScoreboard()
      }
    );

    io.to(this.code).emit(
      'host:say',
      {
        text:
          host.say(
            'welcome',
            {
              game:
                this.sessionGames
            }
          )
      }
    );

    await wait(1400);

    for (
      let i = 0;
      i < PHASE1_QUESTIONS;
      i++
    ) {

      this.phase1Index = i;

      await this.askQuestion(
        io,
        {
          index: i,
          total:
            PHASE1_QUESTIONS,
          difficulty:
            this.difficulty,
          category:
            this.category,
          scoringMode:
            this.mode,
          phase:
            'phase1'
        }
      );

      await wait(
        RESULT_PAUSE_MS
      );
    }

    await this.finishPhase1AndStartElimination(
      io
    );
  }

  async askQuestion(
    io,
    {
      index,
      total,
      difficulty,
      category,
      scoringMode,
      phase,
      activeIds = null
    }
  ) {

    let question =
      questionBank.pickQuestions({
        count: 1,
        difficulty,
        category,
        excludeIds:
          this.usedQuestionIds
      })[0];

    /*
     * Se abbiamo esaurito tutte le domande
     * disponibili con questi filtri, azzeriamo
     * solamente l'esclusione.
     *
     * Questo permette all'eliminazione di essere
     * realmente infinita.
     */
    if (!question) {

      question =
        questionBank.pickQuestions({
          count: 1,
          difficulty,
          category,
          excludeIds: new Set()
        })[0];
    }

    if (!question) {

      throw new Error(
        'Nessuna domanda disponibile per i filtri scelti.'
      );
    }

    this.usedQuestionIds.add(
      question.id
    );

    this.currentQuestion =
      question;

    this.currentAnswers =
      new Map();

    this.acceptingAnswers =
      true;

    this.questionStartTs =
      Date.now();

    this.activeIds =
      activeIds
        ? new Set(activeIds)
        : new Set(
            this.playerList
              .filter(p => p.connected)
              .map(p => p.id)
          );

    io.to(this.code).emit(
      'host:say',
      {
        text:
          host.say(
            'questionIntro',
            {
              category:
                question.category
            }
          )
      }
    );

    io.to(this.code).emit(
      'game:question',
      {
        phase,
        index,
        total,
        id: question.id,
        category:
          question.category,
        difficulty:
          question.difficulty,
        text:
          question.text,
        answers:
          question.answers,
        timeLimitMs:
          QUESTION_TIME_MS,
        startTs:
          this.questionStartTs,

        eligibleIds:
          activeIds
            ? [...activeIds]
            : null,

        eliminationRound:
          phase === 'elimination'
            ? this.eliminationRound
            : null
      }
    );

    await wait(
      QUESTION_TIME_MS
    );

    this.acceptingAnswers =
      false;

    const result =
      this.resolveQuestion(
        scoringMode,
        question,
        activeIds
      );

    io.to(this.code).emit(
      'game:questionResult',
      {
        phase,
        correctIndex:
          question.correctIndex,
        correctText:
          question.answers[
            question.correctIndex
          ],
        results:
          result.perPlayer,
        scoreboard:
          this.scoreboard()
      }
    );

    io.to(this.code).emit(
      'host:say',
      {
        text:
          result.hostLine
      }
    );

    return result;
  }

  resolveQuestion(
    scoringMode,
    question,
    activeIds
  ) {

    const eligibleIds =
      activeIds
        ? [...activeIds]
        : this.playerList
            .filter(p => p.connected)
            .map(p => p.id);

    const answered =
      eligibleIds.map(id => ({
        id,
        entry:
          this.currentAnswers.get(id)
      }));

    const correctAnswers =
      answered
        .filter(
          a =>
            a.entry &&
            a.entry.answerIndex ===
              question.correctIndex
        )
        .sort(
          (a, b) =>
            a.entry.elapsedMs -
            b.entry.elapsedMs
        );

    const perPlayer = [];

    let fastestCorrectName = null;
    let anyWrong = false;

    for (
      const id of eligibleIds
    ) {

      const player =
        this.players.get(id);

      if (!player)
        continue;

      const entry =
        this.currentAnswers.get(id);

      let points = 0;
      let correct = false;

      const answerIndex =
        entry
          ? entry.answerIndex
          : null;

      if (
        entry &&
        entry.answerIndex ===
          question.correctIndex
      ) {

        correct = true;

        if (
          scoringMode === 'rush'
        ) {

          const rank =
            correctAnswers.findIndex(
              c => c.id === id
            );

          points =
            rank === 0
              ? 3
              : rank === 1
                ? 2
                : rank === 2
                  ? 1
                  : 0;

          if (rank === 0)
            fastestCorrectName =
              player.nickname;

        } else {

          points = 2;
        }

      } else if (entry) {

        points = -1;
        anyWrong = true;
      }

      player.score += points;

      perPlayer.push({
        id,
        nickname:
          player.nickname,
        answerIndex,
        correct,
        points,
        elapsedMs:
          entry
            ? entry.elapsedMs
            : null
      });
    }

    let hostLine;

    if (!correctAnswers.length) {

      hostLine =
        host.say(
          'everyoneWrong'
        );

    } else if (
      !anyWrong &&
      correctAnswers.length ===
        eligibleIds.length
    ) {

      hostLine =
        host.say(
          'everyoneRight'
        );

    } else if (
      scoringMode === 'rush' &&
      fastestCorrectName
    ) {

      hostLine =
        host.say(
          'correctFast',
          {
            name:
              fastestCorrectName
          }
        );

    } else {

      hostLine =
        host.say(
          'correctSlow',
          {
            name:
              correctAnswers
                .map(
                  x =>
                    this.players
                      .get(x.id)
                      ?.nickname
                )
                .filter(Boolean)
                .join(', ')
          }
        );
    }

    const leader =
      this.scoreboard()
        .find(p => p.connected);

    if (
      leader &&
      leader.id !==
        this.lastLeaderId
    ) {

      if (
        this.lastLeaderId !== null
      ) {

        hostLine =
          host.say(
            'leaderChange',
            {
              name:
                leader.nickname
            }
          );
      }

      this.lastLeaderId =
        leader.id;
    }

    return {
      perPlayer,
      hostLine
    };
  }

  async finishPhase1AndStartElimination(
    io
  ) {

    const standings =
      this.scoreboard()
        .filter(
          p => p.connected
        );

    const qualifiers =
      standings;

    qualifiers.forEach(
      p => {
        p.qualified = true;
      }
    );

    this.activeIds =
      new Set(
        qualifiers.map(
          q => q.id
        )
      );

    io.to(this.code).emit(
      'phase1:end',
      {
        standings,
        qualifiers:
          qualifiers.map(
            q => q.id
          )
      }
    );

    io.to(this.code).emit(
      'host:say',
      {
        text:
          host.say(
            'phase1End',
            {
              count:
                qualifiers.length
            }
          )
      }
    );

    await wait(
      BIG_PAUSE_MS
    );

    if (
      qualifiers.length === 1
    ) {

      await this.finish(
        io,
        qualifiers[0].id
      );

      return;
    }

    if (
      qualifiers.length === 0
    ) {

      await this.finish(
        io,
        null
      );

      return;
    }

    this.state =
      'elimination';

    io.to(this.code).emit(
      'host:say',
      {
        text:
          host.say(
            'eliminationStart'
          )
      }
    );

    io.to(this.code).emit(
      'elimination:start',
      {
        activeIds:
          [...this.activeIds]
      }
    );

    await wait(1800);

    await this.runElimination(
      io
    );
  }

  async runElimination(io) {

    let questionIndex = 0;

    /*
     * NON ESISTE UN LIMITE AL NUMERO DI TURNI.
     *
     * Se tutti sbagliano:
     *   nessuno viene eliminato.
     *
     * Se almeno uno risponde correttamente:
     *   tutti gli altri vengono eliminati.
     *
     * Si continua finché rimane esattamente
     * un giocatore.
     */
    while (
      this.activeIds.size > 1
    ) {

      this.eliminationRound += 1;

      const activeBefore =
        [...this.activeIds];

      let question =
        questionBank.pickQuestions({
          count: 1,
          difficulty:
            roundDifficulty(
              this.difficulty,
              this.eliminationRound - 1
            ),
          category:
            this.category,
          excludeIds:
            this.usedQuestionIds
        })[0];

      /*
       * Database esaurito:
       * ricominciamo a pescare anche
       * domande già usate.
       */
      if (!question) {

        question =
          questionBank.pickQuestions({
            count: 1,
            difficulty:
              roundDifficulty(
                this.difficulty,
                this.eliminationRound - 1
              ),
            category:
              this.category,
            excludeIds:
              new Set()
          })[0];
      }

      if (!question) {

        throw new Error(
          'Nessuna domanda disponibile durante l\'eliminazione.'
        );
      }

      this.usedQuestionIds.add(
        question.id
      );

      this.currentQuestion =
        question;

      this.currentAnswers =
        new Map();

      this.acceptingAnswers =
        true;

      this.questionStartTs =
        Date.now();

      io.to(this.code).emit(
        'host:say',
        {
          text:
            host.say(
              'eliminationQuestion',
              {
                round:
                  this.eliminationRound
              }
            )
        }
      );

      io.to(this.code).emit(
        'game:question',
        {
          phase:
            'elimination',

          index:
            questionIndex++,

          total:
            questionIndex,

          id:
            question.id,

          category:
            question.category,

          difficulty:
            question.difficulty,

          text:
            question.text,

          answers:
            question.answers,

          timeLimitMs:
            QUESTION_TIME_MS,

          startTs:
            this.questionStartTs,

          eligibleIds:
            activeBefore,

          eliminationRound:
            this.eliminationRound
        }
      );

      await wait(
        QUESTION_TIME_MS
      );

      this.acceptingAnswers =
        false;

      const survivors = [];
      const eliminated = [];

      for (
        const id of activeBefore
      ) {

        const entry =
          this.currentAnswers.get(id);

        const correct =
          !!entry &&
          entry.answerIndex ===
            question.correctIndex;

        if (correct)
          survivors.push(id);
        else
          eliminated.push(id);
      }

      const resultRows =
        activeBefore.map(id => {

          const p =
            this.players.get(id);

          const entry =
            this.currentAnswers.get(id);

          return {
            id,
            nickname:
              p
                ? p.nickname
                : '???',

            answerIndex:
              entry
                ? entry.answerIndex
                : null,

            correct:
              !!entry &&
              entry.answerIndex ===
                question.correctIndex,

            elapsedMs:
              entry
                ? entry.elapsedMs
                : null,

            points: 0
          };
        });

      io.to(this.code).emit(
        'game:questionResult',
        {
          phase:
            'elimination',

          correctIndex:
            question.correctIndex,

          correctText:
            question.answers[
              question.correctIndex
            ],

          results:
            resultRows,

          scoreboard:
            this.scoreboard()
        }
      );

      /*
       * CASO SPECIALE:
       * tutti hanno sbagliato.
       *
       * Nessuno viene eliminato.
       * La domanda successiva parte
       * con gli stessi giocatori.
       */
      if (
        survivors.length === 0
      ) {

        io.to(this.code).emit(
          'elimination:roundResult',
          {
            round:
              this.eliminationRound,

            eliminated: [],

            survivors:
              activeBefore,

            allWrong: true,

            remaining:
              activeBefore.length
          }
        );

        io.to(this.code).emit(
          'host:say',
          {
            text:
              host.say(
                'allWrongElimination'
              )
          }
        );

      } else {

        const sortedOut =
          eliminated
            .map(
              id =>
                this.players.get(id)
            )
            .filter(Boolean)
            .sort(
              (a, b) =>
                b.score - a.score ||
                a.nickname.localeCompare(
                  b.nickname
                )
            );

        sortedOut.forEach(p => {

          p.eliminated = true;

          this.eliminationOrder.push(
            p.id
          );
        });

        this.activeIds =
          new Set(survivors);

        io.to(this.code).emit(
          'elimination:roundResult',
          {
            round:
              this.eliminationRound,

            eliminated:
              sortedOut.map(
                p => p.id
              ),

            survivors,

            allWrong: false,

            remaining:
              survivors.length
          }
        );

        if (
          sortedOut.length
        ) {

          io.to(this.code).emit(
            'host:say',
            {
              text:
                host.say(
                  'eliminationOut',
                  {
                    names:
                      sortedOut
                        .map(
                          p =>
                            p.nickname
                        )
                        .join(', ')
                  }
                )
            }
          );
        }
      
