const ratingRubric = [
  {id:'task', name:'任务挑战', weight:25, levels:['有明确的任务和交付物','需要独立完成专业解题或技术实现','还要展示实物、验证结果或答辩论证']},
  {id:'review', name:'评审与复核', weight:20, levels:['公开计分依据','有明确的专家评审或系统测试','另有实质复测、复议或答辩环节']},
  {id:'selection', name:'选拔强度', weight:15, levels:['按成绩排名','通过资格赛或分阶段选拔','同届同口径全国晋级或获奖比例有不超过 10% 的明确上限或实绩']},
  {id:'disclosure', name:'结果透明', weight:10, levels:['可追溯到规则或结果','规则和对应结果或统计均可查','另有明文异议渠道和期限']},
  {id:'employment', name:'就业帮助', weight:15},
  {id:'admission', name:'保研帮助', weight:15}
];
const employmentWeight = ratingRubric.find(d=>d.id==='employment').weight;
const profileJobWeights = [employmentWeight,35,50];
const defaultJobWeight = 35;
const roundRating = n=>Math.round(n*10)/10;

function rateCompetition(employment) {
  const event = employment.event;
  const dossier = competitionEvidence.events[event];
  const platform = employmentData.platforms.includes(event);
  const admission = rateAdmission(event);
  let points = 0, intrinsicPoints = 0, coverage = 0, intrinsicCoverage = 0;
  const dimensions = ratingRubric.map(({id,weight})=>{
    const fact = dossier?.facts[id];
    const score = id==='employment' ? employment.score : id==='admission'?admission.score:fact ? fact[0]*100/3 : null;
    if (score!==null) {
      points += score*weight/100;
      coverage += weight;
      if (fact) {
        intrinsicPoints += score*weight/100;
        intrinsicCoverage += weight;
      }
    }
    return {id,score:score===null?null:roundRating(score),level:fact?.[0]??null,
      reason:fact?.[1]??(id==='employment'?employment.status:id==='admission'?admission.summary:'尚缺适用规则或结果'),
      sources:fact?fact.slice(2).map(i=>dossier.sources[i]):[]};
  });
  const intrinsicWeight = ratingRubric.filter(d=>d.levels).reduce((a,d)=>a+d.weight,0);
  const score = coverage===100?roundRating(points):null;
  return {event,name:employment.name,scope:dossier?.scope??null,platform,coverage,dimensions,employment,admission,score,
    participation:participationRules[event]??null,
    intrinsicWeight,
    intrinsicPoints:intrinsicCoverage===intrinsicWeight?intrinsicPoints:null,
    intrinsic:intrinsicCoverage===intrinsicWeight?roundRating(intrinsicPoints*100/intrinsicWeight):null,
    range:coverage && !platform?[roundRating(points),roundRating(points+100-coverage)]:null,
    status:platform?'待定位具体赛题':score!==null?'六项证据齐备':coverage?'部分维度待核':'待采集赛事证据'};
}

const generalRatings = competitionRatings(employmentData).map(rateCompetition)
  .sort((a,b)=>(b.score??-1)-(a.score??-1)||b.coverage-a.coverage||a.name.localeCompare(b.name,'zh-CN'));
const ratingByEvent = new Map(generalRatings.map(r=>[r.event,r]));
function personalRating(event,match,jobWeight) {
  const rating = ratingByEvent.get(event);
  const base = rating?.score??null, employment = rating?.employment.score??null;
  const matchedJob = match;
  const points = rating?.intrinsicPoints??null;
  const score = points!==null && matchedJob!==null
    ? roundRating(points*(100-jobWeight)/rating.intrinsicWeight+matchedJob*jobWeight/100) : null;
  return {base,employment,match,matchedJob:matchedJob===null?null:roundRating(matchedJob),
    jobWeight,score,change:score!==null&&base!==null?roundRating(score-base):null};
}

function weightAudit() {
  const scenarios=[
    {name:'默认六维',weights:ratingRubric.map(d=>d.weight)},
    {name:'侧重赛制',weights:[30,25,15,10,10,10]},
    {name:'侧重外部用途',weights:[20,15,15,10,20,20]},
    {name:'六维等权',weights:Array(6).fill(100/6)},
    ...[5,25].map(share=>({name:'保研占 '+share+'%',weights:ratingRubric.map(d=>d.id==='admission'?share:d.weight*(100-share)/85)})),
    {name:'旧版五维',weights:[30,25,15,15,15,0]}
  ];
  const complete=generalRatings.filter(r=>r.score!==null);
  for(const s of scenarios){
    const scored=complete.map(r=>({event:r.event,value:roundRating(r.dimensions.reduce((sum,d,i)=>
      sum+(d.level!==null?d.level*100/3:d.score)*s.weights[i]/100,0))}));
    s.results=scored.map(r=>({...r,rank:1+scored.filter(o=>o.value>r.value).length}));
  }
  const paired=generalRatings.filter(r=>r.dimensions[0].level!==null && r.dimensions[1].level!==null);
  return {scenarios,count:complete.length,paired:paired.length,
    sameLevels:paired.filter(r=>r.dimensions[0].level===r.dimensions[1].level).length};
}
