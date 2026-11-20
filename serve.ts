// Neon Shore preview server: serves app/ on http://localhost:8080.
// Plain static files only, no build step, nothing leaves the machine.
// Run it with `node serve.ts` from the repository root.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(join(import.meta.dirname ?? '', 'app'));
const port = Number(process.env.PORT ?? 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const filePath = resolve(join(appDir, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(appDir + sep) && filePath !== appDir) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('Forbidden');
    return;
  }
  const target = existsSync(filePath) && statSync(filePath).isDirectory() ? join(filePath, 'index.html') : filePath;
  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': mimeTypes[extname(target)] ?? 'application/octet-stream' });
  createReadStream(target).pipe(response);
});

server.listen(port, () => {
  console.log(`Neon Shore preview at http://localhost:${port}`);
});
