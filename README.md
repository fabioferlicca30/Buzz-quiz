# Quiz Party — clone di Buzz!

Quiz party multiplayer ispirato a *Buzz!*: risposte a scelta multipla abbinate a 4 tasti colorati (giallo, blu, arancione, verde), presentatore virtuale con battute, due modalità di punteggio, fase a gironi + torneo ad eliminazione diretta.

Stack: **Node.js + Express + Socket.io** sul backend, **HTML/CSS/JS puro** sul frontend (nessun build step). Le domande vivono in un file JSON, niente database esterno da configurare.

## Come funziona il gioco

1. Un giocatore crea una partita scegliendo: visibilità (**chiusa** con codice a 5 caratteri, o **aperta** a chiunque), modalità, livello di difficoltà e categoria.
2. Gli altri entrano con il codice oppure scelgono la partita dalla lista di quelle **aperte**.
3. **Fase 1**: 10 domande a risposta multipla, 10 secondi a testa per rispondere.
   - **Modalità Rush**: chi risponde correttamente più veloce prende più punti (1°=3, 2°=2, 3°=1, dal 4° in poi 0), risposta sbagliata = -1.
   - **Modalità Classica**: punti fissi (2) a chiunque risponda giusto entro i 10 secondi, indipendentemente dalla velocità; sbagliare non toglie punti.
4. Finita la Fase 1, i migliori il **50% (arrotondato per eccesso, minimo 2)** dei giocatori collegati accedono al **torneo ad eliminazione diretta**. Gli altri diventano spettatori e vedono comunque lo show.
5. Nel torneo gli scontri sono 1 contro 1, al meglio di 3 domande (con spareggio in caso di parità); a ogni turno del torneo le domande diventano più difficili. Chi perde è eliminato, chi vince avanza fino alla finale.
6. Il presentatore virtuale commenta ogni domanda, ogni risposta e l'esito finale con frasi scelte a caso da un elenco.

### Alcune scelte di design (dove le regole non erano specificate nel dettaglio)

Ho dovuto decidere alcuni dettagli che non avevi specificato — sono facilmente modificabili nel codice se non ti piacciono:

- **Punti modalità Classica**: 2 punti per risposta corretta, 0 per sbagliata/nessuna risposta. Modificabile in `server/lib/GameRoom.js`, funzione `resolveQuestion`.
- **Nessuna risposta data (Rush)**: vale 0 punti, non -1 (la penalità si applica solo a una risposta sbagliata data attivamente).
- **Torneo — formato scontro**: ogni incontro è al meglio di 3 domande; in caso di parità dopo 3 domande, si continua a oltranza (spareggio) finché uno dei due non è avanti. Le domande del torneo aumentano di un livello di difficoltà a ogni turno (partendo dal livello scelto in fase di creazione partita), fino a fermarsi su "difficile".
- **Giocatori dispari nel torneo**: chi non ha un avversario nel proprio turno passa automaticamente al turno successivo ("bye"), assegnato ai giocatori con il piazzamento migliore in classifica dopo la Fase 1.
- **Codice partita**: 5 caratteri alfanumerici (senza caratteri ambigui tipo 0/O o 1/I).

## Avviare il progetto in locale

Richiede [Node.js](https://nodejs.org) 18 o superiore.

```bash
npm install
npm start
```

L'app sarà disponibile su `http://localhost:3000`. Apri più schede/browser (o dispositivi sulla stessa rete) per simulare più giocatori.

## Come metterlo online

### 1. Carica il codice su GitHub

```bash
git init
git add .
git commit -m "Prima versione di Quiz Party"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/quiz-party.git
git push -u origin main
```

(Crea prima il repository vuoto su github.com, senza README, poi usa l'URL che ti dà.)

### 2. Metti online il server (necessario per il multiplayer)

⚠️ **GitHub da solo non basta**: GitHub Pages ospita solo file statici, non può far girare un server Node.js con WebSocket. Serve un hosting che esegua codice Node — te ne consiglio uno gratuito e semplice:

**Render.com** (consigliato, supporta WebSocket nel piano gratuito):
1. Vai su [render.com](https://render.com) e crea un account (puoi collegarti con GitHub).
2. "New +" → "Web Service" → seleziona il repository appena creato.
3. Impostazioni:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Deploy. Dopo un paio di minuti avrai un URL tipo `https://quiz-party.onrender.com` da condividere con i tuoi amici.

Alternative equivalenti: **Railway.app**, **Fly.io**, oppure un piccolo VPS. Evita hosting "solo statici" (Netlify, Vercel senza funzioni serverless dedicate, GitHub Pages) perché non reggono le connessioni WebSocket persistenti di Socket.io.

⚠️ **Nota sulla persistenza delle domande aggiunte in-app**: sui piani gratuiti il filesystem può essere azzerato a ogni nuovo deploy. Le 240 domande di base restano sempre (sono nel repository), ma le domande aggiunte dagli utenti tramite l'app potrebbero non sopravvivere a un redeploy. Per una persistenza solida in futuro, il modo più semplice è collegare un vero database (es. Postgres su Render/Supabase) al posto del file JSON — è un miglioramento possibile ma non necessario per iniziare a giocare.

## Come arrivare a 2000+ domande

Il gioco parte con **240 domande** scritte a mano, divise in 10 categorie (Storia, Geografia, Scienza e Natura, Sport, Cinema e TV, Musica, Cucina, Letteratura, Arte, Tecnologia) e 3 livelli di difficoltà. Scriverne 2000 di qualità a mano non era realistico in un'unica sessione, quindi il progetto è pensato per crescere in due modi:

1. **Dall'interno del gioco**: c'è una schermata "Aggiungi una domanda" per inserirne di nuove una alla volta (utile per far contribuire tutto il gruppo di amici).
2. **In blocco via CSV**: usa lo script di importazione.

   Crea un file CSV con questa intestazione (in italiano, esattamente questi nomi colonna):

   ```csv
   categoria,difficolta,domanda,giallo,blu,arancione,verde,corretta
   Storia,facile,"In che anno è nata la Repubblica Italiana?",1946,1861,1918,1948,giallo
   ```

   - `difficolta`: `facile`, `medio` o `difficile`
   - `corretta`: il colore giusto (`giallo`/`blu`/`arancione`/`verde`) oppure l'indice 0-3

   Poi importa con:

   ```bash
   node server/scripts/importCsv.js percorso/al/tuo/file.csv
   ```

   Puoi generare il CSV come preferisci: scrivendolo a mano, esportandolo da un foglio di calcolo, oppure chiedendo a un assistente AI di generartene un lotto in questo formato da incollare in un file — in quel caso ricontrolla sempre le risposte prima di importarle.

## Struttura del progetto

```
buzz-clone/
├── package.json
├── server/
│   ├── server.js            # Express + Socket.io, gestione lobby/matchmaking
│   ├── lib/
│   │   ├── GameRoom.js      # Stato di gioco: fase 1, punteggi, torneo
│   │   ├── QuestionBank.js  # Caricamento/filtro/aggiunta domande
│   │   └── Host.js          # Battute del presentatore virtuale
│   ├── data/questions.json  # Le 240 domande di base (+ quelle aggiunte)
│   └── scripts/importCsv.js # Import in blocco da CSV
└── public/
    ├── index.html
    ├── style.css
    └── app.js                # Tutta la logica del client (schermate, socket)
```

## Idee per migliorie future

- Persistenza delle domande su un vero database invece del file JSON.
- Riconnessione automatica di un giocatore che perde la connessione a metà partita.
- Voce sintetizzata per il presentatore invece del solo testo.
- Avatar/colori personalizzabili per i giocatori.
