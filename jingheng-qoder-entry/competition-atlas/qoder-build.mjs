import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const webDirectory = 'qoder-web';
const functionsDirectory = 'functions';

await mkdir(webDirectory, { recursive: true });
await mkdir(functionsDirectory, { recursive: true });
await cp(join(root, 'web'), join(root, webDirectory), { recursive: true });

const employmentData = await readJson('server/employment-data.json');
const catalog = await readJson('server/catalog.json');
const competitionEvidence = await readJson('server/competition-evidence.json');
const participationRules = await readJson('server/participation.json');

const eventDirectory = { ...employmentData.events };
const normalizedName = (name) => name.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
const knownNames = new Set(Object.values(eventDirectory).flat().map(normalizedName));
for (const [page, n, name] of catalog) {
  if (!knownNames.has(normalizedName(name))) eventDirectory[`catalog-${page}-${n}`] = [name];
}
await writeFile(join(root, webDirectory, 'event-directory.js'),
  'window.JinghengEventDirectory=' + JSON.stringify(eventDirectory) + ';');

const admissionDocuments = (
  await Promise.all(['science', 'engineering'].map((name) => readJson(`server/admission-${name}.json`)))
).flat();

const moduleOrder = [
  'research.mjs',
  'employment.mjs',
  'career.mjs',
  'admissions.mjs',
  'participation.mjs',
  'ratings.mjs',
  'open-needs.mjs',
  'recommend.mjs',
  'research-confidence.mjs',
  'worker.mjs'
];

const parts = [
  'const assets={};',
  'const catalog=' + JSON.stringify(catalog) + ';',
  'const employmentData=' + JSON.stringify(employmentData) + ';',
  'const competitionEvidence=' + JSON.stringify(competitionEvidence) + ';',
  'const participationRules=' + JSON.stringify(participationRules) + ';',
  'const admissionDocuments=' + JSON.stringify(admissionDocuments) + ';'
];
for (const name of moduleOrder) parts.push(await read(`server/${name}`));
await writeFile(join(root, functionsDirectory, 'worker.js'), parts.join('\n'));

const functionEntry = `import worker from './worker.js';

function routePath(pathname) {
  const api = pathname.indexOf('/api/');
  return api >= 0 ? pathname.slice(api) : pathname;
}

Deno.serve(async (request) => {
  const incoming = new URL(request.url);
  const path = routePath(incoming.pathname);
  if (!path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  const forwardedHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || incoming.host).split(',')[0].trim();
  const forwardedProto = (request.headers.get('x-forwarded-proto') || incoming.protocol.replace(':', '')).split(',')[0].trim();
  const target = new URL(path + incoming.search, forwardedProto + '://' + forwardedHost);
  const init: RequestInit = { method: request.method, headers: request.headers };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();
  const upstream = new Request(target, init);
  const response = await worker.fetch(upstream);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers
  });
});
`;
await writeFile(join(root, functionsDirectory, 'index.ts'), functionEntry);

console.log('Built', webDirectory, 'and', functionsDirectory + '/worker.js');