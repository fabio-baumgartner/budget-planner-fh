import { esc, money, currencySymbol, memberSince, monthLabel, initial } from '../format.js';
import { icons } from '../icons.js';
import { pageHead } from './shared.js';

export function renderProfile({ doc, month, summary }) {
  const cur = doc.settings.currency;
  const isOverride = doc.budgetOverrides[month] != null;
  const settings = [
    { label: 'Name', value: doc.profile.name, action: 'edit-name' },
    { label: 'Währung', value: cur, action: 'edit-currency' },
    { label: 'Warnung bei', value: `${Math.round(doc.settings.warnAt * 100)} % vom Budget`, action: 'edit-warn' },
    { label: 'Monatsbeginn', value: '1. des Monats' },
    { label: 'Daten exportieren', value: 'CSV', action: 'export-csv' },
    { label: 'Abmelden', value: '', action: 'logout' },
    { label: 'Account löschen', value: '', action: 'delete-account', danger: true },
  ];

  return `
    <div style="display:flex;flex-direction:column;gap:24px;max-width:720px">
      ${pageHead({ title: 'Dein', accent: 'Profil' })}
      <div class="profile-grid">
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
            <small>Monatsbudget ${esc(monthLabel(month))}${isOverride ? '' : ' (Summe Kategorien)'}</small>
            <strong>${currencySymbol(cur)} ${money(summary.limit, cur)}</strong>
          </div>
          <span class="hero-chip">Anpassen</span>
        </button>
      </div>
      <div class="settings-list">
        ${settings
          .map((s) => {
            const tag = s.action ? 'button type="button"' : 'div';
            const close = s.action ? 'button' : 'div';
            return `<${tag} class="setting ${s.danger ? 'danger' : ''}" ${s.action ? `data-action="${s.action}"` : ''}>
              <span>${esc(s.label)}</span>
              <span class="setting-value">${esc(s.value)}${s.action ? icons.chevron : ''}</span>
            </${close}>`;
          })
          .join('')}
      </div>
    </div>`;
}
