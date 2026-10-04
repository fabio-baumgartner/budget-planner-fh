// Startdokument für neue User. Kategorien und Farben aus dem UI-Design.
// Budgets starten bei 0: Jeder legt sie selbst fest (Dialog "Budgets festlegen" in der App).
import { randomUUID } from 'node:crypto';

const DEFAULT_CATEGORIES = [
  { name: 'Wohnen', color: '#2E7CF6', budget: 0 },
  { name: 'Essen', color: '#26C839', budget: 0 },
  { name: 'Mobilität', color: '#E8A400', budget: 0 },
  { name: 'Freizeit', color: '#8B5CF6', budget: 0 },
  { name: 'Sparen', color: '#145F1E', budget: 0 },
  { name: 'Sonstiges', color: '#808080', budget: 0 },
];

export function createDefaultDoc({ name, email, today = new Date() }) {
  return {
    version: 1,
    profile: { name, email, createdAt: today.toISOString().slice(0, 10) },
    settings: { currency: 'EUR', warnAt: 0.9, carryOver: true },
    budgetOverrides: {},
    overBudgetNotified: {},
    categories: DEFAULT_CATEGORIES.map((c) => ({ id: randomUUID(), ...c })),
    recurring: [],
    transactions: [],
  };
}
