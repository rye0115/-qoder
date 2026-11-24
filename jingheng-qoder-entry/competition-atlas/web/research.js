(() => {
  'use strict';
  const dimensions=[
    {id:'exam',name:'考研复试与调剂',icon:'cap',color:'lav',desc:'院校复试或调剂文件是否接收获奖材料，或明确给予优先待遇。'},
    {id:'recommendation',name:'推荐免试',icon:'book',color:'blue',desc:'具体院校、学院和奖级对应的推免认定、加分或优先条款。'},
    {id:'employment',name:'岗位条款力度',icon:'case',color:'mint',desc:'核对企业岗位条款、获奖者签约去向和社区线索，支持按岗位查证。'},
    {id:'catalog',name:'榜单与目录',icon:'list',color:'peach',desc:'国内大学生竞赛分析报告及高校分级目录是否收录该赛事。'}
  ];
  const paths={cap:'<path d="m2 9 10-5 10 5-10 5zM6 11v5c4 3 8 3 12 0v-5m4-2v6"/>',book:'<path d="M3 5c4-1 7 0 9 2 2-2 5-3 9-2v13c-3.5-1-6.5 0-9 2-2.5-2-5.5-3-9-2zM12 7v13"/>',case:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5c0-1 1-2 2-2h4c1 0 2 1 2 2v2M3 12c4 3 14 3 18 0m-9 1v3"/>',list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1m-1 7h1m-1 7h1"/>',search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',web:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M4 9h16M4 15h16"/>',doc:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>',fine:'<path d="M3 6h7m5 0h6M3 17h3m5 0h10"/><circle cx="12.5" cy="6" r="2.5"/><circle cx="8.5" cy="17" r="2.5"/>'};
  const icon=k=>'<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">'+paths[k]+'</svg>';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const examples=['全国大学生数学建模竞赛','全国大学生电子设计竞赛','蓝桥杯'];
  let current=null,active='recommendation',run=0,controller=null;
  let inputs={event:'',school:'',job:'',employer:'',award:'',year:''};
  const field=(key,label,placeholder)=>'<label class="rs-field">'+label+'<input name="'+key+'" maxlength="'+(key==='year'?4:70)+'" placeholder="'+placeholder+'" value="'+esc(inputs[key])+'" '+(key==='year'?'inputmode="numeric" pattern="[0-9]{4}"':'')+'></label>';
  function form(){return '<section class="rs-search"><div class="rs-search-title"><span class="rs-symbol">'+icon('web')+'</span><div><h2>查询赛事</h2><p>输入赛事名称或简称，可限定院校、岗位或奖级。</p></div></div><form id="research-form"><div class="query-line"><label class="main-query">'+icon('search')+'<input aria-label="赛事名称" name="event" required minlength="2" maxlength="80" autocomplete="off" placeholder="例如：全国大学生数学建模竞赛" value="'+esc(inputs.event)+'"></label><button class="btn primary" type="submit">联网评估</button></div><div class="try-line"><span>试查</span>'+examples.map(x=>'<button type="button" data-rs-example="'+x+'">'+x+'</button>').join('')+'</div><details class="bounds" '+(Object.keys(inputs).some(k=>k!=='event'&&inputs[k])?'open':'')+'><summary>'+icon('fine')+'限定评价条件<span class="bounds-hint">院校、企业、岗位、奖级、年份</span></summary><div class="rs-filters">'+field('school','目标院校或学院','仅约束升学维度')+field('employer','招聘单位','仅约束就业维度')+field('job','目标岗位','如：硬件工程师')+field('award','获奖等级','如：省赛一等奖')+field('year','资料标注年份','如：2026')+'</div><p class="field-note">年份匹配文件标题、发布日期或招录届别。目录按版年核查，收录只针对赛事。</p></details></form></section>';}
  const ruleText='<details class="rs-rules"><summary>条款力度和证据置信度怎样计算？</summary><p>取符合查询范围的最强条款。可提交材料 30 分，纳入评议 50 分，明确优先或加分 75 分，给出具体分值或直通环节 90 分。明文排除记 0 分。目录维度按校级收录 60 分、全国统计目录收录 80 分计量。只有间接材料时显示可核查的数量。</p><p>置信度衡量现有材料对本维度结论的支持程度。单条证据分为 100 × 来源系数 × 直接性 × 年份系数。已核验的官方原文取 0.95，高校转发的招聘原文及自动匹配的公共机构原文取 0.85，其他岗位来源取 0.70，个人自述取 0.30。直接条款取 1，签约案例取 0.50，通用材料取 0.40，个人自述取 0.25。资料与查询年份相差不超过两年取 1，三至五年取 0.85，更早取 0.70，年份不明取 0.65。未限定年份时以当前年为参照。</p><p>同一机构、同一链接或相同引文只加权一次。按单条分从高到低取最多三个来源，以最强来源为起点，其余每个增加（100 − 当前指数）× 0.25 × 单条分 ÷ 100。同一规则正反冲突时暂缓结论，单一结论置信度为 0。未核实的帖子只列为线索。系数为试行设定，录取率和 offer 概率需要另外的结果样本估计。</p></details>';
  function measure(r){
    if(!r)return '<strong class="rs-pending">检索中</strong>';
    const m=r.measurement,c=r.confidence;
    if(!m||!c)return '<strong class="rs-pending">未计算</strong>';
    const number=c.conflict?(m.range?m.range.join('–'):'待复核'):String(m.value);
    const unit=c.conflict&&!m.range?'':m.kind==='direct'?' / 100':m.unit;
    const scope=m.kind==='direct'&&!c.conflict?'<span class="rs-scope">最强已见条款</span>':'';
    return scope+'<strong>'+esc(number)+'<small> '+esc(unit)+'</small></strong><span class="rs-confidence">证据置信度 <b>'+c.index+'</b> / 100</span>';
  }
  function confidenceDetails(r){
    const c=r?.confidence;if(!c)return '';
    const items=c.used.map(s=>'<li><a class="source-link" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a><small>来源 '+s.origin+' × 直接性 '+s.directness+' × 年份 '+s.freshness+' × 100 → '+s.points+' 分</small></li>').join('');
    return '<details class="rs-audit"><summary>置信度 '+c.index+' / 100 · 查看计算依据</summary><p>'+
      (c.conflict?'适用条件存在冲突，单一结论暂缓采信。':c.independent?'有 '+c.independent+' 个去重来源支持当前结论，其中 '+c.used.length+' 个参与计算。':'本轮取得的材料对当前结论提供了 0 条适用依据。赛事本身的影响仍待核实。')+
      '</p>'+(items?'<ul>'+items+'</ul>':'')+'</details>';
  }
  function initial(){return '<section class="rs-section"><div class="rs-section-head"><h2>四个评价维度</h2><span>分维度核对原文</span></div><div class="rs-cards">'+dimensions.map(d=>'<article class="rs-card"><span class="mini-icon '+d.color+'">'+icon(d.icon)+'</span><h3>'+d.name+'</h3><p>'+d.desc+'</p></article>').join('')+'</div></section><section class="panel rs-reference"><div><h2>检索与计分口径</h2><p class="sub">搜索结果用于发现线索，每条计分依据都要回到发布单位的原文。</p></div>'+ruleText+'<div class="ref-links"><a href="https://statics.scnu.edu.cn/pics/xsb/2025/0103/1735893141731811.pdf" target="_blank" rel="noopener">2024 全国普通高校竞赛分析目录</a><a href="https://seee.sues.edu.cn/_t189/61/9d/c11025a287133/page.htm" target="_blank" rel="noopener">上海工程技术大学学科竞赛目录</a></div></section>';}
  function resultHTML(){
    if(!current)return initial();
    const done=Object.keys(current.results).length,failed=Object.values(current.results).filter(r=>r.error).length,i=current.input;
    const context=[i.school,i.employer,i.job,i.award,i.year?i.year+' 年资料':''].filter(Boolean);
    return '<section class="rs-section"><div class="rs-section-head"><div><h2>'+esc(i.event)+'<span class="report-label">影响力报告</span></h2><p class="sub">'+(context.length?esc(context.join(' · ')):'全部院校与岗位 · 不限资料年份')+'</p></div><span role="status">'+(done<4?'正在查阅原文　'+done+' / 4':failed?failed+' 个维度查询失败，可重新检索':'本轮检索完成 · '+esc(new Date(current.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})))+'</span></div><div class="rs-cards">'+dimensions.map(d=>{
      const r=current.results[d.id];
      return '<button type="button" class="rs-card rs-select '+(active===d.id?'chosen':'')+'" data-rs-tab="'+d.id+'" aria-pressed="'+(active===d.id)+'"><span class="rs-cardtop"><span class="mini-icon '+d.color+'">'+icon(d.icon)+'</span><b>'+d.name+'</b></span>'+measure(r)+'<span class="small-state">'+esc(r?.state||'正在查阅原文')+'</span></button>';
    }).join('')+'</div></section>'+confidenceDetails(current.results[active])+evidence()+ruleText;
  }
  function proofCard(s){return '<article class="proof-card"><div class="proof-tag">'+esc(s.rule)+' · '+s.score+' 分</div><h3><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a></h3><div class="proof-meta">'+esc(s.publisher)+'　·　'+esc(s.year?s.year+' 年标注':'年份待核')+(s.version?'　·　'+esc(s.version):'')+'</div><blockquote>'+esc(s.quote)+'</blockquote><a class="source-link" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">核对来源原文</a></article>';}
  function jobEvidence(result,liveHits){
    const archived=result.archived||[];
    const known=new Set(archived.filter(r=>r.kind==='policy').map(r=>r.url));
    const live=liveHits.filter(r=>!known.has(r.url)||r.score===0);
    const records=archived.map(r=>{
      const status=r.kind==='policy'?'企业招聘条款 · '+r.score+' 分':r.kind==='outcome'?'校方单源披露 · '+r.stage:'社区自述 · 待核实';
      return '<article class="proof-card"><span class="proof-tag">'+esc(status)+'</span><h3>'+esc(r.title)+'</h3><p class="proof-meta">'+esc(r.period)+' · '+esc(r.award)+'</p><p>'+esc(r.quote)+'</p><a class="source-link" target="_blank" rel="noopener noreferrer" href="'+esc(r.url)+'">'+esc(r.publisher)+'</a></article>';
    }).join('');
    const search=result.communitySearch;
    const lookup=result.checked.filter(r=>r.status!=='已匹配').map(r=>'<div class="lookup-row"><a target="_blank" rel="noopener noreferrer" href="'+esc(r.url)+'">'+esc(r.title)+'</a><span>'+esc(r.status)+'</span></div>').join('');
    return '<section class="panel rs-evidence"><div class="rs-section-head"><h2>求职招聘依据</h2><a class="source-link" href="#employment-evidence">浏览就业证据库</a></div>'+
      '<p class="sub">分值对应下列招聘文件中最强的适用条款。仅查到获奖者去向时，显示去重的签约或入职案例数。</p>'+records+live.map(proofCard).join('')+
      (!records&&!live.length?'<p class="rs-empty">'+esc(result.error||result.state)+'</p>':'')+
      '<details class="lookup-info"><summary>实时检索与社区线索</summary><p>'+esc(result.query)+'</p><p>'+esc(result.lookup.map(r=>r.provider+' · '+r.status).join('　'))+'</p>'+lookup+
      (search?'<h3>牛客公开原帖</h3><p>'+esc(search.query)+' · '+esc(search.status)+'</p>'+search.links.map(r=>'<div class="lookup-row"><a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.title)+'</a><span>搜索线索 · 未核实</span></div>').join('')+(search.links.length?'':'<p>本轮没有取得可展示的帖子链接。</p>'):'')+'</details></section>';
  }
  function evidence(){
    const d=dimensions.find(v=>v.id===active),r=current.results[active];
    if(!r)return '<section class="panel rs-evidence" aria-live="polite"><h2>'+d.name+'依据</h2><p class="rs-empty">正在检索并读取相关发布单位的原文…</p></section>';
    const hits=r.checked.filter(x=>x.status==='已匹配').sort((a,b)=>b.score-a.score),common=r.checked.filter(x=>x.status==='通用复试材料'),rest=r.checked.filter(x=>x.status!=='已匹配');
    if(active==='employment')return jobEvidence(r,hits);
    if(common.length){
      const cards=common.map(s=>'<article class="proof-card"><h3><a target="_blank" rel="noopener noreferrer" href="'+esc(s.url)+'">'+esc(s.title)+'</a></h3><blockquote>'+esc(s.quote)+'</blockquote></article>').join('');
      return '<section class="panel rs-evidence"><div class="rs-section-head"><h2>'+d.name+'依据</h2><span>'+hits.length+' 条赛事专属依据</span></div>'+hits.map(proofCard).join('')+'<h3>院校通用材料要求</h3><p class="sub">下列复试文件允许提供竞赛获奖证明。适用奖级、专业和材料要求以原文为准；通用条款不计入该赛事的专属分。</p>'+cards+'<details class="lookup-info"><summary>查看检索过程与候选来源</summary><p>'+esc(r.query)+'</p><p>'+esc(r.lookup.map(x=>x.provider+' · '+x.status).join('　'))+'</p>'+rest.map(x=>'<div class="lookup-row"><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a><span>'+esc(x.status)+'</span></div>').join('')+'</details></section>';
    }
    return '<section class="panel rs-evidence"><div class="rs-section-head"><h2>'+d.name+'依据</h2><span>'+hits.length+' 条匹配 / '+r.checked.length+' 个候选页面</span></div>'+(hits.length?hits.map(proofCard).join(''):'<div class="rs-empty"><b>'+esc(r.state)+'</b><p>'+esc(r.error||'本轮可读原文未提供符合查询条件的可量化条款，此维度暂不计分。')+'</p></div>')+'<details class="lookup-info"><summary>查看检索过程与未计分来源</summary><p><b>实际检索词</b>　'+esc(r.query||'请求未完成')+'</p><p><b>搜索渠道</b>　'+esc(r.lookup.map(x=>x.provider+' · '+x.status+'（'+x.usable+' 条合格候选）').join('　')||'未完成')+'</p><p class="field-note">同时回查相关高校、目录和招聘来源，每个维度本轮最多核查 8 页。未匹配只能解释本轮结果。</p>'+rest.map(x=>'<div class="lookup-row"><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a><span>'+esc(x.status)+'</span></div>').join('')+'</details></section>';
  }
  const update=()=>{const a=document.getElementById('rs-report');if(a)a.innerHTML=resultHTML();};
  async function start(input){
    controller?.abort();controller=new AbortController();const signal=controller.signal,id=++run;
    current={input,time:Date.now(),results:{}};active=input.job||input.employer?'employment':'recommendation';update();
    await Promise.all(dimensions.map(async d=>{
      try{
        const response=await fetch('/functions/v1/app/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,track:d.id}),signal:AbortSignal.any([signal,AbortSignal.timeout(48000)])});
        const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');
        if(run===id)current.results[d.id]=result;
      }catch(e){if(run!==id)return;current.results[d.id]={score:null,state:'本次检索未完成',error:e.name==='TimeoutError'?'来源响应超时，可以重新检索。':e.message,query:'',lookup:[],checked:[]};}
      update();
    }));
  }
  function suggest(f,submitted=false){
    const m=window.JinghengSearch.lookup(f.elements.event.value);
    let box=f.querySelector('.rs-suggestions');
    if(!box){box=document.createElement('div');box.className='rs-suggestions';f.querySelector('.query-line').after(box);}
    const choices=m.exact.length?[]:m.partial.length?m.partial:m.near;
    box.innerHTML=window.JinghengSearch.prompt(choices,esc,true);
    if(submitted&&choices.length)box.querySelector('button')?.focus();
    return {choices,exact:m.exact[0]?.name};
  }
  document.addEventListener('input',e=>{if(e.target.name==='event'&&e.target.form?.id==='research-form'&&!e.isComposing)suggest(e.target.form);});
  document.addEventListener('submit',e=>{
    if(e.target.id!=='research-form')return;
    e.preventDefault();const f=e.target;
    const m=suggest(f,true);if(m.choices.length&&!f.dataset.keep)return;
    const useOriginal=!!f.dataset.keep;delete f.dataset.keep;
    f.querySelector('.rs-suggestions').replaceChildren();
    inputs=Object.fromEntries([...new FormData(f)].map(([k,v])=>[k,v.trim()]));
    if(!useOriginal&&m.exact)inputs.event=m.exact;
    start({...inputs});
  });
  document.addEventListener('click',e=>{
    const choice=e.target.closest('#research-form [data-suggest-name],#research-form [data-keep-query]');
    if(choice){const f=choice.form;if(choice.hasAttribute('data-keep-query'))f.dataset.keep='1';else f.elements.event.value=choice.dataset.suggestName;f.requestSubmit();delete f.dataset.keep;return;}
    const chip=e.target.closest('[data-rs-example]');if(chip){const f=chip.closest('form');f.elements.event.value=chip.dataset.rsExample;f.requestSubmit();return;}
    const tab=e.target.closest('[data-rs-tab]');if(tab){active=tab.dataset.rsTab;update();document.querySelector('[data-rs-tab="'+active+'"]')?.focus({preventScroll:true});}
  });
  window.JinghengResearch={prepareCareer(values){controller?.abort();run++;current=null;active='employment';inputs={event:'',school:'',job:'',employer:'',award:'',year:'',...values};},mount(target){target.innerHTML='<section class="intro"><div><div class="title-line"><h1>赛事影响力检索</h1></div><p>按你的升学与求职目标，从公开资料中查找可核验的评价依据。</p></div></section>'+form()+'<div id="rs-report">'+resultHTML()+'</div>';}};
})();
