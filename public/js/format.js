// Formatierung von Geld, Datum und Text für die Anzeige.

// EUR mit de-DE, weil de-AT im Browser ein Leerzeichen als Tausendertrennzeichen nutzt (2 221 statt 2.221).
const LOCALE_BY_CURRENCY = { EUR: 'de-DE', CHF: 'de-CH', USD: 'en-US' };
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

export function signedMoney(amount, type, currency, decimals = 2) {
  return `${type === 'income' ? '+' : '−'}${moneyWithSymbol(amount, currency, decimals)}`;
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

const monthShortFormat = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: 'UTC' });
const monthNameFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', timeZone: 'UTC' });

export function monthLabel(month) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

// "Sep", "Okt" (ohne Punkt, für Diagramm-Achsen)
export function monthShort(month) {
  return monthShortFormat.format(new Date(`${month}-01T00:00:00Z`)).replace('.', '');
}

// "September"
export function monthName(month) {
  return monthNameFormat.format(new Date(`${month}-01T00:00:00Z`));
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

// Kategoriefarben für die Anzeige: Kacheln und Icons tragen schwarze Schrift, brauchen also helle Flächen.
// Gespeichert bleibt immer die Originalfarbe. Alte Standardfarben bekommen ein festes Pastell-Gegenstück,
// andere dunkle Farben werden mit Weiß aufgehellt.
const PASTEL_FOR = {
  '#26C839': '#B8F2D0',
  '#2E7CF6': '#BDE3FF',
  '#E8A400': '#FFE58F',
  '#8B5CF6': '#D9C8FF',
  '#145F1E': '#FFC2B4',
  '#808080': '#E6DFD3',
  '#0EA5A5': '#A9E8E1',
  '#D9538A': '#FFD0E8',
};

export function displayColor(hex) {
  const color = String(hex || '').toUpperCase();
  if (PASTEL_FOR[color]) return PASTEL_FOR[color];
  if (!/^#[0-9A-F]{6}$/.test(color)) return '#E6DFD3';
  const n = parseInt(color.slice(1), 16);
  const rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  if (0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.55) return color;
  const light = rgb.map((c) => Math.round(255 - (255 - c) * 0.35));
  return `#${light.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

const ESCAPES ={ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
