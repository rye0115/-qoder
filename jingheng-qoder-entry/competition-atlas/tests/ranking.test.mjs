import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

async function research(track,fields={}){
  const request=new Request('https://example.test/api/research',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({event:'全国大学生数学建模竞赛',track,...fields})});
  const result=await worker.fetch(request);
  assert.equal(result.status,200);return result.json();
}
test('research distinguishes published terms, case counts, general materials, self-reports and evidence gaps',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const exam=await research('exam');assert.equal(exam.score,75);assert.equal(exam.confidence.index,95);
  assert.match(exam.confidence.used[0].title,/2025.*调剂/);
  const broad=await research('exam',{year:'2026'});assert.equal(broad.score,null);assert.equal(broad.measurement.value,2);
  assert.equal(broad.confidence.index,44);
  const offer=await research('employment');assert.equal(offer.score,75);assert.equal(offer.confidence.independent,1);
  const caseOnly=await research('employment',{employer:'腾讯',job:'后端'});assert.equal(caseOnly.score,null);
  assert.equal(caseOnly.measurement.value,1);assert.equal(caseOnly.confidence.index,31);
  const community=await research('employment',{event:'ICPC',employer:'华为'});assert.equal(community.measurement.kind,'community');
  assert.equal(community.confidence.index,5);assert.equal(community.score,null);
  const other=await research('employment',{employer:'腾讯',job:'视觉设计'});assert.equal(other.score,null);
  assert.equal(other.measurement.value,0);assert.equal(other.confidence.index,0);
  const wrongYear=await research('catalog',{year:'2023'});assert.equal(wrongYear.measurement.value,0);
  const catalog=await research('catalog');assert.equal(catalog.score,80);
  const fdu=await research('recommendation',{school:'复旦大学',award:'全国二等奖'});assert.equal(fdu.score,90);
  assert.equal(fdu.confidence.independent,1);assert.match(fdu.checked.find(x=>x.score===90).quote,/主力/);
});
test('copied job text does not corroborate itself and an explicit negative differs from missing evidence',async t=>{
  const first='https://jobs.example.com/engineer',copy='https://jobs.example.cn/copy';
  const html=s=>new Response(s,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  let lines=['示例赛事获奖者优先录用。'];
  t.mock.method(globalThis,'fetch',async url=>{
    if(String(url).startsWith('https://html.duckduckgo.com/'))return html([first,copy].map(u=>'<a class="result__a" href="'+u+'">2026年工程师招聘</a>').join(''));
    if(url===first||url===copy)return html('<title>2026年工程师招聘</title><p>岗位要求</p>'+lines.map(s=>'<p>'+s+'</p>').join(''));
    return html('<html></html>');
  });
  const get=()=>research('employment',{event:'示例赛事'}),firstResult=await get();
  assert.equal(firstResult.score,75);assert.equal(firstResult.confidence.independent,1);assert.equal(firstResult.confidence.index,70);
  lines=['示例赛事获奖不予加分。'];const negative=await get();assert.equal(negative.score,0);assert.equal(negative.confidence.index,70);
  lines.push('示例赛事获奖者优先录用。');const conflict=await get();assert.equal(conflict.score,null);
  assert.deepEqual(conflict.measurement.range,[0,75]);assert.equal(conflict.confidence.index,0);
});
test('event search proposes corrections while retaining exact, ambiguous and unknown queries',async()=>{
  const page={};
  for(const path of ['event-directory.js','event-search.js']){
    const source=await (await worker.fetch(new Request('https://example.test/'+path))).text();
    new Function('window',source)(page);
  }
  const lookup=s=>page.JinghengSearch.lookup(s);
  for(const typo of ['兰桥杯','蓝杯桥','蓝杯'])assert.equal(lookup(typo).near[0].id,'lanqiao');
  assert.equal(lookup('数学建摸').near[0].id,'cumcm');assert.equal(lookup('电赛').exact[0].id,'nuedc');
  assert.ok(['cumcm','graduateMath'].every(id=>lookup('数学建模').partial.some(r=>r.id===id)));
  assert.deepEqual(lookup('无关的未知测试字符'),{exact:[],partial:[],near:[]});
});

async function profile(p){
  const r=await worker.fetch(new Request('https://example.test/api/recommend',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}));
  assert.equal(r.status,200);
  return r.json();
}
const student={goal:'admission',school:'云南民族大学',unit:'数学与计算机科学学院',cohort:'2027',award:'nat1',place:'2',weight:50};

test('a written need reaches the ranking model and extra conditions can override it',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const need='云南民族大学数学与计算机科学学院，2027届想保研，目标国一，团队第二。';
  const data=await profile({need});
  assert.equal(data.rows.find(r=>r.event==='nuedc').score,89.6);
  assert.equal(data.profile.referenceCohort,false);
  const changed=await profile({need,place:'1'});
  assert.equal(changed.rows.find(r=>r.event==='nuedc').target,92);
  const job=await profile({need:'不考虑保研，想找电子硬件的工作'});
  assert.equal(job.profile.goal,'employment');assert.equal(job.profile.referenceCohort,true);
  assert.equal(job.profile.job,'电子硬件');assert.ok(job.rows.some(r=>r.rank!==null));
  const related=await profile({need:'想亲手做机器人'});
  assert.equal(related.profile.goal,'interest');assert.ok(related.rows.some(r=>r.event==='robomaster'&&r.evidence.length));
  const vague=await worker.fetch(new Request('https://example.test/api/recommend',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({need:'我想保研'})}));
  assert.equal(vague.status,200);assert.equal((await vague.json()).profile.goal,'open');
});

test('default model uses the same comparison set in every sensitivity scenario',async()=>{
  const m=await (await worker.fetch(new Request('https://example.test/api/ratings'))).json();
  assert.equal(m.rubric.reduce((sum,d)=>sum+d.weight,0),100);
  assert.equal(m.rubric.length,6);
  const complete=m.ratings.filter(r=>r.score!==null);
  const baseline=m.audit.scenarios[0];
  assert.deepEqual(complete.map(r=>r.score),baseline.results.map(r=>r.value));
  for(const s of m.audit.scenarios)assert.deepEqual(s.results.map(x=>x.event),complete.map(x=>x.event));
  const cumcm=m.ratings.find(r=>r.event==='cumcm');
  assert.equal(cumcm.employment.employers,1);assert.equal(cumcm.employment.repeat,1);
  assert.equal(cumcm.employment.people,1);assert.equal(cumcm.score,83.4);assert.ok(cumcm.admission.score>0);
  assert.ok(m.ratings.some(r=>r.score===null&&r.range&&r.range[0]<r.range[1]));
  const nuedc=m.ratings.find(r=>r.event==='nuedc');
  assert.equal(nuedc.admission.schools,new Set(nuedc.admission.records.filter(r=>r.cohort===2027 && r.status==='final'&&r.mechanism!=='excluded').map(r=>r.school)).size);
  assert.equal(nuedc.admission.records.find(r=>r.school==='海南大学').corroboration,null);
});

test('same school grade, team order, year and career goal change the recommendation',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const get=(d,id)=>d.rows.find(r=>r.event===id);
  const a=await profile(student);
  const b=await profile({...student,place:'1'});
  assert.equal(get(a,'nuedc').target,79.2);
  assert.equal(get(b,'nuedc').target,92);
  assert.equal(get(a,'nuedc').base,get(b,'nuedc').base);
  assert.equal(get(a,'nuedc').score,89.6);
  assert.ok(get(a,'cumcm').rank);assert.equal(get(a,'cumcm').base,83.4);
  assert.equal(get(a,'icpc').rank,null);
  assert.deepEqual((await profile({...student,unit:'查无此院'})).rows,[]);
  assert.deepEqual((await profile({...student,cohort:'2028'})).rows,[]);
  assert.ok(a.lookup.every(l=>l.count===0));
  const job=await profile({goal:'employment',job:'电子硬件',degree:'本科',cohort:'2027',profile:'interview',weight:50});
  assert.ok(get(job,'nuedc').score>0);assert.notEqual(get(job,'nuedc').score,get(a,'nuedc').score);
  assert.equal(get(job,'nuedc').base,get(a,'nuedc').base);
});

test('a newly discovered original can enter a profile ranking and conflicting evidence suspends the rank',async t=>{
  const target='https://unit.example.edu.cn/rule', html=body=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  let conflict=false;
  t.mock.method(globalThis,'fetch',async url=>{
    if(String(url).startsWith('https://html.duckduckgo.com/'))return html('<a class="result__a" href="'+target+'">推免规则</a>');
    if(url!==target)return html('<html></html>');
    return html('<html><title>测试大学数学学院2027届推免细则</title><p>测试大学数学学院2027届推免工作细则</p>'+
      '<p>全国大学生数学建模竞赛全国一等奖加 3 分。</p>'+(conflict?'<p>全国大学生数学建模竞赛全国一等奖不予加分。</p>':'')+'</html>');
  });
  const p={...student,school:'测试大学',unit:'数学学院',place:''};
  const first=await profile(p);assert.equal(first.rows[0].event,'cumcm');assert.ok(first.rows[0].rank);
  assert.equal(first.rows[0].evidence[0].source,'本次联网原文');
  conflict=true;
  const second=await profile(p);assert.equal(second.rows[0].rank,null);assert.match(second.rows[0].confidence,/冲突/);
});

test('dates depend on the student, competition edition and subject; free weekends and preferences are distinct',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const get=(d,id)=>d.rows.find(r=>r.event===id);
  const baseline=await profile(student);
  assert.ok(baseline.rows.every(r=>!r.fit));
  const avoid={dateMode:'avoid',dateStart:'2027-04-10',dateEnd:'2027-04-10'};
  const one=await profile({need:'想参加蓝桥杯 Python，2027年4月10日没空'});
  assert.equal(one.profile.participation.time.mode,'avoid');
  assert.equal(get(one,'lanqiao').fit.status,'conflict');
  assert.equal(get(one,'lanqiao').rank,null);
  const alternatives=get(await profile(avoid),'lanqiao');
  assert.ok(alternatives.rank);
  assert.deepEqual(alternatives.fit.checks[0].choices.map(c=>c.state),['conflict','match']);
  const pref=get(await profile({need:'想参加蓝桥杯 Python',...avoid,timePriority:'prefer'}),'lanqiao');
  assert.ok(pref.rank);assert.equal(pref.fit.preference,'conflict');
  assert.ok(get(await profile({need:'只在周末有空',eventYear:'2027'}),'lanqiao').rank);
  assert.equal(get(await profile({eventYear:'2027',maxHours:'3'}),'lanqiao').fit.status,'conflict');
  assert.ok(get(await profile({eventYear:'2027',maxHours:'4'}),'lanqiao').rank);
  const mixed=await profile({...student,...avoid});
  assert.equal(get(mixed,'nuedc').rank,null);assert.equal(get(mixed,'nuedc').base,get(baseline,'nuedc').base);
  assert.equal(get(await profile({need:'每周最多投入5小时备赛'}),'lanqiao').fit.status,'unknown');
});

test('local dates, working windows and entry rules keep the scope of each source',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
  const get=async(p,id)=>(await profile(p)).rows.find(r=>r.event===id);
  const block=(start,end)=>({dateMode:'avoid',dateStart:start,dateEnd:end});
  assert.equal((await get(block('2027-03-10','2027-03-18'),'sanchuang')).fit.status,'unknown');
  assert.equal((await get(block('2027-03-01','2027-04-10'),'sanchuang')).fit.status,'conflict');
  assert.equal((await get(block('2026-09-11','2026-09-11'),'cumcm')).fit.status,'unknown');
  assert.equal((await get(block('2027-09-10','2027-09-13'),'cumcm')).fit.status,'unknown');
  assert.equal((await get({need:'我是新闻学专业，只有周末有空',eventYear:'2027'},'sanchuang')).fit.checks[0].state,'match');
  assert.equal((await get({major:'法学',eventYear:'2027'},'sanchuang')).fit.status,'eligible');
  assert.equal((await get({major:'法学',eventYear:'2028'},'sanchuang')).fit.status,'unknown');
  assert.equal((await get({major:'制药工程',eventYear:'2026'},'catalog-4-61')).fit.status,'eligible');
  assert.equal((await get({major:'新专业名',eventYear:'2026'},'catalog-4-61')).fit.status,'unknown');
  for(const p of [{dateStart:'2027-02-29',dateEnd:'2027-03-01'},{dateStart:'2027-04-12',dateEnd:'2027-04-10'},{dateStart:'2027-04-10'}]){
    const r=await worker.fetch(new Request('https://example.test/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}));
    assert.equal(r.status,400);
  }
});

test('new organizer dates can be used, and disagreement with an archived edition requires review',async t=>{
  let year=2028;
  const url='https://www.mcm.edu.cn/html_cn/node/edition.html';
  const html=s=>new Response(s,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  t.mock.method(globalThis,'fetch',async req=>{
    if(String(req).startsWith('https://html.duckduckgo.com/'))return html('<a class="result__a" href="'+url+'">全国组委会通知</a>');
    if(req===url)return html('<title>'+year+'年全国大学生数学建模竞赛第一次通知</title><p>竞赛时间定为9月15日18时至9月18日20时。</p>');
    return html('<html></html>');
  });
  const query=()=>profile({need:'想参加全国大学生数学建模竞赛',dateMode:'available',dateStart:year+'-09-15',dateEnd:year+'-09-18'});
  const current=(await query()).rows.find(r=>r.event==='cumcm');
  assert.equal(current.fit.status,'eligible');assert.equal(current.fit.checks[0].choices[0].url,url);
  year=2026;
  const conflict=(await query()).rows.find(r=>r.event==='cumcm');
  assert.equal(conflict.rank,null);assert.match(conflict.fit.checks[0].note,/互不相符/);
});

test('free-form, mixed and unrecognized wishes keep their wording and their evidence gaps',async t=>{
  let calls=[];
  t.mock.method(globalThis,'fetch',async request=>{calls.push(String(request));return new Response('',{status:503});});
  const practical=await profile({need:'我想积累作品集，也想和同学组队'});
  assert.equal(practical.profile.goal,'open');assert.equal(practical.profile.wishes.length,2);
  assert.ok(practical.rows.some(r=>r.covered.length===2&&r.evidence.length>=2));
  const mixed=await profile({need:'求职和保研都想考虑'});
  assert.deepEqual(mixed.profile.wishes.map(w=>w.kind),['admission','employment']);
  assert.ok(mixed.rows.some(r=>r.covered.length===2));
  const custom='我想尝试潮汐声景采集';calls=[];
  const unknown=await profile({need:custom});
  assert.equal(unknown.profile.need,custom);assert.deepEqual(unknown.rows,[]);
  assert.ok(calls.some(u=>decodeURIComponent(u).includes(custom)));
  const hard=await profile({need:'想做作品集，预算不超过50元'});
  assert.ok(hard.rows.length>0);assert.ok(hard.rows.every(r=>r.rank===null&&r.missing.length));
});
