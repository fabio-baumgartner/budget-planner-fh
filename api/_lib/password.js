// Passwort-Hashing und E-Mail-Hilfen für Registrierung und Login.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt ist absichtlich langsam und braucht viel Speicher. Das bremst Brute-Force-Angriffe auf gestohlene Hashes.
// promisify macht aus der Callback-Funktion eine, die man mit await benutzen kann.
const scryptAsync = promisify(scrypt);
// Länge des berechneten Hashes in Bytes (64 Bytes = 128 Hex-Zeichen).
const KEY_LENGTH = 64;

// Erzeugt für ein neues Passwort einen zufälligen Salt und den Hash, beides als Hex-Text zum Speichern.
// Der Salt sorgt dafür, dass gleiche Passwörter unterschiedliche Hashes bekommen (keine vorberechneten Tabellen möglich).
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return { salt, passwordHash: key.toString('hex') };
}

// Prüft ein eingegebenes Passwort: mit demselben Salt neu hashen und mit dem gespeicherten Hash vergleichen. Liefert true/false.
export async function verifyPassword(password, salt, passwordHash) {
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(passwordHash, 'hex');
  // timingSafeEqual braucht immer gleich lang, egal ab welchem Byte sich die Werte unterscheiden.
  // So lässt sich über die Antwortzeit nichts erraten. Es verlangt gleich lange Buffer, daher die Längenprüfung davor.
  return expected.length === key.length && timingSafeEqual(key, expected);
}

// Die E-Mail selbst taucht nicht im Blob-Pfad auf, nur ihr Hash.
// SHA-256 als fester, eindeutiger Dateiname pro E-Mail. Hier geht es nicht um Passwortschutz, deshalb reicht ein schneller Hash.
export function hashEmail(email) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

// Vereinheitlicht eine E-Mail: Leerzeichen am Rand weg, alles klein. Fehlt der Wert, kommt "" zurück.
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
