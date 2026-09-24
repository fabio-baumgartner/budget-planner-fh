// Speicherschicht: Vercel Blob (privat) in Produktion, lokale Dateien in .data/ als Dev-Fallback.
import { put, get, del } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const DATA_DIR = path.join(process.cwd(), '.data');

if (!useBlob) {
  if (process.env.VERCEL) {
    throw new Error('Kein Blob-Store verbunden (BLOB_STORE_ID oder BLOB_READ_WRITE_TOKEN fehlt).');
  }
  console.warn('[storage] Kein Blob-Store konfiguriert: speichere lokal in .data/ (Wegwerfdaten, nur für Entwicklung).');
}

export async function getJSON(pathname) {
  if (useBlob) {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text());
  }
  try {
    return JSON.parse(await fs.readFile(localPath(pathname), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// createOnly: schlägt fehl, wenn der Pfad schon existiert (atomare Registrierung).
export async function putJSON(pathname, data, { createOnly = false } = {}) {
  const body = JSON.stringify(data);
  if (useBlob) {
    if (createOnly && (await getJSON(pathname))) return false;
    try {
      await put(pathname, body, {
        access: 'private',
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
    await fs.writeFile(file, body, { flag: createOnly ? 'wx' : 'w' });
    return true;
  } catch (err) {
    if (createOnly && err.code === 'EEXIST') return false;
    throw err;
  }
}

export async function remove(pathname) {
  if (useBlob) return del(pathname);
  await fs.rm(localPath(pathname), { force: true });
}

function localPath(pathname) {
  const file = path.join(DATA_DIR, ...pathname.split('/'));
  if (!file.startsWith(DATA_DIR + path.sep)) throw new Error('Ungültiger Pfad');
  return file;
}

export const paths = {
  userIndex: (emailHash) => `users/by-email/${emailHash}.json`,
  userData: (userId) => `users/${userId}/data.json`,
};
