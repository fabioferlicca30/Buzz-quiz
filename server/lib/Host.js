const LINES = {

  welcome: [

    'Benvenuti. Io sono il presentatore e il mio contratto non prevede pietà.',

    'Si parte. Ho già visto le vostre risposte e non sono tranquillo per voi.',

    'Benvenuti al quiz. Potete chiamarla cultura generale, se vi fa sentire meglio.',

    'Cominciamo. Ricordate: il sapere è potere. E voi oggi sembrate poco potenti.',

    'Benvenuti campioni. Alcuni di voi hanno usato il termine campioni un po troppo presto.',

    'Nuova partita, nuove possibilità di fare una figuraccia davanti agli amici.'
  ],

  questionIntro: [

    'Ecco la prossima domanda. Cercate di non farmi perdere fiducia nell\'umanità.',

    'Cervello acceso, dita pronte. E niente Google, geni.',

    'Questa sembra facile. È esattamente così che iniziano le tragedie.',

    'Domanda in arrivo. Chi sbaglia avrà almeno una scusa nuova per la classifica.',

    'Concentratevi. Non posso fare io anche le vostre domande.',

    'Leggete bene. Premere a caso non è una strategia, è un test di coraggio.',

    'Ecco la domanda. Vediamo chi ha studiato e chi ha semplicemente sperato.'
  ],

  correctFast: [

    '{name} ha risposto alla velocità della luce. Peccato non basti per pagare le bollette.',

    '{name} giusto e velocissimo. Qualcuno controlli se sta barando con il futuro.',

    '{name} ha premuto prima ancora di capire la domanda. E incredibilmente ha funzionato.',

    '{name} corretto. Finalmente un neurone ha preso servizio.',

    '{name} ha risposto velocissimo. Gli altri possono iniziare a preoccuparsi.'
  ],

  correctSlow: [

    '{name} ce l\'ha fatta. Piano, ma il risultato non guarda il cronometro.',

    'Alla fine {name} ha trovato la risposta. Evidentemente il cervello era solo in aggiornamento.',

    '{name} risponde bene. Non fate troppo rumore, potrebbe essere un evento raro.',

    '{name} ha trovato la risposta. Meglio tardi che mai, soprattutto per la classifica.',

    'Risposta corretta di {name}. Segnatevi la data, potrebbe essere importante.'
  ],

  wrong: [

    '{name}... no. Quella risposta aveva così poco senso che quasi mi è piaciuta.',

    'Ahi. {name} ha scelto con convinzione una risposta completamente sbagliata. Rispetto.',

    '{name}, tranquillo: anche i campioni sbagliano. Di solito però non così presto.',

    'Risposta sbagliata. Il cervello di {name} ha appena chiesto ferie.',

    '{name} ha appena dimostrato che la sicurezza non è necessariamente collegata alla competenza.',

    'No {name}. La risposta era lì, praticamente con un cartello luminoso.',

    '{name} ha scelto male. Almeno la coerenza con il resto della classifica è impeccabile.',

    'Questa risposta era talmente sbagliata che per un secondo ho pensato fosse una battuta.'
  ],

  everyoneWrong: [

    'Nessuno ha risposto bene. Straordinario: avete trasformato una domanda in un referendum sull\'ignoranza.',

    'Tutti sbagliati. Una prestazione talmente compatta che quasi merita un premio.',

    'Zero risposte corrette. La classifica ringrazia, la cultura generale invece no.',

    'Avete sbagliato tutti. Finalmente qualcosa su cui siete perfettamente d\'accordo.',

    'Nessuno sa la risposta. Bene, almeno nessuno potrà accusare gli altri di essere troppo intelligenti.'
  ],

  everyoneRight: [

    'Tutti giusti. Questa domanda era chiaramente un regalo. Godetevelo, durerà poco.',

    'Bravi tutti. Mi avete rovinato la battuta cattiva che avevo preparato.',

    'Tutti corretti. Per un momento sembrava quasi un gruppo di persone preparate.',

    'Tutti giusti. Tranquilli, recupererò con la prossima domanda.'
  ],

  phase1End: [

    'Fine della fase di riscaldamento. Ora basta punti facili: comincia la selezione naturale.',

    'La fase uno è finita. Chi è rimasto in piedi avrà finalmente l\'occasione di rovinare tutto.',

    'Il riscaldamento è finito. Adesso ogni errore può diventare una storia da raccontare agli amici.',

    'La classifica è pronta. Alcuni sono in alto, altri possono ancora dare la colpa al controller.'
  ],

  eliminationStart: [

    'Da questo momento non esiste più il secondo tentativo. Sbagli una domanda e saluti la compagnia.',

    'Benvenuti all\'eliminazione infinita. Continuo a fare domande finché ne resta uno che non ha mai sbagliato.',

    'Ora non conta più quanto sei bravo. Conta quanto riesci a non fare una figuraccia.',

    'Da qui in poi una risposta sbagliata vale più di mille scuse.'
  ],

  eliminationQuestion: [

    'Turno {round}. Una risposta sbagliata e la tua carriera da campione diventa un ricordo.',

    'Turno {round}. Vediamo chi ha davvero un cervello funzionante e chi lo tiene solo come optional.',

    'Turno {round}. Questa volta basta un errore per finire nella zona spettatori.',

    'Turno {round}. Concentratevi: voglio eliminare qualcuno.',

    'Turno {round}. Uno di voi sta per scoprire che la sicurezza non dà punti.',

    'Turno {round}. Ricordate la regola: sbagliate e sparite.'
  ],

  allWrongElimination: [

    'Avete sbagliato tutti. Nessuno eliminato. Continuate pure: a quanto pare siete democraticamente pessimi.',

    'Tutti fuori strada, quindi nessuno fuori dal gioco. La selezione naturale oggi è in ferie.',

    'Nessuno ha azzeccato la risposta. Peccato: avrei voluto vedere qualche faccia disperata.',

    'Avete sbagliato tutti. Non so se ridere o preoccuparmi.',

    'Nessuno eliminato. Complimenti, siete riusciti a fallire tutti contemporaneamente.',

    'Tutti sbagliati. La partita continua perché evidentemente il destino vi vuole ancora qui.'
  ],

  leaderChange: [

    '{name} è salito in cima alla classifica. Gli altri possono pure fingere di non averlo notato.',

    'Nuovo leader: {name}. Il secondo posto è ufficialmente diventato un problema personale.',

    '{name} comanda la classifica. Respirate: c\'è ancora tempo per rovinarla.',

    '{name} è primo. Gli altri stanno semplicemente contribuendo alla scenografia.',

    'Attenzione: {name} è in testa. Qualcuno faccia qualcosa prima che diventi insopportabile.',

    '{name} guarda tutti dall\'alto. Almeno per ora.'
  ],

  eliminationOut: [

    '{names} eliminato/i. Potete applaudire, ma non troppo: tra poco potrebbe toccare a voi.',

    'Fuori {names}. La classifica ha appena perso qualche sogno di gloria.',

    '{names} è/sono fuori. Complimenti per aver contribuito alla suspense.',

    'E {names} salutano la partita. Il divano li aspetta.',

    '{names} eliminato/i. Una domanda è bastata per trasformare i campioni in spettatori.',

    'Fuori {names}. Potete ancora dire che non vi interessava vincere.'
  ],

  finalWinner: [

    '{name} è il campione! 1000 punti sessione. Gli altri possono iniziare a trovare una scusa.',

    'Vince {name}! Ha resistito fino alla fine senza sbagliare. Finalmente qualcuno che legge le domande.',

    '{name} campione assoluto. Potete contestare il risultato, ma dovrete prima trovare una risposta corretta.',

    '{name} vince! Gli altri hanno combattuto valorosamente. Alcuni più contro le domande che contro gli avversari.',

    'Il vincitore è {name}. Gli altri riceveranno il mio più sincero... zero punti.',

    '{name} ha vinto. Complimenti. Adesso può passare il resto della serata a ricordarlo a tutti.'
  ]
};

function pick(list) {
  return list[
    Math.floor(
      Math.random() * list.length
    )
  ];
}

function say(
  key,
  vars = {}
) {

  let line =
    pick(
      LINES[key] || ['...']
    );

  for (
    const [k, v]
    of Object.entries(vars)
  ) {

    line =
      line
        .split(`{${k}}`)
        .join(String(v));
  }

  return line;
}

module.exports = {
  say
};
