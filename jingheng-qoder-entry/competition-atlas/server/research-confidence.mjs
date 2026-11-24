const generalExamRules=[
  ['丽水学院','2026','https://yzw.lsu.edu.cn/2026/0318/c3055a364353/page.htm','有学科竞赛获奖的考生需提交相应佐证材料和获奖证明。'],
  ['中山大学环境科学与工程学院','2026','https://sese.sysu.edu.cn/article/7093','复试综合评价参考竞赛获奖证明、科研成果及社会服务等材料。']
];
function researchArchive(input,checked){
  const event=Object.keys(employmentData.events).find(id=>employmentData.events[id].some(s=>terms(input.event).some(t=>fold(s)===fold(t))));
  const names=terms(input.event);
  const catalogRow=catalog.find(r=>names.some(t=>fold(t)===fold(r[2])));
  if(input.track==='catalog'&&catalogRow&&(!input.year||input.year==='2024')&&!checked.some(s=>s.url===PDF&&/版本已变更/.test(s.status))){
    return [{...editions[0],status:'已匹配',score:80,quote:'第 '+catalogRow[0]+' 页 · 序号 '+catalogRow[1]+'　'+catalogRow[2],rule:proofNames[80],version:'核验档案 · 2024 版原始目录'}];
  }
  if(input.track==='exam'&&(event||catalogRow)){
    const rules=generalExamRules.filter(([school,year])=>(!input.school||fold(school).includes(fold(input.school)))&&(!input.year||input.year===year))
      .map(([publisher,year,url,quote])=>({publisher,year,url,quote,title:publisher+' · 2026 年硕士研究生复试材料',status:'通用复试材料',version:'核验档案'}));
    if((['cumcm','nuedc'].includes(event)||catalogRow?.[0]===1&&[1,2].includes(catalogRow[1]))&&(!input.year||input.year==='2025')&&
       (!input.school||'西安邮电大学'.includes(input.school))&&(!input.award||/^(?:省|全国)[一二三特]等奖$/.test(awardFold(input.award)))){
      rules.push({publisher:'西安邮电大学',year:'2025',url:'https://gr.xupt.edu.cn/info/1172/8845.htm',
        title:'西安邮电大学 · 2025 年第一批硕士调剂',status:'已匹配',score:75,rule:'调剂优先',
        quote:'限第一批公布的调剂专业。符合调剂学业等要求，获所列竞赛省级以上奖且团队排名前五，可获优先。',version:'核验档案 · 调剂原则及要求第 5 条'});
    }
    return rules;
  }
  if(input.track!=='recommendation'||!event)return [];
  return admissionEvidence(event).filter(r=>r.status==='final'&&r.mechanism!=='excluded'&&
    (!input.school||fold(r.school+r.unit).includes(fold(input.school)))&&(!input.year||[String(r.published).slice(0,4),String(r.cohort)].includes(input.year))&&
    (!input.award||r.awards?.some(key=>awardFold(publishedAwards[key])===awardFold(input.award))))
    .map(r=>{
      const score=r.mechanism==='points'?(r.values||/\d+(?:\.\d+)?\s*分|对应\s*\d/.test(r.effect)?90:75):r.mechanism==='priority'?75:50;
      return {title:r.school+' · '+r.unit,publisher:r.school,url:r.url,year:String(r.published).slice(0,4),status:'已匹配',score,rule:proofNames[score],
        quote:r.requirement+' '+r.effect,version:'核验档案 · '+r.cohort+' 届 · '+r.locator};
    });
}

function confidenceSource(row,kind,year){
  const u=new URL(row.url),host=u.hostname;
  const institution=host.match(/(?:^|\.)([^.]+\.(?:edu|gov|org)\.cn)$/)?.[1]||host.replace(/^www\./,'');
  const employerOriginal=row.employerDomain&&(host===row.employerDomain||host.endsWith('.'+row.employerDomain));
  const official=/\.(?:edu|gov)\.cn$|(?:^|\.)ncss\.cn$/.test(host)||employerOriginal;
  const verified=!!row.version||row.kind==='policy'||row.kind==='outcome';
  let origin=.70;
  if(kind==='community')origin=.30;
  else if(official){
    const relayedJob=row.kind==='policy'&&/\.edu\.cn$/.test(host)&&!employerOriginal;
    origin=verified && !relayedJob ? .95 : .85;
  }
  const directness={direct:1,outcome:.5,general:.4,community:.25}[kind];
  const sourceYear=Number(row.year)||0;
  const age=Math.abs(year-sourceYear);
  const freshness=sourceYear?(age<=2?1:age<=5?.85:.7):.65;
  return {url:row.url,title:row.title,issuer:row.org&&row.kind==='policy'?row.org:institution,origin,directness,freshness,
    points:Math.round(100*origin*directness*freshness),quote:fold(row.quote||'')};
}
function researchAssessment(input,checked,archived){
  const policies=archived.filter(r=>r.kind==='policy');
  const links=new Set(policies.map(r=>r.url));
  const disputed=checked.filter(r=>r.status==='文件存在不同条件，请人工复核');
  const direct=[...policies,...checked.filter(r=>r.status==='已匹配'&&(!links.has(r.url)||r.score===0)),
    ...disputed.flatMap(r=>(r.strengths||[]).map(score=>({...r,score})))];
  const values=direct.map(r=>r.score);
  const sameScope=(a,b)=>a.url===b.url||(a.org||new URL(a.url).hostname)===(b.org||new URL(b.url).hostname)&&a.year===b.year&&a.title===b.title;
  const conflict=disputed.length>0||direct.some(a=>a.score===0&&direct.some(b=>b.score>0&&sameScope(a,b)));
  const score=conflict||!values.length?null:Math.max(...values);
  const fallback=[['outcome',archived.filter(r=>r.kind==='outcome')],['general',checked.filter(r=>r.status==='通用复试材料')],['community',archived.filter(r=>r.kind==='community')]];
  const [kind,rows]=direct.length?['direct',conflict?direct:direct.filter(r=>r.score===score)]:fallback.find(([,items])=>items.length)||['none',[]];
  const year=Number(input.year)||new Date().getUTCFullYear();
  const ranked=rows.map(r=>{
    const source=confidenceSource(r,kind,year);
    if(input.track==='employment'&&kind==='direct'&&!r.org&&/\.(?:edu|gov)\.cn$|(?:^|\.)ncss\.cn$/.test(new URL(r.url).hostname)){
      source.issuer='招聘文件转发 · 发布主体待核';
    }
    return source;
  }).sort((a,b)=>b.points-a.points);
  const urls=new Set(),issuers=new Set(),quotes=new Set(),support=[];
  for(const s of ranked){
    const repeat=urls.has(s.url)||issuers.has(s.issuer)||s.quote&&quotes.has(s.quote);
    urls.add(s.url);issuers.add(s.issuer);quotes.add(s.quote);
    if(!repeat)support.push(s);
  }
  const used=support.slice(0,3);
  let index=used[0]?.points||0;
  for(const s of used.slice(1))index+=(100-index)*.25*s.points/100;
  const confidence={index:conflict?0:Math.round(index),independent:support.length,used:used.map(({quote,...s})=>s),conflict};
  const unit={direct:'分',outcome:'个签约或入职案例',general:'个通用材料来源',community:'条已收录自述',none:'条适用证据'}[kind];
  const count=kind==='general'?support.length:new Set(rows.map(r=>r.person||r.id||r.url)).size;
  return {score,confidence,measurement:{kind,value:conflict?null:kind==='direct'?score:count,unit,
    range:conflict&&values.includes(0)&&Math.max(...values)>0?[0,Math.max(...values)]:null}};
}
