// POST /api/auth/login: prüft E-Mail und Passwort und setzt bei Erfolg das Session-Cookie.
import { route, readJson, send, HttpError } from '../_lib/http.js';
import { hashPassword, verifyPassword, hashEmail, normalizeEmail } from '../_lib/password.js';
import { getJSON, paths } from '../_lib/storage.js';
import { createSessionCookie } from '../_lib/session.js';

// Absichtlich dieselbe Meldung für unbekannte E-Mail und falsches Passwort,
// damit man über den Login nicht herausfinden kann, welche E-Mails registriert sind.
const INVALID = 'E-Mail oder Passwort ist falsch.';

export default route(['POST'], async (req, res) => {
  const body = await readJson(req);
  // E-Mail vereinheitlichen (trim, Kleinbuchstaben), damit "Max@X.at" und "max@x.at" derselbe Account sind.
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Bitte E-Mail und Passwort eingeben.');

  // User über den Hash der E-Mail nachschlagen (Index-Datei users/by-email/<hash>.json).
  const user = await getJSON(paths.userIndex(hashEmail(email)));
  if (!user) {
    // Gleich viel Rechenzeit wie bei einem echten Check, damit man existierende E-Mails nicht erraten kann.
    await hashPassword(password);
    throw new HttpError(401, INVALID);
  }
  // Passwort mit dem gespeicherten Salt neu hashen und mit dem gespeicherten Hash vergleichen.
  if (!(await verifyPassword(password, user.salt, user.passwordHash))) throw new HttpError(401, INVALID);

  // Erfolg: Cookie mit userId und E-Mail setzen. Der Browser schickt es ab jetzt bei jeder Anfrage mit.
  send(res, 200, { email: user.email }, { 'Set-Cookie': createSessionCookie(req, { userId: user.userId, email: user.email }) });
});
