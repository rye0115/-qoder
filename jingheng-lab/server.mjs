import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DIMENSIONS, WEIGHTS, COMPOSITE, PRESETS } from './lib/weights.mjs';
import { runResearch, archiveResults } from './lib/engine.mjs';
import { CORPUS } from './lib/corpus.mjs';
import { providerInfo } from './lib/providers.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STORE = path.join(DATA_DIR, 'store.json');

await loadEnv();
await fs.mkdir(DATA_DIR, { recursive: true });

const PORT = Number(process.env.PORT || 48780);
const jobs = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env is optional
  }
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeStore(list) {
  const tmp = `${STORE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, STORE);
}

async function saveEvent(result) {
  const list = await readStore();
  const rest = list.filter(e => e.id !== result.id);
  rest.unshift({
    ...result,
    savedAt: new Date().toISOString()
  });
  await writeStore(rest.slice(0, 200));
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

const json = (res, status, data) => send(res, status, JSON.stringify(data));

function readBody(req, limit = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cleanInput(body) {
  const name = String(body.name || '').trim().slice(0, 80);
  const year = Number(body.year);
  const cohortN = Number(body.cohortN);
  const scope = ['postgrad', 'career', 'balanced'].includes(body.scope) ? body.scope : 'balanced';
  return {
    name,
    year: Number.isFinite(year) && year >= 1990 && year <= 2100 ? Math.round(year) : null,
    level: String(body.level || '').trim().slice(0, 30) || null,
    field: String(body.field || '').trim().slice(0, 40) || null,
    scope,
    cohortN: Number.isFinite(cohortN) ? Math.max(0, Math.min(200, Math.round(cohortN))) : 0
  };
}

async function api(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, providers: providerInfo(), archive: CORPUS.length });
  }

  if (req.method === 'GET' && pathname === '/api/meta') {
    return json(res, 200, {
      dimensions: DIMENSIONS,
      weights: WEIGHTS,
      composite: COMPOSITE,
      presets: PRESETS,
      providers: providerInfo(),
      archive: CORPUS.map(d => ({
        id: d.id,
        name: d.name,
        aliases: d.aliases,
        meta: d.meta,
        origin: d.origin || 'archive',
        hint: d.coverageNote
      })),
      limits: { minCohort: 20, maxEvidence: 16, fetchPages: 6 }
    });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const saved = await readStore();
    const merged = new Map();
    for (const item of archiveResults()) merged.set(item.id, item);
    for (const item of saved) merged.set(item.id, item);
    return json(res, 200, { events: [...merged.values()] });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/events/')) {
    const id = decodeURIComponent(pathname.slice('/api/events/'.length));
    const saved = await readStore();
    const found = saved.find(e => e.id === id) || archiveResults().find(e => e.id === id) || null;
    if (!found) return json(res, 404, { error: '未找到该赛事' });
    return json(res, 200, found);
  }

  if (req.method === 'POST' && pathname === '/api/research') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return json(res, err.status || 400, { error: err.message });
    }
    const input = cleanInput(body);
    if (!input.name) return json(res, 400, { error: '请填写赛事名称' });

    const id = crypto.randomUUID();
    const job = {
      id,
      status: 'running',
      input,
      stages: [],
      result: null,
      error: null,
      createdAt: Date.now()
    };
    jobs.set(id, job);
    if (jobs.size > 60) {
      const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      jobs.delete(oldest.id);
    }

    runResearch(input, stages => { job.stages = stages; })
      .then(async result => {
        job.result = result;
        job.status = 'done';
        await saveEvent(result);
      })
      .catch(err => {
        job.status = 'error';
        job.error = err.code === 'NO_PROVIDER'
          ? '未配置检索服务：在 .env 填入 TAVILY_API_KEY 或 SERPER_API_KEY，并配置 LLM_API_KEY 后重启。'
          : err.message;
      });

    return json(res, 202, { jobId: id });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/jobs/')) {
    const id = pathname.slice('/api/jobs/'.length);
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: '任务不存在或已过期' });
    return json(res, 200, {
      id: job.id,
      status: job.status,
      stages: job.stages,
      input: job.input,
      result: job.result,
      error: job.error
    });
  }

  return json(res, 404, { error: '接口不存在' });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(PUBLIC, `.${rel}`);
  if (!resolved.startsWith(PUBLIC + path.sep)) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const type = MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
    const body = await fs.readFile(resolved);
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) return await api(req, res, pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    json(res, 500, { error: '服务内部错误' });
    console.error(err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const info = providerInfo();
  console.log(`竞衡研究台已启动 http://127.0.0.1:${PORT}`);
  console.log(`检索: ${info.search || '未配置'} · 模型: ${info.llm || '未配置'} · 证据库: ${CORPUS.length} 项`);
});