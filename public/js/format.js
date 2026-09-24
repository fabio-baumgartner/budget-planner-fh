// Formatierung von Geld, Datum und Text für die Anzeige.

const LOCALE_BY_CURRENCY = { EUR: 'de-AT', CHF: 'de-CH', USD: 'en-US' };
const SYMBOL = { EUR: '€', CHF: 'CHF', USD: '$' };

export function currencySymbol(currency) {
  return SYMBOL[currency] || currency;
}

// Betrag ohne Währung. decimals: 0 für Übersichten, 2 für Buchungen.
export function money(amount, currency, decimals = 0) {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] || 'de-AT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
}

export function moneyWithSymbol(amount, currency, decimals = 0) {
  const value = money(amount, currency, decimals);
  return currency === 'USD' ? `$${value}` : `${value} ${currencySymbol(currency)}`;
}

export function signedMoney(amount, type, currency) {
  return `${type === 'income' ? '+' : '−'}${moneyWithSymbol(amount, currency, 2)}`;
}

// "12,50" oder "12.50" oder "1.234,5" -> 12.5; ungültig -> NaN
export function parseAmount(input) {
  let text = String(input).trim().replace(/\s|'/g, '');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else {
    text = text.replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text);
}

export function amountInputValue(amount) {
  return amount ? String(amount).replace('.', ',') : '';
}

const monthFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function monthLabel(month) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

export function dateLabel(iso) {
  return shortDate.format(new Date(`${iso}T00:00:00Z`));
}

export function memberSince(iso) {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function initial(text) {
  return (String(text).trim()[0] || '?').toUpperCase();
}

export function tint(hex, alpha = 0.14) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
