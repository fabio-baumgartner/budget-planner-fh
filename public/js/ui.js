// Generische UI-Bausteine: Modal und Toast.
import { icons } from './icons.js';
import { esc } from './format.js';

// close-Funktion des gerade offenen Modals oder null. Es ist immer höchstens ein Modal offen.
let activeModal = null;

// Öffnet ein Modal. body ist HTML, onMount bekommt das Modal-Element und eine close-Funktion.
export function openModal({ title, body, onMount, onClose, label }) {
  // Ein eventuell schon offenes Modal zuerst schließen.
  closeModal();
  const root = document.getElementById('modal-root');
  // Fokus merken, damit er nach dem Schließen zurück auf den auslösenden Button springt (Barrierefreiheit).
  const lastFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', label || title);
  // Kopfzeile mit Titel (escaped) und Schließen-Button, darunter der übergebene body.
  // body wird NICHT escaped, der Aufrufer muss Benutzereingaben darin selbst mit esc() absichern.
  modal.innerHTML = `
    <div class="modal-head">
      <h2 class="modal-title">${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Schließen">${icons.close}</button>
    </div>
    ${body}`;

  root.append(backdrop, modal);
  // Seite dahinter nicht scrollen lassen, solange das Modal offen ist.
  document.body.style.overflow = 'hidden';

  // Escape-Taste schließt das Modal.
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  // Schließt genau dieses Modal und räumt auf (Elemente, Listener, Scroll-Sperre, Fokus), danach onClose.
  // Die Prüfung am Anfang verhindert doppeltes Schließen, falls close mehrfach aufgerufen wird.
  const close = () => {
    if (activeModal !== close) return;
    activeModal = null;
    backdrop.remove();
    modal.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    lastFocus?.focus?.();
    onClose?.();
  };

  // Schließen per Klick auf den abgedunkelten Hintergrund oder auf jedes Element mit data-close.
  backdrop.addEventListener('click', close);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  activeModal = close;

  // Jetzt registriert der Aufrufer seine eigenen Event-Listener im Modal.
  onMount?.(modal, close);
  // Feld für den Fokus: [autofocus] oder sonst das erste Eingabefeld bzw. der erste Button (außer Schließen).
  const focusTarget = modal.querySelector('[autofocus]') || modal.querySelector('input, button:not([data-close])');
  // Auf Touch-Geräten nicht sofort die Tastatur aufklappen.
  if (focusTarget && !matchMedia('(pointer: coarse)').matches) focusTarget.focus();
  return close;
}

// Schließt das aktuell offene Modal, falls es eines gibt (z. B. beim Wechsel der Ansicht).
export function closeModal() {
  activeModal?.();
}

// Ja/Nein-Dialog als Promise: await confirmModal(...) liefert true (bestätigt) oder false (abgebrochen).
// danger: roter Button für endgültige Aktionen wie Löschen.
export function confirmModal({ title, text, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    // Wird nur beim Klick auf den Bestätigen-Button true. Escape, Hintergrund oder "Abbrechen" ergeben false.
    let answered = false;
    openModal({
      title,
      body: `
        <p class="modal-text">${esc(text)}</p>
        <div class="modal-actions">
          <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmLabel)}</button>
          <button type="button" class="btn-secondary" data-close>Abbrechen</button>
        </div>`,
      onMount(modal, close) {
        modal.querySelector('[data-confirm]').addEventListener('click', () => {
          answered = true;
          close();
        });
      },
      // Egal wie das Modal geschlossen wird: erst hier wird das Promise aufgelöst.
      onClose: () => resolve(answered),
    });
  });
}

// Kurze Einblendung (Toast), die nach duration Millisekunden von selbst verschwindet.
// kind: 'info' | 'success' | 'error'. Fehler haben role=alert und werden von Screenreadern sofort vorgelesen.
export function toast(message, kind = 'info', duration = 3500) {
  const stack = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
  stack.append(el);
  // Höchstens drei Meldungen gleichzeitig.
  while (stack.children.length > 3) stack.firstElementChild.remove();
  setTimeout(() => el.remove(), duration);
}
