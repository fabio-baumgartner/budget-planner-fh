import { route, readJson, send, HttpError } from '../_lib/http.js';
import { hashPassword, verifyPassword, hashEmail, normalizeEmail } from '../_lib/password.js';
import { getJSON, paths } from '../_lib/storage.js';
import { createSessionCookie } from '../_lib/session.js';

const INVALID = 'E-Mail oder Passwort ist falsch.';

export default route(['POST'], async (req, res) => {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Bitte E-Mail und Passwort eingeben.');

  const user = await getJSON(paths.userIndex(hashEmail(email)));
  if (!user) {
    // Gleich viel Rechenzeit wie bei einem echten Check, damit man existierende E-Mails nicht erraten kann.
    await hashPassword(password);
    throw new HttpError(401, INVALID);
  }
  if (!(await verifyPassword(password, user.salt, user.passwordHash))) throw new HttpError(401, INVALID);

  send(res, 200, { email: user.email }, { 'Set-Cookie': createSessionCookie(req, { userId: user.userId, email: user.email }) });
});
