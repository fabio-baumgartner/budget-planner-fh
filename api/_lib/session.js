// Session als HMAC-signiertes Cookie: payload.signatur, beides base64url.
// Der Server speichert keine Sessions: Alles steht im Cookie, die Signatur verhindert, dass jemand den Inhalt fälscht.
// Genutzt von den Endpoints in api/auth/ (Cookie setzen/löschen) und api/data.js (requireUser).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

const COOKIE = 'bp_session';
// Gültigkeit einer Session: 7 Tage in Sekunden.
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// Geheimer Schlüssel für die Signatur aus der Umgebungsvariable SESSION_SECRET.
// Auf Vercel ist er Pflicht (sonst Fehler), lokal gibt es einen festen Ersatzwert nur für die Entwicklung.
function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.VERCEL) throw new Error('SESSION_SECRET ist nicht gesetzt.');
  return 'dev-only-secret-nicht-in-produktion-verwenden';
}

// HMAC-SHA256: Prüfsumme über die Daten, berechnet mit dem geheimen Schlüssel.
// Wer den Schlüssel nicht kennt, kann zu veränderten Daten keine passende Signatur erzeugen.
function sign(data) {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

// Baut den Set-Cookie-Header für eine neue Session.
// Payload = { uid, email, exp } als base64url, exp = Ablaufzeitpunkt in Millisekunden.
export function createSessionCookie(req, { userId, email }) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, email, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString('base64url');
  return cookie(req, `${payload}.${sign(payload)}`, MAX_AGE_SECONDS);
}

// Leeres Cookie mit Max-Age=0: Der Browser löscht es sofort (Logout, Account gelöscht).
export function clearSessionCookie(req) {
  return cookie(req, '', 0);
}

// Setzt den Cookie-Header zusammen:
// - HttpOnly: JavaScript im Browser kann das Cookie nicht lesen (Schutz bei XSS)
// - SameSite=Lax: Anfragen von fremden Seiten bekommen das Cookie nicht mit, außer beim normalen Aufruf eines Links (Schutz vor CSRF)
// - Secure: Cookie nur über HTTPS senden. Lokal (http://localhost) wird es weggelassen, sonst ginge der Login nicht.
function cookie(req, value, maxAge) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

// Auf Vercel immer HTTPS. Hinter einem Proxy verrät der Header x-forwarded-proto das ursprüngliche Protokoll.
function isHttps(req) {
  return Boolean(process.env.VERCEL) || req.headers['x-forwarded-proto'] === 'https';
}

// Liest und prüft das Session-Cookie. Gibt { userId, email } zurück oder null, wenn es fehlt, gefälscht oder abgelaufen ist.
export function readSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  // base64url enthält keinen Punkt, deshalb trennt der Punkt Payload und Signatur eindeutig.
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  // Signatur selbst neu berechnen und vergleichen. timingSafeEqual verhindert Timing-Angriffe,
  // die Längenprüfung davor ist nötig, weil es bei ungleich langen Buffern einen Fehler werfen würde.
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  // Erst nach erfolgreicher Signaturprüfung den Inhalt lesen. Kaputtes JSON landet im catch und gilt als nicht angemeldet.
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Abgelaufen (exp in der Vergangenheit) heißt ungültig, auch wenn der Browser das Cookie noch schickt.
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { userId: data.uid, email: data.email };
  } catch {
    return null;
  }
}

// Für geschützte Endpoints: liefert die Session oder bricht mit 401 (Nicht angemeldet) ab.
export function requireUser(req) {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'Nicht angemeldet');
  return session;
}

// Zerlegt den Cookie-Header 'a=1; b=2' in ein Objekt { a: '1', b: '2' }.
// Getrennt wird am ersten =, alles danach gehört zum Wert.
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}
