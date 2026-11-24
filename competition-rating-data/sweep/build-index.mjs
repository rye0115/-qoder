// build-index.mjs — 从 sweep/raw/*.json 生成紧凑候选索引 sweep/index.md
// 用法: node build-index.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(base, 'raw');
const outFile = path.join(base, 'index.md');

// 学校名单与标签（211/985/note）
const tags = new Map();
for (const f of ['schools.txt', 'schools-shuangfei.txt']) {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('name|')) continue;
    const [name, is211, is985, note = ''] = line.split('|');
    tags.set(name, { is211: is211 === '1', is985: is985 === '1', note });
  }
}

const GOOD = /(分级|级别认定|等级认定|认定|竞赛目录|分类目录|管理办法|管理办|A类|B类|C类|Ⅰ级|I级|一类|二类|S类|重点竞赛)/;
const BAD_HOST = /(baike\.baidu|csdn|zhihu|163\.com|weixin\.qq|sohu|bilibili|toutiao)/;

function loadItems(prefix) {
  const out = [];
  for (const f of fs.readdirSync(rawDir)) {
    if (!f.startsWith(prefix) || !f.endsWith('.json')) continue;
    const name = f.slice(prefix.length).replace(/\.q[12]\.json$/, '');
    try {
      const j = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
      for (const r of j.results || []) {
        for (const it of r.items || []) out.push({ school: name, ...it, engine: r.engine });
      }
    } catch { /* 损坏文件忽略 */ }
  }
  return out;
}

function score(it) {
  let s = 0;
  try {
    const u = new URL(it.url);
    if (u.hostname.endsWith('.edu.cn')) s += 3;
    if (u.hostname.endsWith('.edu.cn') && /(jwc|jiaowu|cxcy|bksy|kjc|jiaochu|tw|xiaoyuan|graduate|yjs| dean)/i.test(u.hostname)) s += 2;
  } catch { s -= 1; }
  if (GOOD.test(it.title || '')) s += 3;
  if (GOOD.test(it.snippet || '')) s += 1;
  if (BAD_HOST.test(it.url || '')) s -= 4;
  return s;
}

// 按学校聚合 q1 + q2 的条目
const bySchool = new Map();
for (const it of loadItems('')) {
  if (!it.school) continue;
  if (!bySchool.has(it.school)) bySchool.set(it.school, []);
  bySchool.get(it.school).push(it);
}

const lines = ['# 检索候选索引（自动生成，按得分排序，取前 6）', ''];
let weak = [], strong = 0;
for (const [name, tag] of tags) {
  const items = (bySchool.get(name) || bySchool.get(name.replace(/[（）()]/g, '')) || []);
  const edu = items.some(i => (i.url || '').includes('.edu.cn'));
  const label = `${name}${tag.is985 ? ' [985]' : ''}${tag.is211 ? ' [211]' : ''}${tag.note ? ' [' + tag.note + ']' : ''}`;
  if (items.length === 0) {
    weak.push(name);
    lines.push(`## ${label}`, '- 无结果（需换关键词人工检索）', '');
    continue;
  }
  edu ? strong++ : weak.push(name);
  const top = items
    .map(i => ({ ...i, _s: score(i) }))
    .sort((a, b) => b._s - a._s)
    .slice(0, 6);
  lines.push(`## ${label}`);
  top.forEach((i, n) => {
    const sn = (i.snippet || '').replace(/\s+/g, ' ').slice(0, 160);
    lines.push(`${n + 1}. [${(i.title || '').slice(0, 60)}](${i.url}) — ${sn}`);
  });
  if (!edu) lines.push('  ⚠️ 无 .edu.cn 命中，结果置信度低');
  lines.push('');
}
lines.push(`## 汇总`, `- 学校数：${tags.size}`, `- 有官网命中：${strong}`, `- 低置信/无结果（需人工补检）：${weak.length}`, weak.length ? `- 需人工补检名单：${weak.join('、')}` : '');

fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`index.md 写入完成：${tags.size} 校，强命中 ${strong}，弱命中 ${weak.length}`);
