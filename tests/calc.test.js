import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  daysLeft,
  applyRecurring,
  monthSummary,
  categoryRows,
  donutArcs,
  shouldNotifyOverBudget,
  transactionsToCsv,
  carryIn,
  forecastMonth,
  history,
} from '../public/js/calc.js';

const income = (id, amount, date) => ({ id, type: 'income', amount, categoryId: null, note: '', date, recurringId: null });
const expense = (id, amount, date, extra = {}) => ({ id, type: 'expense', amount, categoryId: 'essen', note: '', date, recurringId: null, ...extra });

let counter = 0;
const newId = () => `id-${++counter}`;

function makeDoc(overrides = {}) {
  return {
    version: 1,
    profile: { name: 'Test', email: 't@example.com', createdAt: '2026-09-01' },
    settings: { currency: 'EUR', warnAt: 0.9 },
    budgetOverrides: {},
    overBudgetNotified: {},
    categories: [
      { id: 'wohnen', name: 'Wohnen', color: '#2E7CF6', budget: 1000 },
      { id: 'essen', name: 'Essen', color: '#26C839', budget: 400 },
    ],
    recurring: [],
    transactions: [],
    ...overrides,
  };
}

const salary = { id: 'r-gehalt', kind: 'salary', title: 'Gehalt', amount: 2500, categoryId: null, active: true, startMonth: '2026-07', lastBooked: null };
const rent = { id: 'r-miete', kind: 'fixed', title: 'Miete', amount: 900, categoryId: 'wohnen', active: true, startMonth: '2026-07', lastBooked: null };

test('addMonths über Jahresgrenzen', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-09', 15), '2027-12');
});

test('daysLeft zählt heute mit', () => {
  assert.equal(daysLeft('2026-09', '2026-09-24'), 7);
  assert.equal(daysLeft('2026-08', '2026-09-24'), 0);
  assert.equal(daysLeft('2026-10', '2026-09-24'), 31);
});

test('applyRecurring bucht über 3 Monate genau einmal pro Monat', () => {
  const doc = makeDoc({ recurring: [salary, rent] });
  const { doc: after, created } = applyRecurring(doc, '2026-09-24', newId);
  assert.equal(created.length, 6);
  for (const month of ['2026-07', '2026-08', '2026-09']) {
    const inMonth = after.transactions.filter((t) => t.date === `${month}-01`);
    assert.equal(inMonth.length, 2);
    assert.ok(inMonth.some((t) => t.type === 'income' && t.amount === 2500));
    assert.ok(inMonth.some((t) => t.type === 'expense' && t.amount === 900 && t.categoryId === 'wohnen'));
  }
  assert.ok(after.recurring.every((r) => r.lastBooked === '2026-09'));
});

test('applyRecurring ist idempotent', () => {
  const first = applyRecurring(makeDoc({ recurring: [salary, rent] }), '2026-09-24', newId).doc;
  const second = applyRecurring(first, '2026-09-30', newId);
  assert.equal(second.created.length, 0);
  assert.equal(second.doc, first);
});

test('applyRecurring holt einen neuen Monat nach', () => {
  const first = applyRecurring(makeDoc({ recurring: [salary] }), '2026-09-24', newId).doc;
  const { created } = applyRecurring(first, '2026-10-02', newId);
  assert.equal(created.length, 1);
  assert.equal(created[0].date, '2026-10-01');
});

test('pausierte Einträge buchen nicht und holen später nicht nach', () => {
  const paused = { ...rent, active: false };
  const { doc, created } = applyRecurring(makeDoc({ recurring: [paused] }), '2026-09-24', newId);
  assert.equal(created.length, 0);
  assert.equal(doc.recurring[0].lastBooked, '2026-09');
  const resumed = { ...doc, recurring: [{ ...doc.recurring[0], active: true }] };
  assert.equal(applyRecurring(resumed, '2026-09-28', newId).created.length, 0);
  assert.equal(applyRecurring(resumed, '2026-10-01', newId).created.length, 1);
});

test('monthSummary: Kontostand-Modell', () => {
  const doc = makeDoc({
    transactions: [
      { id: 'a', type: 'income', amount: 2500, categoryId: null, note: '', date: '2026-09-01', recurringId: null },
      { id: 'b', type: 'expense', amount: 900, categoryId: 'wohnen', note: '', date: '2026-09-01', recurringId: null },
      { id: 'c', type: 'expense', amount: 120.5, categoryId: 'essen', note: '', date: '2026-09-10', recurringId: null },
      { id: 'd', type: 'expense', amount: 999, categoryId: 'essen', note: '', date: '2026-08-10', recurringId: null },
    ],
  });
  const s = monthSummary(doc, '2026-09');
  assert.equal(s.income, 2500);
  assert.equal(s.expenses, 1020.5);
  // Die August-Ausgabe von 999 wandert als negativer Übertrag in den September.
  assert.equal(s.carryIn, -999);
  assert.equal(s.available, 480.5);
  assert.equal(s.limit, 1400);
  assert.equal(s.status, 'ok');
  assert.equal(s.spentByCategory.essen, 120.5);
  // Ohne Übertrag zählt nur der Monat selbst.
  const alone = monthSummary({ ...doc, settings: { ...doc.settings, carryOver: false } }, '2026-09');
  assert.equal(alone.carryIn, 0);
  assert.equal(alone.available, 1479.5);
});

test('Budget-Override gilt nur für seinen Monat', () => {
  const doc = makeDoc({ budgetOverrides: { '2026-09': 3000 } });
  assert.equal(monthSummary(doc, '2026-09').limit, 3000);
  assert.equal(monthSummary(doc, '2026-10').limit, 1400);
});

test('Status: genau am Limit ist nicht drüber, aber Warnung', () => {
  const tx = (amount) => ({ id: 'x', type: 'expense', amount, categoryId: 'essen', note: '', date: '2026-09-05', recurringId: null });
  const income = { id: 'i', type: 'income', amount: 5000, categoryId: null, note: '', date: '2026-09-01', recurringId: null };
  assert.equal(monthSummary(makeDoc({ transactions: [income, tx(1400)] }), '2026-09').status, 'warn');
  assert.equal(monthSummary(makeDoc({ transactions: [income, tx(1400)] }), '2026-09').overBudget, false);
  assert.equal(monthSummary(makeDoc({ transactions: [income, tx(1400.01)] }), '2026-09').overBudget, true);
  assert.equal(monthSummary(makeDoc({ transactions: [income, tx(1000)] }), '2026-09').status, 'ok');
});

test('Status over, wenn verfügbar negativ ist', () => {
  const doc = makeDoc({
    transactions: [{ id: 'x', type: 'expense', amount: 50, categoryId: 'essen', note: '', date: '2026-09-05', recurringId: null }],
  });
  const s = monthSummary(doc, '2026-09');
  assert.equal(s.negative, true);
  assert.equal(s.status, 'over');
});

test('shouldNotifyOverBudget nur beim ersten Überschreiten', () => {
  const doc = makeDoc();
  const under = { month: '2026-09', overBudget: false };
  const over = { month: '2026-09', overBudget: true };
  assert.equal(shouldNotifyOverBudget(under, over, doc), true);
  assert.equal(shouldNotifyOverBudget(over, over, doc), false);
  assert.equal(shouldNotifyOverBudget(under, over, { ...doc, overBudgetNotified: { '2026-09': true } }), false);
});

test('categoryRows: übrig, Warnung, drüber', () => {
  const doc = makeDoc();
  const rows = categoryRows(doc, { spentByCategory: { wohnen: 950, essen: 450 } });
  assert.deepEqual(rows.map((r) => [r.state, r.rest, r.pct]), [['warn', 50, 95], ['over', -50, 100]]);
});

test('donutArcs: je Kategorie Budget- und Ausgabenbogen', () => {
  const doc = makeDoc();
  const arcs = donutArcs(doc, { spentByCategory: { essen: 100 } });
  assert.equal(arcs.length, 3);
  assert.deepEqual(arcs.map((a) => a.opacity), [0.22, 0.22, 1]);
  assert.equal(donutArcs(makeDoc({ categories: [] }), { spentByCategory: {} }).length, 0);
});

test('CSV-Export mit Semikolon und Escaping', () => {
  const doc = makeDoc({
    transactions: [{ id: 'x', type: 'expense', amount: 9.5, categoryId: 'essen', note: 'Pizza; groß', date: '2026-09-05', recurringId: null }],
  });
  const lines = transactionsToCsv(doc).split('\r\n');
  assert.equal(lines[0], 'Datum;Typ;Kategorie;Notiz;Betrag;Automatisch');
  assert.equal(lines[1], '2026-09-05;Ausgabe;Essen;"Pizza; groß";-9.50;nein');
});

// ---------- Übertrag ----------

test('Übertrag: positiv und negativ über mehrere Monate, auch über leere Monate', () => {
  const doc = makeDoc({
    transactions: [
      income('a', 2000, '2026-06-01'),
      expense('b', 1500, '2026-06-10'), // Juni: +500
      expense('c', 800, '2026-07-05'), // Juli: -800 -> Stand -300
      // August leer
      income('d', 1000, '2026-09-01'),
    ],
  });
  assert.equal(carryIn(doc, '2026-06'), 0);
  assert.equal(carryIn(doc, '2026-07'), 500);
  assert.equal(carryIn(doc, '2026-08'), -300);
  assert.equal(carryIn(doc, '2026-09'), -300);
  assert.equal(monthSummary(doc, '2026-09').available, 700);
  // Zukünftiger Monat übernimmt den Stand bis dahin.
  assert.equal(carryIn(doc, '2026-12'), 700);
});

test('Übertrag ausgeschaltet', () => {
  const doc = makeDoc({ settings: { currency: 'EUR', warnAt: 0.9, carryOver: false }, transactions: [income('a', 500, '2026-08-01')] });
  assert.equal(carryIn(doc, '2026-09'), 0);
});

test('Negativer Übertrag färbt den neuen Monat rot', () => {
  const doc = makeDoc({ transactions: [expense('a', 100, '2026-08-03'), income('b', 50, '2026-09-01')] });
  const s = monthSummary(doc, '2026-09');
  assert.equal(s.available, -50);
  assert.equal(s.status, 'over');
  assert.equal(s.overBudget, false);
});

// ---------- Prognose ----------

test('Prognose nur für den laufenden Monat', () => {
  const doc = makeDoc();
  assert.equal(forecastMonth(doc, '2026-08', '2026-09-15'), null);
  assert.equal(forecastMonth(doc, '2026-10', '2026-09-15'), null);
});

test('Prognose ohne Historie: reine Hochrechnung', () => {
  // 300 variabel in 10 Tagen -> 30 pro Tag -> 900 im September (30 Tage)
  const doc = makeDoc({ transactions: [expense('a', 300, '2026-09-05')] });
  const f = forecastMonth(doc, '2026-09', '2026-09-10');
  assert.equal(f.historyMonths, 0);
  assert.equal(f.variableForecast, 900);
  assert.equal(f.projectedExpenses, 900);
  assert.equal(f.status, 'ok'); // Limit 1400, Warnung ab 1260
  assert.equal(f.endDate, '2026-09-30');
});

test('Prognose: fixe und geplante Buchungen werden nicht hochgerechnet', () => {
  const doc = makeDoc({
    transactions: [
      expense('miete', 900, '2026-09-01', { recurringId: 'r1', categoryId: 'wohnen' }),
      expense('geplant', 100, '2026-09-25'),
      expense('a', 150, '2026-09-04'),
    ],
  });
  const f = forecastMonth(doc, '2026-09', '2026-09-10');
  assert.equal(f.fixed, 1000);
  assert.equal(f.variableSoFar, 150);
  assert.equal(f.projectedExpenses, 1450); // 1000 + 150/10*30
  assert.equal(f.status, 'over');
  assert.equal(f.difference, 50);
  // Noch 250 bis zum Limit (1400 - 900 - 100 geplant - 150), 21 Tage inkl. heute
  assert.equal(f.dailyAllowance, 11.9);
});

test('Prognose: Glättung mit dem Durchschnitt der Vormonate', () => {
  // Historie: Juli 600, August 600 variabel. Heute Tag 6 von 30 mit 300 variabel -> Hochrechnung 1500.
  // Gewicht 6/30 = 0.2 -> 0.2 * 1500 + 0.8 * 600 = 780
  const doc = makeDoc({
    transactions: [expense('j', 600, '2026-07-10'), expense('a', 600, '2026-08-10'), expense('s', 300, '2026-09-03')],
  });
  const f = forecastMonth(doc, '2026-09', '2026-09-06');
  assert.equal(f.historyMonths, 2);
  assert.equal(f.variableForecast, 780);
});

test('Prognose fällt nie unter die bisherigen Ausgaben', () => {
  const doc = makeDoc({ transactions: [expense('a', 2000, '2026-08-10'), expense('s', 500, '2026-09-28')] });
  // Hohe Hochrechnung wird nicht unterschritten; auch an Tag 1 ohne Ausgaben kein Fehler.
  const f = forecastMonth(doc, '2026-09', '2026-09-29');
  assert.ok(f.projectedExpenses >= 500);
  const day1 = forecastMonth(makeDoc(), '2026-09', '2026-09-01');
  assert.equal(day1.projectedExpenses, 0);
  assert.equal(day1.daysRemaining, 30);
});

// ---------- Verlauf ----------

test('Verlauf: 6 Monate inkl. leerer Monate und Jahreswechsel', () => {
  const doc = makeDoc({ transactions: [income('a', 1000, '2026-11-01'), expense('b', 400, '2026-11-05'), expense('c', 1500, '2027-01-03')] });
  const h = history(doc, '2027-02');
  assert.deepEqual(h.months.map((m) => m.month), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(h.months.map((m) => m.expenses), [0, 0, 400, 0, 1500, 0]);
  assert.equal(h.months[4].over, true); // 1500 > 1400
  assert.equal(h.avgExpenses, 950); // Ø nur über Monate mit Buchungen
  assert.equal(h.avgIncome, 500);
  assert.equal(h.savingsRate, -0.9); // (1000 - 1900) / 1000
});

test('Verlauf: Sparquote ohne Einnahmen ist nicht definiert', () => {
  assert.equal(history(makeDoc({ transactions: [expense('a', 10, '2026-09-01')] }), '2026-09').savingsRate, null);
});
