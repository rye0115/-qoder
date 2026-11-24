const careerDegrees = ['专科', '本科', '硕士', '博士'];
const selectedPrizes = {
  participated:'仅参赛', prize:'已获奖，奖级未指定',
  prov1:'省级一等奖', prov2:'省级二等奖', prov3:'省级三等奖',
  nat1:'全国一等奖', nat2:'全国二等奖', nat3:'全国三等奖',
  medal:'奖牌（赛区或颜色另核）'
};
const careerProfiles = {
  explore:{name:'探索就业方向',need:'希望一场比赛能用于更多公司的申请',effect:25,breadth:55,entry:20},
  practice:{name:'积累第一段项目经历',need:'优先考虑参赛经历就能用于求职的比赛',effect:15,breadth:15,entry:70},
  interview:{name:'争取校招面试',need:'优先考虑明确加分或能直通面试的竞赛',effect:75,breadth:15,entry:10}
};

function competitionRatings(data) {
  return Object.entries(data.events).map(([event,names])=>{
    const records=data.records.filter(r=>r.events.includes(event));
    const policies=records.filter(r=>r.kind==='policy' && ['直通','优先'].includes(r.effect) && r.sources?.length);
    const employers=new Set(policies.map(r=>r.org));
    const people=new Set(records.filter(r=>r.kind==='outcome' && r.person && r.sources?.length &&
      ['已签约','已入职'].includes(r.stage)).map(r=>r.person));
    const publications=new Map();
    for(const row of policies){
      const editions=row.sourceByYear || (row.years.length===1?{[row.years[0]]:row.sources[0]}:{});
      if(!publications.has(row.org))publications.set(row.org,[]);
      for(const [year,source] of Object.entries(editions)){
        if(row.sources.includes(source))publications.get(row.org).push({year,url:data.sources[source][1]});
      }
    }
    const repeat=[...publications.values()].filter(items=>items.some(a=>items.some(b=>a.year!==b.year&&a.url!==b.url))).length;
    const points={breadth:7*Math.min(employers.size,5),effect:policies.some(r=>r.effect==='直通')?40:policies.length?30:0,
      repeat:5*Math.min(repeat,3),outcome:5*Math.min(people.size,2)};
    const platform=data.platforms.includes(event);
    const score=employers.size&&!platform?Object.values(points).reduce((a,b)=>a+b,0):null;
    const status=platform?'平台级线索，待核具体赛题':!employers.size?'缺少直接招聘条款':employers.size===1?'单一招聘方暂评':'多家招聘方有据';
    return {event,name:names[0],score,status,points,employers:employers.size,repeat,people:people.size,
      records:records.map(r=>r.id)};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name,'zh-CN'));
}

function careerAwardStatus(requirement, prize) {
  if (!prize || requirement === '参赛经历即可') return 'match';
  if (prize === 'participated') return 'miss';
  if (requirement === '获奖，奖级未限定') return 'match';
  const limits = {'省级一等奖及以上':['prov',1], '全国二等奖及以上':['nat',2]};
  const limit = limits[requirement];
  const entry = /^(prov|nat)([123])$/.exec(prize);
  if (!limit || !entry) return 'unknown';
  if (entry[1] !== limit[0]) return entry[1] === 'prov' ? 'miss' : 'unknown';
  return Number(entry[2]) <= limit[1] ? 'match' : 'miss';
}

function careerMatch(params) {
  const get = key => (params.get(key) || '').trim().slice(0,100);
  const mode = get('mode') || 'role';
  const direction = get('direction'), company = fold(get('company')), role = fold(get('job'));
  const degree = get('degree'), cohort = get('cohort'), small = get('size') === 'hundreds';
  const prize = mode === 'event' ? get('prize') : '';
  const profileId=get('profile')||'explore';
  const jobWeight = get('jobWeight') ? Number(get('jobWeight')) : defaultJobWeight;
  if(!profileJobWeights.includes(jobWeight))throw Error('不支持该就业权重。');
  const profile=Object.hasOwn(careerProfiles,profileId)?careerProfiles[profileId]:null;
  if (!profile || !['role','event'].includes(mode) || degree && !careerDegrees.includes(degree) ||
      cohort && !/^(19|20)\d{2}$/.test(cohort) || prize && !Object.hasOwn(selectedPrizes,prize)) {
    throw Error('请检查查询方向、学历、毕业届别或奖级。');
  }
  const event = get('event');
  const eventId = Object.keys(employmentData.events).find(id => id === event ||
    employmentData.events[id].some(name => fold(name) === fold(event)));
  const groups = new Map();
  for (const row of employmentData.records) {
    const org = employmentData.organizations[row.org];
    if (mode === 'event' && !row.events.includes(eventId)) continue;
    if (small && !org.hundreds || direction && !row.paths?.includes(direction)) continue;
    if (company && !fold(org.name+' '+(org.sector||'')).includes(company)) continue;
    if (role && ![row.role,...(row.roleTerms || [])].some(s => fold(s).includes(role))) continue;
    const policy = row.kind === 'policy';
    const years = row.cohorts ?? (policy ? row.years : []);
    const missing = [];
    if (cohort && years.length && !years.includes(cohort)) continue;
    if (cohort && !years.length) missing.push('毕业届别待核');
    if (degree && row.minDegree && careerDegrees.indexOf(degree) < careerDegrees.indexOf(row.minDegree)) continue;
    if (degree && !row.minDegree) missing.push('岗位学历门槛待核');
    if (prize && policy) {
      const fit = careerAwardStatus(row.award, prize);
      if (fit === 'miss') continue;
      if (fit === 'unknown') missing.push('奖级对应关系待核');
    }
    const direct = policy && !missing.length;
    const rank = direct ? (row.effect === '直通' ? 4 : 3) : policy ? 2 : row.kind === 'outcome' ? 1 : 0;
    const keys = mode === 'event' ? [row.org+'/'+row.role] : row.events;
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, {key, rank, employers:new Set(), matches:[], latest:0});
      const group = groups.get(key);
      group.rank = Math.max(group.rank, rank);
      if (direct) {
        group.employers.add(row.org);
        group.latest = Math.max(group.latest,...years.map(Number));
      }
      const entry=prize?100:row.award==='参赛经历即可'?100:row.award==='获奖，奖级未限定'?75:40;
      group.matches.push({id:row.id, rank, missing, direct, entry, effect:row.effect==='直通'?100:75});
    }
  }
  const results = [...groups.values()].map(({employers,...group}) => {
    const breadth=100*Math.min(employers.size,3)/3;
    for(const m of group.matches)m.fit=m.direct?(m.effect*profile.effect+breadth*profile.breadth+m.entry*profile.entry)/100:null;
    group.matches.sort((a,b)=>(b.fit??-1)-(a.fit??-1)||b.rank-a.rank);
    const best=group.matches[0];
    const tier=best.direct?best.rank:group.rank;
    const fit=best.direct?Math.round(best.fit):null;
    return {...group,rank:tier,directEmployers:employers.size,fit,
      personal:personalRating(mode==='event'?eventId:group.key,fit,jobWeight),
      fitParts:best.direct?{effect:best.effect,breadth:Math.round(breadth),entry:best.entry,record:best.id}:null};
  });
  results.sort((a,b)=>{
    if(a.personal.score!==b.personal.score)return (b.personal.score??-1)-(a.personal.score??-1);
    if(a.fit!==b.fit)return (b.fit??-1)-(a.fit??-1);
    return b.rank-a.rank || b.directEmployers-a.directEmployers ||
      b.latest-a.latest || a.key.localeCompare(b.key,'zh-CN');
  });
  return {mode,eventId:eventId||null,profileId,jobWeight,results};
}
