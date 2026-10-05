// Bausteine, die mehrere Screens nutzen.
import { icons } from '../icons.js';
import { esc, monthLabel, initial, displayColor } from '../format.js';

// Seitenkopf: Titel links (Akzentwort als Textmarker in Statusfarbe), rechts optional Monatswahl und die Buttons "Einnahme" / "Ausgabe".
export function pageHead({ eyebrow, title, accent, month, currentMonth, actions = false }) {
  // Rechte Seite nur, wenn month bzw. actions übergeben werden (das Profil hat z. B. keine Monatswahl).
  const right = [month ? monthSwitch(month, currentMonth) : '', actions ? actionButtons() : ''].join('');
  return `
    <div class="page-head">
      <div class="page-head-text">
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
        <h1 class="page-title">${esc(title)} <span class="hl">${esc(accent)}</span></h1>
      </div>
      ${right ? `<div class="page-actions">${right}</div>` : ''}
    </div>`;
}

// Monatswahl: zurück, aktueller Monat (Klick springt zu heute, deaktiviert wenn schon aktuell), vor.
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
    <button type="button" class="btn-action income press" data-action="add-income">${icons.plus}Einnahme</button>
    <button type="button" class="btn-action expense press" data-action="add-expense">${icons.minus}Ausgabe</button>`;
}

// Rundes Icon mit dem Anfangsbuchstaben in der Kategoriefarbe.
export function categoryIcon(label, color, size = 'sm') {
  return `<span class="cat-icon ${size}" style="--c:${displayColor(color)}" aria-hidden="true">${esc(initial(label))}</span>`;
}

// Kleines Farbquadrat für Listen, Tabellen und Chips
export function swatch(color) {
  return `<span class="sw" style="--c:${displayColor(color)}" aria-hidden="true"></span>`;
}

// Kategorien als Nachschlagetabelle { id: Kategorie }, damit Buchungen ihre Kategorie schnell finden.
export function categoryMap(doc) {
  return Object.fromEntries(doc.categories.map((c) => [c.id, c]));
}

// Anzeige-Kategorie einer Buchung: Einnahmen mint, gelöschte Kategorien weiß.
export function displayCategory(tx, cats) {
  if (tx.type === 'income') return { name: 'Einnahme', color: INCOME_COLOR };
  return cats[tx.categoryId] || NO_CATEGORY;
}

// Werden oben in displayCategory schon verwendet. Das klappt, weil die Funktion erst nach dem Laden des Moduls aufgerufen wird.
export const NO_CATEGORY = { name: 'Ohne Kategorie', color: '#FFFFFF' };
export const INCOME_COLOR = '#B8F2D0';
