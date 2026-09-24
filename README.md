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

Testet die Rechenlogik in `public/js/calc.js` (Monatsauswertung, automatische Buchungen, Budgetwarnung, CSV-Export).

## Requirements-Abdeckung

| Requirement | Umsetzung |
|---|---|
| FR-01 Einnahmen/Ausgaben speichern | Dialog "Buchung hinzufügen", `PUT /api/data` |
| FR-02 Kategorien erstellen | Dashboard, "Neue Kategorie" (eindeutiger Name) |
| FR-03 Ausgabe reduziert Budget | `monthSummary()`: verfügbar = Einnahmen − Ausgaben |
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
