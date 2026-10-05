// Das komplette Dokument des eingeloggten Users. Die userId kommt nur aus der Session.
import { route, readJson, send } from './_lib/http.js';
import { requireUser, clearSessionCookie } from './_lib/session.js';
import { getJSON, putJSON, remove, paths } from './_lib/storage.js';
import { hashEmail } from './_lib/password.js';
import { sanitizeDoc } from './_lib/validate.js';
import { createDefaultDoc } from './_lib/defaults.js';

// Ein Endpoint für drei Methoden: Dokument laden (GET), speichern (PUT), Account löschen (DELETE).
// Ohne gültige Session wirft requireUser() einen 401-Fehler, route() schickt ihn als Antwort.
export default route(['GET', 'PUT', 'DELETE'], async (req, res) => {
  const { userId, email } = requireUser(req);
  // Speicherpfad des Dokuments: users/<userId>/data.json
  const path = paths.userData(userId);

  // GET: Dokument laden. Fehlt es (z. B. weil das Anlegen bei der Registrierung gescheitert ist),
  // wird ein Startdokument erzeugt und gespeichert. Als Name dient der Teil der E-Mail vor dem @.
  if (req.method === 'GET') {
    let doc = await getJSON(path);
    if (!doc) {
      doc = createDefaultDoc({ name: email.split('@')[0], email });
      await putJSON(path, doc);
    }
    return send(res, 200, doc);
  }

  // PUT: Der Client schickt immer das ganze Dokument. sanitizeDoc() prüft es (Fehler -> 400, nichts wird gespeichert)
  // und übernimmt E-Mail und Beitrittsdatum aus der gespeicherten Version (stored).
  if (req.method === 'PUT') {
    const stored = (await getJSON(path)) || createDefaultDoc({ name: email.split('@')[0], email });
    const doc = sanitizeDoc(await readJson(req), stored);
    await putJSON(path, doc);
    return send(res, 200, { ok: true });
  }

  // DELETE: Account samt Daten löschen.
  await remove(path);
  // Auch den E-Mail-Index löschen, sonst wäre die E-Mail für eine neue Registrierung blockiert.
  await remove(paths.userIndex(hashEmail(email)));
  // Session-Cookie im Browser löschen, der User ist damit ausgeloggt.
  send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
});
