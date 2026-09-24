// Einstieg der App: laden, Routing (#dashboard, #finance, #profile), rendern, Aktionen verteilen.
import { api } from './api.js';
import { load, getDoc, update, subscribe, onSaveState } from './store.js';
import { monthSummary, addMonths, monthOf, transactionsToCsv } from './calc.js';
import { todayIso, initial, esc } from './format.js';
import { icons } from './icons.js';
import { toast, confirmModal, closeModal } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderFinance } from './views/finance.js';
import { renderProfile } from './views/profile.js';
import {
  openTransactionModal,
  openCategoryModal,
  openRecurringModal,
  openBudgetModal,
  openNameModal,
  openChoiceModal,
  checkOverBudgetOnLoad,
} from './modals.js';

const VIEWS = {
  dashboard: { label: 'Dashboard', icon: icons.dashboard, render: renderDashboard },
  finance: { label: 'Finance Manager', icon: icons.finance, render: renderFinance },
  profile: { label: 'Profil', icon: icons.profile, render: renderProfile },
};

const ui = {
  view: 'dashboard',
  month: monthOf(todayIso()),
  filter: 'all',
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icons[el.dataset.icon]));
  renderNav();

  try {
    const created = await load();
    if (created.length) toast(`${created.length} wiederkehrende Buchung(en) automatisch gebucht`, 'success');
  } catch (err) {
    if (err.status === 401) return location.replace('/login');
    document.getElementById('view').innerHTML = `<div class="loading">Konnte deine Daten nicht laden: ${esc(err.message)}</div>`;
    return;
  }

  readRoute();
  window.addEventListener('hashchange', () => {
    readRoute();
    closeModal();
    render();
    window.scrollTo(0, 0);
  });
  subscribe(render);
  onSaveState(renderSaveState);
  document.addEventListener('click', onAction);
  render();
  checkOverBudgetOnLoad(ui.month);
}

function readRoute() {
  const view = location.hash.slice(1);
  ui.view = VIEWS[view] ? view : 'dashboard';
}

function renderNav() {
  const html = Object.entries(VIEWS)
    .map(([key, v]) => `<a class="nav-btn" href="#${key}" data-view="${key}">${v.icon}<span>${v.label}</span></a>`)
    .join('');
  document.querySelectorAll('[data-nav]').forEach((nav) => (nav.innerHTML = html));
}

function render() {
  const doc = getDoc();
  const today = todayIso();
  const summary = monthSummary(doc, ui.month);

  document.body.classList.toggle('is-over', summary.status === 'over');
  document.querySelectorAll('[data-view]').forEach((link) => {
    const active = link.dataset.view === ui.view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('header-avatar').textContent = initial(doc.profile.name);
  document.title = `${VIEWS[ui.view].label} · Budget Planner`;

  document.getElementById('view').innerHTML = VIEWS[ui.view].render({
    doc,
    today,
    month: ui.month,
    currentMonth: monthOf(today),
    summary,
    filter: ui.filter,
  });
}

let lastSaveState = 'saved';

function renderSaveState(state) {
  const labels = { pending: 'Ungespeichert', saving: 'Speichert …', saved: 'Gespeichert', error: 'Speichern fehlgeschlagen' };
  const el = document.getElementById('save-state');
  el.textContent = labels[state] || '';
  el.style.color = state === 'error' ? 'var(--red)' : '';
  // Nur beim ersten Fehler melden, nicht bei jedem neuen Versuch.
  if (state === 'error' && lastSaveState !== 'error') toast('Speichern fehlgeschlagen. Neuer Versuch in 5 Sekunden.', 'error');
  if (state === 'saved' && lastSaveState === 'error') toast('Wieder gespeichert', 'success');
  if (state !== 'pending' && state !== 'saving') lastSaveState = state;
}

// ---------- Aktionen (Event-Delegation über data-action) ----------

const actions = {
  'add-income': () => openTransactionModal({ type: 'income' }),
  'add-expense': () => openTransactionModal({ type: 'expense' }),
  'edit-tx': ({ id }) => openTransactionModal({ id }),
  'new-category': () => openCategoryModal({ viewMonth: ui.month }),
  'edit-category': ({ id }) => openCategoryModal({ id, viewMonth: ui.month }),
  'new-recurring': ({ kind }) => openRecurringModal({ kind }),
  'edit-recurring': ({ id }) => openRecurringModal({ id }),
  'edit-budget': () => openBudgetModal(ui.month),
  'edit-name': () => openNameModal(),

  'prev-month': () => setMonth(addMonths(ui.month, -1)),
  'next-month': () => setMonth(addMonths(ui.month, 1)),
  'current-month': () => setMonth(monthOf(todayIso())),
  filter: ({ filter }) => {
    ui.filter = filter;
    render();
  },

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
          d.settings.warnAt = Number(value);
        }),
    }),

  'export-csv': () => {
    const csv = transactionsToCsv(getDoc());
    // BOM, damit Excel die Umlaute richtig liest.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `budget-planner-${todayIso()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },

  logout: async () => {
    await api.logout().catch(() => {});
    location.replace('/login');
  },

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

function onAction(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const handler = actions[el.dataset.action];
  if (!handler) return;
  event.preventDefault();
  handler(el.dataset, el);
}

function setMonth(month) {
  ui.month = month;
  render();
}
