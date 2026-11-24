import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
const assets={};
for(const name of await readdir('web'))assets['/'+name]=await readFile('web/'+name,'utf8');
const catalog=JSON.parse(await readFile('server/catalog.json','utf8'));
const employmentData=JSON.parse(await readFile('server/employment-data.json','utf8'));
const eventDirectory={...employmentData.events};
const normalizedName=name=>name.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase();
const knownNames=new Set(Object.values(eventDirectory).flat().map(normalizedName));
for(const [page,n,name] of catalog)if(!knownNames.has(normalizedName(name)))eventDirectory['catalog-'+page+'-'+n]=[name];
assets['/event-directory.js']='window.JinghengEventDirectory='+JSON.stringify(eventDirectory)+';';
const competitionEvidence=JSON.parse(await readFile('server/competition-evidence.json','utf8'));
const participationRules=JSON.parse(await readFile('server/participation.json','utf8'));
const participation=await readFile('server/participation.mjs','utf8');
const openNeeds=await readFile('server/open-needs.mjs','utf8');
const ratingEngine=await readFile('server/ratings.mjs','utf8');
const admissionDocuments=(await Promise.all(['science','engineering'].map(async name=>
  JSON.parse(await readFile('server/admission-'+name+'.json','utf8'))))).flat();
const admissions=await readFile('server/admissions.mjs','utf8');
const recommender=await readFile('server/recommend.mjs','utf8');
const employment=await readFile('server/employment.mjs','utf8');
const career=await readFile('server/career.mjs','utf8');
const core=await readFile('server/research.mjs','utf8');
const researchConfidence=await readFile('server/research-confidence.mjs','utf8');
const router=await readFile('server/worker.mjs','utf8');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js',[
  'const assets='+JSON.stringify(assets)+';', 'const catalog='+JSON.stringify(catalog)+';',
  'const employmentData='+JSON.stringify(employmentData)+';', 'const competitionEvidence='+JSON.stringify(competitionEvidence)+';',
  'const participationRules='+JSON.stringify(participationRules)+';',
  'const admissionDocuments='+JSON.stringify(admissionDocuments)+';',core,employment,career,admissions,participation,ratingEngine,openNeeds,recommender,researchConfidence,router
].join('\n'));
