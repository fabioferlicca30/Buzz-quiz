const questionBank = require('./QuestionBank');
const host = require('./Host');

const PHASE1_QUESTIONS = 10;
const QUESTION_TIME_MS = 10000;
const RESULT_PAUSE_MS = 4500;
const BIG_PAUSE_MS = 6000;
const DIFFICULTY_ORDER = ['facile', 'medio', 'difficile'];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Genera il classico ordine di seeding di un tabellone (1 vs ultimo, 2 vs penultimo, ecc.)
function seedOrder(size) {
  let seeds = [1];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(n + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

function roundDifficulty(baseDifficulty, roundIndex) {
  const baseIdx = baseDifficulty === 'misto' ? 0 : DIFFICULTY_ORDER.indexOf(baseDifficulty);
  const idx = Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, baseIdx) + roundIndex);
  return DIFFICULTY_ORDER[idx];
}

class GameRoom {
  constructor(code, hostSocketId, settings) {
    this.code = code;
    this.visibility = settings.visibility === 'public' ? 'public' : 'private';
    this.mode = settings.mode === 'classic' ? 'classic' : 'rush'; // 'rush' | 'classic'
    this.difficulty = settings.difficulty || 'misto'; // facile|medio|difficile|misto
    this.category = settings.category || 'tutte';
    this.hostSocketId = hostSocketId;
    this.players = new Map(); // socketId -> player
    this.state = 'lobby'; // lobby | phase1 | tournament | finished
    this.usedQuestionIds = new Set();
    this.currentQuestion = null;
    this.acceptingAnswers = false;
    this.currentAnswers = new Map(); // socketId -> {answerIndex, elapsedMs}
    this.questionStartTs = 0;
    this.phase1Index = 0;
    this.bracket = null;
    this.createdAt = Date.now();
  }

  addPlayer(socketId, nickname) {
    this.players.set(socketId, {
      id: socketId,
      nickname: nickname.slice(0, 16),
      score: 0,
      connected: true,
      isHost: socketId === this.hostSocketId,
      qualified: false,
      eliminated: false,
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  get playerList() {
    return [...this.players.values()];
  }

  get connectedCount() {
    return this.playerList.filter((p) => p.connected).length;
  }

  publicSummary() {
    return {
      code: this.code,
      visibility: this.visibility,
      mode: this.mode,
      difficulty: this.difficulty,
      category: this.category,
      state: this.state,
      players: this.playerList.map((p) => ({ nickname: p.nickname, isHost: p.isHost, connected: p.connected })),
    };
  }

  scoreboard() {
    return this.playerList
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, connected: p.connected, eliminated: p.eliminated }));
  }

  submitAnswer(socketId, answerIndex) {
    if (!this.acceptingAnswers) return;
    if (this.currentAnswers.has(socketId)) return;
    const player = this.players.get(socketId);
    if (!player || !player.connected) return;
    // Durante il torneo rispondono solo i giocatori attivi nel match corrente.
    if (this.state === 'tournament' && this.activeCompetitorIds && !this.activeCompetitorIds.has(socketId)) return;
    const elapsedMs = Date.now() - this.questionStartTs;
    this.currentAnswers.set(socketId, { answerIndex, elapsedMs: Math.max(0, elapsedMs) });
  }

  // ---- Ciclo principale della partita -----------------------------------
  async run(io) {
    this.state = 'phase1';
    io.to(this.code).emit('host:say', { text: host.say('welcome') });
    await wait(1500);

    for (let i = 0; i < PHASE1_QUESTIONS; i++) {
      this.phase1Index = i;
      await this.askQuestion(io, {
        index: i,
        total: PHASE1_QUESTIONS,
        difficulty: this.difficulty,
        category: this.category,
        scoringMode: this.mode,
        phase: 'phase1',
      });
      await wait(RESULT_PAUSE_MS);
    }

    await this.finishPhase1AndStartTournament(io);
  }

  async askQuestion(io, { index, total, difficulty, category, scoringMode, phase, activeIds = null }) {
    const question = questionBank.pickQuestions({
      count: 1,
      difficulty,
      category,
      excludeIds: this.usedQuestionIds,
    })[0];
    if (!question) return null; // non dovrebbe succedere con >200 domande disponibili
    this.usedQuestionIds.add(question.id);
    this.currentQuestion = question;
    this.currentAnswers = new Map();
    this.acceptingAnswers = true;
    this.activeCompetitorIds = activeIds; // null = tutti i giocatori collegati possono rispondere

    io.to(this.code).emit('host:say', { text: host.say('questionIntro') });
    io.to(this.code).emit('game:question', {
      phase,
      index,
      total,
      id: question.id,
      category: question.category,
      difficulty: question.difficulty,
      text: question.text,
      answers: question.answers,
      timeLimitMs: QUESTION_TIME_MS,
      startTs: Date.now(),
      eligibleIds: activeIds ? [...activeIds] : null,
    });

    await wait(QUESTION_TIME_MS);
    this.acceptingAnswers = false;

    const result = this.resolveQuestion(scoringMode, question, activeIds);
    io.to(this.code).emit('game:questionResult', {
      phase,
      correctIndex: question.correctIndex,
      correctText: question.answers[question.correctIndex],
      results: result.perPlayer,
      scoreboard: this.scoreboard(),
    });
    io.to(this.code).emit('host:say', { text: result.hostLine });
    return result;
  }

  resolveQuestion(scoringMode, question, activeIds) {
    const eligibleIds = activeIds ? [...activeIds] : this.playerList.filter((p) => p.connected).map((p) => p.id);
    const answered = eligibleIds.map((id) => ({ id, entry: this.currentAnswers.get(id) }));

    const correctAnswers = answered
      .filter((a) => a.entry && a.entry.answerIndex === question.correctIndex)
      .sort((a, b) => a.entry.elapsedMs - b.entry.elapsedMs);

    const pointsForRank = [3, 2, 1]; // dal 4 posto in poi: 0 punti (comunque risposta corretta)
    const perPlayer = [];
    let fastestCorrectName = null;
    let anyCorrect = correctAnswers.length > 0;
    let anyWrong = false;

    for (const { id } of eligibleIds.map((id) => ({ id }))) {
      const player = this.players.get(id);
      if (!player) continue;
      const entry = this.currentAnswers.get(id);
      let points = 0;
      let correct = false;
      let answerIndex = entry ? entry.answerIndex : null;

      if (entry && entry.answerIndex === question.correctIndex) {
        correct = true;
        if (scoringMode === 'rush') {
          const rank = correctAnswers.findIndex((c) => c.id === id);
          points = rank >= 0 && rank < pointsForRank.length ? pointsForRank[rank] : 0;
          if (rank === 0) fastestCorrectName = player.nickname;
        } else {
          points = 2; // modalità classica: stesso valore per tutti, entro il limite di tempo
        }
      } else if (entry) {
        points = -1;
        anyWrong = true;
      } else {
        points = 0; // nessuna risposta data in tempo
      }

      player.score += points;
      perPlayer.push({
        id,
        nickname: player.nickname,
        answerIndex,
        correct,
        points,
        elapsedMs: entry ? entry.elapsedMs : null,
      });
    }

    let hostLine;
    if (!anyCorrect) {
      hostLine = host.say('everyoneWrong');
    } else if (!anyWrong && correctAnswers.length === eligibleIds.length) {
      hostLine = host.say('everyoneRight');
    } else if (scoringMode === 'rush' && fastestCorrectName) {
      hostLine = host.say('correctFast', { name: fastestCorrectName });
    } else if (correctAnswers.length > 0) {
      const last = correctAnswers[correctAnswers.length - 1];
      const p = this.players.get(last.id);
      hostLine = host.say('correctSlow', { name: p ? p.nickname : 'qualcuno' });
    } else {
      hostLine = host.say('wrong', { name: 'tutti' });
    }

    return { perPlayer, hostLine };
  }

  async finishPhase1AndStartTournament(io) {
    const standings = this.scoreboard().filter((p) => p.connected);
    const n = standings.length;
    const qualifiersCount = Math.min(n, Math.max(2, Math.ceil(n / 2)));
    const qualifiers = standings.slice(0, qualifiersCount);

    for (const p of this.playerList) {
      p.qualified = qualifiers.some((q) => q.id === p.id);
      if (!p.qualified) p.eliminated = true;
    }

    io.to(this.code).emit('phase1:end', {
      standings,
      qualifiers: qualifiers.map((q) => q.id),
    });
    io.to(this.code).emit('host:say', { text: host.say('phase1End') });
    await wait(BIG_PAUSE_MS);

    if (qualifiers.length < 2) {
      // Non ci sono abbastanza giocatori collegati per un torneo: dichiariamo vincitore diretto.
      await this.finish(io, qualifiers[0] ? qualifiers[0].id : null);
      return;
    }

    this.state = 'tournament';
    io.to(this.code).emit('host:say', { text: host.say('tournamentStart') });
    io.to(this.code).emit('tournament:start', { qualifiers: qualifiers.map((q) => q.id) });
    await wait(2000);

    await this.runTournament(io, qualifiers.map((q) => q.id));
  }

  async runTournament(io, qualifierIds) {
    const bracketSize = nextPowerOfTwo(qualifierIds.length);
    const order = seedOrder(bracketSize);
    // seed 1..K = giocatori in ordine di classifica, il resto sono "bye" (null)
    let currentRoundPlayers = order.map((seed) => (seed <= qualifierIds.length ? qualifierIds[seed - 1] : null));
    let roundIndex = 0;

    while (currentRoundPlayers.length > 1) {
      const pairs = [];
      for (let i = 0; i < currentRoundPlayers.length; i += 2) {
        pairs.push([currentRoundPlayers[i], currentRoundPlayers[i + 1]]);
      }

      io.to(this.code).emit('tournament:round', {
        round: roundIndex + 1,
        pairs: pairs.map(([a, b]) => ({
          a: a ? this.players.get(a)?.nickname : null,
          b: b ? this.players.get(b)?.nickname : null,
        })),
        difficulty: roundDifficulty(this.difficulty, roundIndex),
      });

      const winners = [];
      for (const [a, b] of pairs) {
        if (a && !b) {
          winners.push(a);
          continue;
        }
        if (b && !a) {
          winners.push(b);
          continue;
        }
        if (!a && !b) {
          winners.push(null);
          continue;
        }
        const winnerId = await this.playMatch(io, a, b, roundIndex);
        winners.push(winnerId);
      }

      currentRoundPlayers = winners.filter((w) => w !== null || winners.length === 1);
      roundIndex++;
      await wait(2000);
    }

    const championId = currentRoundPlayers[0] || null;
    await this.finish(io, championId);
  }

  // Disputa un incontro 1 vs 1 al meglio di 3 domande (con spareggio in caso di parità)
  async playMatch(io, aId, bId, roundIndex) {
    const activeIds = new Set([aId, bId]);
    const matchScore = { [aId]: 0, [bId]: 0 };
    const difficulty = roundDifficulty(this.difficulty, roundIndex);
    const playerA = this.players.get(aId);
    const playerB = this.players.get(bId);

    io.to(this.code).emit('host:say', {
      text: `Prossimo scontro: ${playerA ? playerA.nickname : '???'} contro ${playerB ? playerB.nickname : '???'}. Che vinca il migliore!`,
    });
    await wait(1500);

    let played = 0;
    const MAX_QUESTIONS = 3;
    const MAX_SUDDEN_DEATH = 5;

    while (played < MAX_QUESTIONS || matchScore[aId] === matchScore[bId]) {
      if (played >= MAX_QUESTIONS + MAX_SUDDEN_DEATH) break; // sicurezza anti-loop infinito
      const question = questionBank.pickQuestions({
        count: 1,
        difficulty,
        category: this.category,
        excludeIds: this.usedQuestionIds,
      })[0];
      if (!question) break;
      this.usedQuestionIds.add(question.id);
      this.currentQuestion = question;
      this.currentAnswers = new Map();
      this.acceptingAnswers = true;
      this.activeCompetitorIds = activeIds;

      io.to(this.code).emit('game:question', {
        phase: 'tournament',
        index: played,
        total: played < MAX_QUESTIONS ? MAX_QUESTIONS : played + 1,
        id: question.id,
        category: question.category,
        difficulty: question.difficulty,
        text: question.text,
        answers: question.answers,
        timeLimitMs: QUESTION_TIME_MS,
        startTs: Date.now(),
        eligibleIds: [aId, bId],
        match: { a: playerA ? playerA.nickname : null, b: playerB ? playerB.nickname : null },
      });

      await wait(QUESTION_TIME_MS);
      this.acceptingAnswers = false;

      const entryA = this.currentAnswers.get(aId);
      const entryB = this.currentAnswers.get(bId);
      const correctA = entryA && entryA.answerIndex === question.correctIndex;
      const correctB = entryB && entryB.answerIndex === question.correctIndex;

      let roundWinner = null;
      if (correctA && correctB) {
        roundWinner = entryA.elapsedMs <= entryB.elapsedMs ? aId : bId;
      } else if (correctA) {
        roundWinner = aId;
      } else if (correctB) {
        roundWinner = bId;
      }
      if (roundWinner) matchScore[roundWinner] += 1;

      io.to(this.code).emit('game:questionResult', {
        phase: 'tournament',
        correctIndex: question.correctIndex,
        correctText: question.answers[question.correctIndex],
        results: [aId, bId].map((id) => {
          const p = this.players.get(id);
          const entry = this.currentAnswers.get(id);
          return {
            id,
            nickname: p ? p.nickname : '???',
            answerIndex: entry ? entry.answerIndex : null,
            correct: entry ? entry.answerIndex === question.correctIndex : false,
            elapsedMs: entry ? entry.elapsedMs : null,
          };
        }),
        matchScore: { a: matchScore[aId], b: matchScore[bId] },
      });

      played++;
      await wait(RESULT_PAUSE_MS);
    }

    const winnerId = matchScore[aId] > matchScore[bId] ? aId : bId;
    const loserId = winnerId === aId ? bId : aId;
    const loser = this.players.get(loserId);
    if (loser) loser.eliminated = true;

    const winnerPlayer = this.players.get(winnerId);
    io.to(this.code).emit('tournament:matchResult', { winnerId, loserId, matchScore });
    io.to(this.code).emit('host:say', { text: host.say('matchWin', { name: winnerPlayer ? winnerPlayer.nickname : 'il vincitore' }) });
    await wait(2500);

    return winnerId;
  }

  async finish(io, championId) {
    this.state = 'finished';
    const champion = championId ? this.players.get(championId) : null;
    io.to(this.code).emit('host:say', {
      text: champion ? host.say('finalWinner', { name: champion.nickname }) : 'Partita conclusa!',
    });
    io.to(this.code).emit('game:final', {
      championId,
      championName: champion ? champion.nickname : null,
      standings: this.scoreboard(),
    });
  }
}

module.exports = { GameRoom, nextPowerOfTwo, seedOrder, roundDifficulty };
