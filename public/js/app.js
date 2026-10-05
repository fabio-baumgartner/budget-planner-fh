// Einstieg der App: laden, Routing (#dashboard, #finance, #profile), rendern, Aktionen verteilen.
import { api } from './api.js';
import { load, getDoc, update, subscribe, onSaveState } from './store.js';
import { monthSummary, addMonths, monthOf, transactionsToCsv } from './calc.js';
import { todayIso, initial, esc, money } from './format.js';
import { icons } from './icons.js';
import { toast, confirmModal, closeModal } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderFinance } from './views/finance.js';
import { renderProfile } from './views/profile.js';
import { renderAnalysis } from './views/analysis.js';
import {
  openTransactionModal,
  openCategoryModal,
  openRecurringModal,
  openBudgetModal,
  openBudgetsModal,
  openNameModal,
  openChoiceModal,
  checkOverBudgetOnLoad,
} from './modals.js';

// Alle Ansichten der App. Der Schlüssel ist gleichzeitig der URL-Hash (#dashboard, #finance, #auswertungen, #profile).
// render bekommt die aktuellen Daten und liefert das HTML der Ansicht als String.
const VIEWS = {
  dashboard: { label: 'Dashboard', icon: icons.dashboard, render: renderDashboard },
  finance: { label: 'Finance Manager', icon: icons.finance, render: renderFinance },
  auswertungen: { label: 'Auswertungen', icon: icons.analysis, render: renderAnalysis },
  profile: { label: 'Profil', icon: icons.profile, render: renderProfile },
};

// UI-Zustand, der nicht gespeichert wird: aktive Ansicht, gewählter Monat (JJJJ-MM), Filter im Finance Manager.
const ui = {
  view: 'dashboard',
  month: monthOf(todayIso()),
  filter: 'all',
};

// Start, sobald das HTML geladen ist.
document.addEventListener('DOMContentLoaded', init);

// Initialisierung: Icons und Navigation einsetzen, Daten laden, Listener registrieren, erstes Rendern.
async function init() {
  // Elemente mit data-icon="..." im statischen HTML bekommen ihr SVG-Icon.
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icons[el.dataset.icon]));
  renderNav();

  try {
    // load() holt das Dokument vom Server und bucht fällige Gehälter und Fixkosten nach.
    const created = await load();
    if (created.length) toast(`${created.length} wiederkehrende Buchung(en) automatisch gebucht`, 'success');
  } catch (err) {
    // 401 = nicht eingeloggt: zur Login-Seite. Andere Fehler werden direkt in der Ansicht angezeigt.
    if (err.status === 401) return location.replace('/login');
    document.getElementById('view').innerHTML = `<div class="loading">Konnte deine Daten nicht laden: ${esc(err.message)}</div>`;
    return;
  }

  readRoute();
  // Navigation über den URL-Hash: offenes Modal schließen, neu rendern, nach oben scrollen.
  window.addEventListener('hashchange', () => {
    readRoute();
    closeModal();
    render();
    window.scrollTo(0, 0);
  });
  // State-Fluss: jede Änderung über store.update() ruft render() auf, die Ansicht wird komplett neu aufgebaut.
  subscribe(render);
  // Speicherstatus ("Speichert …", "Gespeichert") in der Oberfläche anzeigen.
  onSaveState(renderSaveState);
  // Ein einziger Klick-Listener für die ganze Seite (Event-Delegation, siehe onAction).
  document.addEventListener('click', onAction);
  render();
  // FR-09: beim Öffnen einmal warnen, falls der Monat schon über Budget ist.
  checkOverBudgetOnLoad(ui.month);
}

// Liest die Ansicht aus dem URL-Hash. Unbekannter oder leerer Hash führt zum Dashboard.
function readRoute() {
  const view = location.hash.slice(1);
  ui.view = VIEWS[view] ? view : 'dashboard';
}

// Baut die Navigationslinks aus VIEWS und setzt sie in jedes Element mit data-nav (Seitenleiste und Leiste unten).
function renderNav() {
  const html = Object.entries(VIEWS)
    .map(([key, v]) => `<a class="nav-btn" href="#${key}" data-view="${key}">${v.icon}<span>${v.label}</span></a>`)
    .join('');
  document.querySelectorAll('[data-nav]').forEach((nav) => (nav.innerHTML = html));
}

// animate: Balken wachsen beim Rendern (aus bei reinen Filterwechseln und bei "Bewegung reduzieren").
function render({ animate = true } = {}) {
  const doc = getDoc();
  const today = todayIso();
  // Kennzahlen des gewählten Monats (Einnahmen, Ausgaben, verfügbar, Limit, Status) aus calc.js.
  const summary = monthSummary(doc, ui.month);

  // Statusfarbe ok / knapp / drüber für die ganze App (FR-09)
  document.body.dataset.status = summary.status;
  document.body.classList.toggle('is-over', summary.status === 'over');
  // Aktiven Navigationspunkt markieren (aria-current für Screenreader).
  document.querySelectorAll('[data-view]').forEach((link) => {
    const active = link.dataset.view === ui.view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  // Initiale, Name und E-Mail in die Platzhalter mit data-user-* im statischen HTML eintragen.
  document.querySelectorAll('[data-user-initial]').forEach((el) => (el.textContent = initial(doc.profile.name)));
  document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = doc.profile.name));
  document.querySelectorAll('[data-user-email]').forEach((el) => (el.textContent = doc.profile.email));
  document.title = `${VIEWS[ui.view].label} · Budget Planner`;

  // Die gewählte Ansicht liefert einen HTML-String, der den Inhalt von #view komplett ersetzt.
  // Klasse "grow" startet im CSS die Wachs-Animation der Balken.
  const view = document.getElementById('view');
  view.classList.toggle('grow', animate && !reducedMotion.matches);
  view.innerHTML = VIEWS[ui.view].render({
    doc,
    today,
    month: ui.month,
    currentMonth: monthOf(today),
    summary,
    filter: ui.filter,
  });
  // Auf dem Dashboard die große Zahl animiert hochzählen lassen.
  if (ui.view === 'dashboard') countHero(view, doc.settings.currency);
}

// ---------- Zählwerk: die Hero-Zahl zählt vom zuletzt gezeigten Wert zum neuen ----------

// Nutzer hat im System "Bewegung reduzieren" eingestellt: dann keine Animationen.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// heroShown: zuletzt angezeigter Wert, heroFrame: ID des laufenden Animationsframes.
let heroShown = null;
let heroFrame = 0;

// Lässt die Zahl in [data-hero] in ca. 900 ms vom alten zum neuen Wert laufen.
// Formatiert wird selbst mit money(), weil money() nur den Betrag ohne Vorzeichen liefert.
function countHero(view, currency) {
  const el = view.querySelector('[data-hero]');
  if (!el) return;
  const target = Number(el.dataset.hero);
  const from = heroShown ?? 0;
  const show = (value) => {
    const rounded = Math.round(value);
    el.textContent = `${rounded < 0 ? '−' : ''}${money(rounded, currency)}`;
  };
  // Eine eventuell noch laufende Animation abbrechen.
  cancelAnimationFrame(heroFrame);
  // Ohne Animation, wenn reduzierte Bewegung gewünscht ist oder sich der gerundete Wert nicht ändert.
  if (reducedMotion.matches || Math.round(from) === Math.round(target)) {
    heroShown = target;
    show(target);
    return;
  }
  const start = performance.now();
  show(from);
  // Wird pro Bildschirm-Frame aufgerufen. 1 - (1 - p)^3 lässt die Zahl zum Ende hin abbremsen (Ease-out).
  const step = (now) => {
    const progress = Math.min((now - start) / 900, 1);
    heroShown = from + (target - from) * (1 - (1 - progress) ** 3);
    show(heroShown);
    if (progress < 1) heroFrame = requestAnimationFrame(step);
    else heroShown = target;
  };
  heroFrame = requestAnimationFrame(step);
}

// Letzter abgeschlossener Status (saved oder error), damit Toasts nur beim Wechsel erscheinen.
let lastSaveState = 'saved';

// Zeigt den Speicherstatus in allen [data-save-state]-Elementen und meldet Fehler und Erholung per Toast.
function renderSaveState(state) {
  const labels = { pending: 'Ungespeichert', saving: 'Speichert …', saved: 'Gespeichert', error: 'Speichern fehlgeschlagen' };
  document.querySelectorAll('[data-save-state]').forEach((el) => {
    el.textContent = labels[state] || '';
    el.classList.toggle('error', state === 'error');
  });
  // Nur beim ersten Fehler melden, nicht bei jedem neuen Versuch.
  if (state === 'error' && lastSaveState !== 'error') toast('Speichern fehlgeschlagen. Neuer Versuch in 5 Sekunden.', 'error');
  if (state === 'saved' && lastSaveState === 'error') toast('Wieder gespeichert', 'success');
  if (state !== 'pending' && state !== 'saving') lastSaveState = state;
}

// ---------- Aktionen (Event-Delegation über data-action) ----------

// Zuordnung data-action -> Funktion. Buttons im HTML tragen z. B. data-action="edit-tx" data-id="...".
// Jede Funktion bekommt el.dataset, also alle data-*-Attribute des geklickten Elements als Objekt.
const actions = {
  'add-income': () => openTransactionModal({ type: 'income' }),
  'add-expense': () => openTransactionModal({ type: 'expense' }),
  'edit-tx': ({ id }) => openTransactionModal({ id }),
  'new-category': () => openCategoryModal({ viewMonth: ui.month }),
  'edit-category': ({ id }) => openCategoryModal({ id, viewMonth: ui.month }),
  'new-recurring': ({ kind }) => openRecurringModal({ kind }),
  'edit-recurring': ({ id }) => openRecurringModal({ id }),
  'edit-budget': () => openBudgetModal(ui.month),
  'edit-budgets': () => openBudgetsModal(),
  'edit-name': () => openNameModal(),

  // Monatswahl (Pfeile, Klick auf den Monat, Balken im Verlauf)
  'prev-month': () => setMonth(addMonths(ui.month, -1)),
  'next-month': () => setMonth(addMonths(ui.month, 1)),
  'current-month': () => setMonth(monthOf(todayIso())),
  'select-month': ({ month }) => setMonth(month),
  // ⓘ-Erklärungen: per Tipp als Meldung, damit sie auch am Handy lesbar sind
  info: ({ text }) => toast(text, 'info', 6000),

  // Übertrag aus dem Vormonat an/aus. Fehlt die Einstellung (undefined), gilt sie als an.
  'toggle-carry': () => {
    const on = getDoc().settings.carryOver === false;
    update((d) => {
      d.settings.carryOver = on;
    });
    toast(on ? 'Übertrag aus dem Vormonat ist an' : 'Übertrag aus dem Vormonat ist aus', 'success');
  },
  // Filter im Finance Manager. Nur UI-Zustand, darum ohne update() und ohne Balken-Animation.
  filter: ({ filter }) => {
    ui.filter = filter;
    render({ animate: false });
  },

  // Einstellungen im Profil: Auswahl-Dialog, der gewählte Wert wird über update() gespeichert.
  'edit-currency': () =>
    openChoiceModal({
      title: 'Währung',
      options: [
        ['EUR', 'Euro (€)'],
        ['CHF', 'Franken (CHF)'],
        ['USD', 'US-Dollar ($)'],
      ],
      current: getDoc().settings.currency,
      onPick: (currency) =>
        update((d) => {
          d.settings.currency = currency;
        }),
    }),

  'edit-warn': () =>
    openChoiceModal({
      title: 'Warnung ab',
      options: [0.75, 0.8, 0.85, 0.9, 0.95, 1].map((v) => [v, `${Math.round(v * 100)} %`]),
      current: getDoc().settings.warnAt,
      onPick: (value) =>
        update((d) => {
          // data-value ist immer ein String, daher zurück in eine Zahl.
          d.settings.warnAt = Number(value);
        }),
    }),

  // CSV-Export aller Buchungen: Datei im Browser erzeugen und als Download anstoßen.
  'export-csv': () => {
    const csv = transactionsToCsv(getDoc());
    // BOM, damit Excel die Umlaute richtig liest.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    // Unsichtbarer Link mit download-Attribut, der Klick darauf startet den Download.
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `budget-planner-${todayIso()}.csv`;
    link.click();
    // Temporäre Blob-URL kurz danach wieder freigeben.
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },

  // Abmelden: der Server löscht das Session-Cookie. Auch bei einem Fehler geht es zur Login-Seite.
  logout: async () => {
    await api.logout().catch(() => {});
    location.replace('/login');
  },

  // Account löschen erst nach Bestätigung, danach zur Registrierung.
  'delete-account': async () => {
    const ok = await confirmModal({
      title: 'Account löschen?',
      text: 'Dein Account und alle Buchungen, Kategorien und Einstellungen werden endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAccount();
      location.replace('/login#register');
    } catch (err) {
      toast(err.message, 'error');
    }
  },
};

// Zentraler Klick-Handler: sucht das nächste Element mit data-action (auch wenn auf ein Icon darin geklickt wurde)
// und ruft die passende Funktion aus actions auf. Klappt auch für Elemente, die erst später gerendert werden.
function onAction(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const handler = actions[el.dataset.action];
  if (!handler) return;
  // Standardaktion des Elements (z. B. Link folgen oder Formular absenden) unterbinden.
  event.preventDefault();
  handler(el.dataset, el);
}

// Wechselt den angezeigten Monat und rendert neu (der Monat steht nicht in der URL).
function setMonth(month) {
  ui.month = month;
  render();
}
