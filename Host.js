// Il "presentatore" virtuale: frasi spiritose scelte a caso per rendere il gioco più vivo.
// Sono organizzate per momento della partita.

const LINES = {
  welcome: [
    'Bentornati al vostro quiz preferito, io sono il vostro presentatore virtuale e oggi ho voglia di mettervi in difficoltà!',
    'Ok gente, sistemate i cervelli in modalità competizione: si comincia!',
    'Niente scuse, niente aiuti da internet: solo voi, io e qualche domanda cattiva.',
  ],
  questionIntro: [
    'Ecco a voi la prossima domanda, fatemi vedere quanto siete svegli.',
    'Occhi aperti, cervello acceso: si parte!',
    'Questa qui sembra facile... o forse no.',
    'Attenzione, tra poco qualcuno di voi si pentirà di aver risposto di fretta.',
  ],
  correctFast: [
    '{name} risponde alla velocità della luce, e pure giusto! Impressionante.',
    'Wow {name}, hai risposto prima ancora che finissi di leggere la domanda.',
    '{name} in testa: velocità e cervello, che combinazione pericolosa.',
  ],
  correctSlow: [
    '{name} ce l\'ha fatta, con calma ma ce l\'ha fatta.',
    'Meglio tardi che mai, {name}!',
    '{name} risponde giusto, anche se sembrava stesse consultando un\'enciclopedia mentale.',
  ],
  wrong: [
    '{name}... no. Proprio no. Ma va bene, ridiamoci su.',
    'Ahi ahi {name}, quella risposta era una trappola e ci sei cascato in pieno.',
    '{name} tenta il colpo di fortuna e fallisce miseramente.',
    'Coraggiosa risposta di {name}. Sbagliata, ma coraggiosa.',
  ],
  timeout: [
    '{name} è rimasto in silenzio, forse ha perso la connessione con il proprio cervello.',
    'Il tempo è scaduto e {name} non ha detto nulla: strategia o panico?',
  ],
  everyoneWrong: [
    'Nessuno ha risposto bene?! Questa domanda era davvero cattiva, lo ammetto.',
    'Un disastro collettivo. Complimenti a tutti, in negativo.',
  ],
  everyoneRight: [
    'Ma bravi tutti quanti, oggi siete in forma!',
    'Domanda troppo facile a quanto pare, la prossima sarà più cattiva.',
  ],
  leaderChange: [
    '{name} scavalca tutti e prende la testa della classifica!',
    'Colpo di scena: {name} è il nuovo leader!',
  ],
  phase1End: [
    'Fine della prima fase! Solo i migliori andranno al torneo, gli altri... beh, potranno guardare.',
    'Le domande di riscaldamento sono finite, ora si fa sul serio con il torneo.',
  ],
  tournamentStart: [
    'È il momento del torneo ad eliminazione diretta: da qui in poi le domande si fanno più difficili e non c\'è pietà.',
    'Cominciamo il torneo: un passo falso e siete fuori.',
  ],
  matchWin: [
    '{name} vince lo scontro e passa al turno successivo!',
    '{name} avanza nel torneo, complimenti!',
  ],
  finalWinner: [
    '{name} è il campione assoluto di questa partita! Applausi virtuali per lui!',
    'Signore e signori, abbiamo un vincitore: {name}!',
  ],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function say(key, vars = {}) {
  const pool = LINES[key] || ['...'];
  let line = pick(pool);
  for (const [k, v] of Object.entries(vars)) {
    line = line.split(`{${k}}`).join(v);
  }
  return line;
}

module.exports = { say };
