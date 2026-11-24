import { DIMENSIONS, WEIGHTS, COMPOSITE } from './weights.mjs';

export function clamp(n, lo = 0, hi = 100) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

export function weightedIndex(scores, weights) {
  let sum = 0;
  let mass = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = scores?.[key];
    if (typeof score === 'number' && Number.isFinite(score)) {
      sum += score * weight;
      mass += weight;
    }
  }
  return mass ? sum / mass : null;
}

export function coverageOf(scores) {
  const scored = DIMENSIONS.filter(d => typeof scores?.[d.id] === 'number').length;
  return scored / DIMENSIONS.length;
}

export function compositeOf(postgrad, career, preset = 'balanced') {
  if (postgrad == null && career == null) return null;
  if (postgrad == null) return career;
  if (career == null) return postgrad;
  const mix = COMPOSITE[preset] ?? COMPOSITE.balanced;
  return postgrad * mix.postgrad + career * mix.career;
}

export function scarcityScore(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) return null;
  const points = [
    [0.003, 96], [0.005, 93], [0.01, 88], [0.02, 82],
    [0.05, 70], [0.1, 60], [0.2, 46], [0.33, 33], [0.6, 20]
  ];
  if (ratio <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    if (ratio <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const t = (Math.log(ratio) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 18;
}

export function confidenceOf({ scores, evidence, conflicts = [] }) {
  const coverage = coverageOf(scores);
  const domains = new Set((evidence || []).map(e => e.domain).filter(Boolean));
  const independence = Math.min(1, domains.size / 6);
  const grades = (evidence || []).reduce((acc, e) => {
    acc.A += e.grade === 'A' ? 1 : 0;
    acc.B += e.grade === 'B' ? 1 : 0;
    acc.C += e.grade === 'C' ? 1 : 0;
    return acc;
  }, { A: 0, B: 0, C: 0 });
  const quality = Math.min(1, (grades.A + grades.B * 0.55 + grades.C * 0.2) / 5);
  const base = coverage * 0.5 + independence * 0.25 + quality * 0.25;
  const penalty = Math.min(0.3, conflicts.length * 0.09);
  return Math.round(Math.max(0, base - penalty) * 100) / 100;
}

export function tierOf(composite, cohortN) {
  if (composite == null) return { code: 'NA', label: '证据不足，暂不出分' };
  if (!cohortN || cohortN < 20) {
    return { code: 'NA', label: '未分区（同组不足 20 项）', reason: '分区需要同年度、同人群、同领域的至少 20 项有效赛事。' };
  }
  const percentile = Math.min(0.99, Math.max(0.01, 1 - composite / 110));
  if (percentile <= 0.25) return { code: 'Q1', label: '一区', percentile };
  if (percentile <= 0.5) return { code: 'Q2', label: '二区', percentile };
  if (percentile <= 0.75) return { code: 'Q3', label: '三区', percentile };
  return { code: 'Q4', label: '四区', percentile };
}

export function assembleScores(raw) {
  const out = {};
  for (const dim of DIMENSIONS) out[dim.id] = clamp(raw?.[dim.id]);
  return out;
}

export function dimensionRows(scores, evidence) {
  return DIMENSIONS.map(dim => ({
    id: dim.id,
    name: dim.name,
    hint: dim.hint,
    desc: dim.desc,
    guide: dim.guide,
    score: typeof scores[dim.id] === 'number' ? Math.round(scores[dim.id]) : null,
    postgrad: WEIGHTS.postgrad[dim.id],
    career: WEIGHTS.career[dim.id],
    evidence: (evidence || []).filter(e => e.dims?.includes(dim.id)).map(e => e.id)
  }));
}