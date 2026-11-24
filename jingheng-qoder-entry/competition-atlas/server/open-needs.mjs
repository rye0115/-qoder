// These synonyms expand searches for evidence. The user's original wording is kept for every wish.
const needPatterns=[
  [/作品集|做出.{0,5}作品|做.{0,3}项目|积累项目/,['提交作品','完成软件方案','实际制作','自行制作','项目报告书','作品展示'],'有作品可展示'],
  [/组队|团队协作|团队合作|和同学一起/,['组队','参赛团队','参赛队','队员','队伍完成'],'组队参赛'],
  [/演讲|口头表达|答辩|练.{0,4}表达/,['演讲','现场阐释','现场答辩','向评委演示'],'演讲或答辩'],
  [/个人赛|独立参赛|一个人参赛|不想组队|不组队/,['个人赛','个人参赛','独立参赛'],'个人参赛']
];
function textWish(label){
  const solitary=/不想组队|不组队/.test(label);
  const recipe=needPatterns.filter(([re,,name])=>re.test(label)&&!(solitary&&name==='组队参赛'));
  const requirements=solitary?['个人赛','个人参赛','独立参赛']:recipe.flatMap(([,terms])=>terms);
  const words=label.replace(/我希望|我想要|我想|我只想|最好|希望|想要|推荐|适合|参加|竞赛|比赛|有没有|我可以|我喜欢|我对|感兴趣|我需要|有没有|寻找|了解|想/g,' ').trim();
  const terms=requirements.length?requirements:[...new Set([words,...[...new Intl.Segmenter('zh',{granularity:'word'}).segment(words)].map(x=>x.segment)]
    .filter(w=>w.length>=2&&!/^(大学生|同学|一个|学生|那些|哪些|可以|自己的|自己|相关|我能|东西|一些|一点|这种|方向|条件|需求|能够)$/.test(w)))];
  // Negations and quantitative limits need an explicit clause. Loose keyword hits cannot prove them.
  const exact=!solitary&&/不超过|必须|不要|不能|不想|不需要|至少|预算|少于|低于|以内|最多|免费|免收费/.test(label);
  if(recipe.length>1&&!exact)return recipe.map(([,matches,name])=>({kind:'text',label:name,terms:matches}));
  return [{kind:'text',label,terms:exact?[words].filter(Boolean):terms,hard:exact}];
}
function openTextParts(text,covered){
  const pieces=text.split(/[，,。；;！？\n]|(?:而且|并且|同时|也希望|还想|也想|又想|又要)/).map(x=>x.trim()).filter(Boolean);
  return pieces.filter(s=>!covered.some(re=>re.test(s))&&!/^(?:我是|就读于|来自|本科在).*(?:专业|大学|学院|学生)$|^(?:20\d{2}届|目标国[一二三]|团队第[一二三])$/.test(s));
}
function openNeedList(p,candidates,pages){
  const matches=new Map();
  const docs=admissionDocuments.filter(d=>String(d.cohort)===p.cohort&&(!p.school||fold(d.school)===fold(p.school))&&(!p.unit||fitsDepartment(d,p)));
  const jobs=profileJobs(p);
  for(const [index,wish] of p.wishes.entries()){
    let hits=[];
    if(wish.kind==='text'){
      hits=relatedCompetitions({...p,topics:wish.terms,excluded:[]},candidates,pages);
    }else{
      const target={...p,goal:wish.kind};
      const claims=[];
      if(wish.kind==='admission'){
        for(const c of candidates)for(const r of admissionEvidence(c.event,docs))claims.push({...admissionClaim(r,target),event:c.event});
      }else{
        for(const job of jobs)for(const event of job.events)claims.push({...jobClaim(job,target),event});
      }
      if(wish.kind==='employment'||p.school&&p.unit)for(const page of pages)claims.push(...liveClaims(page,target,candidates,docs));
      const groups=personalList(target,claims,candidates);
      hits=groups.filter(r=>r.target!==null).map(r=>({...r,evidence:r.evidence.filter(e=>e.score>0)}));
    }
    for(const hit of hits){
      if(!matches.has(hit.event))matches.set(hit.event,{event:hit.event,name:hit.name,base:hit.base,found:[],evidence:[]});
      const row=matches.get(hit.event);
      row.found.push(index);
      for(const proof of hit.evidence){
        if(!row.evidence.some(e=>e.url===proof.url&&e.wish===wish.label))
          row.evidence.push({wish:wish.label,title:proof.title,url:proof.url,detail:proof.detail,source:proof.source});
      }
    }
  }
  const rows=[...matches.values()];
  for(const r of rows){
    r.covered=r.found.map(i=>p.wishes[i].label);
    r.missing=p.wishes.filter((_,i)=>!r.found.includes(i)).map(w=>w.label);
    r.rank=p.wishes.some((w,i)=>w.hard&&!r.found.includes(i))?null:0;
  }
  rows.sort((a,b)=>b.covered.length-a.covered.length||(b.base??-1)-(a.base??-1));
  const ranked=rows.filter(r=>r.rank!==null);
  for(const r of ranked)r.rank=1+ranked.filter(o=>o.covered.length>r.covered.length||o.covered.length===r.covered.length&&(o.base??-1)>(r.base??-1)).length;
  return rows;
}
