// Alle Dialoge zum Anlegen und Bearbeiten. Änderungen laufen über store.update().
import { getDoc, update, newId } from './store.js';
import { monthSummary, shouldNotifyOverBudget, categoryBudgetTotal, monthOf, suggestBudgets } from './calc.js';
import { openModal, confirmModal, toast } from './ui.js';
import { esc, moneyWithSymbol, currencySymbol, parseAmount, amountInputValue, monthLabel, todayIso, displayColor, initial } from './format.js';

// Pastellfarben für neue Kategorien. Bestehende Kategorien behalten ihre gespeicherte Farbe (Anzeige über displayColor).
const PALETTE = ['#BDE3FF', '#B8F2D0', '#FFE58F', '#D9C8FF', '#FFC2B4', '#E6DFD3', '#A9E8E1', '#FFD0E8'];

// ---------- FR-09: Änderung übernehmen und bei erster Überschreitung warnen ----------

// Führt eine Änderung aus (wie store.update) und prüft danach für jeden betroffenen Monat,
// ob er dadurch zum ersten Mal über das Budget rutscht. Dann einmal warnen und das in overBudgetNotified merken.
// months: Monate, die die Änderung betreffen kann (Duplikate werden entfernt).
function commit(months, mutate) {
  const unique = [...new Set(months)];
  // Zustand vor der Änderung festhalten, danach mit dem neuen vergleichen.
  const before = unique.map((m) => monthSummary(getDoc(), m));
  update(mutate);
  unique.forEach((month, i) => {
    const after = monthSummary(getDoc(), month);
    if (shouldNotifyOverBudget(before[i], after, getDoc())) {
      update((d) => {
        d.overBudgetNotified[month] = true;
      });
      toast(`Achtung: Dein Budget für ${monthLabel(month)} ist überschritten.`, 'error', 6000);
    }
  });
}

// Beim App-Start: Ist der Monat schon über Budget und wurde noch nicht gewarnt, jetzt einmal warnen.
export function checkOverBudgetOnLoad(month) {
  const doc = getDoc();
  const summary = monthSummary(doc, month);
  if (summary.overBudget && !doc.overBudgetNotified[month]) {
    update((d) => {
      d.overBudgetNotified[month] = true;
    });
    toast(`Achtung: Dein Budget für ${monthLabel(month)} ist überschritten.`, 'error', 6000);
  }
}

// ---------- Bausteine ----------

// Betragsfeld mit Währungssymbol als HTML. Der Wert wird mit Komma angezeigt (12,50).
function amountField(value, cur) {
  return `
    <div class="amount-field">
      <span>${currencySymbol(cur)}</span>
      <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(amountInputValue(value))}" aria-label="Betrag" autofocus>
    </div>`;
}

// Kategorien als auswählbare Chips (Radio-Gruppe) als HTML, oder ein Hinweis, wenn es noch keine gibt.
function categoryChips(categories, selectedId) {
  if (!categories.length) return '<p class="modal-text">Noch keine Kategorien. Lege im Dashboard eine an.</p>';
  return `<div class="chips" role="radiogroup" aria-label="Kategorie">
    ${categories
      .map(
        (c) => `<button type="button" class="chip sm pick ${c.id === selectedId ? 'active' : ''}" style="--c:${displayColor(c.color)}" data-cat="${c.id}" role="radio" aria-checked="${c.id === selectedId}">
          <span class="sw" aria-hidden="true"></span>${esc(c.name)}</button>`,
      )
      .join('')}
  </div>`;
}

// Macht eine Chip-Gruppe klickbar: genau ein Chip ist aktiv, onSelect bekommt den Wert aus data-<attr>.
function bindChips(modal, selector, attr, onSelect) {
  modal.querySelectorAll(selector).forEach((chip) => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll(selector).forEach((c) => {
        c.classList.toggle('active', c === chip);
        c.setAttribute('aria-checked', String(c === chip));
      });
      onSelect(chip.dataset[attr]);
    });
  });
}

// Zeigt eine Fehlermeldung im Formular an. Leerer Text blendet sie aus.
function formError(modal, message) {
  const el = modal.querySelector('.form-error');
  el.textContent = message;
  el.hidden = !message;
}

// ---------- Buchung (FR-01, FR-03) ----------

// Dialog zum Anlegen (ohne id) oder Bearbeiten (mit id) einer Buchung.
// type: Vorauswahl Ausgabe oder Einnahme beim Anlegen.
export function openTransactionModal({ type = 'expense', id } = {}) {
  const doc = getDoc();
  const cur = doc.settings.currency;
  const existing = id ? doc.transactions.find((t) => t.id === id) : null;
  // Stammt die Buchung aus Gehalt oder Fixkosten? Dann steht unten ein Hinweis.
  const recurringSource = existing?.recurringId ? doc.recurring.find((r) => r.id === existing.recurringId) : null;
  // Lokaler Zustand des Dialogs: gewählte Art und Kategorie (neue Buchung: erste Kategorie vorausgewählt).
  const state = {
    type: existing?.type || type,
    categoryId: existing ? existing.categoryId : doc.categories[0]?.id ?? null,
  };

  // HTML des Formulars: Umschalter Ausgabe/Einnahme, Betrag, Kategorie (nur bei Ausgaben), Notiz, Datum,
  // Hinweis bei automatischer Buchung, Fehlerzeile und Buttons (Löschen nur beim Bearbeiten).
  const body = `
    <form class="modal-form" novalidate style="display:contents">
      <div class="segmented" role="radiogroup" aria-label="Art der Buchung">
        <button type="button" data-type="expense" class="${state.type === 'expense' ? 'active' : ''}">Ausgabe</button>
        <button type="button" data-type="income" class="${state.type === 'income' ? 'active' : ''}">Einnahme</button>
      </div>
      ${amountField(existing?.amount, cur)}
      <div class="field" data-expense-only ${state.type === 'income' ? 'hidden' : ''}>
        <span class="field-label">Kategorie</span>
        ${categoryChips(doc.categories, state.categoryId)}
      </div>
      <input class="input" name="note" maxlength="120" value="${esc(existing?.note || '')}" aria-label="Notiz">
      <div class="field">
        <label class="field-label" for="tx-date">Datum</label>
        <input class="input" id="tx-date" name="date" type="date" required value="${existing?.date || todayIso()}">
      </div>
      ${recurringSource ? `<p class="modal-text" style="font-size:12px">Automatisch gebucht aus „${esc(recurringSource.title)}“. Änderungen gelten nur für diese Buchung.</p>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">
        <button type="submit" class="btn-primary" data-save></button>
        ${existing ? '<button type="button" class="btn-danger-text" data-delete>Buchung löschen</button>' : ''}
      </div>
    </form>`;

  openModal({
    title: existing ? 'Buchung bearbeiten' : 'Buchung hinzufügen',
    body,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      const note = form.elements.note;
      const saveButton = modal.querySelector('[data-save]');

      // Passt das Formular an die gewählte Art an: Kategorie ein-/ausblenden, Platzhalter und Button-Text.
      const refresh = () => {
        const isExpense = state.type === 'expense';
        modal.querySelector('[data-expense-only]').hidden = !isExpense;
        note.placeholder = isExpense ? 'Notiz, z. B. Billa Wocheneinkauf' : 'Notiz, z. B. Nebenjob September';
        saveButton.textContent = isExpense ? 'Ausgabe speichern' : 'Einnahme speichern';
        modal.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === state.type));
      };
      refresh();

      // Umschalter Ausgabe / Einnahme
      modal.querySelectorAll('[data-type]').forEach((button) =>
        button.addEventListener('click', () => {
          state.type = button.dataset.type;
          refresh();
        }),
      );
      bindChips(modal, '[data-cat]', 'cat', (value) => (state.categoryId = value));

      // Speichern: Eingaben prüfen, Buchung zusammenbauen und über commit() speichern (inkl. Budget-Warnung FR-09).
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const amount = parseAmount(form.elements.amount.value);
        const date = form.elements.date.value;
        // !(amount > 0) erwischt auch NaN, also eine ungültige Eingabe.
        if (!(amount > 0)) return formError(modal, 'Bitte gib einen gültigen Betrag an, z. B. 12,50.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return formError(modal, 'Bitte wähle ein Datum.');

        const tx = {
          id: existing?.id || newId(),
          type: state.type,
          amount,
          // Einnahmen haben keine Kategorie.
          categoryId: state.type === 'expense' ? state.categoryId : null,
          note: note.value.trim(),
          date,
          recurringId: existing?.recurringId || null,
        };
        // Betroffen ist der Monat des neuen Datums und beim Bearbeiten auch der alte Monat.
        const months = [monthOf(date), ...(existing ? [monthOf(existing.date)] : [])];
        // Bearbeiten: Buchung ersetzen. Neu: vorne in die Liste einfügen.
        commit(months, (d) => {
          if (existing) d.transactions = d.transactions.map((t) => (t.id === tx.id ? tx : t));
          else d.transactions.unshift(tx);
        });
        close();
        toast(existing ? 'Buchung gespeichert' : tx.type === 'expense' ? 'Ausgabe gespeichert' : 'Einnahme gespeichert', 'success');
      });

      // Löschen: erst diesen Dialog schließen (es gibt nur ein Modal gleichzeitig), dann Bestätigung abfragen.
      modal.querySelector('[data-delete]')?.addEventListener('click', async () => {
        close();
        const ok = await confirmModal({
          title: 'Buchung löschen?',
          text: `„${existing.note || 'Buchung'}“ wird endgültig gelöscht.`,
          confirmLabel: 'Löschen',
          danger: true,
        });
        if (!ok) return;
        update((d) => {
          d.transactions = d.transactions.filter((t) => t.id !== existing.id);
        });
        toast('Buchung gelöscht', 'success');
      });
    },
  });
}

// ---------- Kategorie (FR-02) ----------

// Dialog für eine Kategorie (FR-02). viewMonth: angezeigter Monat, für die Budget-Warnung in commit().
// Neue Kategorien bekommen reihum die nächste Farbe aus PALETTE.
export function openCategoryModal({ id, viewMonth } = {}) {
  const doc = getDoc();
  const cur = doc.settings.currency;
  const existing = id ? doc.categories.find((c) => c.id === id) : null;
  const state = { color: existing?.color || PALETTE[doc.categories.length % PALETTE.length] };

  // HTML: Vorschau-Icon mit Initiale, Name, Budget pro Monat, Farbauswahl, Fehlerzeile, Buttons.
  const body = `
    <form novalidate style="display:contents">
      <div class="row" style="gap:14px">
        <span class="cat-icon lg" data-preview style="flex:0 0 auto"></span>
        <input class="input" name="name" maxlength="40" placeholder="Name, z. B. Haustier" value="${esc(existing?.name || '')}" aria-label="Name" autofocus>
      </div>
      <label class="input-group">
        <span>Budget ${currencySymbol(cur)}</span>
        <input name="budget" inputmode="decimal" autocomplete="off" placeholder="200" value="${esc(amountInputValue(existing?.budget))}">
        <span style="font-size:11px">pro Monat</span>
      </label>
      <div class="field">
        <span class="field-label">Farbe</span>
        <div class="swatches" role="radiogroup" aria-label="Farbe">
          ${PALETTE.map(
            (color) => `<button type="button" class="swatch ${color === state.color ? 'active' : ''}" data-color="${color}"
              style="--c:${color}" role="radio" aria-checked="${color === state.color}" aria-label="Farbe ${color}"></button>`,
          ).join('')}
        </div>
      </div>
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">
        <button type="submit" class="btn-primary">Kategorie speichern</button>
        ${existing ? '<button type="button" class="btn-danger-text" data-delete>Kategorie löschen</button>' : ''}
      </div>
    </form>`;

  openModal({
    title: existing ? 'Kategorie bearbeiten' : 'Neue Kategorie',
    body,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      const preview = modal.querySelector('[data-preview]');
      // Vorschau-Icon live aktualisieren (Initiale des Namens und Farbe).
      const refresh = () => {
        preview.textContent = initial(form.elements.name.value);
        preview.style.setProperty('--c', displayColor(state.color));
      };
      refresh();
      form.elements.name.addEventListener('input', refresh);
      bindChips(modal, '[data-color]', 'color', (value) => {
        state.color = value;
        refresh();
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = form.elements.name.value.trim();
        // Leeres Budget-Feld bedeutet 0 (Kategorie ohne Budget).
        const budget = form.elements.budget.value.trim() === '' ? 0 : parseAmount(form.elements.budget.value);
        if (!name) return formError(modal, 'Bitte gib einen Namen an.');
        // Name darf nicht doppelt vorkommen (Groß-/Kleinschreibung egal), außer es ist dieselbe Kategorie.
        const duplicate = getDoc().categories.some((c) => c.id !== existing?.id && c.name.toLowerCase() === name.toLowerCase());
        if (duplicate) return formError(modal, 'Diese Kategorie gibt es schon.');
        if (!(budget >= 0)) return formError(modal, 'Bitte gib ein gültiges Budget an, z. B. 200.');

        commit([viewMonth], (d) => {
          if (existing) {
            d.categories = d.categories.map((c) => (c.id === existing.id ? { ...c, name, budget, color: state.color } : c));
          } else {
            d.categories.push({ id: newId(), name, budget, color: state.color });
          }
        });
        close();
        toast(existing ? 'Kategorie gespeichert' : `Kategorie „${name}“ angelegt`, 'success');
      });

      // Löschen: Buchungen und Fixkosten dieser Kategorie bleiben erhalten und verlieren nur die Zuordnung.
      modal.querySelector('[data-delete]')?.addEventListener('click', async () => {
        close();
        const used = getDoc().transactions.filter((t) => t.categoryId === existing.id).length;
        const ok = await confirmModal({
          title: 'Kategorie löschen?',
          text: used
            ? `„${existing.name}“ wird gelöscht. ${used} Buchung(en) bleiben erhalten und stehen danach unter „Ohne Kategorie“.`
            : `„${existing.name}“ wird gelöscht.`,
          confirmLabel: 'Löschen',
          danger: true,
        });
        if (!ok) return;
        update((d) => {
          d.categories = d.categories.filter((c) => c.id !== existing.id);
          d.transactions.forEach((t) => {
            if (t.categoryId === existing.id) t.categoryId = null;
          });
          d.recurring.forEach((r) => {
            if (r.categoryId === existing.id) r.categoryId = null;
          });
        });
        toast('Kategorie gelöscht', 'success');
      });
    },
  });
}

// ---------- Gehalt und Fixkosten (FR-05, FR-06, FR-07, FR-08) ----------

// Dialog für Gehalt (kind 'salary') oder Fixkosten (kind 'fixed'), FR-05 bis FR-08.
// Neue Einträge starten im aktuellen Monat. Die eigentliche Buchung erzeugt applyRecurring() in store.update().
export function openRecurringModal({ kind = 'fixed', id } = {}) {
  const doc = getDoc();
  const cur = doc.settings.currency;
  const existing = id ? doc.recurring.find((r) => r.id === id) : null;
  const entryKind = existing?.kind || kind;
  const isSalary = entryKind === 'salary';
  // Fixkosten: Kategorie "Wohnen" vorauswählen, falls vorhanden, sonst die erste.
  const state = { categoryId: existing ? existing.categoryId : (doc.categories.find((c) => c.name === 'Wohnen') || doc.categories[0])?.id ?? null };
  const label = isSalary ? 'Gehalt' : 'Fixkosten';

  // HTML: Betrag, Bezeichnung, Kategorie (nur Fixkosten), Aktiv-Schalter (nur beim Bearbeiten), Hinweistext, Buttons.
  const body = `
    <form novalidate style="display:contents">
      ${amountField(existing?.amount, cur)}
      <div class="field">
        <label class="field-label" for="rec-title">Bezeichnung</label>
        <input class="input" id="rec-title" name="title" maxlength="60" value="${esc(existing?.title || (isSalary ? 'Gehalt' : ''))}"
          placeholder="${isSalary ? 'z. B. Gehalt' : 'z. B. Miete, Handyvertrag, Öffi-Jahreskarte'}">
      </div>
      ${isSalary ? '' : `<div class="field"><span class="field-label">Kategorie</span>${categoryChips(doc.categories, state.categoryId)}</div>`}
      ${existing ? `<label class="toggle"><span>Aktiv (monatlich buchen)</span><input type="checkbox" name="active" ${existing.active ? 'checked' : ''}></label>` : ''}
      <p class="modal-text" style="font-size:12px">${
        existing
          ? 'Änderungen gelten ab der nächsten automatischen Buchung. Bereits gebuchte Monate bleiben unverändert.'
          : `Wird ab ${esc(monthLabel(monthOf(todayIso())))} am 1. jedes Monats automatisch als ${isSalary ? 'Einnahme' : 'Ausgabe'} gebucht.`
      }</p>
      <p class="form-error" role="alert" hidden></p>
      <div class="modal-actions">
        <button type="submit" class="btn-primary">${label} speichern</button>
        ${existing ? `<button type="button" class="btn-danger-text" data-delete>${label} löschen</button>` : ''}
      </div>
    </form>`;

  openModal({
    title: existing ? `${label} bearbeiten` : `${label} anlegen`,
    body,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      // Kategorie-Chips gibt es nur bei Fixkosten, beim Gehalt findet bindChips einfach nichts.
      bindChips(modal, '[data-cat]', 'cat', (value) => (state.categoryId = value));

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const amount = parseAmount(form.elements.amount.value);
        const title = form.elements.title.value.trim();
        if (!(amount > 0)) return formError(modal, 'Bitte gib einen gültigen Betrag an.');
        if (!title) return formError(modal, 'Bitte gib eine Bezeichnung an.');

        // Neuer Eintrag: lastBooked null, damit applyRecurring ab startMonth bucht.
        // Beim Bearbeiten bleibt lastBooked erhalten, darum ändern sich bereits gebuchte Monate nicht.
        const month = monthOf(todayIso());
        const entry = existing
          ? { ...existing, title, amount, categoryId: isSalary ? null : state.categoryId, active: form.elements.active.checked }
          : { id: newId(), kind: entryKind, title, amount, categoryId: isSalary ? null : state.categoryId, active: true, startMonth: month, lastBooked: null };

        commit([month], (d) => {
          if (existing) d.recurring = d.recurring.map((r) => (r.id === entry.id ? entry : r));
          else d.recurring.push(entry);
        });
        close();
        toast(existing ? `${label} gespeichert` : `${title} angelegt und für ${monthLabel(month)} gebucht`, 'success');
        // Erstes Gehalt und noch keine Budgets: direkt zum Festlegen der Budgets weiterführen.
        if (!existing && isSalary && getDoc().categories.length && categoryBudgetTotal(getDoc()) === 0) {
          openBudgetsModal({ afterSalary: true });
        }
      });

      // Löschen entfernt nur die Vorlage. Bereits erzeugte Buchungen bleiben bestehen.
      modal.querySelector('[data-delete]')?.addEventListener('click', async () => {
        close();
        const ok = await confirmModal({
          title: `${label} löschen?`,
          text: `„${existing.title}“ wird ab jetzt nicht mehr gebucht. Bereits gebuchte Beträge bleiben in deinen Buchungen erhalten.`,
          confirmLabel: 'Löschen',
          danger: true,
        });
        if (!ok) return;
        update((d) => {
          d.recurring = d.recurring.filter((r) => r.id !== existing.id);
        });
        toast(`${label} gelöscht`, 'success');
      });
    },
  });
}

// ---------- Monatsbudget (FR-04) ----------

// Dialog für das Budget-Limit eines Monats (FR-04). Ein eigener Wert landet in budgetOverrides[month],
// ohne eigenen Wert gilt die Summe der Kategorie-Budgets.
export function openBudgetModal(month) {
  const doc = getDoc();
  const cur = doc.settings.currency;
  const override = doc.budgetOverrides[month];
  const categoryTotal = categoryBudgetTotal(doc);

  // Body-HTML: Betragsfeld (vorbelegt mit eigenem Wert oder Kategorie-Summe), Erklärung, Buttons.
  // Der Zurücksetzen-Button erscheint nur, wenn es einen eigenen Wert gibt.
  openModal({
    title: `Budget ${monthLabel(month)}`,
    body: `
      <form novalidate style="display:contents">
        ${amountField(override ?? categoryTotal, cur)}
        <p class="modal-text" style="font-size:13px">Obergrenze für deine Ausgaben in diesem Monat. Ohne eigenen Wert gilt die Summe deiner Kategorie-Budgets: <strong>${moneyWithSymbol(categoryTotal, cur)}</strong>.</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Budget speichern</button>
          ${override != null ? '<button type="button" class="btn-secondary" data-reset>Auf Summe der Kategorien zurücksetzen</button>' : ''}
        </div>
      </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const amount = parseAmount(form.elements.amount.value);
        if (!(amount >= 0)) return formError(modal, 'Bitte gib einen gültigen Betrag an.');
        commit([month], (d) => {
          d.budgetOverrides[month] = amount;
        });
        close();
        toast('Budget gespeichert', 'success');
      });
      // Zurücksetzen: eigenen Wert löschen, dann gilt wieder die Summe der Kategorien.
      modal.querySelector('[data-reset]')?.addEventListener('click', () => {
        commit([month], (d) => {
          delete d.budgetOverrides[month];
        });
        close();
        toast('Budget zurückgesetzt', 'success');
      });
    },
  });
}

// ---------- Budgets je Kategorie festlegen (alle auf einmal) ----------

// Dialog, um die Budgets aller Kategorien auf einmal festzulegen.
// afterSalary: true, wenn der Dialog direkt nach dem ersten Gehalt aufgeht (anderer Einleitungstext).
export function openBudgetsModal({ afterSalary = false } = {}) {
  const doc = getDoc();
  const cur = doc.settings.currency;
  const month = monthOf(todayIso());
  if (!doc.categories.length) return toast('Lege zuerst eine Kategorie an.', 'info');

  // Basis für den 50/30/20-Vorschlag: Summe der aktiven Gehälter, sonst die Einnahmen des aktuellen Monats.
  const salaryTotal = doc.recurring.filter((r) => r.kind === 'salary' && r.active).reduce((s, r) => s + r.amount, 0);
  const income = salaryTotal || monthSummary(doc, month).income;
  const incomeLabel = salaryTotal ? 'Gehalt pro Monat' : `Einnahmen ${monthLabel(month)}`;
  const override = doc.budgetOverrides[month];

  // Eine Eingabezeile pro Kategorie (HTML-String). data-id verbindet das Feld mit der Kategorie.
  const rows = doc.categories
    .map(
      (c) => `
        <label class="budget-row">
          <span class="budget-name"><span class="sw" style="--c:${displayColor(c.color)}" aria-hidden="true"></span><span>${esc(c.name)}</span></span>
          <span class="input-group">
            <input data-id="${c.id}" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(amountInputValue(c.budget))}" aria-label="Budget ${esc(c.name)}">
            <span>${esc(currencySymbol(cur))}</span>
          </span>
        </label>`,
    )
    .join('');

  const intro = afterSalary
    ? 'Dein Gehalt ist angelegt. Lege jetzt fest, wie viel du pro Monat für jede Kategorie einplanst.'
    : 'Lege fest, wie viel du pro Monat für jede Kategorie einplanst. Zusammen ergibt das dein Budget-Limit.';

  // Body-HTML: Einleitung, Vorschlag-Button, Eingabezeilen, Summen (Budget-Limit, Einkommen, bleibt frei)
  // und ein Hinweis, falls für den Monat ein eigenes Limit gilt.
  openModal({
    title: 'Budgets festlegen',
    body: `
      <form novalidate style="display:contents">
        <p class="modal-text">${intro}</p>
        <div class="budget-suggest">
          <button type="button" class="btn sm" data-suggest ${income > 0 ? '' : 'disabled'}>Nach 50/30/20 vorschlagen</button>
          <span class="modal-note">${
            income > 0
              ? 'Faustregel: 50 % für Bedürfnisse (Wohnen, Essen, Mobilität), 30 % für Wünsche (Freizeit, Sonstiges), 20 % fürs Sparen. Eigene Kategorien bekommen keinen Vorschlag.'
              : 'Für einen Vorschlag lege zuerst ein Gehalt an.'
          }</span>
        </div>
        <div class="budget-rows">${rows}</div>
        <div class="rec-totals">
          <div><span>Summe = Budget-Limit</span><strong data-sum></strong></div>
          ${income > 0 ? `<div><span>${esc(incomeLabel)}</span><strong>${moneyWithSymbol(income, cur)}</strong></div><div><span>Bleibt frei</span><strong data-rest></strong></div>` : ''}
        </div>
        ${override != null ? `<p class="modal-note">Für ${esc(monthLabel(month))} gilt im Profil ein eigenes Limit von ${moneyWithSymbol(override, cur)}. Es hat Vorrang vor dieser Summe.</p>` : ''}
        <p class="form-error" role="alert" hidden></p>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Budgets speichern</button>
        </div>
      </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      const inputs = [...modal.querySelectorAll('[data-id]')];
      // Leeres Feld zählt als 0, eine ungültige Eingabe ergibt NaN.
      const valueOf = (input) => (input.value.trim() === '' ? 0 : parseAmount(input.value));

      // Summe und "Bleibt frei" bei jeder Eingabe live neu berechnen. Nachkommastellen nur, wenn nötig.
      const refresh = () => {
        const sum = inputs.reduce((s, input) => s + (valueOf(input) || 0), 0);
        modal.querySelector('[data-sum]').textContent = moneyWithSymbol(sum, cur, sum % 1 ? 2 : 0);
        const rest = modal.querySelector('[data-rest]');
        if (rest) rest.textContent = `${income - sum < 0 ? '−' : ''}${moneyWithSymbol(income - sum, cur, (income - sum) % 1 ? 2 : 0)}`;
      };
      refresh();
      inputs.forEach((input) => input.addEventListener('input', refresh));

      // Vorschlag nach 50/30/20 eintragen. Nur Standardkategorien (z. B. Wohnen, Essen) bekommen einen Wert.
      modal.querySelector('[data-suggest]').addEventListener('click', () => {
        const suggestion = suggestBudgets(getDoc().categories, income);
        inputs.forEach((input) => {
          if (suggestion[input.dataset.id] !== undefined) input.value = String(suggestion[input.dataset.id]);
        });
        refresh();
      });

      // Speichern: alle Felder prüfen, beim ersten ungültigen abbrechen und den Fokus dorthin setzen.
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const budgets = {};
        for (const input of inputs) {
          const value = valueOf(input);
          if (!(value >= 0)) {
            input.focus();
            return formError(modal, 'Bitte gib gültige Beträge an, z. B. 250 oder 12,50.');
          }
          budgets[input.dataset.id] = value;
        }
        commit([month], (d) => {
          d.categories.forEach((c) => {
            if (budgets[c.id] !== undefined) c.budget = budgets[c.id];
          });
        });
        close();
        toast('Budgets gespeichert', 'success');
      });
    },
  });
}

// ---------- Profil-Einstellungen ----------

// Dialog zum Ändern des Anzeigenamens im Profil.
export function openNameModal() {
  const doc = getDoc();
  openModal({
    title: 'Name ändern',
    body: `
      <form novalidate style="display:contents">
        <input class="input" name="name" maxlength="60" value="${esc(doc.profile.name)}" aria-label="Name" autofocus>
        <p class="form-error" role="alert" hidden></p>
        <button type="submit" class="btn-primary">Speichern</button>
      </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('form');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = form.elements.name.value.trim();
        if (!name) return formError(modal, 'Bitte gib einen Namen an.');
        update((d) => {
          d.profile.name = name;
        });
        close();
      });
    },
  });
}

// Allgemeiner Auswahl-Dialog (z. B. Währung, Warnschwelle). options: Liste aus [Wert, Beschriftung].
// onPick bekommt den gewählten Wert als String, danach schließt der Dialog.
export function openChoiceModal({ title, options, current, onPick }) {
  openModal({
    title,
    body: `<div class="chips" role="radiogroup">
      ${options
        .map(
          ([value, label]) =>
            `<button type="button" class="chip ${String(value) === String(current) ? 'active' : ''}" data-value="${esc(value)}" role="radio" aria-checked="${String(value) === String(current)}">${esc(label)}</button>`,
        )
        .join('')}
    </div>`,
    onMount(modal, close) {
      modal.querySelectorAll('[data-value]').forEach((chip) =>
        chip.addEventListener('click', () => {
          onPick(chip.dataset.value);
          close();
        }),
      );
    },
  });
}
