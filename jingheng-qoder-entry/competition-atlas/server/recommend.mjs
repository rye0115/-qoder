const goalWeights=[35,50,70];
const publishedAwards={nat1:'全国一等奖',nat2:'全国二等奖',nat3:'全国三等奖',prov1:'省级一等奖',prov2:'省级二等奖',prov3:'省级三等奖'};
function longestMention(text,values){
  return [...new Set(values.filter(Boolean))].sort((a,b)=>b.length-a.length).find(v=>fold(text).includes(fold(v)))||'';
}
function readNeed(body){
  if(typeof body.need!=='string'||!body.need.trim()||body.need.length>500)throw Error('请用 1 至 500 个字描述你的需求。');
  const originalNeed=body.need.trim(),need=originalNeed.normalize('NFKC');
  const participation=readParticipation(body,need);
  const positive=need.replace(/(?:不考虑|不打算|不想|不准备|无意|不走|不要|不需要|不以)(?:找)?(?:保研|推免|研究生推免|求职|就业|工作|校招)/g,'');
  const hiring=/求职|就业|找[^，。！？；\s]{0,14}(?:工作|实习|岗位)|(?:想|希望|以后)(?:去|进|进入)[^，。！？；\s]{0,14}(?:公司|企业)|校招|面试|招聘|应聘|投简历|找岗|应届岗/.test(positive);
  const admission=/保研|推免|推荐免试/.test(positive);
  const explicit=k=>fixedQuery(body[k],80);
  const jobWords=employmentData.records.flatMap(r=>[r.role,...r.roleTerms||[],...r.paths||[]]);
  const shortJob=positive.match(/前端|后端|软件测试|嵌入式|硬件|软件开发|机械|算法|数据分析|产品经理|销售|售前/)?.[0];
  const freeRole=positive.match(/(?:找(?:一份|一个|份|个)?|应聘|从事)([\p{L}A-Za-z]{2,15}?)(?:的)?(?:岗位|岗|实习|工作)/u)?.[1];
  const job=explicit('job')||longestMention(positive,jobWords)||shortJob||(freeRole&&!/^(?:一份|一个|一段|相关|合适|适合|暑期|暑假|寒假|长期|短期)$/.test(freeRole)?freeRole:'');
  const year=need.match(/(20\d{2})\s*(?:年\s*)?(?:届|毕业)/)?.[1]||need.match(/(?:毕业(?:届别|年份)?|届别)[为是：:\s]*(20\d{2})/)?.[1]||need.match(/(?:^|\D)(2\d)届/)?.[1]?.replace(/^/,'20');
  const school=explicit('school')||longestMention(need,admissionDocuments.map(d=>d.school))||
    need.match(/(?:就读于?|来自|本科在|目前在|我是|^)([\u4e00-\u9fff]{2,12}?大学)/)?.[1]||'';
  const unit=explicit('unit')||longestMention(need,admissionDocuments.filter(d=>!school||d.school===school).map(d=>d.unit))||
    (school&&need.split(school)[1]?.match(/^[\s，,的]*([\u4e00-\u9fff]{2,14}?学院)/)?.[1])||'';
  const awardMatch=positive.match(/(国(?:家级|赛|级)?|全国(?:赛)?|省(?:级|赛)?)([一二三])(?:等奖)?/);
  const company=explicit('company')||longestMention(positive,Object.values(employmentData.organizations).flatMap(o=>[o.name,...o.name.split(/\s+/)]))||
    positive.match(/正浩创新|拼多多|思谋|黑格智造|默贝克|十八刻|石犀科技|众云网|腾讯|字节跳动|华为|大疆/)?.[0]||'';
  const seekingJob=hiring||explicit('job')||explicit('company')||company&&/去|进|投/.test(positive)||job&&/岗|工程师/.test(positive);
  const wantsAdmission=!!(admission||explicit('goal')==='admission'||explicit('unit'));
  const wantsJob=!!(seekingJob||explicit('goal')==='employment');
  const covered=[];
  if(wantsAdmission)covered.push(/保研|推免/);
  if(wantsJob)covered.push(/求职|就业|找.{0,12}(?:工作|岗位|实习)|招聘|应聘|校招|面试/);
  if(participation)covered.push(/没空|有空|周末|工作日|小时|暑假|寒假|\d月|专业[的，,。]?$|参赛年份/);
  const extra=openTextParts(positive,covered).filter(s=>s!==school&&s!==unit&&!(school&&s.includes(school)));
  const otherWishes=extra.filter(s=>needPatterns.some(([re])=>re.test(s))||/想|希望|至少|需要|预算|喜欢|想要|感兴趣|必须/.test(s));
  const broadMixed=wantsAdmission&&wantsJob||wantsAdmission&&(!school||!unit)||
    (wantsAdmission||wantsJob)&&otherWishes.length>0;
  const order=need.match(/(?:署名|排位|排序|顺位|排名|队内|团队|队伍中)\s*(?:第)?\s*([1-9]\d?|[一二三四五六七八九])(?:位|名)?/)?.[1];
  const place=order&&/[一二三四五六七八九]/.test(order)?String('一二三四五六七八九'.indexOf(order)+1):order;
  const fields={school,unit,cohort:explicit('cohort')||year||String(policyCohort),job:job||'全部岗位',company,
    degree:explicit('degree')||longestMention(need,careerDegrees),award:explicit('award')||(awardMatch?(awardMatch[1].startsWith('省')?'prov':'nat')+('一二三'.indexOf(awardMatch[2])+1):''),
    place:explicit('place')||place,profile:explicit('profile')||(/项目经历|实战|练手/.test(need)?'practice':/面试/.test(need)?'interview':'explore'),weight:body.weight||50};
  function openProfile(parts){
    const wishes=[...(wantsAdmission?[{kind:'admission',label:[school,unit,'推免条款'].filter(Boolean).join(' · ')}]:[]),
      ...(wantsJob?[{kind:'employment',label:[company,job,'招聘条款'].filter(Boolean).join(' · ')}]:[]),
      ...[...new Set(parts)].flatMap(textWish)];
    if(wantsJob&&!Object.hasOwn(careerProfiles,fields.profile))throw Error('请选择有效的求职偏好。');
    return {...fields,goal:'open',wishes,need:originalNeed,participation};
  }
  if(broadMixed)return openProfile(otherWishes);
  let goal=explicit('goal');
  if(!goal && (admission||explicit('unit')))goal='admission';
  if(!goal && seekingJob)goal='employment';
  if(!goal){
    if(otherWishes.some(s=>needPatterns.some(([re])=>re.test(s)))||extra.length>1&&!participation)return openProfile(extra);
    const excludedParts=positive.match(/(?:不想|不做|不考虑|排除|不要)[^，。！？；、\s]*/g)||[];
    const excluded=[...new Set(excludedParts.flatMap(interestTerms))];
    const subject=excludedParts.reduce((s,part)=>s.replace(part,' '),positive);
    const topics=interestTerms(participation?subject.split(/[，,。；;]/).filter(s=>!/专业|周末|工作日|有空|没空|\d月|小时/.test(s)).join(' '):subject);
    if(participation){
      const interest=subject.match(/(?:想|喜欢|感兴趣|希望)(?:在|用|趁)?(?:周末|工作日|暑假|寒假)?(?:亲手)?(?:做|学|参加|练习|尝试|研究)([^，。；,\s]{2,18})/);
      if(interest)for(const term of interestTerms(interest[1]))if(!topics.includes(term))topics.push(term);
    }
    const named=participation&&longestMention(positive,catalogueCandidates().flatMap(c=>c.aliases));
    if(named&&!topics.includes(named))topics.unshift(named);
    if(participation&&!topics.length&&!extra.length)return {goal:'participation',need:originalNeed,participation};
    if(!topics.length)return openProfile(extra.length?extra:[need]);
    return {goal:'interest',topics,excluded,need:originalNeed,participation};
  }
  const parsed=readProfile({...fields,goal});
  return {...parsed,need:originalNeed,participation,referenceCohort:!explicit('cohort')&&!year};
}
function interestTerms(text){
  const stop=new Set(['大学','大学生','学生','自己','比赛','大赛','竞赛','全国','希望','参加','适合','可以','时间','想要','有没有','一个','帮我','方面','需要','相关','专业','能力','推荐','最好','个人','团队','取得','完成','进行']);
  const known=Object.entries(employmentData.events).flatMap(([,names])=>names).concat(catalog.map(r=>r[2]));
  const title=longestMention(text,known);
  const vocabulary=known.join(' ')+Object.values(competitionEvidence.events).map(d=>d.facts.task?.[1]||'').join(' ');
  const words=[...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)].map(w=>w.segment);
  const phrases=['数学建模','机器人','电子设计','软件设计','软件开发','算法','程序设计','创业','工程实践','数据分析','机器学习','编程','硬件','机械设计','电子商务'].filter(s=>text.includes(s));
  const found=[...new Set([title,...phrases,...words.filter(s=>s.length>=2&&!stop.has(s)&&fold(vocabulary).includes(fold(s)))].filter(Boolean))];
  return found.filter(s=>!found.some(other=>other!==s&&fold(other).includes(fold(s)))).slice(0,6);
}
function readProfile(body){
  if(body&&Object.hasOwn(body,'need'))return readNeed(body);
  if(!body||typeof body!=='object')throw Error('请填写参赛需求。');
  const participation=readParticipation(body);
  if(body.goal==='admission'&&(!body.school||!body.unit))return readNeed({...body,need:'我想了解保研'});
  if(!body.goal&&participation)return {goal:'participation',participation};
  const p={};
  for(const key of ['goal','school','unit','cohort','job','company','degree','award','place','profile']){
    p[key]=fixedQuery(body?.[key],80);
  }
  p.weight=Number(body?.weight??50);
  if(!goalWeights.includes(p.weight)||!['admission','employment'].includes(p.goal)||!/^20\d{2}$/.test(p.cohort)||
    p.award && !Object.hasOwn(publishedAwards,p.award))throw Error('请选择目标、四位毕业届别、奖级和目标权重。');
  if(p.goal==='admission' && (!p.school||!p.unit||p.place&&!/^[1-9]\d?$/.test(p.place)))throw Error('保研需填写本科所在学校、院系和有效的团队顺位。');
  if(p.goal==='employment' && (!p.job || p.degree&&!careerDegrees.includes(p.degree)||!Object.hasOwn(careerProfiles,p.profile)))throw Error('请填写岗位方向，并选择有效的求职偏好。');
  return {...p,participation};
}
function fitsDepartment(doc,p){
  return fold(doc.school)===fold(p.school)&&(fold(doc.unit)===fold(p.unit)||doc.unit==='校级推免推荐')&&String(doc.cohort)===p.cohort;
}
function admissionClaim(row,p){
  const claim={url:row.url,title:row.school+' · '+row.unit,detail:row.requirement+' '+row.effect,locator:row.locator,
    corroboration:row.corroboration,attachment:row.attachment,source:'核验档案',issuer:row.school,confidence:row.confidence,score:null,status:'适用条款',
    ceiling:!p.award,mechanism:row.mechanism,origin:'admission',notes:row.notes,unit:row.unit};
  if(row.status!=='final')return {...claim,status:'公示稿待核正式版本'};
  if(p.award && !row.awards?.includes(p.award))return {...claim,status:row.awards?'奖级不在已核范围':'奖级对应关系待核'};
  if(p.place && row.places && !row.places.includes(Number(p.place)))return {...claim,status:'顺位不在条款范围'};
  if(p.place && !row.places && /主力|第一作者|负责人|排序|排名前|第一完成人/.test(row.requirement))return {...claim,status:'顺位与贡献身份需院系认定'};
  if(row.mechanism==='excluded' && !p.award)return {...claim,status:'排除条款须核对具体条件'};
  let score=row.strength;
  const value=row.values?.[p.award],factor=row.factors?.[p.place]??1;
  if(value!=null && row.scaleMax>0 && row.mechanism==='points'){
    const fraction=Math.min(1,value*factor/row.scaleMax);
    score=roundRating(60+40*fraction);
    claim.calculation='本档 '+value+' × 顺位系数 '+factor+' ÷ 同表上限 '+row.scaleMax+'；映射为 60 ＋ 40 × 比例。';
  }
  if(!p.place && row.places)claim.detail+=' 顺位按条款允许的最优情况估计。';
  return {...claim,score};
}
function profileJobs(p) {
  return employmentData.records.filter(r=>{
    if(r.kind!=='policy'||!(r.cohorts??r.years).includes(p.cohort))return false;
    const org=employmentData.organizations[r.org];
    return (!p.company||fold(org.name).includes(fold(p.company)))&&
      (p.job==='全部岗位'||[r.role,...(r.roleTerms||[]),...(r.paths||[])].some(s=>fold(s).includes(fold(p.job))));
  });
}
function jobClaim(row,p){
  const org=employmentData.organizations[row.org],src=employmentData.sources[row.sourceByYear?.[p.cohort]??row.sources[0]];
  const officialHost=Boolean(publicSource(src[1]));
  const claim={url:src[1],title:org.name+' · '+row.role,issuer:org.name,source:'核验档案',detail:row.award+'。'+row.note,
    locator:row.period,confidence:officialHost?'高 · 可追溯岗位条款':'中 · 招聘平台岗位材料',status:'适用条款',score:null,origin:'employment'};
  if(p.degree && (!row.minDegree||careerDegrees.indexOf(p.degree)<careerDegrees.indexOf(row.minDegree)))return {...claim,status:row.minDegree?'学历不满足':'学历要求待核'};
  if(p.award && careerAwardStatus(row.award,p.award)!=='match')return {...claim,status:'奖级未证实满足门槛'};
  return {...claim,score:row.effect==='直通'?100:75,entry:p.award||row.award==='参赛经历即可'?100:row.award==='获奖，奖级未限定'?75:40};
}
function profileQueries(p){
  if(p.goal==='open')return [p.need,'大学生竞赛 规则 参赛作品'].join(' ');
  if(p.goal==='participation')return participationQuery(p);
  if(p.goal==='interest')return [p.need,...p.topics,'大学生竞赛','赛题 章程'].join(' ');
  const target=p.goal==='admission'?[p.school,p.unit,p.cohort+'届','推免','竞赛','细则 site:edu.cn']:
    [p.company,p.job==='全部岗位'?'':p.job,p.cohort+'届','校园招聘','竞赛','优先'];
  return target.filter(Boolean).join(' ');
}
function participationQuery(p){
  const a=p.participation;
  const event=longestMention(p.need||'',catalogueCandidates().flatMap(c=>c.aliases));
  return [event||'全国大学生竞赛',a.year||a.time?.start?.slice(0,4),a.major?'参赛专业 报名资格':'',a.time?'比赛时间 赛程':'','组委会 通知'].filter(Boolean).join(' ');
}
function catalogueCandidates(){
  const known=Object.entries(employmentData.events).map(([event,names])=>({event,name:names[0],aliases:names}));
  const extra=catalog.filter(([, ,name])=>!known.some(r=>r.aliases.some(alias=>fold(name).includes(fold(alias))||fold(alias).includes(fold(name)))));
  return [...known,...extra.map(([page,n,name])=>({event:'catalog-'+page+'-'+n,name,aliases:[name]}))];
}
async function retrieveProfile(p,docs,jobs){
  const query=profileQueries(p);
  const queries=[['360 搜索',query],['DuckDuckGo',query]];
  if(p.participation&&p.goal!=='participation')queries.push(['DuckDuckGo',participationQuery(p)]);
  const searches=await Promise.all(queries.map(async ([provider,phrase])=>{
    try{return {...await discover(phrase,provider),phrase};}catch{return {provider,phrase,status:'检索服务暂不可用',found:[]};}
  }));
  const seeds=docs.map(d=>({url:d.url,title:d.title})).concat(jobs.map(r=>{
    const [title,url]=employmentData.sources[r.sourceByYear?.[p.cohort]??r.sources[0]];return {url,title};
  }));
  const channels=searches.map(s=>s.found);
  const selected=new Map();
  function add(item){if(item&&publicSource(item.url)&&!selected.has(item.url)&&selected.size<8)selected.set(item.url,item);}
  // Reserve space for discovered sources even when the archive already contains many eligible jobs.
  seeds.slice(0,2).forEach(add);
  for(let i=0;i<5;i++)for(const found of channels)add(found[i]);
  seeds.forEach(add);
  const pages=[];
  for(const item of selected.values()){
    pages.push((async()=>{
      try{
        const raw=await readRemote(item.url);
        if(raw.pdf)return {...item,status:'取得 PDF，自动解析待核'};
        const doc=documentText(raw.html);
        if(!doc.lines.length||/验证码|访问验证|安全验证|Access Denied|Just a moment/i.test(doc.title))return {...item,status:'原文受限'};
        return {...item,url:raw.url,requested:item.url,title:doc.title||item.title,status:'已读取网页',doc};
      }catch(e){return {...item,status:e.message.includes('HTTP')?e.message:'原文受限或超时'};}
    })());
  }
  return {query:[...new Set(queries.map(q=>q[1]))].join(' / '),lookup:searches.map(s=>({provider:s.provider,status:s.status,count:s.found.length})),pages:await Promise.all(pages)};
}
function textAward(line,award){
  if(!award)return true;
  const prefix=award.startsWith('nat')?'(?:国家级|全国(?:级|赛)?)':'(?:省级|省赛|省部级)';
  const rank=['','一','二','三'][Number(award.slice(-1))];
  return new RegExp(prefix+'(?:的)?'+rank+'等奖').test(line);
}
function liveClaims(page,p,candidates,docs){
  const doc=page.doc;
  if(!doc)return [];
  const head=doc.title+' '+doc.lines.filter(l=>l.length<150).slice(0,15).join(' ');
  const isAdmission=p.goal==='admission';
  if(isAdmission){
    const scoped=docs.some(d=>d.url===page.url||d.url===page.requested);
    const text=doc.lines.join(' ');
    if(!/\.edu\.cn$/.test(new URL(page.url).hostname)||!/推免|推荐.{0,12}免试/.test(doc.title)||
      /接收|招生简章|冬令营|夏令营|征求意见|草案|公示/.test(doc.title)||
      !new RegExp(p.cohort+'\\s*届').test(head)||!scoped&&!(text.includes(p.school)&&head.includes(p.unit)))return [];
  }else{
    if(!new RegExp(p.cohort+'\\s*届').test(doc.lines.join(' ')) || p.job!=='全部岗位'&&!fold(head).includes(fold(p.job)) ||
      p.company&&!fold(head).includes(fold(p.company)) || !/岗位要求|任职要求|职位要求|岗位职责/.test(doc.lines.join(' ')))return [];
    if(p.degree&&!doc.lines.some(l=>l.length<150&&new RegExp('(?:学历|要求).{0,10}'+p.degree+'|'+p.degree+'(?:及以上|以上)学历').test(l)))return [];
  }
  const host=new URL(page.url).hostname;
  const employer=p.company||doc.lines.join(' ').match(/(?:招聘单位|用人单位|公司名称)\s*[:：]\s*([^\s｜]{2,35}?(?:公司|研究院|研究所))/)?.[1]||
    (/^(?:jobs|careers?|campus|recruit|hr)\./.test(host)&&!host.endsWith('.edu.cn')?host:null);
  if(!isAdmission&&!employer)return [];
  const hits=[];
  for(const c of candidates){
    const aliases=c.aliases.filter(a=>a.length>=3);
    const lines=candidateLines(doc,aliases);
    for(const line of lines){
      if(!textAward(line,p.award)||/新闻|传言|有望|是否|可咨询/.test(line))continue;
      // Cross-row tables, team eligibility and award ladders need the full reviewed policy.
      if(isAdmission && (p.place||/另见|详见|分别|排名|排序|主力|负责人|另行|｜/.test(line)))continue;
      const strength=effect(line);
      if(strength===null || strength>0 && (isAdmission?!/加分|加\s*\d|计\s*\d|优先推荐|纳入.{0,6}评议/.test(line):!/优先|直通|免笔试/.test(line)))continue;
      if(candidates.some(other=>other.event!==c.event&&other.aliases.some(a=>a.length>=3&&fold(line).includes(fold(a))))&&/分别|其中|除外|仅限/.test(line))continue;
      const score=strength===0?0:isAdmission?(/加分|加\s*\d|计\s*\d/.test(line)?80:/优先/.test(line)?60:40):/直通|免笔试/.test(line)?100:75;
      hits.push({event:c.event,url:page.url,title:page.title,issuer:isAdmission?p.school:employer,
        detail:line.slice(0,350),source:'本次联网原文',confidence:'中 · 原文自动匹配，待人工复核',status:'适用条款',
        score,entry:p.award?100:/参赛经历|参赛经验/.test(line)?100:40});
    }
  }
  return hits;
}
function personalList(p,claims,candidates){
  const rows=[];
  for(const candidate of candidates){
    const evidence=claims.filter(c=>c.event===candidate.event);
    if(!evidence.length)continue;
    const hasUnitPolicy=evidence.some(c=>c.unit&&c.unit!=='校级推免推荐'&&c.source==='核验档案');
    const valid=evidence.filter(c=>c.score!==null && !(hasUnitPolicy&&c.unit==='校级推免推荐'));
    const conflict=valid.some(c=>c.score===0)&&valid.some(c=>c.score>0);
    const eligible=valid.filter(c=>c.score>0);
    let target=eligible.length?Math.max(...eligible.map(c=>c.score)):null;
    if(p.goal==='employment' && eligible.length){
      const profile=careerProfiles[p.profile],employers=new Set(eligible.map(c=>c.issuer));
      const breadth=p.company?100:100*Math.min(employers.size,3)/3;
      target=Math.round(Math.max(...eligible.map(c=>(c.score*profile.effect+breadth*profile.breadth+c.entry*profile.entry)/100)));
    }
    if(conflict)target=null;
    const r=ratingByEvent.get(candidate.event);
    const quality=r?.intrinsicPoints!=null?100*r.intrinsicPoints/r.intrinsicWeight:null;
    const platform=r?.platform??false;
    const score=target!==null&&quality!==null&&!platform?roundRating(quality*(100-p.weight)/100+target*p.weight/100):null;
    const confidence=conflict?'条款冲突，需复核':target===null?'条件待核':eligible.some(c=>c.confidence.startsWith('中'))?'中 · 含自动匹配或平台来源':eligible.some(c=>c.corroboration)?'高 · 该赛另有实施公示':'高 · 适用条款已核';
    rows.push({event:candidate.event,name:candidate.name,base:r?.score??null,quality:quality===null?null:roundRating(quality),target,score,confidence,
      byWeight:score===null?null:goalWeights.map(w=>roundRating(quality*(100-w)/100+target*w/100)),
      state:conflict?'正负条款冲突':platform?'待定位具体赛题':score!==null?'可比较':target!==null?'赛制维度待补':valid.some(c=>c.score===0)?'已见明文限制':'适用条件待核',
      evidence});
  }
  rows.sort((a,b)=>(b.score??-1)-(a.score??-1)||(b.target??-1)-(a.target??-1)||a.name.localeCompare(b.name,'zh-CN'));
  for(const row of rows){
    row.rank=row.score===null?null:1+rows.filter(other=>other.score!==null&&other.score>row.score).length;
    if(row.byWeight){
      const ranks=row.byWeight.map((score,i)=>1+rows.filter(other=>other.byWeight&&other.byWeight[i]>score).length);
      row.rankRange=[Math.min(...ranks),Math.max(...ranks)];
    }
  }
  return rows;
}
function relatedCompetitions(p,candidates,pages){
  const result=[];
  for(const c of candidates){
    const evidence=new Map(),terms=new Set();
    function consider(text,url,title,source){
      const normalized=fold(text);
      const hits=p.topics.filter(s=>{
        const term=fold(s);
        return term&&normalized.includes(term)&&!['不','禁止','不得','不含','并非','不接受','没有','未提供'].some(prefix=>normalized.includes(prefix+term));
      });
      if(!hits.length)return;
      hits.forEach(s=>terms.add(s));
      if(!evidence.has(url))evidence.set(url,{title,url,detail:text,source});
    }
    const dossier=competitionEvidence.events[c.event],task=dossier?.facts.task;
    if(task)for(const i of task.slice(2)){
      const [title,url]=dossier.sources[i];
      consider(c.name+' · '+dossier.scope+'。'+task[1],url,title,'已核赛制原文');
    }
    if(p.participation||p.goal==='open'){
      const rules=participationRules[c.event];
      for(const doc of [rules?.major,...rules?.calendars||[]].filter(Boolean))consider(c.name+' · '+doc.scope+'。'+doc.note,doc.url,doc.scope,'已核参赛规则');
    }
    for(const page of pages){
      if(!page.doc)continue;
      for(const line of candidateLines(page.doc,c.aliases).filter(l=>l.length<350))consider(line,page.url,page.title,'本次联网匹配');
      if(p.goal==='open'&&c.aliases.some(s=>s.length>=3&&fold(page.title).includes(fold(s)))&&
        !candidates.some(other=>other.event!==c.event&&other.aliases.some(s=>s.length>=3&&fold(page.title).includes(fold(s))))){
        for(const line of page.doc.lines.filter(s=>s.length>=6&&s.length<300))consider(line,page.url,page.title,'本次联网匹配');
      }
    }
    const relevant=[...evidence.values()];
    const descriptions=[c.name,dossier?.facts.task?.[1]||'',...relevant.map(e=>e.detail)].join(' ');
    if(terms.size&&!p.excluded.some(s=>fold(descriptions).includes(fold(s))))result.push({event:c.event,name:c.name,topics:[...terms],base:ratingByEvent.get(c.event)?.score??null,evidence:relevant});
  }
  result.sort((a,b)=>b.topics.length-a.topics.length||(b.base??-1)-(a.base??-1)||a.name.localeCompare(b.name,'zh-CN'));
  let rank=0;
  result.forEach((row,i)=>{const prev=result[i-1];if(!prev||prev.topics.length!==row.topics.length||prev.base!==row.base)rank=i+1;row.rank=rank;});
  return result;
}
async function recommend(p){
  const candidates=catalogueCandidates();
  const docs=p.goal==='admission'?admissionDocuments.filter(d=>fitsDepartment(d,p)):[];
  const jobs=p.goal==='employment'?profileJobs(p):[];
  const network=await retrieveProfile(p,docs,jobs);
  const report={asOf:new Date().toISOString(),profile:p,query:network.query,lookup:network.lookup,
    pages:network.pages.map(({url,title,status})=>({url,title,status})),pool:candidates.length};
  if(p.goal==='open')return {...report,rows:applyParticipation(openNeedList(p,candidates,network.pages),p,network.pages)};
  if(p.goal==='interest')return {...report,rows:applyParticipation(relatedCompetitions(p,candidates,network.pages),p,network.pages)};
  if(p.goal==='participation'){
    const pool=candidates.filter(c=>ratingByEvent.has(c.event)||Object.hasOwn(participationRules,c.event));
    const rows=pool.map(c=>({event:c.event,name:c.name,base:ratingByEvent.get(c.event)?.score??null}));
    for(const r of rows)r.rank=1+rows.filter(o=>(o.base??-1)>(r.base??-1)).length;
    return {...report,rows:applyParticipation(rows,p,network.pages)};
  }
  const claims=[];
  for(const c of candidates)for(const r of admissionEvidence(c.event,docs))claims.push({...admissionClaim(r,p),event:c.event});
  for(const row of jobs)for(const event of row.events)claims.push({...jobClaim(row,p),event});
  for(const page of network.pages){
    const live=liveClaims(page,p,candidates,docs);
    for(const c of live){
      const known=claims.some(r=>r.event===c.event&&(r.url===page.requested||r.url===c.url));
      if(!known || c.score===0)claims.push(c);
    }
  }
  return {...report,rows:applyParticipation(personalList(p,claims,candidates),p,network.pages)};
}
