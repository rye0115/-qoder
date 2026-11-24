import { DIMENSIONS, WEIGHTS, COMPOSITE } from './weights.mjs';
import {
  assembleScores, coverageOf, weightedIndex, compositeOf,
  confidenceOf, tierOf, dimensionRows, clamp, scarcityScore
} from './scoring.mjs';
import { CORPUS, findDossier, normalizeName } from './corpus.mjs';
import { searchWeb, fetchPage, chatJSON, hasSearch, hasLLM, providerInfo } from './providers.mjs';

export const STAGES = [
  { id: 'parse', name: '解析条件' },
  { id: 'plan', name: '生成检索计划' },
  { id: 'search', name: '检索' },
  { id: 'fetch', name: '抓取与快照' },
  { id: 'extract', name: '抽取证据' },
  { id: 'score', name: '维度打分' },
  { id: 'finalize', name: '指数与置信度' }
];

const wait = ms => new Promise(r => setTimeout(r, ms));
const round = n => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

export function assemble(dossier, input = {}, mode = 'archive') {
  const scores = assembleScores(dossier.scores);
  const coverage = coverageOf(scores);
  const post = weightedIndex(scores, WEIGHTS.postgrad);
  const career = weightedIndex(scores, WEIGHTS.career);
  const usable = coverage >= 0.6;
  const composite = usable ? compositeOf(post, career, input.scope || 'balanced') : null;
  const confidence = confidenceOf({ scores, evidence: dossier.evidence, conflicts: dossier.conflicts });

  return {
    id: dossier.id,
    name: dossier.name,
    aliases: dossier.aliases || [],
    meta: dossier.meta,
    mode,
    updatedAt: dossier.updatedAt,
    coverageNote: dossier.coverageNote,
    queries: dossier.queries || [],
    input: {
      year: input.year ?? null,
      level: input.level ?? dossier.meta?.level ?? null,
      field: input.field ?? dossier.meta?.field ?? null,
      scope: input.scope || 'balanced',
      cohortN: Number(input.cohortN) || 0
    },
    scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, round(v)])),
    dims: dimensionRows(scores, dossier.evidence),
    evidence: dossier.evidence,
    excluded: dossier.excluded || [],
    conflicts: dossier.conflicts || [],
    gaps: dossier.gaps || [],
    scarcity: dossier.scarcity,
    indexes: {
      postgrad: usable ? round(post) : null,
      career: usable ? round(career) : null,
      composite: usable ? round(composite) : null,
      coverage: Math.round(coverage * 100) / 100,
      mass: Math.round(coverage * 100)
    },
    confidence,
    tier: tierOf(composite, Number(input.cohortN) || 0),
    formula: {
      postgrad: WEIGHTS.postgrad,
      career: WEIGHTS.career,
      composite: COMPOSITE.balanced
    },
    providers: providerInfo()
  };
}

export function archiveResults() {
  return CORPUS.map(d => assemble(d, {}, d.origin === 'import' ? 'import' : 'archive'));
}

function buildStages() {
  return STAGES.map(s => ({ ...s, status: 'pending', note: '' }));
}

function stageSetter(stages, emit) {
  return (id, status, note) => {
    const item = stages.find(s => s.id === id);
    if (!item) return;
    item.status = status;
    if (note) item.note = note;
    emit?.(stages.map(s => ({ ...s })));
  };
}

export async function runResearch(input, emit) {
  const stages = buildStages();
  const set = stageSetter(stages, emit);
  const name = String(input.name || '').trim();
  if (!name) throw Object.assign(new Error('请填写赛事名称'), { code: 'BAD_INPUT' });

  set('parse', 'running');
  await wait(90);
  const dossier = findDossier(name);
  set('parse', 'done', dossier ? `命中已核验档案：${dossier.name}` : '未命中档案，转入实时检索');

  if (dossier) return replay(dossier, input, set);

  if (!hasSearch()) {
    set('parse', 'error', '未配置检索凭据，且未命中已核验档案');
    throw Object.assign(new Error('未配置检索服务，无法实时研究新赛事'), { code: 'NO_PROVIDER' });
  }
  return live(input, set);
}

async function replay(dossier, input, set) {
  set('plan', 'running');
  await wait(70);
  set('plan', 'done', `${dossier.queries?.length || 0} 条查询（已归档）`);

  set('search', 'running');
  await wait(90);
  set('search', 'done', `${new Set(dossier.evidence.map(e => e.domain)).size} 个来源（快照已存）`);

  set('fetch', 'running');
  await wait(70);
  set('fetch', 'done', `${dossier.evidence.length} 个页面已读取`);

  set('extract', 'running');
  await wait(90);
  set('extract', 'done', `${dossier.evidence.length} 条采信 · ${dossier.excluded?.length || 0} 条排除`);

  set('score', 'running');
  await wait(90);
  set('score', 'done', `${DIMENSIONS.filter(d => typeof dossier.scores[d.id] === 'number').length} 个维度出分`);

  set('finalize', 'running');
  await wait(80);
  const result = assemble(dossier, input, dossier.origin === 'import' ? 'import' : 'archive');
  set('finalize', 'done', `置信度 ${result.confidence.toFixed(2)}`);
  return result;
}

function buildQueries(input) {
  const name = input.name;
  const year = input.year || new Date().getFullYear();
  return [
    `${name} 主办单位 章程 ${year}`,
    `${name} ${year} 获奖名单 公示`,
    `${name} 参赛队数 获奖率`,
    `${name} 推免 加分 高校 实施细则`,
    `${name} 招聘 优先录用 校招`,
    `${name} 报名费 收费 培训`,
    `${name} 评阅 查重 异议 申诉`,
    `${name} 争议 作弊 代做 通报`
  ];
}

async function live(input, set) {
  set('plan', 'running');
  await wait(80);
  const queries = buildQueries(input);
  set('plan', 'done', `${queries.length} 条查询`);

  set('search', 'running');
  const hits = [];
  for (const q of queries) {
    try {
      const rows = await searchWeb(q);
      hits.push(...rows);
    } catch (err) {
      if (err.code === 'NO_PROVIDER') throw err;
    }
  }
  const seen = new Set();
  const unique = hits.filter(h => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
  if (!unique.length) throw Object.assign(new Error('检索未返回可用结果'), { code: 'EMPTY' });
  set('search', 'done', `${unique.length} 条结果 · ${queries.length} 条查询`);

  set('fetch', 'running');
  const rank = { gov: 0, edu: 1, org: 2 };
  const ordered = [...unique].sort((a, b) => rankOf(a.url, rank) - rankOf(b.url, rank)).slice(0, 6);
  const pages = [];
  for (const hit of ordered) {
    try {
      const page = await fetchPage(hit.url);
      pages.push({ ...page, snippet: hit.snippet, title: page.title || hit.title });
    } catch {
      pages.push({
        url: hit.url,
        domain: safeDomain(hit.url),
        title: hit.title,
        text: hit.snippet,
        failed: true
      });
    }
  }
  set('fetch', 'done', `${pages.filter(p => !p.failed).length} 个页面读取 · ${pages.filter(p => p.failed).length} 个失败`);

  set('extract', 'running');
  const extraction = hasLLM()
    ? await llmExtract(input, pages)
    : heuristicExtract(input, pages);
  set('extract', 'done', `${extraction.evidence.length} 条采信 · ${extraction.excluded.length} 条排除`);

  set('score', 'running');
  await wait(60);
  const scoredDims = DIMENSIONS.filter(d => typeof extraction.scores[d.id] === 'number').length;
  set('score', 'done', `${scoredDims} 个维度出分${hasLLM() ? '' : '（启发式，未启用模型）'}`);

  set('finalize', 'running');
  const dossier = {
    id: `live-${Date.now().toString(36)}`,
    name: input.name,
    aliases: [],
    meta: {
      host: extraction.host || '待核',
      founded: extraction.founded || null,
      level: input.level || '待核',
      field: input.field || '待核',
      cadence: '待核'
    },
    updatedAt: new Date().toISOString().slice(0, 10),
    coverageNote: `${queries.length} 条查询、${pages.length} 个页面${hasLLM() ? '、模型抽取' : '、启发式抽取'}`,
    queries,
    scores: extraction.scores,
    scarcity: extraction.scarcity,
    evidence: extraction.evidence,
    conflicts: extraction.conflicts,
    gaps: extraction.gaps,
    excluded: extraction.excluded
  };
  const result = assemble(dossier, input, hasLLM() ? 'live' : 'live-heuristic');
  set('finalize', 'done', `置信度 ${result.confidence.toFixed(2)}`);
  return result;
}

function rankOf(url, rank) {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('.gov.cn')) return rank.gov;
    if (host.endsWith('.edu.cn')) return rank.edu;
    if (host.endsWith('.org.cn') || host.endsWith('.org')) return rank.org;
    return 3;
  } catch {
    return 4;
  }
}

function safeDomain(url) {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function gradeOf(domain) {
  if (!domain) return 'C';
  if (domain.endsWith('.gov.cn')) return 'A';
  if (domain.endsWith('.edu.cn')) return 'B';
  if (domain.endsWith('.org.cn') || domain.endsWith('.org')) return 'B';
  return 'C';
}

async function llmExtract(input, pages) {
  const sources = pages.map((p, i) => ({
    id: i + 1,
    title: p.title,
    url: p.url,
    domain: p.domain,
    excerpt: p.text.slice(0, 1100)
  }));
  const schema = `{
  "host": "主办单位或 待核",
  "scores": {"official": 0-100 或 null, "university": ..., "employer": ..., "rigor": ..., "scarcity": ..., "longevity": ..., "compliance": ..., "accessibility": ...},
  "scarcity": {"numerator": 数字, "denominator": 数字, "unit": "口径", "note": "说明"} 或 null,
  "evidence": [{"source": 来源编号, "quote": "原文摘录", "dims": ["official"]}],
  "excluded": [{"title": "被排除的材料", "reason": "原因"}],
  "conflicts": ["来源之间的矛盾"],
  "gaps": ["尚未取得的关键材料"]
}`;
  const system = `你是竞赛评价研究员。只依据给定来源打分，不得引入外部记忆。
维度定义：${DIMENSIONS.map(d => `${d.name}(${d.id})：${d.desc}`).join('；')}。
评分规则：0-100，缺少可信证据必须填 null，不得猜测；主办方自述、关联企业、二手榜单不能作为采信或企业采信证据；获奖率必须用同届同组国奖数除以有效参赛数，省奖不得计入分母。
只输出 JSON，结构如下：${schema}`;
  const user = `赛事：${input.name}；年份：${input.year || '待定'}；组别：${input.level || '待定'}；领域：${input.field || '待定'}。
来源：
${sources.map(s => `[${s.id}] ${s.title} (${s.domain}) ${s.url}\n${s.excerpt}`).join('\n\n')}`;

  const data = await chatJSON(system, user);
  const scores = {};
  for (const dim of DIMENSIONS) scores[dim.id] = clamp(data.scores?.[dim.id]);
  const evidence = [];
  let seq = 1;
  for (const item of Array.isArray(data.evidence) ? data.evidence.slice(0, 16) : []) {
    const src = sources.find(s => s.id === Number(item.source));
    if (!src) continue;
    const dims = (item.dims || []).filter(d => DIMENSIONS.some(x => x.id === d));
    if (!dims.length) continue;
    evidence.push({
      id: `E${seq++}`,
      title: src.title || src.domain,
      url: src.url,
      domain: src.domain,
      grade: gradeOf(src.domain),
      kind: 'live',
      publishedAt: '',
      dims,
      quote: String(item.quote || '').slice(0, 500)
    });
  }
  return {
    host: data.host,
    founded: null,
    scores,
    scarcity: data.scarcity || null,
    evidence,
    excluded: Array.isArray(data.excluded) ? data.excluded.slice(0, 8) : [],
    conflicts: Array.isArray(data.conflicts) ? data.conflicts.slice(0, 6) : [],
    gaps: Array.isArray(data.gaps) ? data.gaps.slice(0, 8) : []
  };
}

function heuristicExtract(input, pages) {
  const text = pages.map(p => p.text || '').join('\n');
  const aHit = /竞赛排行榜|84\s*项|竞赛目录|评估与管理体系/.test(text);
  const edu = /教育部/.test(text);
  const uniHits = pages.filter(p => p.domain.endsWith('.edu.cn') && /推免|加分|认定/.test(p.text)).length;
  const jobHits = pages.filter(p => !p.domain.endsWith('.edu.cn') && /招聘|优先录用|优先录取|免笔试|校招/.test(p.text)).length;
  const rigorHits = ['公示', '异议', '查重', '评阅', '双评', '通报'].filter(k => text.includes(k)).length;
  const fee = Number((text.match(/报名费[^。]{0,20}?(\d{2,5})\s*元/) || [])[1] || 0);
  const teamMatch = text.match(/(\d{4,6})\s*(?:支)?队/);
  const awardMatch = text.match(/全国一等奖[^。]{0,24}?(\d{1,5})\s*(?:项|个|队)/);
  let scarcity = null;
  if (teamMatch && awardMatch) {
    const denominator = Number(teamMatch[1]);
    const numerator = Number(awardMatch[1]);
    if (denominator > numerator && numerator > 0) {
      scarcity = { numerator, denominator, unit: '参赛队（启发式口径）', year: input.year || null, note: '自动抽取，需人工复核分母' };
    }
  }
  const foundedMatch = text.match(/((?:19|20)\d{2})\s*年[^。]{0,12}创办/);

  const scores = {
    official: aHit ? (edu ? 92 : 84) : edu ? 70 : 40,
    university: clamp(35 + uniHits * 15),
    employer: jobHits ? clamp(35 + jobHits * 12) : 30,
    rigor: clamp(30 + rigorHits * 12),
    scarcity: scarcity ? scarcityScore(scarcity.numerator / scarcity.denominator) : null,
    longevity: foundedMatch ? clamp(((new Date().getFullYear() - Number(foundedMatch[1])) / 34) * 95) : null,
    compliance: clamp(45 + (text.includes('公示') ? 12 : 0) + (text.includes('异议') ? 12 : 0) + (fee ? 6 : 0) - (text.includes('指定器材') ? 15 : 0)),
    accessibility: fee ? clamp(95 - fee / 12) : 70
  };

  const evidence = pages.map((p, i) => ({
    id: `E${i + 1}`,
    title: p.title || p.domain,
    url: p.url,
    domain: p.domain,
    grade: gradeOf(p.domain),
    kind: 'live-heuristic',
    publishedAt: '',
    dims: ['official', 'university', 'employer', 'rigor', 'compliance', 'accessibility'],
    quote: (p.text || '').slice(0, 220)
  }));

  return {
    host: null,
    founded: foundedMatch ? Number(foundedMatch[1]) : null,
    scores,
    scarcity,
    evidence,
    excluded: [],
    conflicts: [],
    gaps: [
      '本次未启用模型抽取，证据与维度分均由关键词规则生成。',
      '应人工核对国奖分母、推免细则与企业 JD。',
      '关键词命中不等于原文结论，引用前请回看来源。'
    ]
  };
}

export { normalizeName };