import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(here, '..');
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(APP_ROOT, 'data', 'inputs');
export const USER_DATA_DIR = process.env.USER_DATA_DIR
  ? path.resolve(process.env.USER_DATA_DIR)
  : path.join(APP_ROOT, 'data', 'user');

export const EVENT_ORDER = [
  'nuedc', 'software', 'computer', 'cumcm', 'sanchuang', 'robomaster',
  'lanqiao', 'mati', 'leetcode', 'robocon', 'icpc', 'tianchi',
  'graduateElectronics', 'graduateMath', 'kaggle'
];

export const SHORT_NAMES = {
  nuedc: '电赛',
  software: '软件杯',
  computer: '计算机设计',
  cumcm: '数模',
  sanchuang: '三创赛',
  robomaster: '机甲大师',
  lanqiao: '蓝桥杯',
  mati: '码蹄杯',
  leetcode: 'LeetCode',
  robocon: 'ROBOCON',
  icpc: 'ICPC',
  tianchi: '天池',
  graduateElectronics: '研电赛',
  graduateMath: '研数模',
  kaggle: 'Kaggle'
};

export const DIMENSION_META = [
  { id: 'task', name: '任务挑战', weight: 25, levels: ['有明确的任务和交付物', '需要独立完成专业解题或技术实现', '还要展示实物、验证结果或答辩论证'] },
  { id: 'review', name: '评审与复核', weight: 20, levels: ['公开计分依据', '有明确的专家评审或系统测试', '另有实质复测、复议或答辩环节'] },
  { id: 'selection', name: '选拔强度', weight: 15, levels: ['按成绩排名', '通过资格赛或分阶段选拔', '同届同口径全国晋级或获奖比例有不超过 10% 的明确上限或实绩'] },
  { id: 'disclosure', name: '结果透明', weight: 10, levels: ['可追溯到规则或结果', '规则和对应结果或统计均可查', '另有明文异议渠道和期限'] }
];

export const EMPLOYMENT_WEIGHT = 15;
export const ADMISSION_WEIGHT = 15;

export function round1(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function roundInt(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n + Number.EPSILON);
}

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[“”"'‘’《》〈〉（）()【】[\]，,。.!！?？：:；;、\s·\-—_/\\]/g, '')
    .trim();
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    const junk = ['utm_source', 'utm_medium', 'utm_campaign', 'spm', 'from'];
    for (const key of junk) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return String(url || '');
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function readJson(name) {
  const file = path.join(DATA_DIR, name);
  const raw = await fs.readFile(file, 'utf8');
  return { file, raw, value: JSON.parse(raw), sha256: sha256(raw) };
}

let cache = null;

export async function loadData() {
  if (cache) return cache;
  const names = [
    'admission-engineering.json', 'admission-science.json', 'catalog.json',
    'competition-evidence.json', 'employment-data.json', 'participation.json'
  ];
  const loaded = {};
  for (const name of names) loaded[name] = await readJson(name);

  const engineering = loaded['admission-engineering.json'].value;
  const science = loaded['admission-science.json'].value;
  const catalogRaw = loaded['catalog.json'].value;
  const competition = loaded['competition-evidence.json'].value;
  const employment = loaded['employment-data.json'].value;
  const participation = loaded['participation.json'].value;

  const eventNames = {};
  const aliases = {};
  for (const [id, list] of Object.entries(employment.events || {})) {
    eventNames[id] = list[0];
    aliases[id] = [...new Set([...list, SHORT_NAMES[id]].filter(Boolean))];
  }

  // The six inputs are the only scoring source. The catalog is used solely
  // for "榜单与目录" evidence and for fuzzy name suggestions.
  const catalog = catalogRaw.map((row) => ({ level: row[0], id: row[1], name: row[2] }));
  const catalogFor = {};
  for (const id of EVENT_ORDER) {
    const namesForEvent = aliases[id] || [eventNames[id]];
    const normalized = namesForEvent.map(normalizeText).filter(Boolean);
    const hit = catalog.find((entry) => {
      const n = normalizeText(entry.name);
      return normalized.some((alias) => n === alias || (alias.length >= 4 && n.includes(alias)) || (n.length >= 5 && alias.includes(n)));
    });
    if (hit) catalogFor[id] = hit;
  }

  const admission = [
    ...engineering.map((r) => ({ ...r, input: 'admission-engineering.json' })),
    ...science.map((r) => ({ ...r, input: 'admission-science.json' }))
  ];

  const admissionByEvent = {};
  for (const id of EVENT_ORDER) admissionByEvent[id] = [];
  for (const record of admission) {
    for (const clause of record.clauses || []) {
      for (const id of clause.events || []) {
        if (!admissionByEvent[id]) admissionByEvent[id] = [];
        admissionByEvent[id].push({ record, clause });
      }
    }
  }

  const employmentByEvent = {};
  for (const id of EVENT_ORDER) employmentByEvent[id] = [];
  for (const record of employment.records || []) {
    for (const id of record.events || []) {
      if (!employmentByEvent[id]) employmentByEvent[id] = [];
      employmentByEvent[id].push(record);
    }
  }

  const sourceMap = {};
  for (const [key, value] of Object.entries(employment.sources || {})) {
    sourceMap[key] = { key, title: value[0], url: value[1], host: hostOf(value[1]) };
  }

  for (const record of employment.records || []) {
    record.sourceDetails = (record.sources || []).map((key) => sourceMap[key]).filter(Boolean);
    record.primarySource = record.sourceDetails[0] || null;
    record.orgName = employment.organizations?.[record.org]?.name || record.org || '';
    record.orgSector = employment.organizations?.[record.org]?.sector || '';
    record.orgSize = employment.organizations?.[record.org]?.size || '';
  }

  const hashes = Object.fromEntries(names.map((n) => [n, loaded[n].sha256]));
  const provenance = JSON.parse(await fs.readFile(path.join(APP_ROOT, 'data', 'provenance.json'), 'utf8'));

  cache = {
    engineering,
    science,
    admission,
    admissionByEvent,
    catalog,
    catalogFor,
    competition,
    employment,
    participation,
    eventNames,
    aliases,
    employmentByEvent,
    sourceMap,
    hashes,
    provenance,
    reviewed: employment.reviewed || competition.reviewed || '2026-11',
    dataFiles: names.map((name) => ({ name, sha256: hashes[name], source: provenance.files.find((f) => f.file === name)?.source }))
  };
  return cache;
}

export function eventMeta(data, id) {
  const known = data.competition.events?.[id];
  const participation = data.participation[id] || null;
  const catalog = data.catalogFor[id] || null;
  return {
    id,
    name: data.eventNames[id] || id,
    shortName: SHORT_NAMES[id] || id,
    aliases: data.aliases[id] || [data.eventNames[id] || id],
    scope: known?.scope || null,
    catalog,
    participation,
    hasFacts: Boolean(known?.facts),
    platform: (data.employment.platforms || []).includes(id)
  };
}

export function sourceHost(url) {
  return hostOf(url);
}

export { sha256, normalizeUrl, hostOf };