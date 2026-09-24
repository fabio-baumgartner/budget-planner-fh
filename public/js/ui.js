// Generische UI-Bausteine: Modal und Toast.
import { icons } from './icons.js';
import { esc } from './format.js';

let activeModal = null;

// Öffnet ein Modal. body ist HTML, onMount bekommt das Modal-Element und eine close-Funktion.
export function openModal({ title, body, onMount, onClose, label }) {
  closeModal();
  const root = document.getElementById('modal-root');
  const lastFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', label || title);
  modal.innerHTML = `
    <div class="modal-head">
      <h2 class="modal-title">${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Schließen">${icons.close}</button>
    </div>
    ${body}`;

  root.append(backdrop, modal);
  document.body.style.overflow = 'hidden';

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
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

  backdrop.addEventListener('click', close);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  activeModal = close;

  onMount?.(modal, close);
  const focusTarget = modal.querySelector('[autofocus]') || modal.querySelector('input, button:not([data-close])');
  // Auf Touch-Geräten nicht sofort die Tastatur aufklappen.
  if (focusTarget && !matchMedia('(pointer: coarse)').matches) focusTarget.focus();
  return close;
}

export function closeModal() {
  activeModal?.();
}

export function confirmModal({ title, text, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
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
      onClose: () => resolve(answered),
    });
  });
}

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
