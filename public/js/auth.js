// Login und Registrierung (login.html)
import { api } from './api.js';

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

let mode = 'login';

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

  if (location.hash === '#register') setMode('register');

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    const message = validate(data);
    if (message) return showError(message);

    submit.disabled = true;
    submit.textContent = 'Einen Moment …';
    try {
      if (mode === 'login') await api.login(data.email, data.password);
      else await api.register(data.name, data.email, data.password);
      location.replace('/');
    } catch (err) {
      showError(err.message);
      submit.disabled = false;
      submit.textContent = TEXT[mode].submit;
    }
  });

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }
});

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
  history.replaceState(null, '', mode === 'register' ? '#register' : location.pathname);
}

function validate({ name = '', email = '', password = '' }) {
  if (mode === 'register' && !name.trim()) return 'Bitte gib deinen Namen an.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Bitte gib eine gültige E-Mail-Adresse an.';
  if (mode === 'register' && password.length < 8) return 'Das Passwort braucht mindestens 8 Zeichen.';
  if (!password) return 'Bitte gib dein Passwort ein.';
  return null;
}
