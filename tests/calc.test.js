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
} from '../public/js/calc.js';

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
  assert.equal(s.available, 1479.5);
  assert.equal(s.limit, 1400);
  assert.equal(s.status, 'ok');
  assert.equal(s.spentByCategory.essen, 120.5);
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
