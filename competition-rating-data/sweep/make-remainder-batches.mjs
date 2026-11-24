// make-remainder-batches.mjs — 计算各批未完成学校，重新切成 6 个补跑批次
// 用法: node make-remainder-batches.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const bdir = path.join(base, 'batches');

function parseCsvFirstCol(p) {
  if (!fs.existsSync(p)) return new Set();
  const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const out = new Set();
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^"([^"]*)"/);
    if (m && m[1]) out.add(m[1].trim());
  }
  return out;
}

const remaining = [];
for (let n = 1; n <= 9; n++) {
  const schoolsFile = path.join(bdir, `batch-${n}-schools.txt`);
  if (!fs.existsSync(schoolsFile)) continue;
  const schools = fs.readFileSync(schoolsFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const done = parseCsvFirstCol(path.join(bdir, `batch-${n}.csv`));
  const rem = schools.filter(s => !done.has(s));
  if (rem.length) remaining.push(...rem);
  console.log(`batch-${n}: ${done.size}/${schools.length} 已完成${rem.length ? '，缺 ' + rem.length : ''}`);
}

// 切成 6 份（对齐并发上限 6）
const N = 6, per = Math.ceil(remaining.length / N);
let idx = 10;
for (let i = 0; i < N; i++) {
  const chunk = remaining.slice(i * per, (i + 1) * per);
  if (!chunk.length) break;
  fs.writeFileSync(path.join(bdir, `batch-${idx}-schools.txt`), chunk.join('\n') + '\n', 'utf8');
  console.log(`batch-${idx}-schools.txt: ${chunk.length} 所`);
  idx++;
}
console.log(`共剩余 ${remaining.length} 所`);
