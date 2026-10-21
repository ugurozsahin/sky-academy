// Usage: node scripts/site-serve.mjs [port]      (#2096)
// Serves website/ at `/` and the built game (dist/) at `/play/`, the way the Pages deploy lays them out, on
// 127.0.0.1. The `site` Playwright project starts one per worker on a free port (tests/site/); a developer runs
// it by hand to look at a page. No dependency: node:http and node:fs only. GET and HEAD; a folder without its
// trailing slash is redirected to it, as Pages does; a missing file answers website/404.html with status 404.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** Where each URL prefix is read from, longest prefix first. */
export const MOUNTS = [['/play/', join(ROOT, 'dist')], ['/', join(ROOT, 'website')]];
export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** The file a URL path names under `mounts`, `{ redirect }` for a folder asked for without its slash, or null. */
export function resolvePath(urlPath, mounts = MOUNTS) {
  let path;
  try { path = decodeURIComponent(urlPath.split(/[?#]/)[0]); } catch { return null; }
  if (path.includes('\0')) return null;
  const bare = path.endsWith('/') ? path : `${path}/`;
  const [prefix, dir] = mounts.find(([p]) => path.startsWith(p) || bare === p) ?? [];
  if (!dir) return null;
  const file = resolve(dir, `.${path.slice(prefix.length - 1)}`);
  if (file !== dir && !file.startsWith(dir + sep)) return null;      // `..` that climbs out of the mount
  const st = statSync(file, { throwIfNoEntry: false });
  if (st?.isDirectory()) return path.endsWith('/') ? resolvePath(`${path}index.html`, mounts) : { redirect: `${path}/` };
  return st?.isFile() ? { file } : null;
}

/** Start a server; `port` 0 takes a free one. Resolves `{ origin, close }`. */
export function serve({ port = 0, mounts = MOUNTS } = {}) {
  const notFound = join(mounts.find(([p]) => p === '/')?.[1] ?? '', '404.html');
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
    const hit = resolvePath(req.url ?? '/', mounts);
    if (hit?.redirect) { res.writeHead(301, { location: hit.redirect }).end(); return; }
    const file = hit?.file ?? (statSync(notFound, { throwIfNoEntry: false })?.isFile() ? notFound : null);
    const body = file ? readFileSync(file) : Buffer.from('Not found');
    res.writeHead(hit ? 200 : 404, { 'content-type': TYPES[extname(file ?? '')] ?? (file ? 'application/octet-stream' : 'text/plain'), 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => ok({
      origin: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise(done => server.close(() => done())),
    }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2] ?? '4400';
  if (!/^\d+$/.test(arg)) { console.error(`site-serve: the port must be a plain integer, got "${arg}"`); process.exit(1); }
  serve({ port: Number(arg) }).then(s => console.log(`site-serve: ${s.origin}/`), e => { console.error(`site-serve: ${e.message}`); process.exit(1); });
}
