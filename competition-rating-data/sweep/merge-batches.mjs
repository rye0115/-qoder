// merge-batches.mjs — 合并主 CSV + 9 个批次 CSV，补层级标签，输出全量数据
// 用法: node merge-batches.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '..');
const mainCsv = path.join(root, 'universities-competition-ratings.csv');
const outCsv = process.argv[2]
  ? path.join(root, process.argv[2])
  : path.join(root, 'universities-competition-ratings-full.csv');

// ---- 层级标签映射 ----
const tier = new Map();
const readList = (f) => {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('name|')) continue;
    const [name, is211, is985] = line.split('|');
    tier.set(name, is985 === '1' ? '985' : is211 === '1' ? '211（非985）' : f.includes('shuangfei') ? '双非（高口碑名单）' : '双一流（非211）');
  }
};
readList('schools.txt');
readList('schools-shuangfei.txt');

// ---- 简易 CSV 解析（够用：全字段被双引号包裹） ----
function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsvRows(p) {
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    if (f.every(x => !x.trim())) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = (f[idx] || '').trim(); });
    rows.push(row);
  }
  return { header, rows };
}

const FIELDS = ['学校', '层级标签', '分级模式', '分级体系', '现行文件', '文件年份', '时效备注', '来源URL'];
const seen = new Set();
const merged = [];
let dup = 0;

function push(rows) {
  for (const r of rows) {
    const name = r['学校'];
    if (!name) continue;
    if (seen.has(name)) { dup++; continue; }
    seen.add(name);
    merged.push({
      '学校': name,
      '层级标签': tier.get(name) || r['层级标签'] || '其他（非名单高校）',
      '分级模式': r['分级模式'] || '',
      '分级体系': r['分级体系'] || '',
      '现行文件': r['现行文件'] || '',
      '文件年份': r['文件年份'] || '',
      '时效备注': r['时效备注'] || '',
      '来源URL': r['来源URL'] || '',
    });
  }
}

const m = readCsvRows(mainCsv);
push(m.rows || m); // 兼容：主表头已有列
const batchDir = path.join(base, 'batches');
if (fs.existsSync(batchDir)) {
  for (const f of fs.readdirSync(batchDir).filter(f => /^batch-\d+\.csv$/.test(f)).sort()) {
    const b = readCsvRows(path.join(batchDir, f));
    if (b.rows) push(b.rows);
  }
}

// 名单内未提取的学校 → 占位行（保持 191 校全覆盖）
let placeholder = 0;
for (const [name, t] of tier) {
  if (!seen.has(name)) {
    seen.add(name);
    placeholder++;
    merged.push({
      '学校': name,
      '层级标签': t,
      '分级模式': '未提取（已跳过）',
      '分级体系': '',
      '现行文件': '',
      '文件年份': '',
      '时效备注': '候选链接见 sweep/index.md（搜"## 校名"段落）；原始检索结果在 sweep/raw/',
      '来源URL': '',
    });
  }
}

// 顺序：985 → 211 → 双一流 → 双非 → 其他，同级保持出现顺序
const ORDER = { '985': 0, '211（非985）': 1, '双一流（非211）': 2, '双非（高口碑名单）': 3, '其他（非名单高校）': 4 };
merged.sort((a, b) => (ORDER[a['层级标签']] ?? 9) - (ORDER[b['层级标签']] ?? 9));

const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const lines = [FIELDS.map(esc).join(',')];
for (const r of merged) lines.push(FIELDS.map(f => esc(r[f])).join(','));
fs.writeFileSync(outCsv, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');

const counts = {};
for (const r of merged) counts[r['层级标签']] = (counts[r['层级标签']] || 0) + 1;
const missing = merged.filter(r => (r['分级体系'] || '').includes('未检索到')).length;
console.log(`合并完成：${merged.length} 行（重复跳过 ${dup}，占位 ${placeholder}），输出 ${outCsv}`);
console.log('层级分布：' + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('，'));
console.log(`未检索到公开分级文件：${missing} 所`);
