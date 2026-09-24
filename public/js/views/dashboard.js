import { categoryRows, legendRows, donutArcs, daysLeft } from '../calc.js';
import { esc, money, currencySymbol, monthLabel, tint, initial } from '../format.js';
import { icons } from '../icons.js';
import { pageHead } from './shared.js';

export function renderDashboard({ doc, month, currentMonth, summary, today }) {
  const cur = doc.settings.currency;
  return `
    ${pageHead({ eyebrow: monthLabel(month), title: 'Dein', accent: 'Budget', month, currentMonth })}
    <div class="grid-hero">
      ${hero(doc, summary, month, today, cur)}
      ${donut(doc, summary, cur)}
    </div>
    ${categories(doc, summary, cur)}`;
}

function hero(doc, summary, month, today, cur) {
  const left = daysLeft(month, today);
  const chip = month < today.slice(0, 7) ? 'Abgeschlossen' : `${left} ${left === 1 ? 'Tag' : 'Tage'} übrig`;
  const pct = summary.limit > 0 ? Math.min((summary.expenses / summary.limit) * 100, 100) : summary.expenses > 0 ? 100 : 0;
  const hasSalary = doc.recurring.some((r) => r.kind === 'salary' && r.active);

  let hint = '';
  if (summary.overBudget) {
    hint = `<div class="hero-hint"><span>Budget um ${currencySymbol(cur)} ${money(summary.expenses - summary.limit, cur)} überschritten.</span>
      <button type="button" data-action="edit-budget">Budget anpassen</button></div>`;
  } else if (summary.income === 0 && !hasSalary) {
    hint = `<div class="hero-hint"><span>Noch keine Einnahmen. Lege dein Gehalt an, es wird jeden Monat automatisch gebucht.</span>
      <button type="button" data-action="new-recurring" data-kind="salary">Gehalt anlegen</button></div>`;
  }

  return `
    <section class="hero" aria-label="Verfügbares Geld">
      <div class="hero-top">
        <span class="hero-label">${summary.negative ? 'Im Minus' : 'Noch verfügbar'}</span>
        <span class="hero-chip">${chip}</span>
      </div>
      <div class="hero-amount">
        <span class="hero-currency">${currencySymbol(cur)}</span>
        <span class="hero-value">${summary.negative ? '−' : ''}${money(summary.available, cur)}</span>
      </div>
      ${hint}
      <div class="hero-bottom">
        <div class="hero-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"
          aria-label="Anteil des Budgets ausgegeben"><div class="hero-bar" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="hero-meta">
          <span>Ausgegeben ${currencySymbol(cur)} ${money(summary.expenses, cur)}</span>
          <span>Budget ${currencySymbol(cur)} ${money(summary.limit, cur)}</span>
        </div>
      </div>
    </section>`;
}

function donut(doc, summary, cur) {
  const arcs = donutArcs(doc, summary);
  const legend = legendRows(doc, summary);
  return `
    <section class="card donut-card" aria-label="Ausgaben nach Kategorie">
      <div class="donut-head">
        <span class="card-title">Ausgaben nach Kategorie</span>
        <div class="donut-key" aria-hidden="true"><span><i></i>Ausgegeben</span><span><i class="faint"></i>Budget</span></div>
      </div>
      <div class="donut-body">
        <div class="donut">
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r="88" fill="none" stroke="#F5F5F5" stroke-width="22"/>
            ${arcs
              .map(
                (a) => `<circle cx="110" cy="110" r="88" fill="none" stroke="${a.color}" stroke-opacity="${a.opacity}"
                  stroke-width="22" stroke-dasharray="${a.dash}" stroke-dashoffset="${a.offset}"/>`,
              )
              .join('')}
          </svg>
          <div class="donut-center">
            <small>Ausgegeben</small>
            <strong>${money(summary.expenses, cur)}</strong>
            <small>von ${money(summary.limit, cur)} ${currencySymbol(cur)}</small>
          </div>
        </div>
        <ul class="legend">
          ${legend
            .map(
              (l) => `<li><span class="dot" style="background:${l.color}"></span><span class="name">${esc(l.name)}</span><strong>${l.pct}%</strong></li>`,
            )
            .join('')}
        </ul>
      </div>
    </section>`;
}

function categories(doc, summary, cur) {
  const rows = categoryRows(doc, summary);
  const cards = rows
    .map((c) => {
      const stateText = c.state === 'over' ? `${money(-c.rest, cur)} drüber` : `${money(c.rest, cur)} übrig`;
      const barColor = c.state === 'over' ? 'var(--red)' : c.color;
      return `
        <button type="button" class="cat-card" data-action="edit-category" data-id="${c.id}" aria-label="Kategorie ${esc(c.name)} bearbeiten">
          <span class="cat-icon" style="background:${tint(c.color)};color:${c.color}">${esc(initial(c.name))}</span>
          <span class="cat-body">
            <span class="cat-row">
              <span class="cat-name">${esc(c.name)}</span>
              <span class="cat-state ${c.state}">${stateText}</span>
            </span>
            <span class="cat-track"><span class="cat-bar" style="display:block;width:${c.pct}%;background:${barColor}"></span></span>
            <span class="cat-meta"><span>${money(c.spent, cur)} ausgegeben</span><span>${money(c.budget, cur)} ${currencySymbol(cur)}</span></span>
          </span>
        </button>`;
    })
    .join('');

  return `
    <section class="section" aria-label="Kategorien">
      <div class="section-head">
        <h2 class="section-title">Kategorien</h2>
        <button type="button" class="btn" data-action="new-category">${icons.plus}Neue Kategorie</button>
      </div>
      ${rows.length ? `<div class="cat-grid">${cards}</div>` : '<div class="card empty">Noch keine Kategorien. Leg deine erste an.</div>'}
    </section>`;
}
