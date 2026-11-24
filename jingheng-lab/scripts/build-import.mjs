import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = path.join(ROOT, 'data', 'legacy');
const OUT = path.join(ROOT, 'data', 'imported-dossiers.json');

const read = name => JSON.parse(fs.readFileSync(path.join(LEGACY, name), 'utf8'));

const catalog = read('catalog.json');
const compEvidence = read('competition-evidence.json');
const admissionDocs = [
  ...read('admission-engineering.json'),
  ...read('admission-science.json')
];
const employment = read('employment-data.json');
const participation = read('participation.json');

const CATALOG_URL = 'https://www.cahe.edu.cn/site/content/17082.html';
const CATALOG_MATCH = {
  cumcm: '全国大学生数学建模竞赛',
  nuedc: '全国大学生电子设计竞赛',
  computer: '中国大学生计算机设计大赛',
  lanqiao: '蓝桥杯全国软件和信息技术专业人才大赛',
  software: '“中国软件杯”大学生软件设计大赛',
  sanchuang: '全国大学生电子商务“创新、创意及创业”挑战赛'
};

const FIELDS = {
  cumcm: '数学建模',
  nuedc: '电子信息',
  computer: '计算机',
  robomaster: '机器人',
  lanqiao: '软件与信息技术',
  software: '软件',
  mati: '程序设计',
  sanchuang: '电子商务'
};

const LEVELS = {
  cumcm: '本科 / 高职高专',
  nuedc: '本科 / 高职高专',
  computer: '本科',
  robomaster: '本科',
  lanqiao: '本科 / 高职高专',
  software: '本科',
  mati: '本科 / 高职高专',
  sanchuang: '本科 / 高职高专 / 研究生'
};

const MECHANISM = { points: 80, route: 70, priority: 60, review: 40, excluded: 0 };
const round = n => Math.round(n * 10) / 10;

function domainOf(url) {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function gradeOf(url) {
  const domain = domainOf(url);
  if (domain.endsWith('.gov.cn')) return 'A';
  if (domain.endsWith('.edu.cn')) return 'B';
  if (domain === 'unknown') return 'C';
  return 'B';
}

function catalogHit(event) {
  const name = CATALOG_MATCH[event];
  if (!name) return null;
  const index = catalog.findIndex(row => row[2] === name);
  return index < 0 ? null : { index: index + 1, name };
}

function admissionFor(event) {
  const schools = new Map();
  const picks = [];
  for (const doc of admissionDocs) {
    if (doc.cohort !== 2027 || doc.status !== 'final') continue;
    for (const clause of doc.clauses || []) {
      if (!clause.events?.includes(event) || clause.mechanism === 'excluded') continue;
      const strength = MECHANISM[clause.mechanism] ?? 0;
      const previous = schools.get(doc.school) ?? 0;
      if (strength > previous) schools.set(doc.school, strength);
      picks.push({ doc, clause, strength });
    }
  }
  if (!schools.size) return { score: null, schools: 0, picks: [] };
  const score = round([...schools.values()].reduce((a, b) => a + b, 0) / schools.size);
  const best = [];
  const seen = new Set();
  for (const pick of [...picks].sort((a, b) => b.strength - a.strength)) {
    if (seen.has(pick.doc.school)) continue;
    seen.add(pick.doc.school);
    best.push(pick);
    if (best.length >= 6) break;
  }
  return { score, schools: schools.size, picks: best, total: picks.length };
}

function employmentFor(event) {
  const records = employment.records.filter(row => row.events?.includes(event));
  const policies = records.filter(row =>
    row.kind === 'policy' && ['直通', '优先'].includes(row.effect) && row.sources?.length
  );
  const employers = new Set(policies.map(row => row.org));
  const people = new Set(records
    .filter(row => row.kind === 'outcome' && row.person && row.sources?.length &&
      ['已签约', '已入职'].includes(row.stage))
    .map(row => row.person));
  const publications = new Map();
  for (const row of policies) {
    const editions = row.sourceByYear ||
      (row.years.length === 1 ? { [row.years[0]]: row.sources[0] } : {});
    if (!publications.has(row.org)) publications.set(row.org, []);
    for (const [year, source] of Object.entries(editions)) {
      if (row.sources.includes(source)) {
        publications.get(row.org).push({ year, url: employment.sources[source]?.[1] });
      }
    }
  }
  const repeat = [...publications.values()]
    .filter(items => items.some(a => items.some(b => a.year !== b.year && a.url !== b.url))).length;
  const points = {
    breadth: 7 * Math.min(employers.size, 5),
    effect: policies.some(row => row.effect === '直通') ? 40 : policies.length ? 30 : 0,
    repeat: 5 * Math.min(repeat, 3),
    outcome: 5 * Math.min(people.size, 2)
  };
  const platform = (employment.platforms || []).includes(event);
  const score = employers.size && !platform
    ? Object.values(points).reduce((a, b) => a + b, 0)
    : null;
  return {
    score,
    employers: employers.size,
    repeat,
    people: people.size,
    policies: policies.slice(0, 4),
    records: records.length
  };
}

function evidenceFromAdmission(event, admission, nextId) {
  const list = [];
  for (const { doc, clause } of admission.picks) {
    list.push({
      id: nextId('E'),
      title: `${doc.school} · ${doc.title}`,
      url: doc.url,
      domain: domainOf(doc.url),
      grade: gradeOf(doc.url),
      kind: 'admission',
      publishedAt: doc.published || '',
      dims: ['university'],
      quote: `${doc.unit}：${clause.effect || clause.requirement || ''}${clause.locator ? `（${clause.locator}）` : ''}`.slice(0, 480)
    });
  }
  return list;
}

function evidenceFromEmployment(event, employmentData, nextId) {
  const list = [];
  for (const row of employmentData.policies) {
    const source = employment.sources[row.sources[0]];
    if (!source) continue;
    const org = employment.organizations[row.org] || { name: row.org };
    list.push({
      id: nextId('E'),
      title: `${org.name} · ${row.role || '招聘岗位'}`,
      url: source[1],
      domain: domainOf(source[1]),
      grade: gradeOf(source[1]),
      kind: 'employment',
      publishedAt: String(row.years?.[0] || row.period || ''),
      dims: ['employer'],
      quote: `${row.effect}：${row.note || row.period || ''}`.slice(0, 480)
    });
  }
  return list;
}

function evidenceFromFacts(event, nextId) {
  const dossier = compEvidence.events[event];
  if (!dossier) return [];
  const dimsBySource = new Map();
  const quotes = {};
  for (const [factId, fact] of Object.entries(dossier.facts || {})) {
    const dims = factId === 'disclosure' ? ['compliance'] : ['rigor'];
    const indexes = fact.slice(2).filter(i => dossier.sources[i]);
    for (const i of indexes) {
      if (!dimsBySource.has(i)) dimsBySource.set(i, new Set());
      for (const dim of dims) dimsBySource.get(i).add(dim);
      quotes[i] = quotes[i] ? `${quotes[i]} ${fact[1]}` : fact[1];
    }
  }
  const list = [];
  for (const [i, dims] of dimsBySource) {
    const [title, url] = dossier.sources[i];
    list.push({
      id: nextId('E'),
      title,
      url,
      domain: domainOf(url),
      grade: gradeOf(url),
      kind: 'organizer',
      publishedAt: '',
      dims: [...dims],
      quote: String(quotes[i] || '').slice(0, 480)
    });
  }
  return list;
}

function evidenceFromCatalog(hit, nextId) {
  if (!hit) return [];
  return [{
    id: nextId('E'),
    title: `全国普通高校大学生竞赛分析报告（2025）竞赛目录 · 第 ${hit.index} 项`,
    url: CATALOG_URL,
    domain: domainOf(CATALOG_URL),
    grade: 'A',
    kind: 'catalog',
    publishedAt: '',
    dims: ['official'],
    quote: `收录“${hit.name}”。84 项目录只表示入选门槛，目录内不再区分名次。`
  }];
}

function scoreFromFacts(event) {
  const dossier = compEvidence.events[event];
  const facts = dossier?.facts || {};
  const level = key => (typeof facts[key]?.[0] === 'number' ? facts[key][0] : null);
  const task = level('task');
  const review = level('review');
  const disclosure = level('disclosure');
  const rigorParts = [task, review].filter(v => v !== null);
  const rigor = rigorParts.length
    ? Math.round(rigorParts.reduce((a, b) => a + b, 0) / rigorParts.length * 100 / 3)
    : null;
  const compliance = disclosure !== null ? Math.round(disclosure * 100 / 3) : null;
  return { rigor, compliance };
}

function build(event) {
  const admission = admissionFor(event);
  const employmentData = employmentFor(event);
  const facts = scoreFromFacts(event);
  const hit = catalogHit(event);
  const names = employment.events[event] || [event];
  const name = hit?.name || names[0];
  let seq = 0;
  const nextId = prefix => `${prefix}${++seq}`;

  const evidence = [
    ...evidenceFromCatalog(hit, nextId),
    ...evidenceFromFacts(event, nextId),
    ...evidenceFromAdmission(event, admission, nextId),
    ...evidenceFromEmployment(event, employmentData, nextId)
  ].sort((a, b) => ({ catalog: 0, organizer: 1, admission: 2, employment: 3 }[a.kind] ?? 4) -
    ({ catalog: 0, organizer: 1, admission: 2, employment: 3 }[b.kind] ?? 4));

  const scores = {
    official: hit ? 85 : null,
    university: admission.score,
    employer: employmentData.score,
    rigor: facts.rigor,
    scarcity: null,
    longevity: null,
    compliance: facts.compliance,
    accessibility: null
  };

  const gaps = [
    '奖项稀缺：未取得同届、同组国奖数与有效参赛数，稀缺维暂不打分。',
    '历史稳定：未取得创办年份与连续举办记录，历史维暂不打分。',
    '可及性：未取得报名费、器材与强制培训成本，可及性暂不打分。',
    `高校采信只覆盖 ${admission.schools || 0} 所定向样本学校，不能外推为全国采信率。`,
    '企业采信只统计独立招聘方公开岗位，合作与赞助关系不计入。'
  ];
  if (!hit && event === 'robomaster') {
    gaps.push('RoboMaster 未见于 2025 版 84 项竞赛目录，官方准入待核。');
  }
  if (!hit && event === 'mati') {
    gaps.push('84 项目录中仅有“码蹄杯全国职业院校程序设计大赛”，与大学生版是否同一赛事待核。');
  }
  if (employmentData.repeat) {
    gaps.push(`企业条款中 ${employmentData.repeat} 家存在跨年重复招聘记录，已计入就业分。`);
  }

  return {
    id: event,
    name,
    aliases: [...new Set(names)].filter(alias => alias !== name),
    meta: {
      host: '待核',
      founded: null,
      level: LEVELS[event] || '待核',
      field: FIELDS[event] || '待核',
      cadence: '待核'
    },
    origin: 'import',
    updatedAt: employment.reviewed || compEvidence.reviewed || '2026-11-23',
    coverageNote: `导入早期研究数据：84 项目录、9 项赛事证据、${admissionDocs.length} 份推免细则、${employment.records.length} 条招聘记录`,
    queries: [],
    scores,
    scarcity: null,
    evidence,
    excluded: [],
    conflicts: [],
    gaps
  };
}

const EVENTS = Object.keys(compEvidence.events).filter(event =>
  event !== 'leetcode' && (employment.events[event] || CATALOG_MATCH[event])
);

const dossiers = EVENTS.map(build);
fs.writeFileSync(OUT, JSON.stringify(dossiers, null, 2), 'utf8');

for (const dossier of dossiers) {
  const scored = Object.values(dossier.scores).filter(v => typeof v === 'number').length;
  const coverage = (scored / 8 * 100).toFixed(0);
  console.log(`${dossier.id.padEnd(12)} ${dossier.name.padEnd(30)} 出分维度 ${scored}/8 (${coverage}%) · 证据 ${dossier.evidence.length} 条`);
}
console.log(`\n写入 ${path.relative(ROOT, OUT)} · ${dossiers.length} 项赛事`);