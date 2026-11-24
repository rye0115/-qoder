import {
  EVENT_ORDER,
  normalizeText,
  round1
} from './data.mjs';
import {
  jobFitFor,
  ratingFor
} from './scoring.mjs';
import { eventFromQuery, suggestEvents } from './research.mjs';

function typeOf(record) {
  if (record.kind === 'community') return '社区自述';
  if (record.kind === 'outcome') return '签约去向';
  return '招聘条款';
}

function evidenceCard(data, record) {
  return {
    id: record.id,
    type: record.kind,
    typeLabel: typeOf(record),
    role: record.role,
    org: record.org,
    orgName: record.orgName,
    orgSector: record.orgSector,
    orgSize: record.orgSize,
    paths: record.paths || [],
    minDegree: record.minDegree || null,
    period: record.period,
    years: record.years || [],
    award: record.award || null,
    effect: record.effect || null,
    note: record.note,
    stage: record.stage || null,
    claims: record.claims || null,
    person: record.person || null,
    events: (record.events || []).map((id) => ({ id, name: data.eventNames[id] || id })),
    sources: record.sourceDetails || [],
    status: record.kind === 'community'
      ? '单条自述 · 待核'
      : record.kind === 'outcome' ? '校方披露 · 岗位或规则待核' : '招聘原文 · 已核',
    trust: record.kind === 'community' ? 30 : record.kind === 'outcome' ? (record.sources?.includes('sjtu') ? 31 : 90) : 85
  };
}

export function employmentLibrary(data) {
  const records = data.employment.records || [];
  const cards = records.map((r) => evidenceCard(data, r));
  const policy = cards.filter((c) => c.type === 'policy');
  const outcome = cards.filter((c) => c.type === 'outcome');
  const community = cards.filter((c) => c.type === 'community');
  const orgs = new Set(policy.map((c) => c.org));
  const sectors = new Set(cards.map((c) => c.orgSector).filter(Boolean));
  const outcomesPeople = new Set(outcome.map((c) => c.person).filter(Boolean));
  return {
    ok: true,
    reviewed: data.employment.reviewed,
    summary: {
      total: cards.length,
      policy: policy.length,
      outcome: outcome.length,
      community: community.length,
      orgs: orgs.size,
      sectors: sectors.size,
      outcomePeople: outcomesPeople.size
    },
    filters: {
      types: ['全部证据', '招聘条款', '签约去向', '社区自述'],
      scales: ['不限规模', '100 人以上', '500 人以上']
    },
    cards,
    groups: { policy, outcome, community }
  };
}

export function roleOptions(data) {
  const paths = new Set();
  for (const record of data.employment.records || []) {
    for (const p of record.paths || []) paths.add(p);
    for (const t of record.roleTerms || []) paths.add(t);
  }
  return [...paths];
}

export function queryJobs(data, body = {}) {
  const role = String(body.role || body.job || '');
  const company = String(body.company || body.employer || '');
  const direction = body.direction || '探索方向';
  const employmentShare = Number(body.employmentShare ?? 0.35);
  const eventId = body.event ? eventFromQuery(data, body.event) : null;
  if (body.event && !eventId) {
    return { ok: false, error: '没有识别出赛事名称', suggestions: suggestEvents(data, body.event) };
  }
  const ids = eventId ? [eventId] : EVENT_ORDER;
  const items = [];
  for (const id of ids) {
    const rating = ratingFor(data, id);
    const fit = jobFitFor(data, id, { company, award: body.award || '', role, direction, employmentShare });
    const records = (rating.employment.records || []).filter((r) => {
      if (role) {
        const hay = normalizeText([r.role, r.roleTerms?.join(' '), r.paths?.join(' ')].filter(Boolean).join(' '));
        if (!hay.includes(normalizeText(role))) return false;
      }
      if (company) {
        const hay = normalizeText(`${r.orgName} ${r.org}`);
        if (!hay.includes(normalizeText(company))) return false;
      }
      return true;
    });
    const outcomeRecords = records.filter((r) => r.kind === 'outcome' || r.kind === 'community');
    const policyRecords = records.filter((r) => r.kind === 'policy');
    items.push({
      id,
      name: rating.name,
      shortName: rating.shortName,
      general: rating.score,
      employment: rating.employment.score,
      quality: rating.quality == null ? null : round1(rating.quality),
      fit: fit.fit,
      fitRaw: fit.fitRaw,
      composite: fit.composite,
      fitDetail: fit,
      policyRecords,
      outcomeRecords,
      employmentDetail: rating.employment,
      scope: rating.scope,
      status: fit.fit == null ? (outcomeRecords.length ? '仅有去向材料' : '该公司或岗位暂无适用条款') : '已计算',
      evidence: records
    });
  }
  const matched = items.filter((item) => (role || company || !eventId) ? (item.policyRecords.length || item.outcomeRecords.length) : true);
  const policy = matched.filter((x) => x.fit != null).sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  const outcomes = matched.filter((x) => x.fit == null && x.outcomeRecords.length).sort((a, b) => (b.employment ?? -1) - (a.employment ?? -1));
  return {
    ok: true,
    mode: body.event ? 'byEvent' : 'byRole',
    context: { role, company, direction, employmentShare, event: eventId },
    roleOptions: roleOptions(data),
    groups: { policy, outcomes },
    items: [...policy, ...outcomes],
    all: items,
    summary: `${policy.length} 项可直接匹配 · ${outcomes.length} 项仅有去向线索`,
    note: body.event
      ? '按比赛查岗位时，奖级和团队顺位会改变进入条件；未填奖级时按已知门槛记 40 分。'
      : '岗位匹配综合政策力度、招聘方覆盖、进入条件三项；未限定公司时按最多三家线性覆盖。'
  };
}

export function eventDetailForJobs(data, eventId) {
  const rating = ratingFor(data, eventId);
  const fit = jobFitFor(data, eventId, {});
  return {
    rating,
    fit,
    policies: (rating.employment.records || []).filter((r) => r.kind === 'policy'),
    outcomes: (rating.employment.records || []).filter((r) => r.kind === 'outcome'),
    communities: (rating.employment.records || []).filter((r) => r.kind === 'community')
  };
}