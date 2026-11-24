import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, APP_ROOT, round1 } from './lib/data.mjs';
import { buildRatings } from './lib/scoring.mjs';
import { recommend } from './lib/recommend.mjs';
import { buildResearch, eventFromQuery, suggestEvents } from './lib/research.mjs';
import { queryJobs, employmentLibrary, roleOptions } from './lib/jobs.mjs';
import { searchAndExtract, verifyUrlEvidence } from './lib/live-search.mjs';
import { listEvidence, addEvidence, deleteEvidence, clearEvidence } from './lib/evidence-store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(APP_ROOT, 'public');
const PORT = Number(process.env.PORT) || 48738;
const HOST = process.env.HOST || '0.0.0.0';
const ALLOW_LOCAL_EVIDENCE = process.env.ALLOW_LOCAL_EVIDENCE === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'"
};

function sendJson(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...extra
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    ...securityHeaders,
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text)
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_200_000) throw Object.assign(new Error('请求体超过 1.2MB'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }); }
}

function publicRating(rating) {
  return {
    ...rating,
    quality: rating.quality == null ? null : round1(rating.quality),
    contribution: round1(rating.contribution),
    admission: {
      ...rating.admission,
      score: rating.admission.score == null ? null : round1(rating.admission.score)
    }
  };
}

async function bootstrap() {
  const data = await loadData();
  const ratings = buildRatings(data).map(publicRating);
  const demoRaw = JSON.parse(await fs.readFile(path.join(APP_ROOT, 'data', 'demo.json'), 'utf8'));
  const demo = buildDemo(demoRaw);
  return {
    ok: true,
    reviewed: data.reviewed,
    ratings,
    demo,
    library: employmentLibrary(data),
    roleOptions: roleOptions(data),
    dataFiles: data.dataFiles,
    provenance: data.provenance,
    eventNames: data.eventNames,
    meta: {
      weights: { task: 25, review: 20, selection: 15, disclosure: 10, employment: 15, admission: 15 },
      totalEvents: ratings.length,
      rankedEvents: ratings.filter((r) => r.score != null).length,
      pendingEvents: ratings.filter((r) => r.score == null).length,
      platform: data.employment.platforms
    },
    runtime: {
      port: PORT,
      uptime: Math.round(process.uptime()),
      searchProvider: process.env.SEARCH_PROVIDER || 'baidu',
      localEvidence: ALLOW_LOCAL_EVIDENCE
    }
  };
}

function buildDemo(raw) {
  const events = raw.events.map((event) => {
    const composite = event.quality != null && event.influence != null
      ? round1(event.quality * 0.7 + event.influence * 100 * 0.3)
      : null;
    return {
      ...event,
      influencePct: event.influence == null ? null : Math.round(event.influence * 100),
      composite,
      status: composite == null ? '待核' : '可计算',
      categoryKey: event.category
    };
  });
  const withQuality = events.filter((e) => e.quality != null);
  const withComposite = events.filter((e) => e.composite != null);
  const withInfluence = events.filter((e) => e.influence != null);
  const verificationCount = events.filter((e) => e.verification === '资料齐全').length;
  return {
    ...raw,
    events,
    metrics: {
      avgQuality: withQuality.length ? round1(withQuality.reduce((s, e) => s + e.quality, 0) / withQuality.length) : null,
      avgInfluence: withInfluence.length ? round1(withInfluence.reduce((s, e) => s + e.influence * 100, 0) / withInfluence.length) : null,
      awardRecords: events.reduce((s, e) => s + (e.awardRecords || 0), 0),
      verificationRate: Math.round((verificationCount / events.length) * 100),
      computable: withComposite.length,
      total: events.length,
      note: withComposite.length < 10 ? `已有 ${withComposite.length} 项可计算综合分，满 10 项才会开放同类分位。` : '样本量已达到展示分位的门槛。'
    }
  };
}

async function api(req, res, url) {
  const data = await loadData();
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    const mismatched = [];
    for (const file of data.dataFiles) {
      const recorded = data.provenance.files.find((x) => x.file === file.name)?.sha256;
      if (recorded && recorded !== file.sha256) mismatched.push(file.name);
    }
    return sendJson(res, 200, {
      ok: true,
      service: 'jingheng',
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      inputsVerified: mismatched.length === 0,
      mismatched,
      dataFiles: data.dataFiles,
      searchProvider: process.env.SEARCH_PROVIDER || 'baidu',
      localEvidence: ALLOW_LOCAL_EVIDENCE
    });
  }

  if (req.method === 'GET' && pathname === '/api/bootstrap') {
    return sendJson(res, 200, await bootstrap());
  }

  if (req.method === 'GET' && pathname === '/api/ratings') {
    return sendJson(res, 200, {
      ok: true,
      reviewed: data.reviewed,
      ratings: buildRatings(data).map(publicRating),
      dataFiles: data.dataFiles,
      generatedAt: new Date().toISOString()
    });
  }

  if (req.method === 'POST' && pathname === '/api/recommend') {
    const body = await readBody(req);
    const { result } = recommend(data, body);
    return sendJson(res, result.ok === false && result.error ? 200 : 200, { ...result, generatedAt: new Date().toISOString() });
  }

  if (req.method === 'GET' && pathname === '/api/search') {
    const q = url.searchParams.get('q') || '';
    const eventId = eventFromQuery(data, q);
    return sendJson(res, 200, {
      ok: true,
      query: q,
      event: eventId,
      name: eventId ? data.eventNames[eventId] : null,
      suggestions: suggestEvents(data, q).map((s) => ({
        ...s,
        label: s.name,
        note: s.id === eventId ? '匹配到已收录赛事' : '疑似同一赛事'
      }))
    });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/events/')) {
    const id = decodeURIComponent(pathname.slice('/api/events/'.length));
    if (!data.eventNames[id]) return sendJson(res, 404, { ok: false, error: '未知赛事' });
    const rating = buildRatings(data).find((r) => r.id === id);
    return sendJson(res, 200, { ok: true, rating: publicRating(rating) });
  }

  if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/jobs') {
    const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
    return sendJson(res, 200, queryJobs(data, body));
  }

  if (req.method === 'POST' && pathname === '/api/research') {
    const body = await readBody(req);
    const eventId = eventFromQuery(data, body.event || body.name || '');
    let liveResult = { ok: true, skipped: true, items: [], note: '未请求联网检索。' };
    if (eventId && body.live === true) {
      liveResult = await searchAndExtract(data, body, eventId, {
        live: true,
        searchTimeout: Math.min(12000, Number(body.searchTimeout) || 7000)
      });
    }
    const userEvidence = await listEvidence();
    const report = buildResearch(data, body, userEvidence, liveResult.items || []);
    report.upstream = liveResult.skipped
      ? { ok: true, skipped: true, provider: process.env.SEARCH_PROVIDER || 'baidu', note: liveResult.note }
      : {
        ok: liveResult.ok,
        degraded: Boolean(liveResult.degraded),
        provider: liveResult.provider || process.env.SEARCH_PROVIDER || 'baidu',
        error: liveResult.error || null,
        code: liveResult.code || null,
        note: liveResult.note,
        rejected: liveResult.rejected || [],
        fetchedAt: liveResult.search?.fetchedAt || liveResult.fetchedAt || null,
        resultCount: liveResult.search?.results?.length ?? null
      };
    report.live = Boolean(body.live);
    return sendJson(res, 200, report);
  }

  if (req.method === 'GET' && pathname === '/api/employment-evidence') {
    return sendJson(res, 200, employmentLibrary(data));
  }

  if (req.method === 'GET' && pathname === '/api/evidence') {
    return sendJson(res, 200, { ok: true, items: await listEvidence() });
  }

  if (req.method === 'POST' && pathname === '/api/evidence/verify') {
    const body = await readBody(req);
    const eventId = eventFromQuery(data, body.event || '');
    if (!eventId) return sendJson(res, 200, { ok: false, verified: false, reason: '没有识别出赛事名称', suggestions: suggestEvents(data, body.event || '') });
    const result = await verifyUrlEvidence(body, { allowLocal: ALLOW_LOCAL_EVIDENCE });
    return sendJson(res, 200, {
      ...result,
      eventId,
      eventName: data.eventNames[eventId],
      checkedAt: new Date().toISOString()
    });
  }

  if (req.method === 'POST' && pathname === '/api/evidence') {
    const body = await readBody(req);
    const eventId = eventFromQuery(data, body.event || '');
    if (!eventId) return sendJson(res, 200, { ok: false, verified: false, reason: '没有识别出赛事名称', suggestions: suggestEvents(data, body.event || '') });
    const verification = await verifyUrlEvidence(body, { allowLocal: ALLOW_LOCAL_EVIDENCE });
    if (!verification.ok) return sendJson(res, 422, { ok: false, verification });
    const klass = body.class || 'direct';
    const sourceType = body.sourceType || 'official';
    const coefficients = { official: 0.95, forwarded: 0.85, general: 0.70, community: 0.30 };
    const directness = { direct: 1, outcome: 0.5, general: 0.4, community: 0.25 }[klass] ?? 0.4;
    const saved = await addEvidence({
      url: verification.finalUrl,
      originalUrl: body.url,
      title: body.title || verification.pageTitle,
      pageTitle: verification.pageTitle,
      quote: body.quote,
      eventId,
      event: data.eventNames[eventId],
      class: klass,
      track: body.track || (klass === 'outcome' ? 'employment' : 'admission'),
      scope: {
        event: data.eventNames[eventId],
        school: body.school || '',
        unit: body.unit || '',
        employer: body.employer || '',
        job: body.job || '',
        year: body.year || ''
      },
      publisher: new URL(verification.finalUrl).hostname,
      sourceType,
      sourceCoefficient: coefficients[sourceType] ?? 0.95,
      directness,
      policyScore: body.policyScore != null ? Number(body.policyScore) : null,
      publishedAt: verification.publishedAt || null,
      stance: body.stance || 'affirm',
      verification: {
        linkReachable: true,
        quoteFound: true,
        scopeMatched: true,
        contentHash: verification.contentHash,
        finalUrl: verification.finalUrl,
        checkedAt: verification.fetchedAt
      }
    });
    return sendJson(res, 201, {
      ok: true,
      verified: true,
      item: saved,
      message: '链接可达 · 引文出现 · 范围词匹配；已纳入本机证据库。'
    });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/evidence/')) {
    const id = decodeURIComponent(pathname.slice('/api/evidence/'.length));
    return sendJson(res, 200, { ok: true, ...(await deleteEvidence(id)) });
  }

  if (req.method === 'POST' && pathname === '/api/evidence/clear') {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_CLEAR !== '1') {
      return sendJson(res, 403, { ok: false, error: '生产环境默认禁止清空证据库' });
    }
    return sendJson(res, 200, { ok: true, ...(await clearEvidence()) });
  }

  if (req.method === 'GET' && pathname === '/api/provenance') {
    return sendJson(res, 200, { ok: true, provenance: data.provenance, actualHashes: data.hashes });
  }

  if (req.method === 'GET' && pathname === '/api/method') {
    return sendJson(res, 200, {
      ok: true,
      dimensions: [
        { id: 'task', name: '任务挑战', weight: 25, levels: ['有明确的任务和交付物', '需要独立完成专业解题或技术实现', '还要展示实物、验证结果或答辩论证'] },
        { id: 'review', name: '评审与复核', weight: 20, levels: ['公开计分依据', '有明确的专家评审或系统测试', '另有实质复测、复议或答辩环节'] },
        { id: 'selection', name: '选拔强度', weight: 15, levels: ['按成绩排名', '通过资格赛或分阶段选拔', '同届同口径全国晋级或获奖比例有不超过 10% 的明确上限或实绩'] },
        { id: 'disclosure', name: '结果透明', weight: 10, levels: ['可追溯到规则或结果', '规则和对应结果或统计均可查', '另有明文异议渠道和期限'] },
        { id: 'employment', name: '就业帮助', weight: 15 },
        { id: 'admission', name: '保研帮助', weight: 15 }
      ],
      provenance: data.provenance,
      reviewed: data.reviewed,
      limits: [
        '所有维度等级来自六份输入中的可解析原文；缺失维度保留待核，不用猜测补分。',
        '个人推荐只使用本人学校、院系、届别与奖级可对应的条款，不跨校套用。',
        '联网新增证据必须同时通过链接可达、引文出现、范围词匹配三项检查。',
        '演示样本与推荐榜数据相互独立，不能用演示样本反推真实赛事。'
      ]
    });
  }

  return sendJson(res, 404, { ok: false, error: 'API 路径不存在' });
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!target.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw Object.assign(new Error('not file'), { code: 'ENOENT' });
    const ext = path.extname(target).toLowerCase();
    const body = await fs.readFile(target);
    res.writeHead(200, {
      ...securityHeaders,
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=300',
      'content-length': body.length
    });
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // SPA fallback: unknown non-asset paths return index.html.
      if (!path.extname(pathname)) {
        const index = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'));
        res.writeHead(200, { ...securityHeaders, 'content-type': MIME['.html'], 'cache-control': 'no-store', 'content-length': index.length });
        return res.end(index);
      }
      return sendText(res, 404, 'Not found');
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {});
    }
    if (url.pathname.startsWith('/api/')) {
      return await api(req, res, url);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return sendText(res, 405, 'Method not allowed');
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error('[request]', error);
    if (!res.headersSent) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.status ? error.message : '服务处理失败',
        detail: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
    res.end();
  }
});

server.listen(PORT, HOST, async () => {
  const data = await loadData();
  const mismatched = data.dataFiles.filter((f) => {
    const recorded = data.provenance.files.find((x) => x.file === f.name)?.sha256;
    return recorded && recorded !== f.sha256;
  });
  console.log(`竞衡 StudyHack · http://127.0.0.1:${PORT}/`);
  console.log(`输入 ${data.dataFiles.length} 份 · 哈希${mismatched.length ? `异常（${mismatched.map((x) => x.name).join(', ')}）` : '全部匹配'}`);
  console.log(`联网检索：${process.env.SEARCH_PROVIDER || 'baidu'}${ALLOW_LOCAL_EVIDENCE ? ' · 允许本机证据链接' : ''}`);
});