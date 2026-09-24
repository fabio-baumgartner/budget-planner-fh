import { randomUUID } from 'node:crypto';
import { route, readJson, send, HttpError } from '../_lib/http.js';
import { hashPassword, hashEmail, normalizeEmail } from '../_lib/password.js';
import { getJSON, putJSON, paths } from '../_lib/storage.js';
import { createSessionCookie } from '../_lib/session.js';
import { createDefaultDoc } from '../_lib/defaults.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default route(['POST'], async (req, res) => {
  const body = await readJson(req);
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (name.length < 1 || name.length > 60) throw new HttpError(400, 'Bitte gib deinen Namen an.');
  if (!EMAIL.test(email) || email.length > 200) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an.');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Das Passwort braucht mindestens 8 Zeichen.');

  const userId = randomUUID();
  const { salt, passwordHash } = await hashPassword(password);
  const created = await putJSON(
    paths.userIndex(hashEmail(email)),
    { userId, email, salt, passwordHash, createdAt: new Date().toISOString() },
    { createOnly: true },
  );
  if (!created) throw new HttpError(409, 'Zu dieser E-Mail gibt es schon einen Account.');

  // Falls das Anlegen des Dokuments scheitert, legt GET /api/data es später nach.
  if (!(await getJSON(paths.userData(userId)))) {
    await putJSON(paths.userData(userId), createDefaultDoc({ name, email }));
  }

  send(res, 201, { name, email }, { 'Set-Cookie': createSessionCookie(req, { userId, email }) });
});
