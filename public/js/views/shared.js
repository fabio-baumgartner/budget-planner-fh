// Bausteine, die mehrere Screens nutzen.
import { icons } from '../icons.js';
import { esc, monthLabel, tint, initial } from '../format.js';

// Seitenkopf: Titel links, rechts optional Monatswahl und die Buttons "Einnahme" / "Ausgabe".
export function pageHead({ eyebrow, title, accent, month, currentMonth, actions = false }) {
  const right = [month ? monthSwitch(month, currentMonth) : '', actions ? actionButtons() : ''].join('');
  return `
    <div class="page-head">
      <div class="page-head-text">
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
        <h1 class="page-title">${esc(title)} <span>${esc(accent)}</span></h1>
      </div>
      ${right ? `<div class="page-actions">${right}</div>` : ''}
    </div>`;
}

function monthSwitch(month, currentMonth) {
  const isCurrent = month === currentMonth;
  return `
    <div class="month-switch" role="group" aria-label="Monat wählen">
      <button type="button" class="icon-btn" data-action="prev-month" aria-label="Vorheriger Monat">${icons.left}</button>
      <button type="button" class="month-label" data-action="current-month" ${isCurrent ? 'disabled' : ''}
        title="${isCurrent ? '' : 'Zurück zum aktuellen Monat'}">${esc(monthLabel(month))}</button>
      <button type="button" class="icon-btn" data-action="next-month" aria-label="Nächster Monat">${icons.right}</button>
    </div>`;
}

// Am Handy übernimmt die Topbar diese Buttons (per CSS ausgeblendet).
function actionButtons() {
  return `
    <button type="button" class="btn-action income" data-action="add-income">${icons.plus}Einnahme</button>
    <button type="button" class="btn-action expense" data-action="add-expense">${icons.minus}Ausgabe</button>`;
}

export function categoryIcon(label, color, size = 'sm') {
  return `<span class="cat-icon ${size}" style="background:${tint(color)};color:${color}" aria-hidden="true">${esc(initial(label))}</span>`;
}

export function categoryMap(doc) {
  return Object.fromEntries(doc.categories.map((c) => [c.id, c]));
}

// Anzeige-Kategorie einer Buchung: Einnahmen grün, gelöschte Kategorien grau.
export function displayCategory(tx, cats) {
  if (tx.type === 'income') return { name: 'Einnahme', color: INCOME_COLOR };
  return cats[tx.categoryId] || NO_CATEGORY;
}

export const NO_CATEGORY = { name: 'Ohne Kategorie', color: '#808080' };
export const INCOME_COLOR = '#26C839';
