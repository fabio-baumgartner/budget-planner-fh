// Login und Registrierung (login.html)
import { api } from './api.js';

// Texte, die sich zwischen den Tabs "Anmelden" und "Registrieren" unterscheiden.
// title enthält HTML (<span> zum Hervorheben) und wird deshalb per innerHTML gesetzt.
// autocomplete hilft dem Passwort-Manager: gespeichertes Passwort ausfüllen oder ein neues vorschlagen.
const TEXT = {
  login: {
    title: 'Willkommen <span>zurück</span>',
    sub: 'Melde dich an, um dein Budget zu sehen.',
    submit: 'Anmelden',
    autocomplete: 'current-password',
  },
  register: {
    title: 'Dein <span>Budget</span> startet hier',
    sub: 'Lege einen Account an. Deine Daten sieht nur du.',
    submit: 'Account erstellen',
    autocomplete: 'new-password',
  },
};

// Aktueller Modus: 'login' oder 'register'.
let mode = 'login';

// Startpunkt, sobald das HTML der Login-Seite geladen ist.
document.addEventListener('DOMContentLoaded', async () => {
  // Schon eingeloggt? Direkt in die App.
  try {
    await api.me();
    location.replace('/');
    return;
  } catch {
    /* nicht eingeloggt */
  }

  const form = document.getElementById('auth-form');
  const error = document.getElementById('auth-error');
  const submit = document.getElementById('auth-submit');

  // Link mit #register (z. B. nach dem Löschen des Accounts) öffnet gleich den Tab "Registrieren".
  if (location.hash === '#register') setMode('register');

  // Tab-Buttons mit data-mode="login" bzw. "register" schalten den Modus um.
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  // Absenden: erst im Browser prüfen, dann an die API schicken.
  form.addEventListener('submit', async (event) => {
    // Standardverhalten (Seite neu laden) verhindern, der Request läuft selbst per fetch.
    event.preventDefault();
    error.hidden = true;
    // Alle Formularfelder als Objekt { name, email, password }.
    const data = Object.fromEntries(new FormData(form));
    const message = validate(data);
    if (message) return showError(message);

    // Button sperren, damit nicht doppelt abgeschickt wird.
    submit.disabled = true;
    submit.textContent = 'Einen Moment …';
    try {
      if (mode === 'login') await api.login(data.email, data.password);
      else await api.register(data.name, data.email, data.password);
      // Erfolg: der Server hat das Session-Cookie gesetzt, also weiter zur App.
      // replace statt Link: die Login-Seite landet nicht im Zurück-Verlauf.
      location.replace('/');
    } catch (err) {
      // Fehlertext vom Server anzeigen (z. B. falsches Passwort) und Button wieder freigeben.
      showError(err.message);
      submit.disabled = false;
      submit.textContent = TEXT[mode].submit;
    }
  });

  // Zeigt eine Fehlermeldung über dem Absenden-Button.
  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
});

// Wechselt zwischen Anmelden und Registrieren: Texte, Namensfeld, aktiver Tab und URL-Hash.
function setMode(next) {
  mode = next;
  const text = TEXT[mode];
  document.getElementById('auth-title').innerHTML = text.title;
  document.getElementById('auth-sub').textContent = text.sub;
  document.getElementById('auth-submit').textContent = text.submit;
  document.getElementById('name-field').hidden = mode !== 'register';
  document.getElementById('password').autocomplete = text.autocomplete;
  document.getElementById('auth-error').hidden = true;
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  // URL-Hash anpassen, ohne einen neuen Eintrag im Browser-Verlauf anzulegen.
  history.replaceState(null, '', mode === 'register' ? '#register' : location.pathname);
}

// Prüfung im Browser vor dem Absenden. Rückgabe: Fehlertext oder null, wenn alles passt.
// Nur für schnelles Feedback, der Server prüft die Eingaben zusätzlich selbst.
function validate({ name = '', email = '', password = '' }) {
  if (mode === 'register' && !name.trim()) return 'Bitte gib deinen Namen an.';
  // Einfache Formprüfung: etwas@etwas.etwas ohne Leerzeichen.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Bitte gib eine gültige E-Mail-Adresse an.';
  if (mode === 'register' && password.length < 8) return 'Das Passwort braucht mindestens 8 Zeichen.';
  if (!password) return 'Bitte gib dein Passwort ein.';
  return null;
}
