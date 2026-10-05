// Formatierung von Geld, Datum und Text für die Anzeige.

// EUR mit de-DE, weil de-AT im Browser ein Leerzeichen als Tausendertrennzeichen nutzt (2 221 statt 2.221).
const LOCALE_BY_CURRENCY = { EUR: 'de-DE', CHF: 'de-CH', USD: 'en-US' };
const SYMBOL = { EUR: '€', CHF: 'CHF', USD: '$' };

// '€' für EUR, '$' für USD, sonst der Währungscode selbst (z. B. 'CHF').
export function currencySymbol(currency) {
  return SYMBOL[currency] || currency;
}

// Betrag ohne Währung. decimals: 0 für Übersichten, 2 für Buchungen.
export function money(amount, currency, decimals = 0) {
  // Intl.NumberFormat formatiert nach Landesregeln (Tausenderpunkt, Dezimalkomma). Unbekannte Währung: de-AT.
  // Math.abs: Das Vorzeichen wird hier weggelassen, das setzt bei Bedarf signedMoney().
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] || 'de-AT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));
}

// Betrag mit Währung: '$12' bei USD (Symbol vorne), sonst '12 €' bzw. '12 CHF'.
export function moneyWithSymbol(amount, currency, decimals = 0) {
  const value = money(amount, currency, decimals);
  // Geschütztes Leerzeichen: Zahl und Währung brechen nie auseinander.
  return currency === 'USD' ? `$${value}` : `${value} ${currencySymbol(currency)}`;
}

// Mit Vorzeichen für Buchungslisten: + bei Einnahmen, typografisches Minuszeichen (U+2212) bei Ausgaben.
export function signedMoney(amount, type, currency, decimals = 2) {
  return `${type === 'income' ? '+' : '−'}${moneyWithSymbol(amount, currency, decimals)}`;
}

// "12,50" oder "12.50" oder "1.234,5" -> 12.5; ungültig -> NaN
export function parseAmount(input) {
  // Leerzeichen und Apostrophe entfernen (Apostroph = Schweizer Tausendertrennzeichen, z. B. 1'234).
  let text = String(input).trim().replace(/\s|'/g, '');
  if (!text) return NaN;
  // Komma und Punkt kommen vor: Das weiter hinten stehende Zeichen ist das Dezimaltrennzeichen, das andere der Tausendertrenner.
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else {
    // Nur Komma oder nur Punkt (oder keins): Komma wird zum Dezimalpunkt.
    text = text.replace(',', '.');
  }
  // Am Ende nur Ziffern mit höchstens 2 Nachkommastellen, also auch keine negativen Beträge.
  // Achtung: '1.234' (nur Tausenderpunkt) hätte 3 Nachkommastellen und ergibt deshalb NaN.
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text);
}

// Zahl für ein Eingabefeld: 12.5 -> '12,5'. 0 oder kein Wert -> '' (leeres Feld statt 0).
export function amountInputValue(amount) {
  return amount ? String(amount).replace('.', ',') : '';
}

// Formatierer einmal anlegen und wiederverwenden statt bei jedem Aufruf neu.
// timeZone UTC, weil die Datumswerte unten als UTC-Mitternacht erzeugt werden. Sonst könnte sich je nach Zeitzone der Tag verschieben.
const monthFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const monthShortFormat = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: 'UTC' });
const monthNameFormat = new Intl.DateTimeFormat('de-AT', { month: 'long', timeZone: 'UTC' });

// '2026-09' -> 'September 2026'
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

// '2026-09-05' -> '5. Sep.'
export function dateLabel(iso) {
  return shortDate.format(new Date(`${iso}T00:00:00Z`));
}

// Beitrittsdatum: '2026-09-01' -> 'September 2026'
export function memberSince(iso) {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

// Heutiges Datum als 'JJJJ-MM-TT' in der lokalen Zeitzone des Browsers.
export function todayIso() {
  const now = new Date();
  // toISOString() rechnet immer in UTC. Deshalb vorher den Zeitzonen-Versatz ausgleichen,
  // sonst wäre es in Wien kurz nach Mitternacht laut UTC noch der Vortag.
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// Erster Buchstabe groß, z. B. für den Avatar. Leerer Text -> '?'.
export function initial(text) {
  return (String(text).trim()[0] || '?').toUpperCase();
}

// '#RRGGBB' -> 'rgba(r, g, b, alpha)', also dieselbe Farbe halbtransparent.
// Die drei Farbkanäle werden per Bit-Shift (>>) und Maske (& 255) aus der Zahl geholt.
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

// Liefert zur gespeicherten Kategoriefarbe die Anzeigefarbe (siehe Erklärung oben).
export function displayColor(hex) {
  const color = String(hex || '').toUpperCase();
  if (PASTEL_FOR[color]) return PASTEL_FOR[color];
  if (!/^#[0-9A-F]{6}$/.test(color)) return '#E6DFD3';
  const n = parseInt(color.slice(1), 16);
  const rgb = [n >> 16, (n >> 8) & 255, n & 255];
  // Relative Helligkeit nach WCAG: Farbkanäle zuerst linearisieren (die Gamma-Kurve von sRGB rückgängig machen).
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  // Gewichtete Summe, Grün wirkt fürs Auge am hellsten. Ab 0,55 ist die Farbe hell genug für schwarze Schrift.
  if (0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.55) return color;
  // Sonst Richtung Weiß mischen: 35 % Originalfarbe, 65 % Weiß.
  const light = rgb.map((c) => Math.round(255 - (255 - c) * 0.35));
  return `#${light.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// HTML-Sonderzeichen und ihre sicheren Ersatzzeichen (Entities).
const ESCAPES ={ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escaping für Text, der per Template-String ins HTML eingesetzt wird. Verhindert, dass Eingaben wie <script>
// als HTML ausgeführt werden (XSS, Cross-Site Scripting). null/undefined wird zu "".
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
