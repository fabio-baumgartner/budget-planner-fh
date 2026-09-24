// Bausteine, die mehrere Screens nutzen.
import { icons } from '../icons.js';
import { esc, monthLabel } from '../format.js';

export function pageHead({ eyebrow, title, accent, month, currentMonth }) {
  return `
    <div class="page-head">
      <div class="page-head-text">
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
        <h1 class="page-title">${esc(title)} <span>${esc(accent)}</span></h1>
      </div>
      ${month ? monthSwitch(month, currentMonth) : ''}
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

export function categoryMap(doc) {
  return Object.fromEntries(doc.categories.map((c) => [c.id, c]));
}

export const NO_CATEGORY = { name: 'Ohne Kategorie', color: '#808080' };
export const INCOME_COLOR = '#26C839';
