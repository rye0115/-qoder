import {
  EVENT_ORDER,
  normalizeText,
  normalizeUrl,
  round1,
  roundInt,
  hostOf
} from './data.mjs';

const CLASS_META = {
  direct: { label: '直接条款', directness: 1 },
  outcome: { label: '去向案例', directness: 0.5 },
  general: { label: '通用材料', directness: 0.4 },
  community: { label: '社区自述', directness: 0.25 }
};

const ADMISSION_RESEARCH_SCORE = { points: 90, route: 75, priority: 60, review: 50 };

function sourceCoefficientForRecord(record) {
  if (record.kind === 'community') return 0.30;
  const url = record.primarySource?.url || '';
  const host = hostOf(url);
  if (record.kind === 'outcome') {
    if (host.endsWith('.edu.cn') || host.endsWith('.edu')) return 0.95;
    return 0.85;
  }
  if (record.kind === 'policy') {
    if (host.includes('zhaopin.com') || host.includes('51job') || host.includes('liepin')) return 0.70;
    if (host.endsWith('.edu.cn')) return 0.85;
    return 0.85;
  }
  return 0.70;
}

function timeCoefficient(year, queryYear = 2026) {
  if (year == null) return 0.65;
  const diff = Math.abs(Number(queryYear) - Number(year));
  if (!Number.isFinite(diff)) return 0.65;
  if (diff <= 2) return 1;
  if (diff <= 5) return 0.85;
  return 0.70;
}

function latestYear(record) {
  const years = (record.years || []).map(Number).filter(Number.isFinite);
  return years.length ? Math.max(...years) : null;
}

function yearFromDate(value) {
  const m = String(value || '').match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

function baseScoreOf(item) {
  return roundInt(item.sourceCoefficient * item.directness * item.timeCoefficient * 100);
}

function matchesEvent(item, eventId) {
  return !eventId || item.eventId === eventId;
}

export function eventFromQuery(data, query) {
  if (!query) return null;
  const q = normalizeText(query);
  if (data.eventNames[query]) return query;
  let best = null;
  for (const id of EVENT_ORDER) {
    for (const alias of data.aliases[id] || []) {
      const n = normalizeText(alias);
      if (!n) continue;
      if (q === n || q.includes(n) || n.includes(q)) {
        const score = q === n ? 1000 : n.length;
        if (!best || score > best.score) best = { id, score };
      }
    }
  }
  return best?.id || null;
}

function admissionItems(data, eventId, queryYear) {
  const items = [];
  for (const { record, clause } of data.admissionByEvent[eventId] || []) {
    if (record.status && record.status !== 'final') continue;
    const score = ADMISSION_RESEARCH_SCORE[clause.mechanism] ?? 50;
    const year = record.cohort || yearFromDate(record.published);
    const quote = `${clause.requirement} ${clause.effect || ''}`.trim();
    items.push({
      id: `adm-${record.school}-${record.unit}-${clause.mechanism}-${record.locator}`.replace(/\s+/g, '-'),
      origin: 'archive',
      track: 'admission',
      class: 'direct',
      kind: 'policy',
      eventId,
      title: record.title,
      url: record.url,
      publisher: `${record.school}${record.unit}`,
      quote,
      locator: record.locator,
      scope: {
        school: record.school,
        unit: record.unit,
        cohort: record.cohort,
        event: data.eventNames[eventId] || eventId
      },
      year,
      published: record.published,
      sourceCoefficient: 0.95,
      directness: 1,
      timeCoefficient: timeCoefficient(year, queryYear),
      policyScore: score,
      mechanism: clause.mechanism,
      awards: clause.awards || [],
      tag: score >= 90 ? `明确分值或直通环节 · ${score} 分`
        : score >= 75 ? `明确优先或计入加分 · ${score} 分`
        : score >= 60 ? `纳入评议或遴选 · ${score} 分`
        : `仅纳入参考 · ${score} 分`,
      statusLabel: '院系正式规则'
    });
  }
  return items;
}

function employmentItems(data, eventId, queryYear) {
  const items = [];
  for (const record of data.employmentByEvent[eventId] || []) {
    const klass = record.kind === 'outcome' ? 'outcome' : record.kind === 'community' ? 'community' : 'direct';
    const sourceCoefficient = sourceCoefficientForRecord(record);
    const year = latestYear(record) || yearFromDate(record.period);
    const source = record.primarySource;
    const quote = record.note || record.award || '';
    const policyScore = record.kind === 'policy' ? (record.effect === '直通' ? 100 : 75) : null;
    items.push({
      id: `emp-${record.id}`,
      origin: 'archive',
      track: 'employment',
      class: klass,
      kind: record.kind,
      eventId,
      title: source?.title || record.role || record.orgName,
      url: source?.url || '',
      publisher: record.orgName || record.org || '未知招聘方',
      quote,
      locator: record.role || record.roleTerms?.join(' / ') || '',
      scope: {
        employer: record.orgName || record.org,
        role: record.role,
        paths: record.paths || [],
        award: record.award,
        cohort: (record.years || []).join('/'),
        event: data.eventNames[eventId] || eventId
      },
      year,
      published: null,
      sourceCoefficient,
      directness: CLASS_META[klass].directness,
      timeCoefficient: timeCoefficient(year, queryYear),
      policyScore,
      effect: record.effect || null,
      award: record.award || null,
      years: record.years || [],
      person: record.person || null,
      stage: record.stage || null,
      role: record.role || '',
      record,
      tag: record.kind === 'community' ? '社区自述 · 仅本人陈述'
        : record.kind === 'outcome' ? `${record.stage || '去向案例'} · 岗位未完全披露`
        : policyScore >= 100 ? '明确直通环节 · 100 分'
        : '明确优先条款 · 75 分',
      statusLabel: record.kind === 'community' ? '单条自述' : record.kind === 'outcome' ? '校方去向披露' : '招聘原文'
    });
  }
  return items;
}

function competitionItems(data, eventId, queryYear) {
  const known = data.competition.events?.[eventId];
  if (!known) return [];
  const items = [];
  for (const [dim, fact] of Object.entries(known.facts || {})) {
    if (!fact) continue;
    const indexes = fact.slice(2);
    for (const i of indexes) {
      const source = known.sources?.[i];
      if (!source) continue;
      items.push({
        id: `cmp-${eventId}-${dim}-${i}`,
        origin: 'archive',
        track: 'ranking',
        class: 'general',
        eventId,
        title: source[0],
        url: source[1],
        publisher: hostOf(source[1]),
        quote: fact[1],
        scope: { event: data.eventNames[eventId], dimension: dim },
        year: yearFromDate(known.scope) || 2025,
        sourceCoefficient: 0.95,
        directness: 0.4,
        timeCoefficient: timeCoefficient(yearFromDate(known.scope) || 2025, queryYear),
        policyScore: null,
        tag: '通用原始材料',
        statusLabel: '赛事规则原文'
      });
    }
  }
  return items;
}

function participationItems(data, eventId, queryYear) {
  const p = data.participation[eventId];
  if (!p) return [];
  const items = [];
  if (p.major) {
    items.push({
      id: `par-${eventId}-major`,
      origin: 'archive',
      track: 'admission',
      class: 'general',
      eventId,
      title: `${data.eventNames[eventId]} · 专业与参赛对象`,
      url: p.major.url,
      publisher: hostOf(p.major.url),
      quote: `${p.major.scope || ''} ${p.major.note || ''}`.trim(),
      scope: { event: data.eventNames[eventId], major: p.major.scope },
      year: p.major.year || null,
      sourceCoefficient: 0.95,
      directness: 0.4,
      timeCoefficient: timeCoefficient(p.major.year || null, queryYear),
      policyScore: null,
      tag: '通用原始材料',
      statusLabel: '参赛对象原文'
    });
  }
  for (const calendar of p.calendars || []) {
    items.push({
      id: `par-${eventId}-cal-${calendar.year}`,
      origin: 'archive',
      track: 'admission',
      class: 'general',
      eventId,
      title: `${data.eventNames[eventId]} · ${calendar.year} 年赛期`,
      url: calendar.url,
      publisher: hostOf(calendar.url),
      quote: calendar.note || `${calendar.slots?.[0]?.start || ''} 至 ${calendar.slots?.[0]?.end || ''}`,
      scope: { event: data.eventNames[eventId], year: calendar.year },
      year: calendar.year,
      sourceCoefficient: 0.95,
      directness: 0.4,
      timeCoefficient: timeCoefficient(calendar.year, queryYear),
      policyScore: null,
      tag: '通用原始材料',
      statusLabel: '赛期通知'
    });
  }
  return items;
}

function catalogItem(data, eventId, queryYear) {
  const entry = data.catalogFor[eventId];
  if (!entry) return null;
  return {
    id: `cat-${eventId}`,
    origin: 'archive',
    track: 'ranking',
    class: 'general',
    eventId,
    title: `竞赛目录 · ${entry.name}`,
    url: '',
    publisher: '项目输入目录（未附公开原文）',
    quote: `目录层级 ${entry.level}；该赛名已收录于随项目提供的竞赛目录。目录原件未在六份输入中附带可核链接。`,
    scope: { event: data.eventNames[eventId], catalogLevel: entry.level },
    year: 2024,
    sourceCoefficient: 0.85,
    directness: 0.4,
    timeCoefficient: 0.65,
    policyScore: null,
    catalogLevel: entry.level,
    tag: '榜单与目录 · 待补原文',
    statusLabel: '目录索引'
  };
}

function customItems(userEvidence, eventId, queryYear) {
  return (userEvidence || [])
    .filter((e) => e.verified && e.eventId === eventId)
    .map((e) => {
      const klass = e.class || 'direct';
      const year = yearFromDate(e.publishedAt) || e.year || null;
      const item = {
        id: `user-${e.id}`,
        origin: 'user',
        track: e.track || 'admission',
        class: klass,
        eventId: e.eventId || eventId,
        title: e.title || e.url,
        url: e.url,
        publisher: e.publisher || hostOf(e.url),
        quote: e.quote,
        scope: e.scope || {},
        year,
        published: e.publishedAt || null,
        sourceCoefficient: e.sourceCoefficient ?? 0.95,
        directness: e.directness ?? CLASS_META[klass]?.directness ?? 0.4,
        timeCoefficient: timeCoefficient(year, queryYear),
        policyScore: e.policyScore ?? null,
        stance: e.stance || 'affirm',
        tag: klass === 'direct' ? '新核直接条款' : klass === 'outcome' ? '新核去向案例' : klass === 'community' ? '新核社区自述' : '新核通用材料',
        statusLabel: '本轮新增 · 已核验',
        verifiedAt: e.verifiedAt
      };
      item.baseScore = baseScoreOf(item);
      return item;
    });
}

function scopeMatches(item, filters) {
  if (filters.school) {
    const hay = normalizeText(`${item.scope?.school || ''} ${item.scope?.unit || ''} ${item.publisher || ''}`);
    if (!hay.includes(normalizeText(filters.school))) return false;
  }
  if (filters.employer) {
    const hay = normalizeText(`${item.scope?.employer || ''} ${item.publisher || ''} ${item.record?.orgName || ''}`);
    if (!hay.includes(normalizeText(filters.employer))) return false;
  }
  if (filters.job) {
    const r = item.record;
    const hay = normalizeText([
      r?.role, r?.roleTerms?.join(' '), r?.paths?.join(' '), item.scope?.role, item.scope?.paths?.join(' ')
    ].filter(Boolean).join(' '));
    if (!hay || !hay.includes(normalizeText(filters.job))) return false;
  }
  if (filters.award) {
    const hay = normalizeText(`${item.award || ''} ${(item.awards || []).join(' ')} ${item.scope?.award || ''}`);
    if (!hay || !hay.includes(normalizeText(filters.award))) return false;
  }
  if (filters.year) {
    const years = [item.year, ...(item.years || [])].filter(Boolean).map(String);
    if (!years.includes(String(filters.year))) return false;
  }
  return true;
}

function dedupe(items) {
  const seenUrl = new Map();
  const seenQuote = new Set();
  const out = [];
  for (const item of items) {
    const u = item.url ? normalizeUrl(item.url) : '';
    const q = normalizeText(item.quote).slice(0, 220);
    const publisher = normalizeText(item.publisher);
    const quoteKey = `${publisher}|${q}`;
    if (u && seenUrl.has(u)) continue;
    if (q && seenQuote.has(quoteKey)) continue;
    if (u) seenUrl.set(u, item);
    if (q) seenQuote.add(quoteKey);
    out.push(item);
  }
  return out;
}

function independentKey(item) {
  try { return new URL(item.url).hostname; } catch { return item.publisher || item.id; }
}

export function confidenceFor(items) {
  const deduped = dedupe((items || []).filter((x) => x.baseScore != null))
    .sort((a, b) => b.baseScore - a.baseScore);
  if (!deduped.length) return { confidence: 0, independent: 0, used: [] };
  if (deduped.some((x) => x.stance === 'exclude') && deduped.some((x) => x.stance !== 'exclude')) {
    return { confidence: 0, independent: 0, used: [], conflict: true };
  }
  let confidence = deduped[0].baseScore;
  const used = [deduped[0]];
  const domains = new Set([independentKey(deduped[0])]);
  for (const item of deduped.slice(1)) {
    if (used.length >= 3) break;
    const key = independentKey(item);
    if (domains.has(key)) continue;
    confidence += (100 - confidence) * 0.25 * (item.baseScore / 100);
    used.push(item);
    domains.add(key);
  }
  return { confidence: roundInt(confidence), independent: used.length, used };
}

function measurementFrom(items) {
  const outcomePeople = new Set();
  for (const item of items) {
    if (item.class === 'outcome' && item.person) outcomePeople.add(item.person);
    else if (item.class === 'outcome') outcomePeople.add(item.id);
  }
  if (outcomePeople.size) {
    return { kind: 'outcome', value: outcomePeople.size, unit: '个签约或入职案例', range: null };
  }
  const community = items.filter((x) => x.class === 'community').length;
  if (community) return { kind: 'community', value: community, unit: '条已收录自述', range: null };
  const direct = items.filter((x) => x.class === 'direct');
  if (direct.length) return { kind: 'policy', value: direct.length, unit: '条直接条款', range: null };
  const general = items.filter((x) => x.class === 'general').length;
  if (general) return { kind: 'general', value: general, unit: '份通用材料', range: null };
  return { kind: 'none', value: 0, unit: '条适用证据', range: null };
}

function policyScoreFrom(items) {
  const scores = items.map((x) => x.policyScore).filter((x) => x != null);
  return scores.length ? Math.max(...scores) : null;
}

function cardFor(id, name, items, score, options = {}) {
  const conf = confidenceFor(items);
  return {
    id,
    name,
    score,
    scoreLabel: score == null ? '待补证' : `${score} / 100`,
    confidence: conf.confidence,
    independent: conf.independent,
    conflict: conf.conflict || false,
    sourceCount: new Set(items.map((x) => x.url).filter(Boolean)).size,
    evidenceCount: items.length,
    measurement: measurementFrom(items),
    note: options.note || '',
    status: score == null ? 'awaiting' : 'ready'
  };
}

export function buildResearch(data, body = {}, userEvidence = [], liveItems = []) {
  const queryYear = Number(body.year) || 2026;
  const eventId = eventFromQuery(data, body.event || body.name || '');
  if (!eventId) {
    return {
      ok: false,
      error: '没有识别出赛事名称',
      detail: '可以输入简称，例如“数模”“蓝桥杯”“电赛”，系统会先做模糊匹配。',
      suggestions: suggestEvents(data, body.event || '')
    };
  }
  const track = body.track || 'all';
  const filters = {
    school: body.school || '',
    employer: body.employer || body.company || '',
    job: body.job || body.role || '',
    award: body.award || '',
    year: body.year || ''
  };
  let items = [];
  if (track === 'all' || track === 'admission') items.push(...admissionItems(data, eventId, queryYear));
  if (track === 'all' || track === 'employment') items.push(...employmentItems(data, eventId, queryYear));
  if (track === 'all' || track === 'ranking') {
    items.push(...competitionItems(data, eventId, queryYear));
    const cat = catalogItem(data, eventId, queryYear);
    if (cat) items.push(cat);
  }
  if (track !== 'ranking' && track !== 'employment') items.push(...participationItems(data, eventId, queryYear));
  items.push(...customItems(userEvidence, eventId, queryYear));
  items.push(...liveItems.filter((x) => x.eventId === eventId));
  items = dedupe(items).map((item) => ({ ...item, baseScore: item.baseScore ?? baseScoreOf(item) }));
  const scoped = items.filter((item) => scopeMatches(item, filters));
  const admissionScoped = scoped.filter((x) => x.track === 'admission' && x.class === 'direct');
  const employmentScoped = scoped.filter((x) => x.track === 'employment');
  const rankingScoped = scoped.filter((x) => x.track === 'ranking' || x.class === 'general');
  const retestScoped = scoped.filter((x) => x.track === 'retest');

  const employmentPolicy = employmentScoped.filter((x) => x.class === 'direct');
  const admissionScore = policyScoreFrom(admissionScoped);
  const employmentScore = policyScoreFrom(employmentPolicy);
  const rankingEvidence = rankingScoped.filter((x) => x.class === 'general');
  const rankingScore = data.catalogFor[eventId] ? 80 : null;
  const retestScore = policyScoreFrom(retestScoped);

  const cards = [
    cardFor('ranking', '榜单与目录', rankingEvidence, rankingScore, {
      note: rankingScore != null ? '赛名可核对到随项目提供的竞赛目录；目录原件链接仍待补。' : '未在本次目录索引中找到该赛名。'
    }),
    cardFor('admission', '保研认可', admissionScoped, admissionScore, {
      note: admissionScoped.length ? `${new Set(admissionScoped.map((x) => x.scope.school)).size} 所学校有当届正式条款。` : '暂未检索到当届正式条款。'
    }),
    cardFor('employment', '就业帮助', employmentScoped, employmentScore, {
      note: employmentScoped.length ? `${new Set(employmentScoped.map((x) => x.publisher)).size} 个独立招聘方或去向来源。` : '暂无适用的就业证据。'
    }),
    cardFor('retest', '考研复试与调剂', retestScoped, retestScore, {
      note: retestScore != null ? '本轮新增材料含复试或调剂条款，仍需核对院校范围。' : '公开档案未录入，需联网检索或补充原文。'
    })
  ];

  const confidenceBasis = track === 'employment' ? employmentScoped
    : track === 'admission' ? admissionScoped
    : track === 'ranking' ? rankingEvidence
    : scoped;
  const confidence = confidenceFor(confidenceBasis);
  let measurement = measurementFrom(track === 'employment' ? employmentScoped : track === 'admission' ? admissionScoped : scoped);
  if (track === 'employment' && !employmentScoped.length) measurement = { kind: 'none', value: 0, unit: '条适用证据', range: null };
  const policyScore = policyScoreFrom(track === 'employment' ? employmentPolicy : track === 'admission' ? admissionScoped : scoped);

  const classCounts = {
    direct: scoped.filter((x) => x.class === 'direct').length,
    outcome: scoped.filter((x) => x.class === 'outcome').length,
    general: scoped.filter((x) => x.class === 'general').length,
    community: scoped.filter((x) => x.class === 'community').length
  };

  return {
    ok: true,
    event: eventId,
    name: data.eventNames[eventId],
    shortName: data.aliases[eventId]?.[0] || data.eventNames[eventId],
    track,
    query: body.event || '',
    filters,
    queryYear,
    policyScore: track === 'employment' || track === 'all' ? policyScore : null,
    measurement,
    confidence: confidence.confidence,
    independent: confidence.independent,
    conflict: confidence.conflict || false,
    cards,
    evidence: scoped.slice().sort((a, b) => (b.baseScore ?? 0) - (a.baseScore ?? 0)),
    allEvidence: items,
    classCounts,
    stats: {
      archiveCandidates: items.length,
      scopedCandidates: scoped.length,
      verifiedPages: new Set(scoped.map((x) => x.url).filter(Boolean)).size,
      independentSources: new Set(scoped.map((x) => x.url || x.publisher).filter(Boolean)).size,
      direct: classCounts.direct,
      outcome: classCounts.outcome,
      general: classCounts.general,
      community: classCounts.community
    },
    confidenceBasis: {
      formula: '最高单条分起步；至多补入两条独立证据，每条填补剩余分的 25% × 单条分/100，最后取整。',
      top: confidence.used[0] ? {
        id: confidence.used[0].id,
        base: confidence.used[0].baseScore,
        publisher: confidence.used[0].publisher,
        url: confidence.used[0].url
      } : null,
      used: confidence.used.map((x) => ({ id: x.id, base: x.baseScore, publisher: x.publisher, url: x.url })),
      conflict: confidence.conflict || false
    },
    scopeNote: filters.employer || filters.school || filters.job
      ? '已按学校、招聘方或岗位筛选；被筛掉的条款不计入本轮置信度。'
      : '未加限定，展示该赛事全部已核条款与材料。',
    generatedAt: new Date().toISOString()
  };
}

export function suggestEvents(data, query) {
  const q = normalizeText(query);
  if (!q) return [];
  const results = [];
  for (const id of EVENT_ORDER) {
    for (const alias of data.aliases[id] || []) {
      const n = normalizeText(alias);
      if (!n) continue;
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q) || q.startsWith(n)) score = 90;
      else if (n.includes(q) || q.includes(n)) score = 80;
      else score = similarity(q, n);
      if (score >= 45) results.push({ id, name: data.eventNames[id], alias, score });
    }
  }
  const seen = new Set();
  return results
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 5);
}

function similarity(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const distance = dp[a.length][b.length];
  return Math.max(0, 100 - distance * 18);
}