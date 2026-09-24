// Dashboard: beantwortet nur drei Fragen.
// 1. Wie viel habe ich noch? 2. Komme ich durch den Monat? 3. Wofür geht mein Geld weg?
// Details (ausführliche Prognose, Verlauf mit Kennzahlen, Kategorie-Tabelle) stehen unter "Auswertungen".
import { categoryRows, donutArcs, daysLeft, transactionsOfMonth, forecastMonth, addMonths } from '../calc.js';
import { esc, money, moneyWithSymbol, currencySymbol, monthLabel, monthName, dateLabel, signedMoney } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryIcon, categoryMap, displayCategory } from './shared.js';
import { miniTrendCard } from './insights.js';

const RECENT_LIMIT = 4;

export function renderDashboard({ doc, month, currentMonth, summary, today }) {
  const cur = doc.settings.currency;
  return `
    <div class="page">
      ${pageHead({ eyebrow: monthLabel(month), title: 'Dein', accent: 'Budget', month, currentMonth, actions: true })}
      <div class="dash">
        ${hero(doc, summary, month, today, cur)}
        ${categories(doc, summary, cur)}
        ${recent(doc, month, cur)}
        ${miniTrendCard(doc, month, cur)}
      </div>
    </div>`;
}

// ---------- 1 + 2: Hero ----------

function hero(doc, summary, month, today, cur) {
  const current = today.slice(0, 7);
  const left = daysLeft(month, today);
  const chip = month < current ? 'Abgeschlossen' : `${left} ${left === 1 ? 'Tag' : 'Tage'} übrig`;
  const pct = summary.limit > 0 ? Math.min((summary.expenses / summary.limit) * 100, 100) : summary.expenses > 0 ? 100 : 0;
  const forecast = forecastMonth(doc, month, today);

  // Erklärung hinter dem ⓘ (auch am Handy per Tipp lesbar)
  let info = 'Einnahmen minus Ausgaben dieses Monats';
  if (summary.carryIn !== 0) {
    info += `, inkl. ${summary.carryIn < 0 ? '−' : ''}${moneyWithSymbol(summary.carryIn, cur)} Übertrag aus ${monthName(addMonths(month, -1))}`;
  }
  info += '.';

  return `
    <section class="hero dash-hero" aria-label="Verfügbares Geld">
      <div class="hero-top">
        <span class="hero-label">${summary.negative ? 'Im Minus' : 'Noch verfügbar'}
          <button type="button" class="info" data-action="info" data-text="${esc(info)}" title="${esc(info)}" aria-label="Erklärung: ${esc(info)}">i</button>
        </span>
        <span class="hero-chip">${chip}</span>
      </div>
      <div class="hero-amount">
        <span class="hero-value">${summary.negative ? '−' : ''}${money(summary.available, cur)}</span>
        <span class="hero-currency">${currencySymbol(cur)}</span>
      </div>
      ${status(doc, summary, forecast, month, current, cur)}
      <div class="hero-bottom">
        <div class="hero-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"
          aria-label="Anteil des Budgets ausgegeben"><div class="hero-bar" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="hero-meta">
          <span>${moneyWithSymbol(summary.expenses, cur)} von ${moneyWithSymbol(summary.limit, cur)} ausgegeben</span>
          <span>${Math.round(summary.ratio * 100)} %</span>
        </div>
      </div>
      ${
        forecast && summary.limit > 0
          ? `<div class="hero-daily"><strong>${moneyWithSymbol(forecast.dailyAllowance, cur)}</strong><span>pro Tag, um im Budget zu bleiben</span></div>`
          : ''
      }
    </section>`;
}

// Eine einzige Statuszeile statt Prognose-Karte, Hinweis und zweiter Tageszahl.
function status(doc, summary, forecast, month, current, cur) {
  const hasSalary = doc.recurring.some((r) => r.kind === 'salary' && r.active);

  // Neue User ohne Einnahmen: Hinweis zum Gehalt ist wichtiger als jede Prognose.
  if (summary.income === 0 && !hasSalary && month >= current) {
    return `<button type="button" class="hero-status hint" data-action="new-recurring" data-kind="salary">
      <span class="dot" aria-hidden="true">+</span>Noch keine Einnahmen · Gehalt anlegen</button>`;
  }
  if (summary.overBudget) {
    return `<button type="button" class="hero-status over" data-action="edit-budget" title="Budget anpassen">
      <span class="dot" aria-hidden="true">!</span>Budget um ${moneyWithSymbol(summary.expenses - summary.limit, cur)} überschritten</button>`;
  }
  if (summary.limit <= 0) return '';

  if (forecast) {
    const diff = moneyWithSymbol(Math.abs(forecast.difference), cur);
    const text = {
      ok: `Im Plan: ca. ${diff} unter Budget`,
      tight: `Knapp: ca. ${diff} Luft bis Monatsende`,
      over: `Voraussichtlich ca. ${diff} über Budget`,
    }[forecast.status];
    return `<a class="hero-status ${forecast.status}" href="#auswertungen" title="Details in den Auswertungen">
      <span class="dot" aria-hidden="true">${forecast.status === 'ok' ? '✓' : '!'}</span>${text}</a>`;
  }
  if (month < current) {
    return `<span class="hero-status ok"><span class="dot" aria-hidden="true">✓</span>Im Budget geblieben: ${moneyWithSymbol(summary.limit - summary.expenses, cur)} übrig</span>`;
  }
  return '';
}

// ---------- 3: Kategorien (kleiner Donut + eine Liste) ----------

function categories(doc, summary, cur) {
  const rows = categoryRows(doc, summary);
  const arcs = donutArcs(doc, summary);

  const list = rows
    .map((c) => {
      const text = c.state === 'over' ? `${moneyWithSymbol(-c.rest, cur)} drüber` : `${moneyWithSymbol(c.rest, cur)} übrig`;
      const bar = c.state === 'over' ? 'var(--red)' : c.color;
      return `
        <li><button type="button" class="cat-item" data-action="edit-category" data-id="${c.id}"
          aria-label="${esc(c.name)}: ${esc(text)}, bearbeiten">
          <span class="dot" style="background:${c.color}"></span>
          <span class="name">${esc(c.name)}</span>
          <span class="track"><span style="width:${c.pct}%;background:${bar}"></span></span>
          <span class="rest ${c.state}">${text}</span>
        </button></li>`;
    })
    .join('');

  return `
    <section class="card cats-card dash-cats" aria-label="Kategorien">
      <div class="card-head">
        <h2 class="card-title">Kategorien</h2>
        <button type="button" class="btn sm" data-action="new-category">${icons.plus}Neu</button>
      </div>
      ${
        rows.length
          ? `<div class="cats-body">
              <div class="donut sm">
                <svg viewBox="0 0 220 220" aria-hidden="true">
                  <circle cx="110" cy="110" r="88" fill="none" stroke="#F5F5F5" stroke-width="22"/>
                  ${arcs
                    .map(
                      (a) => `<circle cx="110" cy="110" r="88" fill="none" stroke="${a.color}" stroke-opacity="${a.opacity}"
                        stroke-width="22" stroke-dasharray="${a.dash}" stroke-dashoffset="${a.offset}"/>`,
                    )
                    .join('')}
                </svg>
                <div class="donut-center"><strong>${moneyWithSymbol(summary.expenses, cur)}</strong><small>ausgegeben</small></div>
              </div>
              <ul class="cat-list">${list}</ul>
            </div>`
          : `<button type="button" class="empty-add" data-action="new-category">${icons.plus}Erste Kategorie anlegen</button>`
      }
    </section>`;
}

// ---------- Letzte Buchungen ----------

function recent(doc, month, cur) {
  const cats = categoryMap(doc);
  const list = transactionsOfMonth(doc, month).slice(0, RECENT_LIMIT);
  const rows = list
    .map((t) => {
      const cat = displayCategory(t, cats);
      const title = t.note || cat.name;
      const sub = t.type === 'income' ? dateLabel(t.date) : `${cat.name} · ${dateLabel(t.date)}`;
      return `
        <button type="button" class="recent-row" data-action="edit-tx" data-id="${t.id}" aria-label="Buchung ${esc(title)} bearbeiten">
          ${categoryIcon(title, cat.color)}
          <span class="recent-main"><span>${esc(title)}</span><small>${esc(sub)}</small></span>
          <span class="tx-amount ${t.type === 'income' ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur, 0)}</span>
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
