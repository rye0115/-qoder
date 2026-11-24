import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { USER_DATA_DIR } from './data.mjs';

const FILE = path.join(USER_DATA_DIR, 'new-evidence.json');
let queue = Promise.resolve();

async function readAll() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAll(items) {
  await fs.mkdir(USER_DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items.slice(-200), null, 2), 'utf8');
  await fs.rename(tmp, FILE);
}

export async function listEvidence() {
  return readAll();
}

export function addEvidence(entry) {
  queue = queue.then(async () => {
    const items = await readAll();
    const id = crypto.randomUUID();
    const saved = {
      ...entry,
      id,
      verified: true,
      savedAt: new Date().toISOString()
    };
    items.push(saved);
    await writeAll(items);
    return saved;
  });
  return queue;
}

export function deleteEvidence(id) {
  queue = queue.then(async () => {
    const items = await readAll();
    const next = items.filter((x) => x.id !== id);
    await writeAll(next);
    return { deleted: next.length !== items.length, remaining: next.length };
  });
  return queue;
}

export function clearEvidence() {
  queue = queue.then(async () => {
    await writeAll([]);
    return { cleared: true };
  });
  return queue;
}