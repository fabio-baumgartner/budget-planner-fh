import { transactionsOfMonth } from '../calc.js';
import { esc, money, moneyWithSymbol, signedMoney, monthLabel, dateLabel, tint, initial } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryMap, NO_CATEGORY, INCOME_COLOR } from './shared.js';

const FILTERS = [
  ['all', 'Alle'],
  ['expense', 'Ausgaben'],
  ['income', 'Einnahmen'],
];

export function renderFinance({ doc, month, currentMonth, summary, filter }) {
  const cur = doc.settings.currency;
  return `
    ${pageHead({ eyebrow: monthLabel(month), title: 'Finance', accent: 'Manager', month, currentMonth })}
    <div class="kpis">
      <div class="kpi"><small>Einnahmen</small><strong class="pos">+${money(summary.income, cur)}</strong></div>
      <div class="kpi"><small>Ausgaben</small><strong class="${summary.overBudget ? 'neg' : ''}">−${money(summary.expenses, cur)}</strong></div>
      <div class="kpi"><small>Verfügbar</small><strong class="${summary.negative ? 'neg' : ''}">${summary.negative ? '−' : ''}${money(summary.available, cur)}</strong></div>
      <div class="kpi"><small>Budget-Limit</small><strong>${money(summary.limit, cur)}</strong></div>
    </div>
    ${transactions(doc, month, filter, cur)}
    ${recurring(doc, cur)}`;
}

function transactions(doc, month, filter, cur) {
  const cats = categoryMap(doc);
  const list = transactionsOfMonth(doc, month).filter((t) => filter === 'all' || t.type === filter);
  const rows = list
    .map((t) => {
      const isIncome = t.type === 'income';
      const cat = isIncome ? { name: 'Einnahme', color: INCOME_COLOR } : cats[t.categoryId] || NO_CATEGORY;
      const title = t.note || cat.name;
      return `
        <button type="button" class="tx-row" data-action="edit-tx" data-id="${t.id}" aria-label="Buchung ${esc(title)} bearbeiten">
          <span class="tx-title">
            <span class="cat-icon sm" style="background:${tint(cat.color)};color:${cat.color}">${esc(initial(title))}</span>
            <span class="tx-title-text">
              <span>${esc(title)}${t.recurringId ? '<span class="badge">Auto</span>' : ''}</span>
              <span class="tx-sub">${esc(cat.name)} · ${esc(dateLabel(t.date))}</span>
            </span>
          </span>
          <span class="tx-cat"><span class="dot" style="background:${cat.color}"></span><span>${esc(cat.name)}</span></span>
          <span class="tx-date">${esc(dateLabel(t.date))}</span>
          <span class="tx-amount ${isIncome ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur)}</span>
        </button>`;
    })
    .join('');

  return `
    <section class="section" aria-label="Buchungen">
      <div class="section-head">
        <div class="chips" role="group" aria-label="Filter">
          ${FILTERS.map(
            ([key, label]) =>
              `<button type="button" class="chip ${filter === key ? 'active' : ''}" data-action="filter" data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`,
          ).join('')}
        </div>
      </div>
      <div class="table-card">
        <div class="tx-head" aria-hidden="true"><span>Bezeichnung</span><span>Kategorie</span><span>Datum</span><span style="text-align:right">Betrag</span></div>
        ${rows || `<div class="empty">Keine Buchungen in diesem Monat. Mit + und − oben fügst du welche hinzu.</div>`}
      </div>
    </section>`;
}

function recurring(doc, cur) {
  const cats = categoryMap(doc);
  const sorted = [...doc.recurring].sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'salary' ? -1 : 1));
  const rows = sorted
    .map((r) => {
      const isSalary = r.kind === 'salary';
      const cat = isSalary ? { name: 'Gehalt', color: INCOME_COLOR } : cats[r.categoryId] || NO_CATEGORY;
      const sub = isSalary ? 'Gehalt · monatlich am 1.' : `Fixkosten · ${cat.name} · monatlich am 1.`;
      return `
        <button type="button" class="rec-row ${r.active ? '' : 'inactive'}" data-action="edit-recurring" data-id="${r.id}" aria-label="${esc(r.title)} bearbeiten">
          <span class="cat-icon sm" style="background:${tint(cat.color)};color:${cat.color}">${esc(initial(r.title))}</span>
          <span class="rec-main">
            <span>${esc(r.title)}${r.active ? '' : '<span class="badge off">Pausiert</span>'}</span>
            <small>${esc(sub)}</small>
          </span>
          <span class="tx-amount ${isSalary ? 'pos' : ''}">${isSalary ? '+' : '−'}${moneyWithSymbol(r.amount, cur, 2)}</span>
        </button>`;
    })
    .join('');

  return `
    <section class="section" aria-label="Gehalt und Fixkosten">
      <div class="section-head">
        <div>
          <h2 class="section-title">Gehalt &amp; Fixkosten</h2>
          <span class="section-hint">Werden am 1. jedes Monats automatisch gebucht.</span>
        </div>
      </div>
      <div class="chips">
        <button type="button" class="btn" data-action="new-recurring" data-kind="salary">${icons.plus}Gehalt</button>
        <button type="button" class="btn" data-action="new-recurring" data-kind="fixed">${icons.plus}Fixkosten</button>
      </div>
      <div class="table-card">
        ${rows || '<div class="empty">Noch nichts angelegt. Trag dein Gehalt und Fixkosten wie Miete oder Handyvertrag ein.</div>'}
      </div>
    </section>`;
}
