import { transactionsOfMonth, round } from '../calc.js';
import { esc, money, moneyWithSymbol, signedMoney, monthLabel, dateLabel } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryIcon, categoryMap, displayCategory, NO_CATEGORY, INCOME_COLOR } from './shared.js';

const FILTERS = [
  ['all', 'Alle'],
  ['expense', 'Ausgaben'],
  ['income', 'Einnahmen'],
];

export function renderFinance({ doc, month, currentMonth, summary, filter }) {
  const cur = doc.settings.currency;
  return `
    <div class="page">
      ${pageHead({ eyebrow: monthLabel(month), title: 'Finance', accent: 'Manager', month, currentMonth, actions: true })}
      <div class="kpis">
        <div class="kpi"><small>Einnahmen</small><strong class="pos">+${money(summary.income, cur, 2)}</strong></div>
        <div class="kpi"><small>Ausgaben</small><strong class="${summary.overBudget ? 'neg' : ''}">−${money(summary.expenses, cur, 2)}</strong></div>
        <div class="kpi"><small>Verfügbar</small><strong class="${summary.negative ? 'neg' : ''}">${summary.negative ? '−' : ''}${money(summary.available, cur, 2)}</strong></div>
        <div class="kpi"><small>Budget-Limit</small><strong>${money(summary.limit, cur, 2)}</strong></div>
      </div>
      <div class="finance">
        ${transactions(doc, month, filter, cur)}
        ${recurring(doc, cur)}
      </div>
    </div>`;
}

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
          <span class="tx-cat"><span class="dot" style="background:${cat.color}"></span><span>${esc(cat.name)}</span></span>
          <span class="tx-date">${esc(dateLabel(t.date))}</span>
          <span class="tx-amount ${t.type === 'income' ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur)}</span>
        </button>`;
    })
    .join('');

  const emptyText = all.length
    ? 'Keine Buchungen für diesen Filter.'
    : 'Keine Buchungen in diesem Monat. Über „Einnahme“ und „Ausgabe“ fügst du welche hinzu.';

  return `
    <section class="section" aria-label="Buchungen">
      <div class="section-head">
        <div class="chips" role="group" aria-label="Filter">
          ${FILTERS.map(
            ([key, label]) =>
              `<button type="button" class="chip ${filter === key ? 'active' : ''}" data-action="filter" data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`,
          ).join('')}
        </div>
        <span class="count">${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'}</span>
      </div>
      <div class="table-card">
        <div class="tx-head" aria-hidden="true"><span>Bezeichnung</span><span>Kategorie</span><span>Datum</span><span style="text-align:right">Betrag</span></div>
        ${rows || `<div class="empty">${emptyText}</div>`}
      </div>
    </section>`;
}

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
      const sub = isSalary ? 'Gehalt · am 1. des Monats' : `${cat.name} · am 1. des Monats`;
      return `
        <button type="button" class="rec-row ${r.active ? '' : 'inactive'}" data-action="edit-recurring" data-id="${r.id}" aria-label="${esc(r.title)} bearbeiten">
          ${categoryIcon(r.title, cat.color)}
          <span class="rec-main">
            <span>${esc(r.title)}${r.active ? '' : '<span class="badge off">Pausiert</span>'}</span>
            <small>${esc(sub)}</small>
          </span>
          <span class="tx-amount ${isSalary ? 'pos' : ''}">${isSalary ? '+' : '−'}${moneyWithSymbol(r.amount, cur, 2)}</span>
        </button>`;
    })
    .join('');

  return `
    <section class="card rec-card" aria-label="Gehalt und Fixkosten">
      <div>
        <h2 class="card-title">Gehalt &amp; Fixkosten</h2>
        <span class="section-hint">Werden am 1. jedes Monats automatisch gebucht.</span>
      </div>
      <div class="chips">
        <button type="button" class="btn" data-action="new-recurring" data-kind="salary">${icons.plus}Gehalt</button>
        <button type="button" class="btn" data-action="new-recurring" data-kind="fixed">${icons.plus}Fixkosten</button>
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
