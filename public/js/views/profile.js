import { categoryBudgetTotal } from '../calc.js';
import { esc, money, currencySymbol, memberSince, monthLabel, initial } from '../format.js';
import { icons } from '../icons.js';
import { pageHead } from './shared.js';

const CURRENCY_NAMES = { EUR: 'Euro (€)', CHF: 'Franken (CHF)', USD: 'US-Dollar ($)' };

export function renderProfile({ doc, month, summary }) {
  const cur = doc.settings.currency;
  const isOverride = doc.budgetOverrides[month] != null;
  const groups = [
    {
      title: 'Konto',
      items: [
        { label: 'Name', value: doc.profile.name, action: 'edit-name' },
        { label: 'E-Mail', value: doc.profile.email },
      ],
    },
    {
      title: 'Einstellungen',
      items: [
        { label: 'Währung', value: CURRENCY_NAMES[cur], action: 'edit-currency' },
        { label: 'Warnung bei', value: `${Math.round(doc.settings.warnAt * 100)} % vom Budget`, action: 'edit-warn' },
      ],
    },
    {
      title: 'Daten',
      items: [
        { label: 'Buchungen exportieren', value: 'CSV', action: 'export-csv' },
        { label: 'Abmelden', value: '', action: 'logout' },
        { label: 'Account löschen', value: '', action: 'delete-account', danger: true },
      ],
    },
  ];

  const settings = groups
    .map(
      (group) => `
        <div class="settings-group">${esc(group.title)}</div>
        ${group.items
          .map((s) => {
            const open = s.action ? `button type="button" data-action="${s.action}"` : 'div';
            const close = s.action ? 'button' : 'div';
            return `<${open} class="setting ${s.danger ? 'danger' : ''}">
              <span>${esc(s.label)}</span>
              <span class="setting-value"><span style="overflow:hidden;text-overflow:ellipsis">${esc(s.value)}</span>${s.action ? icons.chevron : ''}</span>
            </${close}>`;
          })
          .join('')}`,
    )
    .join('');

  return `
    <div class="page">
      ${pageHead({ title: 'Dein', accent: 'Profil' })}
      <div class="profile">
        <div class="profile-col">
          <div class="card profile-card">
            <span class="avatar lg" aria-hidden="true">${esc(initial(doc.profile.name))}</span>
            <div>
              <strong>${esc(doc.profile.name)}</strong>
              <small>${esc(doc.profile.email)}</small>
              <small>Mitglied seit ${esc(memberSince(doc.profile.createdAt))}</small>
            </div>
          </div>
          <button type="button" class="budget-card" data-action="edit-budget">
            <div>
              <small>Monatsbudget ${esc(monthLabel(month))}</small>
              <strong>${currencySymbol(cur)} ${money(summary.limit, cur)}</strong>
              <small>${isOverride ? 'Eigener Wert für diesen Monat' : `Summe der Kategorie-Budgets (${money(categoryBudgetTotal(doc), cur)})`}</small>
            </div>
            <span class="hero-chip">Anpassen</span>
          </button>
        </div>
        <div class="settings-list">${settings}</div>
      </div>
    </div>`;
}
