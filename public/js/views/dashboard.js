import { categoryRows, legendRows, donutArcs, daysLeft, transactionsOfMonth } from '../calc.js';
import { esc, money, currencySymbol, monthLabel, dateLabel, signedMoney } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryIcon, categoryMap, displayCategory } from './shared.js';

const RECENT_LIMIT = 6;

export function renderDashboard({ doc, month, currentMonth, summary, today }) {
  const cur = doc.settings.currency;
  return `
    <div class="page">
      ${pageHead({ eyebrow: monthLabel(month), title: 'Dein', accent: 'Budget', month, currentMonth, actions: true })}
      <div class="dash">
        ${hero(doc, summary, month, today, cur)}
        ${donut(doc, summary, cur)}
        ${recent(doc, month, cur)}
        ${categories(doc, summary, cur)}
      </div>
    </div>`;
}

function hero(doc, summary, month, today, cur) {
  const current = today.slice(0, 7);
  const left = daysLeft(month, today);
  const chip = month < current ? 'Abgeschlossen' : `${left} ${left === 1 ? 'Tag' : 'Tage'} übrig`;
  const pct = summary.limit > 0 ? Math.min((summary.expenses / summary.limit) * 100, 100) : summary.expenses > 0 ? 100 : 0;
  const hasSalary = doc.recurring.some((r) => r.kind === 'salary' && r.active);

  // Tagesbudget: nur im laufenden Monat sinnvoll.
  const perDay =
    month === current && left > 0 && summary.available > 0
      ? `<div class="hero-sub">≈ ${currencySymbol(cur)} ${money(summary.available / left, cur)} pro Tag bis Monatsende</div>`
      : '';

  let hint = '';
  if (summary.overBudget) {
    hint = `<div class="hero-hint"><span>Budget um ${currencySymbol(cur)} ${money(summary.expenses - summary.limit, cur)} überschritten.</span>
      <button type="button" data-action="edit-budget">Budget anpassen</button></div>`;
  } else if (summary.income === 0 && !hasSalary && month >= current) {
    hint = `<div class="hero-hint"><span>Noch keine Einnahmen. Leg dein Gehalt an, es wird jeden Monat automatisch gebucht.</span>
      <button type="button" data-action="new-recurring" data-kind="salary">Gehalt anlegen</button></div>`;
  }

  return `
    <section class="hero dash-hero" aria-label="Verfügbares Geld">
      <div class="hero-top">
        <span class="hero-label">${summary.negative ? 'Im Minus' : 'Noch verfügbar'}</span>
        <span class="hero-chip">${chip}</span>
      </div>
      <div>
        <div class="hero-amount">
          <span class="hero-currency">${currencySymbol(cur)}</span>
          <span class="hero-value">${summary.negative ? '−' : ''}${money(summary.available, cur)}</span>
        </div>
        ${perDay}
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
    <section class="card donut-card dash-donut" aria-label="Ausgaben nach Kategorie">
      <div class="card-head">
        <h2 class="card-title">Ausgaben nach Kategorie</h2>
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
        ${
          legend.length
            ? `<ul class="legend">
                ${legend
                  .map(
                    (l) => `<li><span class="dot" style="background:${l.color}"></span><span class="name">${esc(l.name)}</span>
                      <span class="amount">${money(l.spent, cur)} ${currencySymbol(cur)}</span><strong>${l.pct}%</strong></li>`,
                  )
                  .join('')}
              </ul>`
            : '<p class="empty" style="flex:1">Leg Kategorien an, um deine Ausgaben aufzuteilen.</p>'
        }
      </div>
    </section>`;
}

function recent(doc, month, cur) {
  const cats = categoryMap(doc);
  const list = transactionsOfMonth(doc, month).slice(0, RECENT_LIMIT);
  const rows = list
    .map((t) => {
      const cat = displayCategory(t, cats);
      const title = t.note || cat.name;
      return `
        <button type="button" class="recent-row" data-action="edit-tx" data-id="${t.id}" aria-label="Buchung ${esc(title)} bearbeiten">
          ${categoryIcon(title, cat.color)}
          <span class="recent-main">
            <span>${esc(title)}</span>
            <small>${esc(cat.name)} · ${esc(dateLabel(t.date))}</small>
          </span>
          <span class="tx-amount ${t.type === 'income' ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur)}</span>
        </button>`;
    })
    .join('');

  return `
    <section class="card recent-card dash-recent" aria-label="Letzte Buchungen">
      <div class="card-head">
        <h2 class="card-title">Letzte Buchungen</h2>
        <a class="card-link" href="#finance">Alle ansehen</a>
      </div>
      ${rows ? `<div class="recent-list">${rows}</div>` : '<p class="empty">Noch keine Buchungen in diesem Monat.</p>'}
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
          ${categoryIcon(c.name, c.color, '')}
          <span class="cat-body">
            <span class="cat-row">
              <span class="cat-name">${esc(c.name)}</span>
              <span class="cat-state ${c.state}">${stateText}</span>
            </span>
            <span class="cat-track"><span class="cat-bar" style="width:${c.pct}%;background:${barColor}"></span></span>
            <span class="cat-meta"><span>${money(c.spent, cur)} ausgegeben</span><span>${money(c.budget, cur)} ${currencySymbol(cur)}</span></span>
          </span>
        </button>`;
    })
    .join('');

  return `
    <section class="section dash-cats" aria-label="Kategorien">
      <div class="section-head">
        <h2 class="section-title">Kategorien</h2>
        <button type="button" class="btn" data-action="new-category">${icons.plus}Neue Kategorie</button>
      </div>
      <div class="cat-grid">
        ${cards}
        ${rows.length ? '' : `<button type="button" class="cat-card add" data-action="new-category">${icons.plus}Erste Kategorie anlegen</button>`}
      </div>
    </section>`;
}
