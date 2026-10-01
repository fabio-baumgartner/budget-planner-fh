// Auswertungen: die Details, die nicht aufs Dashboard gehören.
// Prognose (nur laufender Monat), Verlauf mit Kennzahlen, Kategorien als Tabelle.
import { forecastMonth, categoryRows, legendRows, categoryBudgetTotal, round } from '../calc.js';
import { esc, moneyWithSymbol, monthLabel } from '../format.js';
import { pageHead, swatch, NO_CATEGORY } from './shared.js';
import { forecastCard, trendCard } from './insights.js';

export function renderAnalysis({ doc, month, currentMonth, summary, today }) {
  const cur = doc.settings.currency;
  const forecast = forecastMonth(doc, month, today);
  return `
    <div class="page">
      ${pageHead({ eyebrow: monthLabel(month), title: 'Deine', accent: 'Auswertungen', month, currentMonth })}
      <div class="ana ${forecast ? 'has-forecast' : ''}">
        ${forecast ? forecastCard(forecast, cur) : ''}
        ${trendCard(doc, month, cur)}
        ${categoryTable(doc, summary, month, cur)}
      </div>
    </div>`;
}

function categoryTable(doc, summary, month, cur) {
  const rows = categoryRows(doc, summary);
  const shares = Object.fromEntries(legendRows(doc, summary).map((l) => [l.id, l.pct]));
  const uncategorized = round(summary.spentByCategory.none || 0);
  const budgetTotal = categoryBudgetTotal(doc);
  const restTotal = round(budgetTotal - summary.expenses);
  const signed = (v) => `${v < 0 ? '−' : ''}${moneyWithSymbol(v, cur)}`;

  const body = rows
    .map(
      (c) => `
        <tr>
          <td><button type="button" class="table-link" data-action="edit-category" data-id="${c.id}">
            ${swatch(c.color)}${esc(c.name)}</button></td>
          <td>${moneyWithSymbol(c.budget, cur)}</td>
          <td>${moneyWithSymbol(c.spent, cur)}</td>
          <td class="${c.state === 'over' ? 'over' : ''}">${signed(c.rest)}</td>
          <td>${shares[c.id] ?? 0} %</td>
        </tr>`,
    )
    .join('');

  const noCategory = uncategorized
    ? `<tr><td>${swatch(NO_CATEGORY.color)}${NO_CATEGORY.name}</td><td>·</td>
        <td>${moneyWithSymbol(uncategorized, cur)}</td><td>·</td>
        <td>${summary.expenses ? Math.round((uncategorized / summary.expenses) * 100) : 0} %</td></tr>`
    : '';

  return `
    <section class="card table-section full" aria-label="Kategorien im Detail">
      <div class="card-head">
        <h2 class="card-title">Kategorien im Detail</h2>
        <span class="count">${esc(monthLabel(month))}</span>
      </div>
      ${
        rows.length || uncategorized
          ? `<div class="table-scroll">
              <table class="cat-table">
                <thead><tr><th>Kategorie</th><th>Budget</th><th>Ausgegeben</th><th>Übrig</th><th>Anteil</th></tr></thead>
                <tbody>
                  ${body}${noCategory}
                  <tr class="total"><td>Gesamt</td><td>${moneyWithSymbol(budgetTotal, cur)}</td><td>${moneyWithSymbol(summary.expenses, cur)}</td>
                    <td class="${restTotal < 0 ? 'over' : ''}">${signed(restTotal)}</td><td>100 %</td></tr>
                </tbody>
              </table>
            </div>`
          : '<p class="empty">Noch keine Kategorien.</p>'
      }
    </section>`;
}
