// POST /api/auth/logout: löscht das Session-Cookie im Browser (Max-Age=0).
// Die Session steht nur im Cookie, auf dem Server gibt es nichts zu löschen.
import { route, send } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/session.js';

export default route(['POST'], async (req, res) => {
  send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
});
