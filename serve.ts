// A tiny static server for game/ (Node 22, standard library only), so the
// entry can be played locally without a build step: `node serve.ts` serves
// game/ on http://localhost:8080. It only reads files under game/, sends the
// MIME types a browser game needs, and refuses anything else.
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const port = portArg === -1 ? 8080 : Number(process.argv[portArg + 1]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  let path = url.pathname;
  if (path.endsWith('/')) path += 'index.html';
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const file = resolve(join(root, decoded));
  if (file !== root && !file.startsWith(root + '/')) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let body;
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
    body = readFileSync(file);
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  response.end(body);
}).listen(port, '127.0.0.1', () => {
  console.log(`Solara Bay is on http://localhost:${port}`);
});
