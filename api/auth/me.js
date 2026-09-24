import { route, send } from '../_lib/http.js';
import { requireUser } from '../_lib/session.js';

export default route(['GET'], async (req, res) => {
  const { email } = requireUser(req);
  send(res, 200, { email });
});
