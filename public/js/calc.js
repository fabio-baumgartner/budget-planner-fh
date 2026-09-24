// Rechenlogik des Budget Planners. Reine Funktionen ohne DOM und ohne Seiteneffekte,
// damit sie im Browser und in den Tests (node --test) gleich laufen.

// ---------- Monate und Datum ----------

export function monthOf(isoDate) {
  return isoDate.slice(0, 7);
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Verbleibende Tage inkl. heute. Vergangene Monate: 0, zukünftige: alle Tage.
export function daysLeft(month, todayIso) {
  const current = monthOf(todayIso);
  if (month < current) return 0;
  if (month > current) return daysInMonth(month);
  return daysInMonth(month) - Number(todayIso.slice(8, 10)) + 1;
}

// ---------- FR-07 / FR-08: wiederkehrende Buchungen ----------

// Bucht Gehalt (Einnahme) und Fixkosten (Ausgabe) genau einmal pro Monat am 1.
// Jeder Eintrag merkt sich in lastBooked den zuletzt verarbeiteten Monat. Dadurch:
// - mehrfacher Aufruf erzeugt keine Duplikate (idempotent)
// - verpasste Monate (App länger nicht geöffnet) werden nachgebucht
// - pausierte Einträge (active: false) überspringen ihre Monate
// - eine manuell gelöschte Auto-Buchung kommt nicht zurück
export function applyRecurring(doc, todayIso, newId) {
  const current = monthOf(todayIso);
  const created = [];
  const recurring = doc.recurring.map((entry) => {
    let month = entry.lastBooked ? addMonths(entry.lastBooked, 1) : entry.startMonth;
    let lastBooked = entry.lastBooked;
    while (month <= current) {
      if (entry.active) {
        created.push({
          id: newId(),
          type: entry.kind === 'salary' ? 'income' : 'expense',
          amount: entry.amount,
          categoryId: entry.kind === 'salary' ? null : entry.categoryId,
          note: entry.title,
          date: `${month}-01`,
          recurringId: entry.id,
        });
      }
      lastBooked = month;
      month = addMonths(month, 1);
    }
    return lastBooked === entry.lastBooked ? entry : { ...entry, lastBooked };
  });
  if (!created.length && recurring.every((r, i) => r === doc.recurring[i])) return { doc, created };
  return { doc: { ...doc, recurring, transactions: [...created, ...doc.transactions] }, created };
}

// ---------- Monatsauswertung (Kontostand-Modell) ----------

export function categoryBudgetTotal(doc) {
  return doc.categories.reduce((sum, c) => sum + c.budget, 0);
}

// FR-04: Monatsbudget ist ein Override pro Monat, sonst die Summe der Kategorie-Budgets.
export function budgetLimit(doc, month) {
  return doc.budgetOverrides[month] ?? categoryBudgetTotal(doc);
}

export function transactionsOfMonth(doc, month) {
  return doc.transactions
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

// Einnahmen und Ausgaben je Monat: { '2026-09': { income, expenses, variable } }.
// variable = Ausgaben ohne automatische Buchungen (für die Prognose).
export function monthlyTotals(doc) {
  const totals = {};
  for (const t of doc.transactions) {
    const m = monthOf(t.date);
    const entry = (totals[m] ||= { income: 0, expenses: 0, variable: 0 });
    if (t.type === 'income') {
      entry.income += t.amount;
    } else {
      entry.expenses += t.amount;
      if (!t.recurringId) entry.variable += t.amount;
    }
  }
  for (const entry of Object.values(totals)) {
    entry.income = round(entry.income);
    entry.expenses = round(entry.expenses);
    entry.variable = round(entry.variable);
  }
  return totals;
}

// Übertrag: Summe aus (Einnahmen − Ausgaben) aller Monate vor dem gewählten Monat,
// also der Kontostand am Monatsanfang. Kann auch negativ sein.
export function carryIn(doc, month, totals = monthlyTotals(doc)) {
  if (doc.settings.carryOver === false) return 0;
  let sum = 0;
  for (const [m, t] of Object.entries(totals)) {
    if (m < month) sum += t.income - t.expenses;
  }
  return round(sum);
}

export function monthSummary(doc, month) {
  let income = 0;
  let expenses = 0;
  const spentByCategory = {};
  for (const t of transactionsOfMonth(doc, month)) {
    if (t.type === 'income') {
      income += t.amount;
    } else {
      expenses += t.amount;
      const key = t.categoryId ?? 'none';
      spentByCategory[key] = (spentByCategory[key] || 0) + t.amount;
    }
  }
  income = round(income);
  expenses = round(expenses);
  const carry = carryIn(doc, month);
  const limit = budgetLimit(doc, month);
  const available = round(carry + income - expenses); // FR-03, FR-07, FR-08, plus Übertrag
  const overBudget = limit > 0 && expenses > limit; // FR-09
  const negative = available < 0;
  const ratio = limit > 0 ? expenses / limit : 0;
  const status = overBudget || negative ? 'over' : ratio >= doc.settings.warnAt ? 'warn' : 'ok';
  return { month, carryIn: carry, income, expenses, available, limit, ratio, overBudget, negative, status, spentByCategory };
}

// ---------- Prognose Monatsende ----------

const HISTORY_MONTHS = 3;

// Hochrechnung der Ausgaben bis Monatsende, nur für den laufenden Monat (sonst null).
// 1. Ausgaben teilen: fix (automatische und geplante Buchungen) und variabel (bis heute)
// 2. variable Ausgaben pro Tag hochrechnen
// 3. mit dem Durchschnitt der letzten Monate glätten, Gewicht = Anteil der vergangenen Tage
export function forecastMonth(doc, month, todayIso) {
  if (month !== monthOf(todayIso)) return null;

  const days = daysInMonth(month);
  const elapsed = Number(todayIso.slice(8, 10));
  let fixed = 0;
  let variable = 0;
  for (const t of transactionsOfMonth(doc, month)) {
    if (t.type !== 'expense') continue;
    if (t.recurringId || t.date > todayIso) fixed += t.amount;
    else variable += t.amount;
  }

  const extrapolated = (variable / elapsed) * days;

  // Durchschnitt der variablen Ausgaben der letzten bis zu 3 Monate, die Buchungen haben.
  const totals = monthlyTotals(doc);
  const previous = [];
  for (let i = 1; i <= HISTORY_MONTHS; i++) {
    const t = totals[addMonths(month, -i)];
    if (t) previous.push(t.variable);
  }
  const historyAverage = previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : null;

  const weight = elapsed / days;
  const blended = historyAverage === null ? extrapolated : weight * extrapolated + (1 - weight) * historyAverage;
  // Was schon ausgegeben ist, kann nicht mehr weniger werden.
  const variableForecast = Math.max(blended, variable);

  const summary = monthSummary(doc, month);
  const projectedExpenses = round(fixed + variableForecast);
  const limit = summary.limit;
  const daysRemaining = days - elapsed + 1;
  const status =
    limit > 0 && projectedExpenses > limit ? 'over' : limit > 0 && projectedExpenses >= limit * doc.settings.warnAt ? 'tight' : 'ok';

  return {
    month,
    endDate: `${month}-${String(days).padStart(2, '0')}`,
    daysElapsed: elapsed,
    daysRemaining,
    historyMonths: previous.length,
    fixed: round(fixed),
    variableSoFar: round(variable),
    variableForecast: round(variableForecast),
    projectedExpenses,
    projectedAvailable: round(summary.carryIn + summary.income - projectedExpenses),
    limit,
    difference: round(projectedExpenses - limit),
    // So viel darf ab heute pro Tag noch ausgegeben werden, um im Budget zu bleiben.
    dailyAllowance: round(Math.max(limit - summary.expenses, 0) / daysRemaining),
    status,
  };
}

// ---------- Verlauf ----------

// Die letzten count Monate bis endMonth (inklusive), auch Monate ohne Buchungen.
export function history(doc, endMonth, count = 6) {
  const totals = monthlyTotals(doc);
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(endMonth, -i);
    const t = totals[month] || { income: 0, expenses: 0 };
    const limit = budgetLimit(doc, month);
    months.push({ month, income: t.income, expenses: t.expenses, limit, over: limit > 0 && t.expenses > limit, hasData: Boolean(totals[month]) });
  }
  const withData = months.filter((m) => m.hasData);
  const incomeSum = withData.reduce((s, m) => s + m.income, 0);
  const expenseSum = withData.reduce((s, m) => s + m.expenses, 0);
  return {
    months,
    avgIncome: withData.length ? round(incomeSum / withData.length) : 0,
    avgExpenses: withData.length ? round(expenseSum / withData.length) : 0,
    // Sparquote: Anteil der Einnahmen, der übrig bleibt. Ohne Einnahmen nicht definiert.
    savingsRate: incomeSum > 0 ? (incomeSum - expenseSum) / incomeSum : null,
  };
}

// Karten im Dashboard: Fortschritt und Zustand je Kategorie.
export function categoryRows(doc, summary) {
  return doc.categories.map((c) => {
    const spent = round(summary.spentByCategory[c.id] || 0);
    const rest = round(c.budget - spent);
    const ratio = c.budget > 0 ? spent / c.budget : spent > 0 ? Infinity : 0;
    const state = rest < 0 ? 'over' : ratio >= doc.settings.warnAt ? 'warn' : 'ok';
    return { ...c, spent, rest, pct: Math.min(Math.round(ratio * 100), 100), state };
  });
}

// Legende: Anteil jeder Kategorie an allen Ausgaben des Monats.
export function legendRows(doc, summary) {
  return doc.categories.map((c) => {
    const spent = round(summary.spentByCategory[c.id] || 0);
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      spent,
      pct: summary.expenses ? Math.round((spent / summary.expenses) * 100) : 0,
    };
  });
}

// Donut: pro Kategorie ein heller Bogen (Budget) und darüber ein voller Bogen (ausgegeben, max. Budget).
// Übernommen aus renderVals() im UI-Design-Export.
export function donutArcs(doc, summary, radius = 88, gap = 3) {
  const circumference = 2 * Math.PI * radius;
  const total = categoryBudgetTotal(doc);
  if (total <= 0) return [];
  const arcs = [];
  let position = 0;
  for (const c of doc.categories) {
    const budgetLength = (c.budget / total) * circumference - gap;
    const spentLength = (Math.min(summary.spentByCategory[c.id] || 0, c.budget) / total) * circumference - gap;
    if (budgetLength > 0) arcs.push({ color: c.color, opacity: 0.22, length: budgetLength, offset: -position });
    if (spentLength > 0) arcs.push({ color: c.color, opacity: 1, length: spentLength, offset: -position });
    position += Math.max(budgetLength, 0) + gap;
  }
  return arcs.map((a) => ({ ...a, dash: `${a.length} ${circumference - a.length}` }));
}

// FR-09: Benachrichtigung nur beim ersten Überschreiten im Monat.
export function shouldNotifyOverBudget(before, after, doc) {
  return !before.overBudget && after.overBudget && !doc.overBudgetNotified[after.month];
}

// ---------- Export ----------

export function transactionsToCsv(doc) {
  const names = Object.fromEntries(doc.categories.map((c) => [c.id, c.name]));
  const rows = [['Datum', 'Typ', 'Kategorie', 'Notiz', 'Betrag', 'Automatisch']];
  const sorted = [...doc.transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const t of sorted) {
    rows.push([
      t.date,
      t.type === 'income' ? 'Einnahme' : 'Ausgabe',
      t.type === 'income' ? '' : names[t.categoryId] || 'Ohne Kategorie',
      t.note,
      (t.type === 'income' ? t.amount : -t.amount).toFixed(2),
      t.recurringId ? 'ja' : 'nein',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

function csvCell(value) {
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function round(n) {
  return Math.round(n * 100) / 100;
}
