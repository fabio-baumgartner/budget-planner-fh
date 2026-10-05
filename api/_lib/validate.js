// Prüft das User-Dokument vor dem Speichern. Whitelist: unbekannte Felder fallen weg.
import { HttpError } from './http.js';

// Größenlimit für das ganze Dokument, gemessen an der Länge des JSON-Texts.
const MAX_DOC_BYTES = 900_000;
// Formate: Monat JJJJ-MM (01 bis 12), Datum JJJJ-MM-TT, Farbe #RRGGBB.
// DATE prüft nur das Format, nicht ob es den Tag gibt (2026-02-31 würde durchgehen).
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const CURRENCIES = ['EUR', 'CHF', 'USD'];
// Höchstwert für einzelne Beträge (1 Milliarde).
const MAX_AMOUNT = 1_000_000_000;

// Bricht die Prüfung mit 400 (Bad Request) und einer lesbaren Meldung ab. Gibt nie etwas zurück.
function fail(message) {
  throw new HttpError(400, message);
}

// Text prüfen: muss ein String sein, wird getrimmt und muss danach min bis max Zeichen lang sein.
function text(value, field, { min = 0, max }) {
  if (typeof value !== 'string') fail(`${field} fehlt`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) fail(`${field} muss ${min} bis ${max} Zeichen haben`);
  return trimmed;
}

// IDs: nur Buchstaben, Ziffern, _ und -, 1 bis 64 Zeichen (passt z. B. zu UUIDs).
function id(value, field) {
  if (typeof value !== 'string' || !/^[\w-]{1,64}$/.test(value)) fail(`${field} ist ungültig`);
  return value;
}

// Wie id(), aber null/undefined ist erlaubt und wird zu null (z. B. Einnahme ohne Kategorie).
function optionalId(value, field) {
  return value == null ? null : id(value, field);
}

// Betrag prüfen: endliche Zahl, nicht negativ, höchstens MAX_AMOUNT. 0 nur mit allowZero (z. B. bei Budgets).
function amount(value, field, { allowZero = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} ist keine Zahl`);
  if (value < 0 || (!allowZero && value === 0) || value > MAX_AMOUNT) fail(`${field} ist außerhalb des gültigen Bereichs`);
  // Auf Cent runden (2 Nachkommastellen).
  return Math.round(value * 100) / 100;
}

// Liste prüfen: muss ein Array mit höchstens max Einträgen sein, jedes Element ein Objekt.
// mapItem prüft ein einzelnes Element und baut die bereinigte Version. Feldname und Index landen in der Fehlermeldung.
function list(value, field, max, mapItem) {
  if (!Array.isArray(value)) fail(`${field} muss eine Liste sein`);
  if (value.length > max) fail(`${field}: höchstens ${max} Einträge`);
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') fail(`${field}[${index}] ist ungültig`);
    return mapItem(item, `${field}[${index}]`);
  });
}

// Objekt mit Monaten als Schlüssel prüfen, z. B. { '2026-09': 1500 }. Fehlt es, wird {} daraus.
// mapValue prüft bzw. wandelt jeden Wert. Höchstens 600 Einträge (50 Jahre).
function monthMap(value, field, mapValue) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(`${field} ist ungültig`);
  const out = {};
  const entries = Object.entries(value);
  if (entries.length > 600) fail(`${field}: zu viele Einträge`);
  for (const [key, entry] of entries) {
    if (!MONTH.test(key)) fail(`${field}: ungültiger Monat ${key}`);
    out[key] = mapValue(entry, `${field}.${key}`);
  }
  return out;
}

// Haupt-Funktion, aufgerufen von PUT /api/data. input = Dokument vom Client, stored = aktuell gespeichertes Dokument.
// Baut ein neues Objekt nur aus erlaubten Feldern (Whitelist). Ein Fehler bricht mit 400 ab, dann wird nichts gespeichert.
export function sanitizeDoc(input, stored) {
  if (!input || typeof input !== 'object') fail('Dokument fehlt');
  if (JSON.stringify(input).length > MAX_DOC_BYTES) fail('Dokument zu groß');

  // Einstellungen: nur bekannte Währungen, Warnschwelle zwischen 0,5 und 1 (50 % bis 100 %).
  const settings = input.settings || {};
  if (!CURRENCIES.includes(settings.currency)) fail('Währung ist ungültig');
  if (typeof settings.warnAt !== 'number' || settings.warnAt < 0.5 || settings.warnAt > 1) fail('Warnschwelle ist ungültig');

  return {
    version: 1,
    profile: {
      name: text(input.profile?.name, 'Name', { min: 1, max: 60 }),
      // E-Mail und Beitrittsdatum kann der Client nicht ändern.
      email: stored.profile.email,
      createdAt: stored.profile.createdAt,
    },
    settings: {
      currency: settings.currency,
      warnAt: Math.round(settings.warnAt * 100) / 100,
      // Übertrag aus dem Vormonat, fehlt bei älteren Dokumenten -> an
      carryOver: settings.carryOver !== false,
    },
    budgetOverrides: monthMap(input.budgetOverrides, 'budgetOverrides', (v, f) => amount(v, f, { allowZero: true })),
    // Alles außer true wird zu false.
    overBudgetNotified: monthMap(input.overBudgetNotified, 'overBudgetNotified', (v) => v === true),
    categories: list(input.categories, 'categories', 50, (c, f) => ({
      id: id(c.id, `${f}.id`),
      name: text(c.name, `${f}.name`, { min: 1, max: 40 }),
      // Muster "gültig ? Wert : fail(...)": fail wirft einen Fehler, liefert also nie einen Wert.
      color: COLOR.test(c.color) ? c.color : fail(`${f}.color ist ungültig`),
      budget: amount(c.budget, `${f}.budget`, { allowZero: true }),
    })),
    recurring: list(input.recurring, 'recurring', 100, (r, f) => ({
      id: id(r.id, `${f}.id`),
      kind: r.kind === 'salary' || r.kind === 'fixed' ? r.kind : fail(`${f}.kind ist ungültig`),
      title: text(r.title, `${f}.title`, { min: 1, max: 60 }),
      amount: amount(r.amount, `${f}.amount`),
      categoryId: optionalId(r.categoryId, `${f}.categoryId`),
      active: r.active !== false,
      startMonth: MONTH.test(r.startMonth) ? r.startMonth : fail(`${f}.startMonth ist ungültig`),
      // null (noch nie gebucht) oder ein Monat JJJJ-MM.
      lastBooked: r.lastBooked == null ? null : MONTH.test(r.lastBooked) ? r.lastBooked : fail(`${f}.lastBooked ist ungültig`),
    })),
    transactions: list(input.transactions, 'transactions', 20_000, (t, f) => ({
      id: id(t.id, `${f}.id`),
      type: t.type === 'expense' || t.type === 'income' ? t.type : fail(`${f}.type ist ungültig`),
      amount: amount(t.amount, `${f}.amount`),
      categoryId: optionalId(t.categoryId, `${f}.categoryId`),
      // Notiz ist optional: fehlt sie, wird "" daraus.
      note: text(t.note ?? '', `${f}.note`, { max: 120 }),
      date: DATE.test(t.date) ? t.date : fail(`${f}.date ist ungültig`),
      recurringId: optionalId(t.recurringId, `${f}.recurringId`),
    })),
  };
}
