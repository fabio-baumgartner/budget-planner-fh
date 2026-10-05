# Budget Planner

FH-Projekt für **Einführung in Software Engineering** (FH Technikum Wien, WS 26/27).
Webbasierter Finanzplaner mit Login: Einnahmen und Ausgaben erfassen, Kategorien mit Budget, Gehalt und Fixkosten werden jeden Monat automatisch gebucht, Warnung bei Budgetüberschreitung.

- **Live:** https://budget-planner-fh.vercel.app
- **Anleitung für Nutzer:** https://budget-planner-fh.vercel.app/hilfe (Quelle: [`public/hilfe.html`](public/hilfe.html)), erklärt alle Funktionen, die Berechnungen und häufige Fragen.

## Stack

- Frontend: HTML, CSS, JavaScript (ES Modules, kein Framework, kein Build-Step), in `public/`
- Backend: Vercel Serverless Functions (Node.js) in `api/`
- Daten: privater Vercel Blob Store, ein JSON-Dokument pro User
- Hosting: Vercel, Deploy automatisch bei Push auf `main`

## Lokal starten

```bash
npm install
vercel env pull .env.local   # Blob-Token und SESSION_SECRET (optional)
npm run dev:local            # http://localhost:3000
```

Ohne `.env.local` speichert der Dev-Server in `.data/` (nur Testdaten, nicht im Repo).
Mit Vercel-Login geht auch `npm run dev` (`vercel dev`).

## Tests

```bash
npm test
```

Testet die Rechenlogik in `public/js/calc.js` (Monatsauswertung, Übertrag, automatische Buchungen, Prognose, Verlauf, Budgetwarnung, CSV-Export).

## Algorithmen

Alle Berechnungen sind reine Funktionen in `public/js/calc.js`, ohne Zugriff auf Browser oder Server, und deshalb einzeln testbar.

**1. Automatische Buchungen (`applyRecurring`)**
Gehalt und Fixkosten werden am 1. jedes Monats genau einmal gebucht. Jeder Eintrag merkt sich den zuletzt gebuchten Monat (`lastBooked`). Beim Öffnen der App werden alle Monate seit dem letzten Stand nachgebucht. Dadurch braucht es keinen Server-Cron-Job, mehrfaches Öffnen erzeugt keine Duplikate, und pausierte Einträge überspringen ihre Monate.

**2. Kontostand mit Übertrag (`monthSummary`, `carryIn`)**
`verfügbar = Übertrag + Einnahmen − Ausgaben` des Monats. Der Übertrag ist die Summe aus (Einnahmen − Ausgaben) aller früheren Monate, also der Kontostand am Monatsanfang, auch negativ. Im Profil abschaltbar.

**3. Prognose Monatsende (`forecastMonth`)**
Für den laufenden Monat:
1. Ausgaben aufteilen in *fix* (automatische und geplante Buchungen) und *variabel* (bisherige übrige Ausgaben).
2. Variable Ausgaben pro Tag hochrechnen: `variabel / vergangene Tage × Tage im Monat`.
3. Mit dem Durchschnitt der variablen Ausgaben der letzten bis zu 3 Monate glätten. Gewicht `w = vergangene Tage / Tage im Monat`, also `prognose = w × Hochrechnung + (1 − w) × Durchschnitt`. Am Monatsanfang zählt die Erfahrung, gegen Monatsende das aktuelle Tempo.
4. Prognose = fix + variabel (nie weniger als bisher ausgegeben), verglichen mit dem Budget-Limit: *im Plan*, *knapp* (ab Warnschwelle) oder *über Budget*. Dazu wird angezeigt, wie viel pro Tag noch ausgegeben werden kann.

**4. Verlauf (`history`)**
Einnahmen und Ausgaben der letzten 6 Monate inklusive leerer Monate, Durchschnittswerte über Monate mit Buchungen und die Sparquote `(Einnahmen − Ausgaben) / Einnahmen`.

## Requirements-Abdeckung

| Requirement | Umsetzung |
|---|---|
| FR-01 Einnahmen/Ausgaben speichern | Dialog "Buchung hinzufügen", `PUT /api/data` |
| FR-02 Kategorien erstellen | Dashboard, "Neue Kategorie" (eindeutiger Name) |
| FR-03 Ausgabe reduziert Budget | `monthSummary()`: verfügbar = Übertrag + Einnahmen − Ausgaben |
| FR-04 Monatsbudget festlegen | Profil, "Anpassen" (pro Monat, sonst Summe der Kategorie-Budgets) |
| FR-05 Monatliches Gehalt | Finance Manager, "Gehalt" |
| FR-06 Fixkosten erfassen/ändern/löschen | Finance Manager, "Fixkosten" |
| FR-07/08 Automatische Buchung am 1. | `applyRecurring()` |
| FR-09 Benachrichtigung bei Überschreitung | Toast + rotes Theme, `shouldNotifyOverBudget()` |

## Architektur (3 Schichten)

Der Code ist in drei Teile gegliedert: User Interface, Backend und Datenbank.

```
🖥️ USER INTERFACE  (was man sieht, läuft im Browser)
   public/                 alle Seiten, Design und Browser-Code

⚙️ BACKEND  (Logik am Server, Vercel Serverless Functions)
   api/                    Login, Registrierung, Daten laden/speichern
                           (außer storage.js und defaults.js)

🗄️ DATENBANK  (Datenzugriff und Datenmodell)
   api/_lib/storage.js     liest und schreibt die Daten
   api/_lib/defaults.js    so sieht ein neues User-Dokument aus
```

**Ablauf:** Browser (`public/`) → Server (`api/`) → Speicher (`storage.js` → Vercel Blob)

| Schicht | Dateien |
|---|---|
| User Interface | `public/*.html`, `public/css/`, `public/js/` (app, ui, views, modals, auth, store, format, icons, calc, api) |
| Backend | `api/auth/*` (register, login, logout, me), `api/data.js`, `api/_lib/` (session, password, validate, http) |
| Datenbank | `api/_lib/storage.js`, `api/_lib/defaults.js` |

Zwei Sonderfälle:
- `public/js/calc.js` enthält die Rechenlogik, läuft aber im Browser.
- `public/js/api.js` gehört zum User Interface und ist nur die Verbindung zum Backend.

Der Ordner `api/` muss für Vercel so heißen, deshalb gibt es keinen eigenen Ordner `backend/`.

### Wo werden die Daten gespeichert?

- **Live:** im privaten **Vercel Blob Store**. Das ist ein Cloud-Speicher für Dateien, keine SQL-Datenbank. Jeder User hat dort ein eigenes JSON-Dokument:
  - `users/<userId>/data.json`: Profil, Einstellungen, Kategorien, Gehalt und Fixkosten, Buchungen
  - `users/by-email/<Hash der E-Mail>.json`: Login-Daten (userId, E-Mail, Salt, Passwort-Hash, nie das Passwort selbst)
- **Lokal beim Entwickeln** (ohne Blob-Token): Ordner `.data/` im Projekt, nicht im Repo.
- **Im Browser:** keine Daten dauerhaft gespeichert, nur das Login-Cookie `bp_session` (7 Tage gültig).

### Weitere Ordner

```
scripts/        lokaler Dev-Server
tests/          Unit-Tests (node:test)
```
