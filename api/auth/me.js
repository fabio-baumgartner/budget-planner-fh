// GET /api/auth/me: liefert die E-Mail des eingeloggten Users oder 401 (Nicht angemeldet).
// Das Frontend (auth.js) prüft damit, ob noch eine gültige Session besteht.
import { route, send } from '../_lib/http.js';
import { requireUser } from '../_lib/session.js';

export default route(['GET'], async (req, res) => {
  const { email } = requireUser(req);
  send(res, 200, { email });
});
