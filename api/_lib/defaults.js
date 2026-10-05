// Startdokument für neue User. Kategorien und Farben aus dem UI-Design.
// Budgets starten bei 0: Jeder legt sie selbst fest (Dialog "Budgets festlegen" in der App).
import { randomUUID } from 'node:crypto';

// Die sechs Standardkategorien. Die IDs werden erst in createDefaultDoc() vergeben.
const DEFAULT_CATEGORIES = [
  { name: 'Wohnen', color: '#2E7CF6', budget: 0 },
  { name: 'Essen', color: '#26C839', budget: 0 },
  { name: 'Mobilität', color: '#E8A400', budget: 0 },
  { name: 'Freizeit', color: '#8B5CF6', budget: 0 },
  { name: 'Sparen', color: '#145F1E', budget: 0 },
  { name: 'Sonstiges', color: '#808080', budget: 0 },
];

// Baut das Dokument, das ein neuer User bekommt. Gleiche Struktur, wie sie sanitizeDoc() in validate.js prüft.
// today ist optional (Standard: jetzt) und lässt sich z. B. für Tests festlegen.
export function createDefaultDoc({ name, email, today = new Date() }) {
  return {
    version: 1,
    // createdAt nur als Datum JJJJ-MM-TT, ohne Uhrzeit.
    profile: { name, email, createdAt: today.toISOString().slice(0, 10) },
    // Standard: Euro, Warnung ab 90 % des Budgets, Übertrag aus dem Vormonat an.
    settings: { currency: 'EUR', warnAt: 0.9, carryOver: true },
    // Eigenes Monatslimit pro Monat, z. B. { '2026-09': 1500 } (FR-04). Leer = Summe der Kategorie-Budgets.
    budgetOverrides: {},
    // Monate, für die die Meldung "Budget überschritten" schon kam (FR-09).
    overBudgetNotified: {},
    // Jede Kategorie bekommt eine eigene zufällige ID, ...c kopiert name, color und budget dazu.
    categories: DEFAULT_CATEGORIES.map((c) => ({ id: randomUUID(), ...c })),
    recurring: [],
    transactions: [],
  };
}
