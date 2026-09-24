# Budget Planner

FH-Projekt für **Einführung in Software Engineering** (FH Technikum Wien, WS 26/27).
Webbasierter Finanzplaner mit Login: Einnahmen und Ausgaben erfassen, Kategorien mit Budget, Gehalt und Fixkosten werden jeden Monat automatisch gebucht, Warnung bei Budgetüberschreitung.

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

## Struktur

```
api/            Serverless Functions (auth/*, data.js) und _lib/ (Storage, Session, Validierung)
public/         index.html (App), login.html, css/, js/ (calc, store, views, modals)
scripts/        lokaler Dev-Server
tests/          Unit-Tests (node:test)
```
