import {
  ADMISSION_WEIGHT,
  DIMENSION_META,
  EMPLOYMENT_WEIGHT,
  EVENT_ORDER,
  SHORT_NAMES,
  normalizeText,
  round1
} from './data.mjs';

const FRONT_WEIGHT = DIMENSION_META.reduce((sum, d) => sum + d.weight, 0); // 70

export function qualityOf(levels) {
  if (!levels) return null;
  const ids = DIMENSION_META.map((d) => d.id);
  if (ids.some((id) => levels[id] == null)) return null;
  const known = DIMENSION_META.reduce((sum, d) => sum + (levels[d.id] / 3) * d.weight, 0);
  return (known / FRONT_WEIGHT) * 100;
}

function factEvidence(data, id, dimensionId, fact) {
  if (!fact) return null;
  const sources = data.competition.events?.[id]?.sources || [];
  const indexes = fact.slice(2);
  return {
    text: fact[1],
    sources: indexes.map((i) => sources[i]).filter(Boolean).map(([title, url]) => ({ title, url }))
  };
}

export function employmentFor(data, id) {
  const eventName = data.eventNames[id] || id;
  const records = (data.employmentByEvent[id] || []).slice();
  const platform = (data.employment.platforms || []).includes(id);
  const policy = records.filter((r) => r.kind === 'policy' && r.org && !platform);
  const outcomes = records.filter((r) => r.kind === 'outcome' && (r.stage === '已签约' || r.stage === '已入职'));
  const community = records.filter((r) => r.kind === 'community');
  const orgs = [];
  const orgSeen = new Set();
  for (const record of policy) {
    if (!record.org || orgSeen.has(record.org)) continue;
    orgSeen.add(record.org);
    orgs.push({
      id: record.org,
      name: record.orgName,
      sector: record.orgSector,
      records: policy.filter((r) => r.org === record.org)
    });
  }
  const coverage = Math.min(5, orgs.length) * 7;
  const direct = policy.some((r) => r.effect === '直通');
  const policyStrength = policy.length ? (direct ? 40 : 30) : 0;
  let crossYear = 0;
  if (!platform) {
    for (const org of orgs) {
      const years = new Set();
      for (const record of org.records) {
        for (const year of record.years || []) years.add(String(year));
      }
      const distinctSources = new Set();
      for (const record of org.records) {
        if (record.sourceByYear) Object.values(record.sourceByYear).forEach((s) => distinctSources.add(s));
        else for (const key of record.sources || []) distinctSources.add(key);
      }
      if (years.size >= 2 && distinctSources.size >= 2) crossYear += 5;
    }
  }
  crossYear = Math.min(15, crossYear);
  const seenPeople = new Set();
  const outcomePeople = [];
  for (const record of outcomes) {
    if (!record.person || !record.sources?.length || seenPeople.has(record.person)) continue;
    seenPeople.add(record.person);
    outcomePeople.push(record);
  }
  const outcomeScore = Math.min(10, outcomePeople.length * 5);
  const valid = !platform && orgs.length > 0;
  const score = valid ? Math.min(100, coverage + policyStrength + crossYear + outcomeScore) : null;
  return {
    score,
    platform,
    valid,
    coverage,
    policyStrength,
    direct,
    crossYear,
    outcomeScore,
    orgs,
    orgCount: orgs.length,
    policyCount: policy.length,
    policyRecords: policy,
    outcomes,
    outcomePeople,
    outcomeCount: outcomePeople.length,
    community,
    communityCount: community.length,
    records,
    reason: platform
      ? '平台级记录不计入院校招聘覆盖'
      : valid ? null : '没有可核的独立招聘方条款',
    summary: valid
      ? `${orgs.length} 个招聘方明文采用 · ${crossYear ? `${crossYear / 5} 个跨届复用` : '暂无跨届复用'} · ${outcomePeople.length} 个独立签约或入职案例`
      : (platform ? '平台赛事线索保留待核' : '仅有去向或社区材料，暂不计分')
  };
}

const ADMISSION_STRENGTH = { points: 80, route: 70, priority: 60, review: 40 };

function isUncertainClause(id, record, clause) {
  if (id !== 'icpc') return false;
  const text = `${record.notes || ''} ${clause.requirement || ''}`;
  return /具体赛站|赛站.*确认|行政级别/.test(text);
}

export function admissionFor(data, id) {
  const pairs = (data.admissionByEvent[id] || []).filter(({ record, clause }) => {
    if (record.status && record.status !== 'final') return false;
    return (clause.events || []).includes(id);
  });
  const bySchool = new Map();
  for (const pair of pairs) {
    const key = `${pair.record.school}::${pair.record.unit}`;
    const uncertain = isUncertainClause(id, pair.record, pair.clause);
    const strength = ADMISSION_STRENGTH[pair.clause.mechanism] ?? 40;
    const item = {
      ...pair,
      key,
      strength,
      uncertain,
      strengthLabel: pair.clause.mechanism === 'points' ? '明确加分'
        : pair.clause.mechanism === 'route' ? '专项遴选'
        : pair.clause.mechanism === 'priority' ? '同等优先'
        : pair.clause.mechanism === 'review' ? '纳入评议' : '其他条款'
    };
    if (!bySchool.has(key)) bySchool.set(key, []);
    bySchool.get(key).push(item);
  }
  const schools = [];
  for (const [key, items] of bySchool) {
    const confirmed = items.filter((x) => !x.uncertain);
    const best = confirmed.sort((a, b) => b.strength - a.strength)[0] || null;
    const record = items[0].record;
    schools.push({
      key,
      school: record.school,
      unit: record.unit,
      published: record.published,
      title: record.title,
      url: record.url,
      locator: record.locator,
      notes: record.notes,
      clauses: items,
      best,
      strength: best?.strength ?? null,
      uncertain: !best && items.length > 0,
      status: best ? best.strengthLabel : '证据待核'
    });
  }
  const counted = schools.filter((s) => s.best);
  const rawScore = counted.length ? counted.reduce((sum, s) => sum + s.best.strength, 0) / counted.length : null;
  const score = rawScore == null ? null : round1(rawScore);
  return {
    score,
    rawScore,
    count: counted.length,
    totalRecords: schools.length,
    schools,
    uncertainCount: schools.filter((s) => s.uncertain).length,
    summary: counted.length
      ? `${counted.length} 所学校有 2027 届正式条款 · 平均力度 ${round1(score)}`
      : '暂未发现该赛事的当届正式条款'
  };
}

export function scheduleFor(data, id) {
  const p = data.participation[id];
  if (!p) return null;
  const calendars = p.calendars || [];
  const latest = calendars[calendars.length - 1] || null;
  return {
    calendars,
    latest,
    major: p.major || null,
    note: latest?.note || p.major?.note || '本校参赛资格与具体赛期待核'
  };
}

export function ratingFor(data, id) {
  const meta = {
    id,
    name: data.eventNames[id] || id,
    shortName: SHORT_NAMES[id] || id,
    platform: (data.employment.platforms || []).includes(id)
  };
  const known = data.competition.events?.[id] || null;
  const facts = known?.facts || null;
  const levels = {};
  const dimensions = DIMENSION_META.map((d) => {
    const fact = facts?.[d.id];
    const level = Array.isArray(fact) ? fact[0] : null;
    levels[d.id] = level;
    return {
      id: d.id,
      name: d.name,
      weight: d.weight,
      level,
      score: level == null ? null : round1((level / 3) * 100),
      evidence: factEvidence(data, id, d.id, fact),
      levels: d.levels
    };
  });
  const quality = qualityOf(levels);
  const employment = employmentFor(data, id);
  const admission = admissionFor(data, id);
  const knownWeights = DIMENSION_META
    .filter((d) => levels[d.id] != null)
    .reduce((sum, d) => sum + d.weight, 0)
    + (employment.score != null ? EMPLOYMENT_WEIGHT : 0)
    + (admission.score != null ? ADMISSION_WEIGHT : 0);
  const contribution =
    DIMENSION_META.reduce((sum, d) => sum + (levels[d.id] == null ? 0 : (levels[d.id] / 3) * d.weight), 0)
    + (employment.score != null ? employment.score * EMPLOYMENT_WEIGHT / 100 : 0)
    + (admission.score != null ? admission.score * ADMISSION_WEIGHT / 100 : 0);
  const coverage = knownWeights;
  let score = null;
  let range = null;
  if (coverage >= 100) {
    score = round1(contribution);
    range = [score, score];
  } else if (coverage > 0) {
    const lower = round1(contribution);
    const upper = round1(contribution + (100 - coverage));
    range = [lower, upper];
  }
  const sourceCount = new Set([
    ...(known?.sources || []).map(([, url]) => url),
    ...(employment.records || []).flatMap((r) => (r.sourceDetails || []).map((s) => s.url)),
    ...(admission.schools || []).flatMap((s) => [s.url, ...(s.clauses || []).map((c) => c.record.url)])
  ].filter(Boolean)).size;
  const status = score != null ? 'complete' : coverage > 0 ? 'partial' : (meta.platform ? 'platform' : 'pending');
  return {
    ...meta,
    scope: known?.scope || data.participation[id]?.major?.scope || null,
    scopeNote: known?.scope ? null : (data.participation[id]?.major?.note || '该赛事暂无可解析的当届规则原文'),
    dimensions,
    quality,
    employment,
    admission,
    schedule: scheduleFor(data, id),
    catalog: data.catalogFor[id] || null,
    coverage,
    contribution,
    score,
    range,
    status,
    sourceCount,
    sources: known?.sources?.map(([title, url]) => ({ title, url })) || []
  };
}

export function buildRatings(data) {
  const ratings = EVENT_ORDER.map((id) => ratingFor(data, id));
  ratings.sort((a, b) => {
    if (a.score != null && b.score != null) return b.score - a.score || b.coverage - a.coverage;
    if (a.score != null) return -1;
    if (b.score != null) return 1;
    return b.coverage - a.coverage || EVENT_ORDER.indexOf(a.id) - EVENT_ORDER.indexOf(b.id);
  });
  return ratings;
}

export function rankWithTies(items, scoreKey = 'score') {
  let last = null;
  let lastRank = 0;
  items.forEach((item, index) => {
    const value = item[scoreKey];
    if (value != null && last != null && Math.abs(value - last) < 0.0001) item.rank = lastRank;
    else {
      item.rank = value == null ? null : index + 1;
      lastRank = item.rank;
      last = value;
    }
  });
  return items;
}

export function admissionTargetFor(clause, award, place) {
  if (!clause) return null;
  if (clause.values && clause.scaleMax) {
    const value = clause.values[award];
    if (value == null) return { target: null, reason: `该条款未列明 ${award || '所选奖级'}` };
    let factor = 1;
    if (clause.factors && place != null) factor = clause.factors[String(place)] ?? 0;
    else if (clause.places && place != null && !clause.places.includes(place)) factor = 0;
    const ratio = Math.min(1, Math.max(0, (value * factor) / clause.scaleMax));
    const target = 60 + 40 * ratio;
    return {
      target: round1(target),
      raw: target,
      value,
      factor,
      scaleMax: clause.scaleMax,
      ratio,
      formula: `60 + 40 × (${value} × ${factor} ÷ ${clause.scaleMax}) = ${round1(target)}`
    };
  }
  const strength = ADMISSION_STRENGTH[clause.mechanism] ?? 40;
  return {
    target: strength,
    raw: strength,
    value: null,
    factor: null,
    scaleMax: null,
    ratio: null,
    formula: `${clause.mechanism === 'route' ? '专项遴选' : clause.mechanism === 'priority' ? '同等优先' : clause.mechanism === 'review' ? '纳入评议' : '明确加分'}力度 ${strength}`
  };
}

export function jobFitFor(data, id, options = {}) {
  const {
    company = '',
    award = '',
    role = '',
    direction = '探索方向',
    employmentShare = 0.35
  } = options;
  const employment = employmentFor(data, id);
  let records = (employment.records || []).filter((r) => r.kind === 'policy' && r.org);
  if (role) {
    const roleNorm = normalizeText(role);
    records = records.filter((r) => {
      const hay = normalizeText([r.role, r.roleTerms?.join(' '), r.paths?.join(' ')].filter(Boolean).join(' '));
      return hay.includes(roleNorm) || roleNorm.includes(normalizeText(r.role || ''));
    });
  }
  if (!records.length) {
    return {
      fit: null,
      quality: qualityOfFor(data, id),
      qualityScore: null,
      composite: null,
      policy: null,
      coverage: null,
      entry: null,
      status: employment.platform ? '平台线索待核' : '仅有去向材料',
      evidence: employment
    };
  }
  const companyNorm = normalizeText(company);
  let matched = records;
  if (companyNorm) {
    matched = records.filter((r) => {
      const hay = normalizeText(`${r.orgName} ${r.org || ''} ${r.role || ''} ${(r.paths || []).join(' ')}`);
      return hay.includes(companyNorm) || companyNorm.includes(normalizeText(r.orgName || ''));
    });
    if (!matched.length) {
      return {
        fit: null,
        quality: qualityOfFor(data, id),
        qualityScore: null,
        composite: null,
        status: '该公司暂无适用条款',
        evidence: employment
      };
    }
  }
  const orgIds = new Set(matched.map((r) => r.org));
  let coverage = Math.min(100, (orgIds.size / 3) * 100);
  if (companyNorm && matched.length) coverage = 100;
  const policy = matched.some((r) => r.effect === '直通') ? 100 : 75;
  let entry = 40;
  for (const r of matched) {
    const label = r.award || '';
    if (label.includes('参赛经历即可')) entry = Math.max(entry, 100);
    else if (label.includes('未限定') || !label) entry = Math.max(entry, 75);
    else if (award && awardSatisfies(award, label)) entry = Math.max(entry, 100);
  }
  const weights = direction === '积累项目经历'
    ? { policy: 0.15, coverage: 0.15, entry: 0.70 }
    : direction === '争取校招面试'
      ? { policy: 0.75, coverage: 0.15, entry: 0.10 }
      : { policy: 0.25, coverage: 0.55, entry: 0.20 };
  const fitRaw = policy * weights.policy + coverage * weights.coverage + entry * weights.entry;
  const fit = Math.round(fitRaw + Number.EPSILON);
  const quality = qualityOfFor(data, id);
  const composite = quality == null ? null : quality * (1 - employmentShare) + fit * employmentShare;
  return {
    fit,
    fitRaw,
    quality: quality == null ? null : round1(quality),
    qualityScore: quality,
    composite: composite == null ? null : round1(composite),
    policy,
    coverage: round1(coverage),
    entry,
    direction,
    employmentShare,
    records: matched,
    orgs: [...orgIds].map((org) => ({
      id: org,
      name: data.employment.organizations?.[org]?.name || org
    })),
    status: fit == null ? '待核' : '已计算',
    evidence: employment
  };
}

function qualityOfFor(data, id) {
  const facts = data.competition.events?.[id]?.facts;
  if (!facts) return null;
  const levels = {};
  for (const d of DIMENSION_META) levels[d.id] = facts[d.id]?.[0] ?? null;
  return qualityOf(levels);
}

export function awardSatisfies(userAward, requirement) {
  const rank = { nat1: 1, nat2: 2, nat3: 3, prov1: 3, prov2: 4, prov3: 5 };
  const have = rank[userAward] ?? 9;
  const text = String(requirement || '');
  if (/国家.*一|国一|金奖/.test(text)) return have <= 1;
  if (/国家.*二|国二|银奖/.test(text)) return have <= 2;
  if (/国家.*三|国三|铜奖/.test(text)) return have <= 3;
  if (/省.*一|省级一|省一/.test(text)) return have <= 3;
  if (/三等奖或以上|前三等次|前三个奖项/.test(text)) return have <= 3;
  return false;
}

export function jobGroups(data) {
  const policy = [];
  const outcomes = [];
  for (const id of EVENT_ORDER) {
    const r = ratingFor(data, id);
    const fit = jobFitFor(data, id);
    const item = {
      id,
      name: r.name,
      shortName: r.shortName,
      general: r.score,
      employment: r.employment.score,
      quality: r.quality == null ? null : round1(r.quality),
      fit: fit.fit,
      composite: fit.composite,
      fitDetail: fit,
      employmentDetail: r.employment,
      dimensions: r.dimensions,
      status: fit.fit == null ? fit.status : '已计算',
      scope: r.scope
    };
    if (fit.fit != null) policy.push(item);
    else outcomes.push(item);
  }
  policy.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  outcomes.sort((a, b) => (b.employment ?? -1) - (a.employment ?? -1));
  return { policy, outcomes, all: [...policy, ...outcomes] };
}