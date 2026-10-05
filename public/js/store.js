// Hält das User-Dokument im Speicher und speichert Änderungen verzögert (debounced) auf dem Server.
import { api } from './api.js';
import { applyRecurring } from './calc.js';
import { todayIso } from './format.js';

// ---------- Zustand ----------
// doc: das komplette User-Dokument vom Server (Profil, Buchungen, Kategorien, Einstellungen, ...)
// timer: Timeout für das verzögerte Speichern
// saving / dirtyWhileSaving: verhindern parallele Speicher-Requests (siehe flush)
// saveState: 'pending' | 'saving' | 'saved' | 'error', wird in der Oberfläche angezeigt
// listeners: Funktionen, die nach jeder Änderung aufgerufen werden (subscribe), saveListeners: für den Speicherstatus
let doc = null;
let timer = null;
let saving = false;
let dirtyWhileSaving = false;
let saveState = 'saved';
const listeners = new Set();
const saveListeners = new Set();

// Eindeutige ID für neue Buchungen, Kategorien usw., erzeugt im Browser.
export const newId = () => crypto.randomUUID();

// Lädt das Dokument vom Server und bucht fällige wiederkehrende Posten nach (FR-07 / FR-08).
// Rückgabe: die neu erzeugten Buchungen (app.js zeigt dazu einen Toast).
export async function load() {
  doc = await api.getData();
  const result = applyRecurring(doc, todayIso(), newId);
  // Nur wenn wirklich etwas nachgebucht wurde, liefert applyRecurring ein neues Objekt. Dann sofort speichern.
  if (result.doc !== doc) {
    doc = result.doc;
    scheduleSave(0);
  }
  return result.created;
}

// Liefert das aktuelle Dokument. Nur lesen, Änderungen immer über update().
export function getDoc() {
  return doc;
}

// Änderungen immer über update(): Kopie ändern, wiederkehrende Posten nachbuchen, speichern, neu rendern.
export function update(mutate) {
  // structuredClone erzeugt eine tiefe Kopie, mutate darf sie frei verändern.
  const next = structuredClone(doc);
  mutate(next);
  doc = applyRecurring(next, todayIso(), newId).doc;
  scheduleSave();
  // Alle Abonnenten informieren (app.js rendert dann die aktuelle Ansicht neu).
  listeners.forEach((fn) => fn(doc));
}

// Meldet eine Funktion an, die nach jeder Änderung mit dem neuen doc aufgerufen wird.
// Rückgabe: Funktion zum Abmelden.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Meldet eine Funktion für den Speicherstatus an und ruft sie sofort mit dem aktuellen Status auf.
export function onSaveState(fn) {
  saveListeners.add(fn);
  fn(saveState);
}

// Setzt den Speicherstatus und informiert alle Angemeldeten (z. B. Anzeige "Gespeichert").
function setSaveState(state, error) {
  saveState = state;
  saveListeners.forEach((fn) => fn(state, error));
}

// Debounce: jede Änderung startet den Timer neu. Erst wenn delay ms lang nichts passiert, wird gespeichert.
// So entsteht bei vielen schnellen Änderungen nur ein Request.
function scheduleSave(delay = 500) {
  clearTimeout(timer);
  setSaveState('pending');
  timer = setTimeout(flush, delay);
}

// Schickt das aktuelle doc an den Server (PUT /api/data).
async function flush() {
  // Läuft schon ein Request, nur merken und danach nochmal speichern (siehe finally).
  if (saving) {
    dirtyWhileSaving = true;
    return;
  }
  saving = true;
  setSaveState('saving');
  try {
    await api.saveData(doc);
    setSaveState(dirtyWhileSaving ? 'pending' : 'saved');
  } catch (err) {
    // 401: Session abgelaufen, zurück zum Login.
    if (err.status === 401) return location.replace('/login');
    setSaveState('error', err);
    // Nach einem Fehler in 5 Sekunden nochmal versuchen.
    clearTimeout(timer);
    timer = setTimeout(flush, 5000);
  } finally {
    saving = false;
    // Während des Speicherns kam eine Änderung dazu: gleich nochmal speichern, damit sie nicht verloren geht.
    if (dirtyWhileSaving) {
      dirtyWhileSaving = false;
      flush();
    }
  }
}

// Beim Schließen des Tabs offene Änderungen noch rausschicken.
window.addEventListener('pagehide', () => {
  if (saveState === 'pending' || saveState === 'error') {
    clearTimeout(timer);
    // keepalive: der Browser schickt den Request auch dann noch fertig, wenn die Seite schon weg ist.
    api.saveData(doc, { keepalive: true }).catch(() => {});
  }
});
