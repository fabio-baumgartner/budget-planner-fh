// Lokaler Dev-Server ohne Vercel-Login: liefert public/ aus und ruft die Handler in api/ auf.
// Für die echte Vercel-Umgebung: npm run dev (vercel dev).
import http from 'node:http';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

loadEnv(path.join(ROOT, '.env'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(url, req, res);
      return await serveStatic(url, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Interner Fehler');
    }
  })
  .listen(PORT, () => console.log(`Budget Planner läuft auf http://localhost:${PORT}`));

async function handleApi(url, req, res) {
  const segments = url.pathname.slice(5).split('/');
  const file = path.join(ROOT, 'api', ...segments) + '.js';
  // Ordner mit _ (z. B. _lib) sind wie auf Vercel keine Endpoints.
  if (!file.startsWith(path.join(ROOT, 'api') + path.sep) || segments.some((s) => s.startsWith('_')) || !existsSync(file)) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const handler = (await import(pathToFileURL(file).href)).default;
  await handler(req, res);
}

async function serveStatic(url, res) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  let file = path.join(PUBLIC, pathname);
  if (!file.startsWith(PUBLIC)) {
    res.statusCode = 403;
    return res.end();
  }
  // cleanUrls wie auf Vercel: /login -> login.html
  if (!path.extname(file) && existsSync(file + '.html')) file += '.html';
  try {
    const body = await fs.readFile(file);
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*"?(.*?)"?\s*$/);
    if (match && !line.trim().startsWith('#') && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
