(() => {
  'use strict';
  const criteria = [
    ['任务深度','专业任务',15,'超过一半的可得分来自本领域的专业操作、推理或创作。'],
    ['任务深度','综合应用',15,'主要任务需要组合至少两种专业技能，或解释方法选择并验证结果。'],
    ['能力验证','本人完成',10,'本届实际核验了身份、作者或团队成员。'],
    ['能力验证','独立复核',10,'有独立测试、双评或其他实质复核的执行记录。'],
    ['评审公正','尺度预定',15,'开赛前公开统一的评分标准、计分办法和授奖规则。'],
    ['评审公正','回避执行',15,'有利益冲突规则和本届申报、回避或外部监督记录。'],
    ['可核验性','结果可查',10,'可核对本组正式授奖结果及各奖级数量。'],
    ['可核验性','异议复核',10,'公布申诉渠道、期限和程序，并有受理或零申诉结项说明。']
  ];
  const dimensions=['任务深度','能力验证','评审公正','可核验性'];
  const emptyScope=()=>({year:2026,group:'',field:'',format:'',entry:'',roster:'',sampling:'',panel:[]});
  const ready=s=>Number.isInteger(s.year)&&s.year>=1902&&s.year<=9999&&['group','field','format','entry','roster','sampling'].every(k=>String(s[k]??'').trim());
  const names=s=>Array.from(new Set(s.panel.map(p=>p.trim()).filter(Boolean)));
  const eligible=e=>e.status==='通过'&&!!e.source?.trim();
  function evaluate(e,s){
    const eligibleEvent=eligible(e), panel=names(s), n=panel.length;
    const quality=eligibleEvent&&e.flags.length===8&&e.flags.every(x=>x===1||x===0)?e.flags.reduce((sum,x,i)=>sum+x*criteria[i][2],0):null;
    const observations=panel.map(p=>Object.hasOwn(e.observations,p)?e.observations[p]:null).filter(o=>o&&['采','查'].includes(o.value)&&o.source?.trim());
    const m=observations.length,k=observations.filter(o=>o.value==='采').length;
    const survey=eligibleEvent&&ready(s)&&e.history==='完整'&&n>0;
    const lo=survey?k/n:null, hi=survey?(k+n-m)/n:null;
    const impact=survey&&m===n&&n>=10?lo:null;
    const score=impact!==null&&quality!==null?Math.round((quality*.7+impact*30)*1e6)/1e6:null;
    let state='资料齐全';
    if(e.status!=='通过') state=e.status==='待核'?'资格待核':e.status;
    else if(!e.source?.trim()||quality===null) state='待补证据';
    else if(!ready(s)) state='待设范围';
    else if(e.history!=='完整')state=e.history==='不足'?'观察窗不足':'历史待核';
    else if(n<10)state='机构数不足';
    else if(m<n)state='机构未查完';
    return {quality,impact,score,state,n,m,k,lo,hi,zone:null,position:null};
  }
  function assess(list,scope){
    const rows=list.map(e=>({...e,metrics:evaluate(e,scope)}));
    const valid=rows.filter(e=>e.metrics.score!==null);
    if(valid.length>=20){
      const allSame=valid.every(e=>e.metrics.score===valid[0].metrics.score);
      valid.forEach(e=>{
        const value=e.metrics.score, greater=valid.filter(t=>t.metrics.score>value).length, same=valid.filter(t=>t.metrics.score===value).length;
        const p=(greater+same/2)/valid.length;e.metrics.position=p;e.metrics.zone=allSame?'全组同分':p<=.25?'一区':p<=.5?'二区':p<=.75?'三区':'四区';
      });
    }
    return rows;
  }
  function awardRate(a,e){
    if(!eligible(e)||!a.name?.trim()||!a.entry?.trim()||!a.source?.trim()||!['人','队','作品'].includes(a.unit))return null;
    return Number.isSafeInteger(a.total)&&Number.isSafeInteger(a.won)&&a.total>0&&a.won>=0&&a.won<=a.total?a.won/a.total:null;
  }
  function demo(){
    const panel=Array.from({length:10},(_,i)=>'示例评估机构 '+String(i+1).padStart(2,'0'));
    const scope={year:2026,group:'本科组',field:'工程设计',format:'作品评审',entry:'全国公开团队赛',roster:'虚构的八项同组赛事，固定于 2026 年度演示。',sampling:'十家虚构的独立专业机构，采用相同的公开文件检索范围。',panel};
    const seeds=[
      ['远川杯','远川杯工程设计竞赛','民办专业团体',[1,1,1,1,1,1,1,1],4,10,600,12],
      ['启明杯','启明杯工程创新挑战赛','行业联合主办',[1,1,1,1,1,1,1,0],7,10,420,21],
      ['知行杯','知行杯工程实践竞赛','高校联合主办',[1,1,1,1,1,0,1,1],6,10,360,18],
      ['云帆杯','云帆杯工程创新设计赛','有官方认证',[1,0,1,1,1,1,1,0],7,10,500,50],
      ['方舟杯','方舟杯工程设计挑战赛','民办专业团体',[1,1,1,0,1,0,1,1],5,10,280,14],
      ['青禾杯','青禾杯工程实践挑战赛','有官方认证',[1,0,1,0,1,0,1,1],7,10,600,180],
      ['星图杯','星图杯工程创作竞赛','高校联合主办',[1,1,1,0,1,1,1,0],4,8,240,12],
      ['栖山杯','栖山杯工程设计竞赛','民办专业团体',[1,1,null,0,1,null,1,0],0,0,180,9]
    ];
    return {scope,events:seeds.map(([short,name,host,flags,k,m,total,won],i)=>({
      id:'EX-'+String(i+1).padStart(3,'0'),short,name,host,status:i===7?'待核':'通过',history:i===7?'不足':'完整',
      source:'虚构算例材料：本届赛题与评分办法、评审执行记录、授奖名册及异议结项表。',flags,
      observations:Object.fromEntries(panel.slice(0,m).map((p,j)=>[p,{value:j<k?'采':'查',source:j<k?'示例机构 2025 年项目遴选细则，第 4 条。':'示例机构 2024—2025 年公开项目文件核查记录。'}])),
      awards:[{name:'金奖',entry:'初赛有效提交',unit:'队',total,won,source:'虚构算例，初赛提交清单和金奖名册。'},{name:'金奖',entry:'决赛入围',unit:'队',total:i===0?60:Math.max(won,Math.ceil(total*.2)),won,source:'虚构算例，决赛入围和金奖名册。'}]
    }))};
  }
  globalThis.RatingModel={criteria,dimensions,emptyScope,ready,names,eligible,evaluate,assess,awardRate,demo};
})();
