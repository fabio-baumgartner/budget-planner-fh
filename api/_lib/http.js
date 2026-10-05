// Kleine HTTP-Helfer, damit die Handler auf Vercel und im lokalen Dev-Server gleich laufen.

// Fehler mit HTTP-Statuscode. Handler werfen ihn (z. B. new HttpError(400, "...")),
// route() macht daraus eine JSON-Antwort mit diesem Status.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Obergrenze für den Request-Body (ca. 1 MB), schützt vor riesigen Anfragen.
const MAX_BODY_BYTES = 1_000_000;

// Liest den JSON-Body einer Anfrage und gibt ihn als Objekt zurück. Leerer Body ergibt {}.
export async function readJson(req) {
  // Vercel parst JSON-Bodies selbst, der lokale Dev-Server nicht.
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return parse(req.body);
  if (Buffer.isBuffer(req.body)) return parse(req.body.toString('utf8'));

  // Sonst den Body Stück für Stück (chunks) aus dem Stream lesen und dabei die Größe mitzählen.
  // So wird abgebrochen, sobald das Limit überschritten ist, und nicht erst alles in den Speicher geladen.
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Anfrage zu groß');
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks).toString('utf8'));
}

// JSON-Text in ein Objekt umwandeln. Kaputtes JSON wird zu einem 400-Fehler statt zu einem Absturz.
function parse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Ungültiges JSON');
  }
}

// Schickt eine JSON-Antwort mit Statuscode und optionalen Zusatz-Headern (z. B. Set-Cookie).
export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // no-store: Browser und Zwischenspeicher dürfen die Antwort nicht cachen, die Daten sind privat und ändern sich.
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

// Umhüllt einen Handler: erlaubte Methoden prüfen, Fehler einheitlich beantworten.
export function route(methods, handler) {
  // Die zurückgegebene Funktion ist der eigentliche Handler, den Vercel bzw. der Dev-Server mit (req, res) aufruft.
  return async function (req, res) {
    // 405 = Method Not Allowed. Der Allow-Header nennt die erlaubten Methoden.
    if (!methods.includes(req.method)) {
      return send(res, 405, { error: 'Methode nicht erlaubt' }, { Allow: methods.join(', ') });
    }
    try {
      await handler(req, res);
    } catch (err) {
      // Erwartete Fehler (HttpError) mit ihrem Status und Text beantworten.
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      // Unerwartete Fehler nur ins Server-Log schreiben und dem Client keine internen Details verraten.
      console.error(err);
      return send(res, 500, { error: 'Interner Fehler' });
    }
  };
}
