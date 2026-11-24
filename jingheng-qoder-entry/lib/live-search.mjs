import { hostOf, normalizeText, roundInt } from './data.mjs';
import { EVENT_ORDER } from './data.mjs';

export class UpstreamError extends Error {
  constructor(message, code = 'upstream_error') {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
  }
}

const COMMUNITY_HOSTS = ['zhihu.com', 'nowcoder.com', 'xiaohongshu.com', 'tieba.baidu.com', 'douban.com', 'weibo.com', 'csdn.net'];
const COMMUNITY_WORDS = /经验|自述|听说|感觉|我觉得|亲测|分享/;

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchText(url, { timeout = 6000, maxBytes = 1_500_000 } = {}) {
  const { signal, clear } = timeoutSignal(timeout);
  try {
    const res = await fetch(url, {
      signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9'
      }
    });
    if (!res.ok) throw new UpstreamError(`上游返回 HTTP ${res.status}`, 'http_status');
    const type = res.headers.get('content-type') || '';
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new UpstreamError('页面超过自动核验大小上限', 'too_large');
    const raw = await res.text();
    return { status: res.status, finalUrl: res.url || url, contentType: type, html: raw.slice(0, maxBytes) };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error?.name === 'AbortError') throw new UpstreamError('上游请求超时', 'timeout');
    throw new UpstreamError(error?.message || '上游请求失败', 'network');
  } finally {
    clear();
  }
}

export function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&ldquo;|&rdquo;/g, '"');
}

export function stripHtml(html) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
    .replace(/\s+/g, ' ').trim();
  const text = decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  return { title, text };
}

function dateFromHtml(html) {
  const patterns = [
    /(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/,
    /(20\d{2})[-/年.](\d{1,2})/
  ];
  for (const p of patterns) {
    const m = String(html || '').match(p);
    if (m) {
      const y = m[1];
      const mo = String(m[2]).padStart(2, '0');
      const d = m[3] ? String(m[3]).padStart(2, '0') : '01';
      return `${y}-${mo}-${d}`;
    }
  }
  return null;
}

function classify(host, text, track) {
  const community = COMMUNITY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) || COMMUNITY_WORDS.test(text) && /牛客|知乎|小红书|贴吧|微博/.test(host);
  if (community) return { class: 'community', sourceCoefficient: 0.30, directness: 0.25, policyScore: null, label: '社区自述' };
  const official = host.endsWith('.edu.cn') || host.endsWith('.gov.cn') || host.endsWith('.edu');
  const forwarded = host.endsWith('.edu.cn') && /招聘|校招|就业/.test(text) && track === 'employment';
  const sourceCoefficient = official ? (forwarded ? 0.85 : 0.95) : 0.70;
  if (track === 'employment') {
    if (/直通|免笔试|直接进入面试|直接面试/.test(text)) {
      return { class: 'direct', sourceCoefficient, directness: 1, policyScore: 100, label: '明确直通环节' };
    }
    if (/优先|加分|优先条件/.test(text)) {
      return { class: 'direct', sourceCoefficient, directness: 1, policyScore: 75, label: '明确优先条款' };
    }
    if (/签约|入职|offer|录用|去向/i.test(text)) {
      return { class: 'outcome', sourceCoefficient, directness: 0.5, policyScore: null, label: '去向线索' };
    }
    return { class: 'general', sourceCoefficient, directness: 0.4, policyScore: null, label: '一般招聘材料' };
  }
  if (track === 'admission' || track === 'retest') {
    if (track === 'retest' && /复试|调剂/.test(text)) {
      return { class: 'direct', sourceCoefficient, directness: 1, policyScore: 75, label: '复试或调剂条款' };
    }
    if (/推免|保研|免试攻读/.test(text) && /加分|计分|分值|直通|优先|遴选/.test(text)) {
      const score = /加分|计分|分值/.test(text) ? 90 : /优先/.test(text) ? 60 : 75;
      return { class: 'direct', sourceCoefficient, directness: 1, policyScore: score, label: '推免相关条款' };
    }
    if (/推免|保研|复试|调剂/.test(text)) {
      return { class: 'general', sourceCoefficient, directness: 0.4, policyScore: null, label: '一般规则材料' };
    }
  }
  if (track === 'ranking' && /榜单|排名|目录|竞赛分析/.test(text)) {
    return { class: 'direct', sourceCoefficient, directness: 0.5, policyScore: 60, label: '榜单或目录' };
  }
  return { class: 'general', sourceCoefficient, directness: 0.4, policyScore: null, label: '一般材料' };
}

function findSnippet(text, aliases, keywords) {
  const normalized = text;
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx < 0) continue;
    const around = normalized.slice(Math.max(0, idx - 120), Math.min(normalized.length, idx + 320));
    if (keywords.some((k) => around.includes(k))) return around.trim();
  }
  const key = keywords.find((k) => normalized.includes(k));
  if (key) {
    const idx = normalized.indexOf(key);
    return normalized.slice(Math.max(0, idx - 80), Math.min(normalized.length, idx + 260)).trim();
  }
  return null;
}

async function resolveBaiduLink(url, timeout) {
  if (!/baidu\.com\/link\?url=/.test(url)) return url;
  try {
    const { finalUrl } = await fetchText(url, { timeout });
    return finalUrl;
  } catch {
    return url;
  }
}

export async function searchWeb(query, options = {}) {
  const provider = process.env.SEARCH_PROVIDER || 'baidu';
  if (provider === 'off') throw new UpstreamError('联网检索已被配置关闭', 'disabled');
  const endpoint = process.env.SEARCH_ENDPOINT || 'https://www.baidu.com/s';
  const timeout = Number(options.timeout) || 7000;
  const { signal, clear } = timeoutSignal(timeout);
  try {
    const url = `${endpoint}?wd=${encodeURIComponent(query)}&rn=10`;
    const res = await fetch(url, {
      signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9'
      }
    });
    if (!res.ok) throw new UpstreamError(`检索服务返回 HTTP ${res.status}`, 'search_status');
    const html = await res.text();
    const results = [];
    const blocks = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
    for (const block of blocks) {
      const inner = block[1];
      const link = inner.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const href = decodeEntities(link[1]);
      const title = decodeEntities(link[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      if (!title || !href) continue;
      results.push({ href: href.startsWith('http') ? href : `https://www.baidu.com${href}`, title });
      if (results.length >= 8) break;
    }
    if (!results.length) throw new UpstreamError('检索服务返回了页面，但未能解析出结果', 'parse_empty');
    return { ok: true, provider, endpoint, results, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error?.name === 'AbortError') throw new UpstreamError('检索服务超时', 'timeout');
    throw new UpstreamError(error?.message || '检索服务不可用', 'network');
  } finally {
    clear();
  }
}

export async function searchAndExtract(data, body, eventId, options = {}) {
  const enabled = options.live === true;
  if (!enabled) return { ok: true, skipped: true, items: [], note: '未请求联网检索，仅使用已核档案。' };
  const track = body.track || 'all';
  const eventName = data.eventNames[eventId];
  const aliases = (data.aliases[eventId] || [eventName]).filter(Boolean);
  const scopeTerms = [
    body.school, body.employer || body.company, body.job || body.role,
    track === 'employment' ? '招聘' : track === 'retest' ? '复试 调剂' : '推免 加分'
  ].filter(Boolean);
  const query = [eventName, scopeTerms[0] || '', track === 'employment' ? '招聘 优先 直通' : track === 'retest' ? '复试 调剂' : '推免 加分 细则']
    .filter(Boolean).join(' ');
  let search;
  try {
    search = await searchWeb(query, { timeout: options.searchTimeout || 7000 });
  } catch (error) {
    return {
      ok: false,
      degraded: true,
      items: [],
      error: error.message,
      code: error.code,
      provider: process.env.SEARCH_PROVIDER || 'baidu',
      fetchedAt: new Date().toISOString(),
      note: '联网检索失败，已回退到本地已核档案。'
    };
  }
  const candidates = search.results.slice(0, 4);
  const items = [];
  const rejected = [];
  const keywordSets = track === 'employment'
    ? ['招聘', '校招', '优先', '直通', '加分', '签约', 'offer', '岗位']
    : track === 'retest'
      ? ['复试', '调剂', '推免']
      : track === 'admission'
        ? ['推免', '保研', '加分', '细则', '遴选', '免试']
        : ['推免', '加分', '招聘', '榜单', '竞赛'];
  for (const candidate of candidates) {
    try {
      const finalUrl = await resolveBaiduLink(candidate.href, 5000);
      const host = hostOf(finalUrl);
      if (!host || /baidu\.com$/.test(host)) {
        rejected.push({ url: finalUrl, reason: '未能解析原始出处' });
        continue;
      }
      const page = await fetchText(finalUrl, { timeout: 5000 });
      if (!/html|text/i.test(page.contentType)) {
        rejected.push({ url: finalUrl, reason: '非 HTML 正文，未自动提取' });
        continue;
      }
      const { title, text } = stripHtml(page.html);
      const hasEvent = aliases.some((a) => text.includes(a) || title.includes(a));
      if (!hasEvent) {
        rejected.push({ url: finalUrl, reason: '正文未出现赛事名称' });
        continue;
      }
      if (body.school && !text.includes(body.school)) {
        rejected.push({ url: finalUrl, reason: '正文未出现所填学校' });
        continue;
      }
      if (body.employer && !text.includes(body.employer || body.company)) {
        rejected.push({ url: finalUrl, reason: '正文未出现所填招聘方' });
        continue;
      }
      const snippet = findSnippet(text, aliases, keywordSets);
      if (!snippet) {
        rejected.push({ url: finalUrl, reason: '未找到与限定范围相关的可用引文' });
        continue;
      }
      const klass = classify(host, snippet, track);
      const publishedAt = dateFromHtml(page.html);
      const year = publishedAt ? Number(publishedAt.slice(0, 4)) : null;
      const time = year == null ? 0.65 : Math.abs(2026 - year) <= 2 ? 1 : Math.abs(2026 - year) <= 5 ? 0.85 : 0.70;
      const item = {
        id: `live-${Buffer.from(finalUrl).toString('base64url').slice(0, 20)}`,
        origin: 'live',
        track: track === 'all' ? (klass.class === 'outcome' || klass.class === 'direct' ? 'employment' : 'admission') : track,
        class: klass.class,
        eventId,
        title: title || candidate.title,
        url: finalUrl,
        publisher: host,
        quote: snippet,
        scope: {
          event: eventName,
          school: body.school || null,
          employer: body.employer || body.company || null,
          role: body.job || body.role || null
        },
        year,
        published: publishedAt,
        sourceCoefficient: klass.sourceCoefficient,
        directness: klass.directness,
        timeCoefficient: time,
        policyScore: klass.policyScore,
        tag: klass.label,
        statusLabel: '本轮抓取 · 正文与赛事名已核',
        verifiedQuote: true,
        fetchedAt: new Date().toISOString()
      };
      item.baseScore = roundInt(item.sourceCoefficient * item.directness * item.timeCoefficient * 100);
      items.push(item);
    } catch (error) {
      rejected.push({ url: candidate.href, reason: error.message });
    }
  }
  return {
    ok: true,
    degraded: false,
    search,
    items,
    rejected,
    note: `联网检索返回 ${search.results.length} 条结果，逐页解析 ${candidates.length} 个，保留 ${items.length} 条可用证据。`
  };
}

export async function verifyUrlEvidence(input, { allowLocal = false, timeout = 8000 } = {}) {
  const rawUrl = String(input.url || '').trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return { ok: false, verified: false, reason: 'URL 格式不正确' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, verified: false, reason: '只接受 http/https 链接' };
  const host = parsed.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const privateHost = local || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host);
  if (privateHost && !allowLocal) return { ok: false, verified: false, reason: '出于安全考虑，不接受内网或本机链接' };
  let page;
  try {
    page = await fetchText(rawUrl, { timeout });
  } catch (error) {
    return { ok: false, verified: false, reason: `链接抓取失败：${error.message}`, code: error.code };
  }
  if (!/html|text/i.test(page.contentType)) {
    return { ok: false, verified: false, reason: '当前只能自动比对 HTML/文本正文；PDF 请附人工核对说明', code: 'non_html' };
  }
  const { title, text } = stripHtml(page.html);
  const quote = String(input.quote || '').trim();
  if (quote.length < 12) return { ok: false, verified: false, reason: '引文至少 12 个字，便于核对正文', code: 'quote_short' };
  const quoteNorm = normalizeText(quote);
  const bodyNorm = normalizeText(text);
  if (!bodyNorm.includes(quoteNorm)) {
    return {
      ok: false,
      verified: false,
      reason: '链接可达，但引文未在正文中出现',
      code: 'quote_mismatch',
      finalUrl: page.finalUrl,
      pageTitle: title,
      fetchedAt: new Date().toISOString()
    };
  }
  const scope = {
    event: input.event || '',
    school: input.school || '',
    unit: input.unit || '',
    employer: input.employer || '',
    job: input.job || '',
    year: input.year || ''
  };
  const missing = [];
  const checkTerms = [
    ['赛事', input.event],
    ['学校', input.school],
    ['院系', input.unit],
    ['招聘方', input.employer],
    ['岗位', input.job]
  ];
  for (const [label, term] of checkTerms) {
    if (!term) continue;
    if (!bodyNorm.includes(normalizeText(term))) missing.push(label);
  }
  if (missing.length) {
    return {
      ok: false,
      verified: false,
      reason: `引文已出现，但正文未出现所填范围：${missing.join('、')}`,
      code: 'scope_mismatch',
      finalUrl: page.finalUrl,
      pageTitle: title,
      fetchedAt: new Date().toISOString()
    };
  }
  const publishedAt = input.publishedAt || dateFromHtml(page.html);
  return {
    ok: true,
    verified: true,
    reason: '链接可达 · 引文出现 · 范围词匹配',
    finalUrl: page.finalUrl,
    pageTitle: title,
    quote,
    scope,
    publishedAt,
    contentHash: (await import('node:crypto')).createHash('sha256').update(page.html).digest('hex'),
    contentLength: page.html.length,
    fetchedAt: new Date().toISOString()
  };
}

export function eventIdFromQuery(data, query) {
  const q = normalizeText(query);
  if (!q) return null;
  if (data.eventNames[query]) return query;
  for (const id of EVENT_ORDER) {
    if ((data.aliases[id] || []).some((a) => normalizeText(a) === q)) return id;
  }
  for (const id of EVENT_ORDER) {
    if ((data.aliases[id] || []).some((a) => normalizeText(a).includes(q) || q.includes(normalizeText(a)))) return id;
  }
  return null;
}