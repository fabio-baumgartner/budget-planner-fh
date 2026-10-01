// Dashboard: beantwortet nur drei Fragen.
// 1. Wie viel habe ich noch? 2. Komme ich durch den Monat? 3. Wofür geht mein Geld weg?
// Details (ausführliche Prognose, Verlauf mit Kennzahlen, Kategorie-Tabelle) stehen unter "Auswertungen".
import { categoryRows, daysLeft, transactionsOfMonth, forecastMonth, addMonths } from '../calc.js';
import { esc, money, moneyWithSymbol, currencySymbol, monthLabel, monthName, dateLabel, signedMoney, displayColor } from '../format.js';
import { icons } from '../icons.js';
import { pageHead, categoryIcon, categoryMap, displayCategory } from './shared.js';
import { miniTrendCard } from './insights.js';

const RECENT_LIMIT = 5;

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
      ${summary.status === 'over' ? '<span class="stamp" aria-hidden="true">Überzogen</span>' : ''}
      <div class="hero-main">
        <div class="hero-top">
          <span class="hero-label">${summary.negative ? 'Im Minus' : 'Noch verfügbar'}
            <button type="button" class="info" data-action="info" data-text="${esc(info)}" title="${esc(info)}" aria-label="Erklärung: ${esc(info)}">i</button>
          </span>
          <span class="sticker">${chip}</span>
        </div>
        <div class="hero-amount">
          <span class="hero-value" data-hero="${summary.available}">${summary.negative ? '−' : ''}${money(summary.available, cur)}</span>
          <span class="hero-currency">${esc(currencySymbol(cur))}</span>
        </div>
        ${status(doc, summary, forecast, month, current, cur)}
      </div>
      <div class="hero-side">
        <div class="hero-meter">
          <div class="hero-meter-head"><span>Ausgegeben</span><strong>${Math.round(summary.ratio * 100)} %</strong></div>
          <div class="seg-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"
            aria-label="Anteil des Budgets ausgegeben"><span class="seg-fill gx" style="width:${pct.toFixed(1)}%"></span></div>
          <div class="hero-meter-foot">${moneyWithSymbol(summary.expenses, cur)} von ${moneyWithSymbol(summary.limit, cur)}</div>
        </div>
        ${
          forecast && summary.limit > 0
            ? `<div class="hero-daily"><strong>${moneyWithSymbol(forecast.dailyAllowance, cur)}</strong><span>pro Tag, um im Budget zu bleiben</span></div>`
            : ''
        }
        <div class="hero-flow">
          <div><small>Einnahmen</small><strong>+${moneyWithSymbol(summary.income, cur)}</strong></div>
          <div><small>Ausgaben</small><strong>−${moneyWithSymbol(summary.expenses, cur)}</strong></div>
        </div>
      </div>
    </section>`;
}

// Eine einzige Statuszeile statt Prognose-Karte, Hinweis und zweiter Tageszahl.
function status(doc, summary, forecast, month, current, cur) {
  const hasSalary = doc.recurring.some((r) => r.kind === 'salary' && r.active);

  // Neue User ohne Einnahmen: Hinweis zum Gehalt ist wichtiger als jede Prognose.
  if (summary.income === 0 && !hasSalary && month >= current) {
    return `<button type="button" class="hero-status hint press" data-action="new-recurring" data-kind="salary">
      <span class="dot" aria-hidden="true">+</span>Noch keine Einnahmen · Gehalt anlegen</button>`;
  }
  if (summary.overBudget) {
    return `<button type="button" class="hero-status over press" data-action="edit-budget" title="Budget anpassen">
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
    return `<a class="hero-status ${forecast.status} press" href="#auswertungen" title="Details in den Auswertungen">
      <span class="dot" aria-hidden="true">${forecast.status === 'ok' ? '✓' : '!'}</span>${text}</a>`;
  }
  if (month < current) {
    return `<span class="hero-status ok"><span class="dot" aria-hidden="true">✓</span>Im Budget geblieben: ${moneyWithSymbol(summary.limit - summary.expenses, cur)} übrig</span>`;
  }
  return '';
}

// ---------- 3: Kategorien als Pastell-Kacheln ----------

function categories(doc, summary, cur) {
  const rows = categoryRows(doc, summary);

  const tiles = rows
    .map((c, i) => {
      const shown = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : c.spent > 0 ? 100 : 0;
      const text = c.state === 'over' ? `${moneyWithSymbol(-c.rest, cur)} drüber` : `${moneyWithSymbol(c.rest, cur)} übrig`;
      const sticker =
        c.state === 'over' ? '<span class="sticker sm over">drüber</span>' : c.state === 'warn' ? '<span class="sticker sm warn">knapp</span>' : '';
      return `
        <button type="button" class="cat-tile press big ${c.state}" style="--c:${displayColor(c.color)};--i:${i}" data-action="edit-category" data-id="${c.id}"
          aria-label="${esc(c.name)}: ${esc(text)}, bearbeiten">
          <span class="cat-top"><span class="cat-name">${esc(c.name)}</span>${sticker}</span>
          <span class="cat-pct">${shown}<small>%</small></span>
          <span class="cat-track"><span class="cat-fill gx" style="width:${c.pct}%"></span></span>
          <span class="cat-rest">${text} <span>von ${moneyWithSymbol(c.budget, cur)}</span></span>
        </button>`;
    })
    .join('');

  return `
    <section class="section cats dash-cats" aria-label="Kategorien">
      <div class="section-head">
        <h2 class="section-title">Kategorien</h2>
        <button type="button" class="btn sm press" data-action="new-category">${icons.plus}Neu</button>
      </div>
      ${
        rows.length
          ? `<div class="cat-grid">${tiles}</div>`
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
          <span class="row-main"><span>${esc(title)}</span><small>${esc(sub)}</small></span>
          <span class="amt ${t.type === 'income' ? 'pos' : ''}">${signedMoney(t.amount, t.type, cur)}</span>
        </button>`;
    })
    .join('');

  return `
    <section class="card recent dash-recent" aria-label="Letzte Buchungen">
      <div class="card-head">
        <h2 class="card-title">Letzte Buchungen</h2>
        <a class="link" href="#finance">Alle ansehen →</a>
      </div>
      ${rows ? `<div class="recent-list">${rows}</div>` : '<p class="empty">Noch keine Buchungen in diesem Monat.</p>'}
    </section>`;
}
