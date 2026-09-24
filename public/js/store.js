// Hält das User-Dokument im Speicher und speichert Änderungen verzögert (debounced) auf dem Server.
import { api } from './api.js';
import { applyRecurring } from './calc.js';
import { todayIso } from './format.js';

let doc = null;
let timer = null;
let saving = false;
let dirtyWhileSaving = false;
let saveState = 'saved';
const listeners = new Set();
const saveListeners = new Set();

export const newId = () => crypto.randomUUID();

export async function load() {
  doc = await api.getData();
  const result = applyRecurring(doc, todayIso(), newId);
  if (result.doc !== doc) {
    doc = result.doc;
    scheduleSave(0);
  }
  return result.created;
}

export function getDoc() {
  return doc;
}

// Änderungen immer über update(): Kopie ändern, wiederkehrende Posten nachbuchen, speichern, neu rendern.
export function update(mutate) {
  const next = structuredClone(doc);
  mutate(next);
  doc = applyRecurring(next, todayIso(), newId).doc;
  scheduleSave();
  listeners.forEach((fn) => fn(doc));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onSaveState(fn) {
  saveListeners.add(fn);
  fn(saveState);
}

function setSaveState(state, error) {
  saveState = state;
  saveListeners.forEach((fn) => fn(state, error));
}

function scheduleSave(delay = 500) {
  clearTimeout(timer);
  setSaveState('pending');
  timer = setTimeout(flush, delay);
}

async function flush() {
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
    if (err.status === 401) return location.replace('/login');
    setSaveState('error', err);
    // Nach einem Fehler in 5 Sekunden nochmal versuchen.
    clearTimeout(timer);
    timer = setTimeout(flush, 5000);
  } finally {
    saving = false;
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
    api.saveData(doc, { keepalive: true }).catch(() => {});
  }
});
