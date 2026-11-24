// make-batches.mjs — 把待提取学校名单切成 N 个批次文件
// 用法: node make-batches.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const done = new Set([
  '南京大学','东南大学','南京航空航天大学','河海大学','浙江大学','中国科学技术大学',
  '中国农业大学','北京交通大学','中南大学','华东理工大学','西北农林科技大学',
  '南京工业大学','武汉科技大学','江苏科技大学','武汉工程大学','上海工程技术大学'
]);

const names = [];
for (const f of ['schools.txt', 'schools-shuangfei.txt']) {
  const lines = fs.readFileSync(path.join(base, f), 'utf8')
    .replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('name|')) continue;
    const name = line.split('|')[0];
    if (!done.has(name)) names.push(name);
  }
}

const N = 9, per = Math.ceil(names.length / N);
const dir = path.join(base, 'batches');
fs.mkdirSync(dir, { recursive: true });
for (let i = 0; i < N; i++) {
  const chunk = names.slice(i * per, (i + 1) * per);
  if (chunk.length) {
    fs.writeFileSync(path.join(dir, `batch-${i + 1}-schools.txt`), chunk.join('\n') + '\n', 'utf8');
  }
}
console.log(`共 ${names.length} 所待提取，分 ${N} 批，每批最多 ${per} 所，输出至 batches/`);
