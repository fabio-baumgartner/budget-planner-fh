// Dünner fetch-Wrapper für die eigene API.

// Fehler mit HTTP-Statuscode (status), damit Aufrufer z. B. 401 (nicht eingeloggt) erkennen können.
// status 0 bedeutet: Server gar nicht erreichbar (kein Netz).
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Schickt einen Request an die eigene API und liefert die Antwort als Objekt (JSON).
// - credentials 'same-origin': das Session-Cookie vom Login wird automatisch mitgeschickt
// - keepalive: Request läuft weiter, auch wenn der Tab gerade geschlossen wird (siehe store.js)
// Wirft ApiError bei Netzwerkfehler oder wenn der HTTP-Status kein Erfolg (2xx) ist.
async function request(method, url, body, { keepalive = false } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch {
    // fetch wirft nur, wenn gar keine Antwort kommt (z. B. offline), nicht bei Status 4xx oder 5xx.
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }
  // Leere oder ungültige Antwort (kein JSON) wird zu {} statt zu einem Fehler.
  // Bei Fehlern schickt der Server den Text im Feld "error" mit.
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error || 'Unbekannter Fehler');
  return data;
}

// Alle Endpunkte an einer Stelle. Die Pfade entsprechen den Dateien unter api/ (Vercel Serverless Functions).
// Das ganze User-Dokument (Buchungen, Kategorien, Einstellungen) wird als ein JSON-Objekt geladen (GET) und gespeichert (PUT).
export const api = {
  me: () => request('GET', '/api/auth/me'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  register: (name, email, password) => request('POST', '/api/auth/register', { name, email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  getData: () => request('GET', '/api/data'),
  saveData: (doc, options) => request('PUT', '/api/data', doc, options),
  deleteAccount: () => request('DELETE', '/api/data'),
};
