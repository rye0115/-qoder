import {
  ADMISSION_WEIGHT,
  DIMENSION_META,
  EMPLOYMENT_WEIGHT,
  normalizeText,
  round1
} from './data.mjs';
import {
  admissionTargetFor,
  buildRatings,
  employmentFor,
  jobFitFor,
  qualityOf,
  rankWithTies,
  ratingFor
} from './scoring.mjs';

const AWARD_PATTERNS = [
  [/国(?:家|赛)?\s*一(?:等|等奖)?|全国一(?:等|等奖)?|国家一(?:等|等奖)?|金奖/, 'nat1'],
  [/国(?:家|赛)?\s*二(?:等|等奖)?|全国二(?:等|等奖)?|国家二(?:等|等奖)?|银奖/, 'nat2'],
  [/国(?:家|赛)?\s*三(?:等|等奖)?|全国三(?:等|等奖)?|国家三(?:等|等奖)?|铜奖/, 'nat3'],
  [/省(?:级)?\s*一(?:等|等奖)?/, 'prov1'],
  [/省(?:级)?\s*二(?:等|等奖)?/, 'prov2'],
  [/省(?:级)?\s*三(?:等|等奖)?/, 'prov3']
];

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

export function parseAward(text) {
  const value = String(text || '');
  for (const [pattern, award] of AWARD_PATTERNS) {
    if (pattern.test(value)) return award;
  }
  return null;
}

export function parsePlace(text) {
  const value = String(text || '');
  const direct = value.match(/(?:团队|队员|排名|顺位|第)\s*(?:第)?\s*([一二三四五1-5])\s*(?:位|名|作者|成员)?/);
  if (direct) return CN_NUM[direct[1]] ?? null;
  const leader = /(?:团队)?(?:队长|负责人|第一作者)/.test(value) ? 1 : null;
  return leader;
}

export function parseCohort(text, fallback = 2027) {
  const value = String(text || '');
  const m = value.match(/(20\d{2})\s*(?:届|年)/);
  return m ? Number(m[1]) : fallback;
}

export function parseNeed(data, body = {}) {
  const text = String(body.need || body.query || '');
  let goal = body.goal || null;
  if (!goal) {
    if (/保研|推免|读研|研究生|直博/.test(text)) goal = 'admission';
    else if (/求职|就业|校招|实习|找工作|offer|岗位/i.test(text)) goal = 'employment';
    else if (body.eventYear || body.maxHours || body.allowedStart || body.excludeDates) goal = 'schedule';
    else goal = 'general';
  }
  const award = body.award || parseAward(text);
  const place = body.place != null && body.place !== ''
    ? (CN_NUM[String(body.place)] ?? (Number(body.place) || null))
    : parsePlace(text);
  const cohort = body.cohort ? Number(body.cohort) : parseCohort(text, 2027);
  let targetWeight = body.targetWeight;
  if (typeof targetWeight === 'string') {
    if (targetWeight.includes('%')) targetWeight = Number(targetWeight.replace('%', '')) / 100;
    else targetWeight = Number(targetWeight);
  }
  if (!Number.isFinite(targetWeight)) targetWeight = 0.5;
  targetWeight = Math.min(0.7, Math.max(0.35, targetWeight === 0.25 ? 0.35 : targetWeight));
  const school = String(body.school || '').trim();
  const unit = String(body.unit || '').trim();
  let match = null;
  if (school) {
    match = data.admission.find((r) => normalizeText(r.school).includes(normalizeText(school)) && (!unit || normalizeText(r.unit).includes(normalizeText(unit)))) || null;
  }
  if (!match) {
    let best = null;
    for (const record of data.admission) {
      const schoolIn = text.includes(record.school) || (normalizeText(record.school).length >= 4 && normalizeText(text).includes(normalizeText(record.school)));
      const unitIn = text.includes(record.unit) || normalizeText(text).includes(normalizeText(record.unit));
      if (!schoolIn) continue;
      const score = (unitIn ? 100 : 0) + record.unit.length;
      if (!best || score > best.score) best = { record, score };
    }
    match = best?.record || null;
  }
  return {
    text,
    goal,
    award: award || 'nat1',
    awardExplicit: Boolean(award || body.award),
    place,
    placeExplicit: place != null,
    cohort,
    targetWeight,
    school: match?.school || school || null,
    unit: match?.unit || unit || null,
    record: match,
    eventYear: body.eventYear ? Number(body.eventYear) : null,
    maxHours: body.maxHours != null && body.maxHours !== '' ? Number(body.maxHours) : null,
    allowedStart: body.allowedStart || body.allowedFrom || null,
    allowedEnd: body.allowedEnd || body.allowedTo || null,
    excludeDates: body.excludeDates ? String(body.excludeDates).split(/[,，\s]+/).filter(Boolean) : [],
    direction: body.direction || (/项目/.test(text) ? '积累项目经历' : /面试|校招/.test(text) ? '争取校招面试' : '探索方向'),
    employmentShare: Number(body.employmentShare ?? 0.35)
  };
}

function pickClauseForRecord(record, eventId, cohort) {
  if (!record || record.cohort !== cohort) return null;
  const items = (dataRecordClauses(record).filter((clause) => (clause.events || []).includes(eventId)));
  return items.length ? items : null;
}

function dataRecordClauses(record) {
  return (record?.clauses || []).slice();
}

function chooseStrongestClause(clauses, award, place) {
  let best = null;
  for (const clause of clauses || []) {
    const calc = admissionTargetFor(clause, award, place);
    if (calc?.target == null) continue;
    if (!best || calc.target > best.calc.target || (calc.target === best.calc.target && (clause.values ? 1 : 0) > (best.clause.values ? 1 : 0))) {
      best = { clause, calc };
    }
  }
  return best;
}

function qualityForRating(rating) {
  const levels = {};
  for (const d of DIMENSION_META) levels[d.id] = rating.dimensions.find((x) => x.id === d.id)?.level ?? null;
  return qualityOf(levels);
}

function confidenceSummary(rating) {
  const sources = new Set();
  for (const d of rating.dimensions) for (const s of d.evidence?.sources || []) sources.add(s.url);
  for (const s of rating.sources || []) sources.add(s.url);
  for (const s of rating.admission.schools || []) sources.add(s.url);
  for (const r of rating.employment.records || []) for (const s of r.sourceDetails || []) sources.add(s.url);
  return sources.size;
}

export function recommendAdmission(data, parsed) {
  const ratings = buildRatings(data);
  const ranked = [];
  const pending = [];
  const excluded = [];
  for (const rating of ratings) {
    const clauses = pickClauseForRecord(parsed.record, rating.id, parsed.cohort);
    if (!clauses) {
      excluded.push({ event: rating.id, name: rating.name, reason: '本院系当届没有可核条款' });
      continue;
    }
    const best = chooseStrongestClause(clauses, parsed.award, parsed.place);
    if (!best) {
      excluded.push({ event: rating.id, name: rating.name, reason: '条款不适配已填奖级或顺位' });
      continue;
    }
    const quality = qualityForRating(rating);
    const target = best.calc.target;
    const item = {
      event: rating.id,
      name: rating.name,
      shortName: rating.shortName,
      base: rating.score,
      quality: quality == null ? null : round1(quality),
      qualityRaw: quality,
      target,
      targetCalc: best.calc,
      clause: best.clause,
      school: parsed.record,
      coverage: rating.coverage,
      generalRange: rating.range,
      rank: null,
      status: quality == null ? 'pending' : 'ranked'
    };
    item.qualityDisplay = item.quality;
    if (quality == null) {
      item.score = null;
      pending.push(item);
    } else {
      item.score = round1(quality * (1 - parsed.targetWeight) + target * parsed.targetWeight);
      ranked.push(item);
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  rankWithTies(ranked, 'score');
  const ordered = [...ranked, ...pending];
  const top = ordered[0] || null;
  const stats = {
    candidates: ratings.length,
    parsedPages: ratings.reduce((sum, r) => sum + confidenceSummary(r), 0),
    ranked: ranked.length,
    pending: pending.length,
    excluded: excluded.length
  };
  return {
    ok: true,
    mode: 'personal',
    goal: 'admission',
    event: top?.event ?? null,
    name: top?.name ?? null,
    rank: top?.rank ?? null,
    score: top?.score ?? null,
    base: top?.base ?? null,
    target: top?.target ?? null,
    quality: top?.quality ?? null,
    context: {
      school: parsed.school,
      unit: parsed.unit,
      cohort: parsed.cohort,
      award: parsed.award,
      place: parsed.place,
      targetWeight: parsed.targetWeight,
      qualityWeight: 1 - parsed.targetWeight,
      formula: `个人推荐分 = 赛制质量 × ${(1 - parsed.targetWeight).toFixed(2)} + 目标适配 × ${parsed.targetWeight.toFixed(2)}`,
      basis: '云南民族大学数学与计算机科学学院 2027 届推免细则 B 类条款，竞赛模块按 5% 计入综合成绩；团队第二乘 0.6。'
    },
    items: ordered,
    ranked,
    pending,
    excluded,
    ledger: {
      quality: { label: '赛制质量', value: top?.quality, note: '前四维加权贡献 ÷ 70%，按 1 位小数展示。' },
      target: { label: '目标适配', value: top?.target, note: top?.targetCalc?.formula || '按同院系条款计算。' },
      base: { label: '通用分', value: top?.base, note: '独立于个人条件的六维通用评分。' },
      weight: { label: '目标占比', value: parsed.targetWeight }
    },
    stats,
    notes: [
      '推免结果锁定学校、院系和届别；更换条件会重算，不会沿用通用榜名次。',
      '团队顺位只影响个人适配，不改变赛制质量。',
      '没有同院系正式条款的赛事不进入个人榜，避免把外校标准套到本人。'
    ]
  };
}

function dateOnly(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateRangeOverlaps(aStart, aEnd, bStart, bEnd) {
  const as = dateOnly(aStart); const ae = dateOnly(aEnd); const bs = dateOnly(bStart); const be = dateOnly(bEnd);
  if (!as || !ae || !bs || !be) return false;
  return as <= be && bs <= ae;
}

function slotDates(calendar) {
  return (calendar?.slots || []).flatMap((s) => [s.start, s.end]).filter(Boolean);
}

export function evaluateSchedule(data, rating, parsed) {
  const schedule = rating.schedule;
  if (!schedule) {
    return { fit: 'unknown', reason: '该赛事暂无可核赛期', calendars: [] };
  }
  let calendars = schedule.calendars || [];
  if (parsed.eventYear) {
    calendars = calendars.filter((c) => Number(c.year) === Number(parsed.eventYear));
    if (!calendars.length) return { fit: 'unknown', reason: `未收录 ${parsed.eventYear} 年赛期`, calendars: [] };
  }
  const reasons = [];
  let eligible = true;
  let assessed = false;
  for (const calendar of calendars) {
    const slots = calendar.slots || [];
    if (parsed.maxHours != null) {
      const session = calendar.kind === 'session' || calendar.hours != null;
      if (session) {
        assessed = true;
        let hours = Number(calendar.hours);
        if (!Number.isFinite(hours)) {
          const slot = slots[0];
          const a = slot?.start ? new Date(`${slot.start}T00:00:00+08:00`) : null;
          const b = slot?.end ? new Date(`${slot.end}T00:00:00+08:00`) : null;
          hours = a && b ? Math.max(0, (b - a) / 3600000) : null;
        }
        if (hours != null && hours > parsed.maxHours) {
          eligible = false;
          reasons.push(`单场 ${hours} 小时，超过上限 ${parsed.maxHours} 小时`);
        }
      }
    }
    if (parsed.allowedStart || parsed.allowedEnd) {
      assessed = true;
      const overlaps = slots.some((s) => dateRangeOverlaps(s.start, s.end, parsed.allowedStart || '1900-01-01', parsed.allowedEnd || '2999-12-31'));
      if (!overlaps) {
        eligible = false;
        reasons.push('与允许参赛日期不重叠');
      }
    }
    if (parsed.excludeDates?.length) {
      assessed = true;
      const hit = slots.some((s) => {
        const dates = [s.start, s.end].filter(Boolean);
        return dates.some((date) => parsed.excludeDates.some((ex) => date.startsWith(ex)));
      });
      if (hit) {
        eligible = false;
        reasons.push('与排除日期冲突');
      }
    }
  }
  if (!assessed && parsed.maxHours != null) {
    return {
      fit: 'unknown',
      reason: '该赛事不是按单场计时，单场时长限制不适用',
      calendars
    };
  }
  return {
    fit: eligible ? 'eligible' : 'conflict',
    reason: eligible ? (parsed.maxHours != null ? `单场不超过 ${parsed.maxHours} 小时` : '赛期符合条件') : reasons.join('；'),
    calendars,
    slots: calendars.flatMap((c) => c.slots || [])
  };
}

export function recommendSchedule(data, parsed) {
  const ratings = buildRatings(data);
  const scheduleRatings = ratings.filter((r) => r.schedule?.calendars?.some((c) => c.kind === 'session' || c.hours != null));
  const evaluated = scheduleRatings.map((rating) => ({
    event: rating.id,
    name: rating.name,
    base: rating.score,
    fit: null,
    score: null,
    rank: null,
    schedule: evaluateSchedule(data, rating, parsed),
    calendar: rating.schedule?.latest || null
  }));
  const eligible = evaluated.filter((x) => x.schedule.fit === 'eligible');
  eligible.sort((a, b) => (b.base ?? -1) - (a.base ?? -1));
  rankWithTies(eligible, 'base');
  for (const item of evaluated) {
    const hit = eligible.find((e) => e.event === item.event);
    if (hit) { item.rank = hit.rank; item.score = null; }
  }
  const focused = evaluated.find((x) => x.event === 'lanqiao') || evaluated[0] || null;
  if (focused) focused.fit = focused.schedule.fit;
  return {
    ok: true,
    mode: 'schedule',
    event: focused?.event ?? null,
    rank: focused?.rank ?? null,
    base: focused?.base ?? null,
    score: null,
    fit: focused?.fit ?? null,
    reason: focused?.schedule.reason ?? null,
    context: {
      eventYear: parsed.eventYear,
      maxHours: parsed.maxHours,
      note: '单场时长限制只适用于按场次计时的赛事；cumcm、nuedc 等窗口型赛事不套用该限制。'
    },
    items: evaluated,
    focused
  };
}

export function recommendJobs(data, parsed) {
  const ratings = buildRatings(data);
  const items = ratings.map((rating) => {
    const fit = jobFitFor(data, rating.id, {
      award: parsed.awardExplicit ? parsed.award : '',
      direction: parsed.direction,
      employmentShare: parsed.employmentShare
    });
    return {
      event: rating.id,
      name: rating.name,
      base: rating.score,
      employment: rating.employment.score,
      quality: rating.quality == null ? null : round1(rating.quality),
      fit: fit.fit,
      composite: fit.composite,
      fitDetail: fit,
      rank: null
    };
  }).filter((x) => x.fit != null || x.employment != null);
  const ranked = items.filter((x) => x.composite != null).sort((a, b) => b.composite - a.composite);
  rankWithTies(ranked, 'composite');
  const top = ranked[0] || items[0] || null;
  return {
    ok: true,
    mode: 'job',
    event: top?.event ?? null,
    rank: top?.rank ?? null,
    score: top?.composite ?? null,
    base: top?.base ?? null,
    fit: top?.fit ?? null,
    context: {
      direction: parsed.direction,
      weight: '政策力度 25 / 招聘方覆盖 55 / 进入条件 20',
      employmentShare: parsed.employmentShare
    },
    items,
    ranked
  };
}

export function recommend(data, body) {
  const parsed = parseNeed(data, body);
  if (parsed.goal === 'schedule') return { parsed, result: recommendSchedule(data, parsed) };
  if (parsed.goal === 'employment') return { parsed, result: recommendJobs(data, parsed) };
  if (parsed.goal === 'admission') {
    if (!parsed.record) {
      return {
        parsed,
        result: {
          ok: false,
          mode: 'personal',
          error: '没有找到对应的学校与院系条款',
          detail: '请按“学校 + 学院”填写，例如：云南民族大学数学与计算机科学学院。',
          event: null,
          rank: null,
          score: null
        }
      };
    }
    return { parsed, result: recommendAdmission(data, parsed) };
  }
  const ratings = buildRatings(data);
  return {
    parsed,
    result: {
      ok: true,
      mode: 'general',
      event: ratings[0]?.id ?? null,
      rank: 1,
      score: ratings[0]?.score ?? null,
      base: ratings[0]?.score ?? null,
      items: ratings
    }
  };
}