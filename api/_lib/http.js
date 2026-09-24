// Kleine HTTP-Helfer, damit die Handler auf Vercel und im lokalen Dev-Server gleich laufen.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 1_000_000;

export async function readJson(req) {
  // Vercel parst JSON-Bodies selbst, der lokale Dev-Server nicht.
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return parse(req.body);
  if (Buffer.isBuffer(req.body)) return parse(req.body.toString('utf8'));

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Anfrage zu groß');
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks).toString('utf8'));
}

function parse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

// Umhüllt einen Handler: erlaubte Methoden prüfen, Fehler einheitlich beantworten.
export function route(methods, handler) {
  return async function (req, res) {
    if (!methods.includes(req.method)) {
      return send(res, 405, { error: 'Methode nicht erlaubt' }, { Allow: methods.join(', ') });
    }
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'Interner Fehler' });
    }
  };
}
