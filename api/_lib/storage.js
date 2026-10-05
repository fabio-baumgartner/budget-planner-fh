// Speicherschicht: Vercel Blob (privat) in Produktion, lokale Dateien in .data/ als Dev-Fallback.
import { put, get, del } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Vercel Blob wird genutzt, sobald eine der beiden Blob-Umgebungsvariablen gesetzt ist.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
// Lokaler Speicherordner: .data/ im aktuellen Arbeitsverzeichnis (normalerweise der Projektordner).
const DATA_DIR = path.join(process.cwd(), '.data');

// Läuft einmal beim Laden des Moduls. Auf Vercel ohne Blob-Store sofort abbrechen, weil dort lokale Dateien nicht dauerhaft gespeichert werden.
// Lokal nur eine Warnung ausgeben, welcher Speicher gerade aktiv ist.
if (!useBlob) {
  if (process.env.VERCEL) {
    throw new Error('Kein Blob-Store verbunden (BLOB_STORE_ID oder BLOB_READ_WRITE_TOKEN fehlt).');
  }
  console.warn('[storage] Kein Blob-Store konfiguriert: speichere lokal in .data/ (Wegwerfdaten, nur für Entwicklung).');
} else if (!process.env.VERCEL) {
  console.warn('[storage] ACHTUNG: Lokaler Server ist mit dem echten Vercel Blob Store verbunden (Produktionsdaten).');
}

// Liest ein JSON-Dokument. Gibt null zurück, wenn es (noch) nicht existiert.
export async function getJSON(pathname) {
  if (useBlob) {
    // access private: nur mit Token lesbar. useCache false: immer die aktuelle Version holen, nicht eine zwischengespeicherte.
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    // Der Inhalt kommt als Stream. new Response(...).text() liest ihn komplett als Text ein.
    return JSON.parse(await new Response(result.stream).text());
  }
  try {
    return JSON.parse(await fs.readFile(localPath(pathname), 'utf8'));
  } catch (err) {
    // ENOENT = Datei nicht gefunden. Das ist kein Fehler, sondern heißt: noch keine Daten.
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// createOnly: schlägt fehl, wenn der Pfad schon existiert (atomare Registrierung).
// Speichert data als JSON unter pathname. Rückgabe true = gespeichert, false nur bei createOnly und schon vorhandenem Pfad.
export async function putJSON(pathname, data, { createOnly = false } = {}) {
  const body = JSON.stringify(data);
  if (useBlob) {
    // Schnelle Vorprüfung. Die eigentliche Absicherung gegen Doppelanlage ist allowOverwrite: false weiter unten.
    if (createOnly && (await getJSON(pathname))) return false;
    try {
      await put(pathname, body, {
        access: 'private',
        // Ohne zufälligen Anhang bleibt der Pfad genau so und ist später wieder auffindbar.
        addRandomSuffix: false,
        allowOverwrite: !createOnly,
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      // Ohne allowOverwrite lehnt Blob einen bestehenden Pfad ab (Race bei gleichzeitiger Registrierung).
      if (createOnly && (await getJSON(pathname))) return false;
      throw err;
    }
  }
  const file = localPath(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    // Flag 'wx': Datei nur anlegen, wenn sie noch nicht existiert (sonst Fehler EEXIST). 'w': anlegen oder überschreiben.
    await fs.writeFile(file, body, { flag: createOnly ? 'wx' : 'w' });
    return true;
  } catch (err) {
    if (createOnly && err.code === 'EEXIST') return false;
    throw err;
  }
}

// Löscht ein Dokument. Lokal sorgt force: true dafür, dass eine schon fehlende Datei keinen Fehler auslöst.
export async function remove(pathname) {
  if (useBlob) return del(pathname);
  await fs.rm(localPath(pathname), { force: true });
}

// Wandelt einen Speicherpfad wie users/abc/data.json in einen Dateipfad unter .data/ um.
// Sicherheitsprüfung: Der Pfad darf nicht mit ../ aus .data/ herausführen (Path Traversal).
function localPath(pathname) {
  const file = path.join(DATA_DIR, ...pathname.split('/'));
  if (!file.startsWith(DATA_DIR + path.sep)) throw new Error('Ungültiger Pfad');
  return file;
}

// Alle Speicherpfade an einer Stelle:
// - userIndex: E-Mail-Hash -> userId, Salt und Passwort-Hash (für Login und Registrierung)
// - userData: das eigentliche Dokument eines Users (Kategorien, Buchungen, Einstellungen)
export const paths = {
  userIndex: (emailHash) => `users/by-email/${emailHash}.json`,
  userData: (userId) => `users/${userId}/data.json`,
};
