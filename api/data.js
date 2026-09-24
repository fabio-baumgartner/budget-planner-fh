// Das komplette Dokument des eingeloggten Users. Die userId kommt nur aus der Session.
import { route, readJson, send } from './_lib/http.js';
import { requireUser, clearSessionCookie } from './_lib/session.js';
import { getJSON, putJSON, remove, paths } from './_lib/storage.js';
import { hashEmail } from './_lib/password.js';
import { sanitizeDoc } from './_lib/validate.js';
import { createDefaultDoc } from './_lib/defaults.js';

export default route(['GET', 'PUT', 'DELETE'], async (req, res) => {
  const { userId, email } = requireUser(req);
  const path = paths.userData(userId);

  if (req.method === 'GET') {
    let doc = await getJSON(path);
    if (!doc) {
      doc = createDefaultDoc({ name: email.split('@')[0], email });
      await putJSON(path, doc);
    }
    return send(res, 200, doc);
  }

  if (req.method === 'PUT') {
    const stored = (await getJSON(path)) || createDefaultDoc({ name: email.split('@')[0], email });
    const doc = sanitizeDoc(await readJson(req), stored);
    await putJSON(path, doc);
    return send(res, 200, { ok: true });
  }

  // DELETE: Account samt Daten löschen.
  await remove(path);
  await remove(paths.userIndex(hashEmail(email)));
  send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
});
