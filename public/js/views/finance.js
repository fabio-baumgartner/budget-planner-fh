// Finance Manager (#finance): Kennzahlen des Monats, Liste aller Buchungen mit Filter,
// dazu Gehalt und Fixkosten (wiederkehrende Buchungen, FR-05 bis FR-08).
import { transactionsOfMonth, round } from '../calc.js';
import { esc, money, moneyWithSymbol, signedMoney, monthLabel, dateLabel } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryIcon, categoryMap, displayCategory, swatch, NO_CATEGORY, INCOME_COLOR } from './shared.js';

// Filter-Chips als [Wert, Beschriftung]. Der Wert landet in ui.filter (app.js).
const FILTERS = [
  ['all', 'Alle'],
  ['expense', 'Ausgaben'],
  ['income', 'Einnahmen'],
];

// Rendert die Ansicht als HTML-String: Kopf, vier Kennzahl-Kacheln (KPIs), Buchungen, Gehalt und Fixkosten.
export function renderFinance({ doc, month, currentMonth, summary, filter }) {
  const cur = doc.settings.currency;
  return `
    <div class="page">
      ${pageHead({ eyebrow: monthLabel(month), title: 'Finance', accent: 'Manager', month, currentMonth, actions: true })}
      <div class="kpis">
        <div class="kpi" style="--c:var(--mint)"><small>Einnahmen</small><strong>+${money(summary.income, cur, 2)}</strong></div>
        <div class="kpi" style="--c:${summary.overBudget ? 'var(--red)' : 'var(--lilac)'}"><small>Ausgaben</small><strong>−${money(summary.expenses, cur, 2)}</strong></div>
        <div class="kpi" style="--c:${summary.negative ? 'var(--red)' : 'var(--surface)'}"><small>Verfügbar</small><strong>${summary.negative ? '−' : ''}${money(summary.available, cur, 2)}</strong>
          ${summary.carryIn !== 0 ? `<small class="kpi-sub">inkl. Übertrag ${summary.carryIn < 0 ? '−' : '+'}${money(summary.carryIn, cur, 2)}</small>` : ''}</div>
        <div class="kpi" style="--c:var(--sky)"><small>Budget-Limit</small><strong>${money(summary.limit, cur, 2)}</strong></div>
      </div>
      <div class="finance">
        ${transactions(doc, month, filter, cur)}
        ${recurring(doc, cur)}
      </div>
    </div>`;
}

// Buchungsliste des Monats, gefiltert nach Typ. Klick auf eine Zeile öffnet die Buchung zum Bearbeiten.
// Automatisch gebuchte Einträge (mit recurringId) bekommen das Badge "Auto".
function transactions(doc, month, filter, cur) {
  const cats = categoryMap(doc);
  const all = transactionsOfMonth(doc, month);
  const list = all.filter((t) => filter === 'all' || t.type === filter);
  const rows = list
    .map((t) => {
      const cat = displayCategory(t, cats);
      const title = t.note || cat.name;
      return `
        <button type="button" class="tx-row" data-action="edit-tx" data-id="${t.id}" aria-label="Buchung ${esc(title)} bearbeiten">
          <span class="tx-title">
            ${categoryIcon(title, cat.color)}
            <span class="tx-title-text">
              <span>${esc(title)}${t.recurringId ? '<span class="badge">Auto</span>' : ''}</span>
              <span class="tx-sub">${esc(cat.name)} · ${esc(dateLabel(t.date))}</span>
            </span>
          </span>
          <span class="tx-cat">${swatch(cat.color)}<span>${esc(cat.name)}</span></span>
          <span class="tx-date">${esc(dateLabel(t.date))}</span>
          <span class="amt ${t.type === 'income' ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur)}</span>
        </button>`;
    })
    .join('');

  // Leertext unterscheidet: Monat ganz leer oder nur der Filter passt nicht.
  const emptyText = all.length
    ? 'Keine Buchungen für diesen Filter.'
    : 'Keine Buchungen in diesem Monat. Über „Einnahme“ und „Ausgabe“ fügst du welche hinzu.';

  // HTML: Filter-Chips mit Anzahl, Tabellenkopf, Zeilen oder Leertext.
  return `
    <section class="section" aria-label="Buchungen">
      <div class="section-head">
        <div class="chips" role="group" aria-label="Filter">
          ${FILTERS.map(
            ([key, label]) =>
              `<button type="button" class="chip press ${filter === key ? 'active' : ''}" data-action="filter" data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`,
          ).join('')}
        </div>
        <span class="count">${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'}</span>
      </div>
      <div class="table-card">
        <div class="tx-head" aria-hidden="true"><span>Bezeichnung</span><span>Kategorie</span><span>Datum</span><span style="text-align:right">Betrag</span></div>
        ${rows || `<p class="empty">${emptyText}</p>`}
      </div>
    </section>`;
}

// Gehalt und Fixkosten: Gehälter zuerst, sonst alphabetisch.
// Die Summen zählen nur aktive Einträge, pausierte werden zwar angezeigt, aber nicht mitgerechnet.
function recurring(doc, cur) {
  const cats = categoryMap(doc);
  const sorted = [...doc.recurring].sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'salary' ? -1 : 1));
  const active = doc.recurring.filter((r) => r.active);
  const incomeTotal = round(active.filter((r) => r.kind === 'salary').reduce((s, r) => s + r.amount, 0));
  const fixedTotal = round(active.filter((r) => r.kind === 'fixed').reduce((s, r) => s + r.amount, 0));

  const rows = sorted
    .map((r) => {
      const isSalary = r.kind === 'salary';
      const cat = isSalary ? { name: 'Gehalt', color: INCOME_COLOR } : cats[r.categoryId] || NO_CATEGORY;
      return `
        <button type="button" class="rec-row press ${r.active ? '' : 'inactive'}" data-action="edit-recurring" data-id="${r.id}" aria-label="${esc(r.title)} bearbeiten">
          ${categoryIcon(r.title, cat.color)}
          <span class="row-main">
            <span>${esc(r.title)}${r.active ? '' : '<span class="badge off">Pausiert</span>'}</span>
            <small>${esc(cat.name)} · am 1.</small>
          </span>
          <span class="amt ${isSalary ? 'pos' : ''}">${isSalary ? '+' : '−'}${moneyWithSymbol(r.amount, cur, 2)}</span>
        </button>`;
    })
    .join('');

  // HTML: Überschrift, Buttons für neues Gehalt / neue Fixkosten, Liste mit Summen oder Leertext.
  return `
    <section class="card rec-card" aria-label="Gehalt und Fixkosten">
      <div>
        <h2 class="card-title">Gehalt &amp; Fixkosten</h2>
        <span class="section-hint">Werden am 1. jedes Monats automatisch gebucht.</span>
      </div>
      <div class="chips">
        <button type="button" class="btn press" data-action="new-recurring" data-kind="salary">${icons.plus}Gehalt</button>
        <button type="button" class="btn press" data-action="new-recurring" data-kind="fixed">${icons.plus}Fixkosten</button>
      </div>
      ${
        rows
          ? `<div class="rec-list">${rows}</div>
             <div class="rec-totals">
               <div><span>Einnahmen pro Monat</span><strong>+${moneyWithSymbol(incomeTotal, cur, 2)}</strong></div>
               <div><span>Fixkosten pro Monat</span><strong>−${moneyWithSymbol(fixedTotal, cur, 2)}</strong></div>
               <div><span>Bleibt nach Fixkosten</span><strong>${incomeTotal - fixedTotal < 0 ? '−' : ''}${moneyWithSymbol(incomeTotal - fixedTotal, cur, 2)}</strong></div>
             </div>`
          : '<p class="empty">Noch nichts angelegt. Trag dein Gehalt und Fixkosten wie Miete oder Handyvertrag ein.</p>'
      }
    </section>`;
}
