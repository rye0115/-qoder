import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import worker from './functions/worker.js';

const root = process.cwd();
const webRoot = join(root, 'qoder-web');
const port = Number(process.env.PORT || 48740);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const incoming = new URL(req.url, `http://127.0.0.1:${port}`);
    if (incoming.pathname.startsWith('/functions/v1/app/')) {
      const apiPath = incoming.pathname.slice('/functions/v1/app'.length);
      const target = new URL(apiPath + incoming.search, `http://127.0.0.1:${port}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value != null) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const init = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method)) init.body = await readBody(req);
      const response = await worker.fetch(new Request(target, init));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.setHeader('Cache-Control', 'no-store');
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
      return;
    }

    const rawPath = decodeURIComponent(incoming.pathname);
    const relative = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^([/\\])+/, '');
    const filePath = join(webRoot, relative);
    if (!filePath.startsWith(webRoot)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': types[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ error: 'Local preview failed', detail: String(error?.message || error) }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Jingheng preview: http://127.0.0.1:${port}/`);
});