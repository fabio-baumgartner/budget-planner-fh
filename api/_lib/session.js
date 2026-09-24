// Session als HMAC-signiertes Cookie: payload.signatur, beides base64url.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

const COOKIE = 'bp_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.VERCEL) throw new Error('SESSION_SECRET ist nicht gesetzt.');
  return 'dev-only-secret-nicht-in-produktion-verwenden';
}

function sign(data) {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createSessionCookie(req, { userId, email }) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, email, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString('base64url');
  return cookie(req, `${payload}.${sign(payload)}`, MAX_AGE_SECONDS);
}

export function clearSessionCookie(req) {
  return cookie(req, '', 0);
}

function cookie(req, value, maxAge) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function isHttps(req) {
  return Boolean(process.env.VERCEL) || req.headers['x-forwarded-proto'] === 'https';
}

export function readSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { userId: data.uid, email: data.email };
  } catch {
    return null;
  }
}

export function requireUser(req) {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'Nicht angemeldet');
  return session;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}
