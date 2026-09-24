import { route, send } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/session.js';

export default route(['POST'], async (req, res) => {
  send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
});
