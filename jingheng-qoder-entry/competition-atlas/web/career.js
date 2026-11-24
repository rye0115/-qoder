(() => {
  'use strict';
  const empty = {mode:'rating',profile:'explore',jobWeight:'',find:'',direction:'',company:'',event:'',degree:'',cohort:'',prize:'',size:'',job:''};
  let state={...empty}, catalog, model, request, sequence=0, timer;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = (pairs,current) => pairs.map(([id,label])=>'<option value="'+esc(id)+'"'+(id===current?' selected':'')+'>'+esc(label)+'</option>').join('');
  const pairs = values => values.map(v=>[v,v]);
  const select = (key,label,list) => '<label>'+label+'<select name="'+key+'">'+options(list,state[key])+'</select></label>';
  const input = (key,label,hint,list='') => '<label>'+label+'<input name="'+key+'" type="search" maxlength="80" placeholder="'+hint+'" value="'+esc(state[key])+'"'+(list?' list="'+list+'"':'')+'></label>';
  const datalist = (id,values) => '<datalist id="'+id+'">'+options(pairs(values),'')+'</datalist>';
  const prizeOptions=[['','不限或准备参赛'],['participated','仅参赛'],['prize','已获奖，奖级未指定'],['prov1','省级一等奖'],['prov2','省级二等奖'],['prov3','省级三等奖'],['nat1','全国一等奖'],['nat2','全国二等奖'],['nat3','全国三等奖'],['medal','获奖牌，赛区或颜色另核']];
  const labels=['个人自述','签约案例','条件待核','招聘优先或加分','可直通面试'];
  let coverage='all';
  function masthead(title){
    return '<header class="atlas-titleband"><h1>'+title+'</h1><p class="atlas-date">赛制资料核对至 <time datetime="'+esc(model.asOf)+'">'+esc(model.asOf.replaceAll('-','.'))+'</time></p></header>';
  }
  function profileSidebar(){
    const max=Math.max(...model.rubric.map(d=>d.weight));
    const expanded=matchMedia('(min-width: 561px)').matches?' open':'';
    return '<aside class="atlas-side"><details class="profile-adjust"'+expanded+'><summary class="need-label">按你的需求选赛</summary><div id="profile-controls"></div></details>'+
      '<figure class="weight-chart"><figcaption>通用评分构成</figcaption><ul>'+model.rubric.map(d=>'<li><span>'+esc(d.name)+'</span><i aria-hidden="true"><i style="width:'+100*d.weight/max+'%"></i></i><b>'+d.weight+'%</b></li>').join('')+'</ul></figure></aside>';
  }
  const resultsSlot='<div data-results-slot></div>';
  function coverageControls(){
    const ranked=model.ratings.filter(r=>r.score!==null).length;
    const groups=[['all','全部',model.ratings.length],['ranked','已排名',ranked],['pending','待补证',model.ratings.length-ranked]];
    return '<div class="coverage-filters" role="group" aria-label="按证据状态筛选">'+groups.map(([id,name,n])=>
      '<button type="button" data-coverage="'+id+'" aria-pressed="'+(coverage===id)+'">'+name+' <span>'+n+'</span></button>').join('')+'</div>';
  }
  function form() {
    const tabs='<div class="career-modes" role="group" aria-label="选择查询方式">'+[['rating','赛事排名'],['role','按岗位找比赛'],['event','按比赛查岗位']].map(([k,n])=>
      '<button type="button" data-mode="'+k+'" aria-pressed="'+(k===state.mode)+'">'+n+'</button>').join('')+'</div>';
    if(state.mode==='rating')return masthead('赛事推荐')+'<div class="atlas-toolbar">'+tabs+'</div><div class="atlas-layout">'+profileSidebar()+
      '<div class="atlas-work"><div class="atlas-discover"><form id="career-form" role="search" class="atlas-search"><button type="submit" aria-label="搜索赛事"></button><input type="search" name="find" aria-label="按赛事名称搜索" placeholder="搜索赛事名称或简称" value="'+esc(state.find)+'" maxlength="80"></form>'+coverageControls()+'</div>'+resultsSlot+'</div></div>';
    const byEvent=state.mode==='event';
    const roles=[...new Set(catalog.records.flatMap(r=>r.paths||[]))].filter(x=>x!=='未披露方向');
    const direction=select('direction','岗位方向',[['','全部岗位方向'],...pairs(roles)]);
    const company=input('company','公司或行业','如 思谋、工业自动化','career-orgs');
    const extras=!!(state.degree||state.cohort||state.size||state.job||byEvent&&(state.direction||state.company));
    const chips=byEvent?['全国大学生电子设计竞赛','RoboMaster','蓝桥杯']:['电子硬件','软件开发','算法与数据','机械与机器人','销售'];
    const profiles=Object.entries(model.profiles).map(([k,v])=>[k,v.name]);
    return masthead(byEvent?'按比赛查岗位':'按岗位找比赛')+'<div class="atlas-toolbar">'+tabs+'</div><form id="career-form" class="atlas-job-form"><div class="career-fields">'+select('profile','我目前的求职需求',profiles)+(byEvent?input('event','比赛名称','输入赛事全称或简称','career-events')+select('prize','我的参赛情况',prizeOptions):direction+company)+
      select('jobWeight','个人综合分中就业占比',model.jobWeights.map(w=>[String(w),w+'%'+(w===model.defaultJobWeight?'（默认）':'')]))+
      '<button type="submit" class="btn primary">'+(byEvent?'查公司和岗位':'查适合的比赛')+'</button></div>'+
      '<div class="career-chips"><span>试查</span>'+chips.map(s=>'<button type="button" data-example="'+esc(s)+'">'+esc(s)+'</button>').join('')+'</div>'+
      '<details class="career-extra"'+(extras?' open':'')+'><summary>限定我的条件</summary><div class="career-fields">'+
      (byEvent?direction+company:'')+select('degree','求职时学历',[['','不限学历'],...pairs(['专科','本科','硕士','博士'])])+
      input('cohort','毕业届别','如 2027')+input('job','具体岗位关键词','如 软件测试、售前')+
      select('size','企业规模',[['','不限规模'],['hundreds','已披露百人规模']])+'</div></details>'+
      datalist('career-orgs',Object.values(catalog.organizations).map(o=>o.name))+
      datalist('career-events',Object.values(catalog.events).map(names=>names[0]))+'</form>'+resultsSlot;
  }
  function evidence(row,match,byEvent) {
    const org=catalog.organizations[row.org];
    const links=row.sourceByYear?.[state.cohort]?[row.sourceByYear[state.cohort]]:row.sources;
    const scope=[row.period,row.minDegree?row.minDegree+'及以上':'',org.sector,org.size||''].filter(Boolean);
    const title=byEvent?row.events.filter(e=>catalog.events[e].some(name=>name.toLowerCase()===state.event.toLowerCase())).map(e=>catalog.events[e][0]).join('、'):'';
    return '<div class="career-proof"><div class="career-meta"><b>'+esc(row.kind==='policy'?(row.effect==='直通'?'宣讲现场直通面试':'岗位明确优先或加分'):row.kind==='outcome'?'校方披露签约':'个人自述 · 待核')+'</b>　'+esc(scope.join(' · '))+'</div>'+
      (byEvent?'':'<p class="career-job"><strong>'+esc(org.name)+'</strong>　'+esc(row.role)+'</p>')+
      '<p>'+esc(title?title+' · ':'')+esc(row.award)+'</p><p>'+esc(row.note)+'</p>'+
      (match.missing.length?'<p class="career-missing">'+esc(match.missing.join(' · '))+'</p>':'')+
      '<div class="emp-sources">'+links.map(id=>{const [label,url]=catalog.sources[id];return '<a class="source-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';}).join('')+'</div></div>';
  }
  function renderGroup(group,rows,byEvent,eventId) {
    const first=rows.get(group.matches[0].id);
    const org=catalog.organizations[first.org];
    const title=byEvent?org.name:catalog.events[group.key][0];
    const context=byEvent?first.role:(group.directEmployers?group.directEmployers+' 个独立招聘方明文采用':'仅有条件待核或去向材料');
    const proofs=group.matches.map(m=>evidence(rows.get(m.id),m,byEvent));
    const idx=model.ratings.find(r=>r.event===(byEvent?eventId:group.key));
    const weight=model.profiles[state.profile];
    const p=group.personal;
    const metrics='<div class="career-values"><span>通用含金量 <b>'+esc(p.base??'待评')+'</b></span><span>就业帮助 <b>'+esc(p.employment??'待评')+'</b></span><span>需求匹配 <b>'+esc(p.match??'待核')+'</b></span><span>个人综合分 <b>'+esc(p.score??'待评')+'</b>'+(p.change===null?'':'（'+(p.change>0?'+':'')+p.change+'）')+'</span></div>'+
      (idx?.scope?'<p class="career-caption">赛事规则适用范围：'+esc(idx.scope)+'</p>':'')+
      (group.fitParts?'<details class="career-more"><summary>我的结果怎么算</summary><p>'+esc(weight.name)+'。招聘待遇 '+group.fitParts.effect+' × '+weight.effect+'% ＋ 雇主覆盖 '+group.fitParts.breadth+' × '+weight.breadth+'% ＋ 奖级适配 '+group.fitParts.entry+' × '+weight.entry+'%，取整后需求匹配为 '+p.match+' 分。</p>'+
        (p.matchedJob===null?'':'<p>该组招聘条款对应的个人就业项为 '+p.matchedJob+' 分。</p>')+
        (p.score===null?'<p>赛事或就业证据仍有缺项，个人综合分待评。</p>':'<p>其余四项折合 '+idx.intrinsic+' 分，占 '+(100-p.jobWeight)+'%。个人就业项占 '+p.jobWeight+'%。按未取整的中间值计算。</p>')+'</details>':'');
    return '<article class="career-group"><header><div><h3>'+esc(title)+'</h3><p>'+esc(context)+'</p></div><span class="emp-type '+(group.rank>=3?'policy':group.rank===1?'outcome':'community')+'">'+esc(labels[group.rank])+'</span></header>'+
      metrics+proofs[0]+(proofs.length>1?'<details class="career-more"><summary>查看其余 '+(proofs.length-1)+' 条证据</summary>'+proofs.slice(1).join('')+'</details>':'')+
      (byEvent?'':'<button type="button" class="career-drill" data-event="'+esc(group.key)+'">用我的奖级查岗位</button>')+'</article>';
  }
  function guide() {
    const ruleItems=model.rubric.filter(d=>d.levels).map(d=>'<li><b>'+esc(d.name)+' · '+d.weight+'%</b>　'+d.levels.map((v,i)=>(i+1)+' 档 '+esc(v)).join(' / ')+'</li>').join('');
    const jobWeight=model.rubric.find(d=>d.id==='employment').weight;
    return '<p>本榜采用百分制，最多显示一位小数。单项分和综合分使用同一量表，待补证的赛事显示可能范围或待评。</p>'+
      '<p><b>专业与赛期。</b>这两项描述报名和参赛条件。填写专业后按对应规则核对，填写时间后按所选届次和赛项核对。必需条件冲突或缺证时单列，时间偏好用于个人排序。通用分仍由以下六项计算。</p>'+
      '<p><b>通用含金量。</b>任务、评审、选拔和透明四项各分三档，依公开材料判档，依次获得该项权重的三分之一、三分之二、全部。就业帮助和保研帮助各占 '+jobWeight+'%。六项都有证据才给单值。缺项按可能取得的最低和最高分显示范围。</p><ul>'+ruleItems+'</ul>'+
      '<p><b>就业帮助。</b>每家明确采用赛事的独立招聘方计 7 分，上限 35；最强待遇为招聘优先得 30 分，直通面试得 40 分；跨届独立简章每家计 5 分，上限 15；可核实的独立签约或入职案例每人计 5 分，上限 10。只有个人去向、没有直接招聘条款时保留待评。论坛自述只作查证线索，同一份简章或案例转帖合并。</p>'+
      '<p><b>保研帮助。</b>只在核验到当届正式本科推荐规则时计入通用分。同一学校取有证的最高用途，多校等权平均。计入评价分、专项申请、同等优先、纳入评议依次编码为 80、70、60、40。公示稿、历届材料与明确限制单列；跨校公开样本覆盖有限。学校原始加分用各自的量表。</p>'+
      '<p><b>按我的需求选赛。</b>筛出符合方向、公司、学历、届别和奖级的条款，按所选需求对招聘待遇、雇主覆盖、奖级适配加权得到需求匹配。直通或优先对应 100 或 75 分，覆盖三家招聘方达满分；仅需参赛、要求获奖、限定奖级依次为 100、75、40 分，已满足明确奖级时为 100 分。</p>'+
      '<p>个人推荐度＝四项赛制质量折合分 ×（1 − 目标权重）＋ 目标适配 × 目标权重。求职按目标岗位算适配，保研按本校本院本届的用途和奖级算适配。奖级分值和同表上限可核时，计分适配取 60 ＋ 40 × 本档分值占上限比例。就业证据只占一个加权项。结果是公开证据下的比较分，权重为试行设定，录用概率尚无样本支持。</p>';
  }
  function sourceLinks(sources) {
    return sources.map(([name,url])=>'<a class="source-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+'</a>').join(' ');
  }
  function admissionDetails(a){
    return '<p>'+esc(a.confidence)+'</p>'+a.records.map(c=>'<div class="policy-clause"><b>'+esc(c.school+' · '+c.unit+' · '+c.cohort+' 届')+'</b><p>'+esc(c.requirement)+' '+esc(c.effect)+'</p><p class="career-meta">'+esc(c.confidence)+' · '+esc(c.locator)+' · 发布于 '+esc(c.published)+'</p><div>'+sourceLinks([[c.title,c.url],...(c.attachment?[[c.attachment.title,c.attachment.url]]:[]),...(c.corroboration?[[c.corroboration.title,c.corroboration.url]]:[])])+'</div>'+(c.corroboration?'<p>'+esc(c.corroboration.note)+'</p>':'')+'</div>').join('');
  }
  function auditDetails(){
    const a=model.audit;
    const head=a.scenarios.map(s=>'<th>'+esc(s.name)+'</th>').join('');
    const rows=model.ratings.filter(r=>r.score!==null).map(r=>'<tr><th>'+esc(r.name)+'</th>'+a.scenarios.map(s=>{const x=s.results.find(x=>x.event===r.event);return '<td>'+x.rank+' / '+x.value+'</td>';}).join('')+'</tr>').join('');
    return '<p>目前 '+a.paired+' 项有任务与评审档案，其中 '+a.sameLevels+' 项同档。两者同时受答辩材料影响，样本无法分辨其独立贡献。权重为试行判断，尚缺独立评审与结果样本校准。</p><p>按同一批 '+a.count+' 项六维齐备赛事重新计算，每格为名次 / 分数，同分并列。各方案依页面的维度顺序取权重。</p><p>'+a.scenarios.map(s=>esc(s.name)+'（'+s.weights.map(w=>Number(w.toFixed(1))).join(' / ')+'）').join('；')+'</p><div class="table-scroll"><table><thead><tr><th>赛事</th>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div><p>研究依据　'+sourceLinks([['OECD／欧盟 JRC 综合指标手册','https://doi.org/10.1787/9789264043466-en'],['教育部推免工作通知','https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/201408/t20140804_172730.html']])+'</p>';
  }
  function rankingHeading(summary){
    return '<header class="ranking-heading"><div><h2>比赛排行榜</h2><span role="status">'+esc(summary)+'</span></div>'+
      '<div class="ranking-tools"><button type="button" data-rank-help="method" aria-haspopup="dialog">评分方法</button>'+
      '<button type="button" data-rank-help="weights" aria-haspopup="dialog">权重与排名</button></div></header>';
  }
  function rankingTable(rows,labels,scoreLabel,caption){
    if(!rows.length)return '';
    const body=rows.map(row=>{
      const id='rank-detail-'+row.event;
      const score=row.score!==null?esc(row.score):row.range?esc(row.range.join('–')):'待评';
      const breakdown=labels.map((name,i)=>esc(name)+' '+esc(row.metrics[i]??'待核')).join(' · ');
      const meter=Number.isFinite(row.score)?'<span class="score-meter" aria-hidden="true"><i style="width:'+Math.min(100,Math.max(0,row.score))+'%"></i></span>':'';
      const rankStyle=row.rank===1?' rank-top rank-first':row.rank<=3?' rank-top':'';
      return '<tbody><tr class="rank-row"><td class="rank-number">'+(row.rank===null?'<span aria-label="未排名">—</span>':'<span class="rank-position'+rankStyle+'">'+String(row.rank).padStart(2,'0')+'</span>')+'</td>'+
        '<th scope="row" class="rank-name"><button type="button" class="rank-toggle" aria-controls="'+esc(id)+'" aria-expanded="false" aria-label="'+esc('查看'+row.name+'的评分依据')+'">'+esc(row.name)+'</button>'+
        (row.subtitle?'<small>'+esc(row.subtitle)+'</small>':'')+'<small class="rank-mobile-metrics">'+breakdown+'</small></th>'+
        row.metrics.map(n=>'<td class="rank-metric">'+esc(n??'待核')+'</td>').join('')+
        '<td class="rank-total'+(row.score===null?' rank-pending':'')+'">'+score+meter+(row.score===null&&row.range?'<small>可能范围</small>':'')+'</td>'+
        '<td class="rank-disclosure"><button type="button" class="rank-toggle rank-chevron" aria-label="'+esc('展开或收起'+row.name+'的详情')+'" aria-controls="'+esc(id)+'" aria-expanded="false"></button></td></tr>'+
        '<tr class="rank-detail" id="'+esc(id)+'" hidden><td colspan="'+(4+labels.length)+'"><div class="rank-detail-body">'+row.detail+'</div></td></tr></tbody>';
    }).join('');
    return '<div class="rank-list"><table class="ranking-table" aria-label="'+esc(caption)+'"><thead><tr><th scope="col" class="rank-number">名次</th><th scope="col" class="rank-name">赛事名称</th>'+
      labels.map(n=>'<th scope="col" class="rank-metric">'+esc(n)+'</th>').join('')+'<th scope="col" class="rank-total">'+esc(scoreLabel)+'<small> / 100</small></th><th scope="col" class="rank-disclosure"><span class="rank-sr">详情</span></th></tr></thead>'+body+'</table></div>';
  }
  function drawRatings(region){
    const q=state.find.trim(),match=window.JinghengSearch.lookup(q,catalog.events);
    const direct=[...match.exact,...match.partial],similar=!direct.length?match.near:[];
    const ids=new Set([...direct,...similar].map(m=>m.id));
    const matches=model.ratings.filter(r=>!q||ids.has(r.event));
    const nRanked=matches.filter(r=>r.score!==null).length;
    const counts={all:matches.length,ranked:nRanked,pending:matches.length-nRanked};
    for(const button of region.closest('.atlas-work').querySelectorAll('[data-coverage]')){
      button.querySelector('span').textContent=counts[button.dataset.coverage];
    }
    const list=matches.filter(r=>coverage==='all'||(r.score!==null)===(coverage==='ranked'));
    const rows=new Map(catalog.records.map(r=>[r.id,r]));
    function ratingRow(r){
      const e=r.employment;
      const details=r.dimensions.map((d,i)=>{
        const rule=model.rubric[i];
        return '<div class="career-proof"><b>'+esc(rule.name)+' · '+rule.weight+'%</b>　'+
          (d.score===null?'待核':d.level!==null?'第 '+d.level+' 档 · '+d.score+' / 100':d.score+' / 100')+
          '<p>'+esc(d.reason)+'</p>'+(d.id==='admission'?admissionDetails(r.admission):'')+(d.sources.length?'<div class="emp-sources">'+sourceLinks(d.sources)+'</div>':'')+'</div>';
      }).join('');
      const missing=r.dimensions.filter(d=>d.score===null).map(d=>model.rubric.find(r=>r.id===d.id).name);
      const rank=r.score===null?null:1+model.ratings.filter(other=>other.score!==null&&other.score>r.score).length;
      const detail='<div class="rank-detail-head"><h3>评分依据</h3><button type="button" class="career-drill" data-event="'+esc(r.event)+'">按我的条件匹配岗位</button></div>'+
        '<p class="career-caption">'+esc([r.status,r.scope].filter(Boolean).join(' · '))+'</p>'+
        '<h3>专业与赛期</h3><p>'+esc(r.participation?.major?(r.participation.major.year?r.participation.major.year+' 年 · ':'')+r.participation.major.scope+'。'+r.participation.major.note:'专业准入条款待核。')+' '+(r.participation?.major?sourceLinks([['查看准入原文',r.participation.major.url]]):'')+'</p>'+
        (r.participation?.calendars||[]).map(c=>'<p>'+esc(c.year+' 年 · '+c.scope+'。'+c.slots.map(s=>s.name+' '+s.start+(s.start===s.end?'':' 至 '+s.end)).join('，')+'。'+c.note)+' '+sourceLinks([['查看赛程原文',c.url]])+'</p>').join('')+
        (r.participation?.calendars?.length?'':'<p>分届赛程待核。</p>')+
        (missing.length&&!r.platform?'<p>待核维度　'+esc(missing.join('、'))+'</p>':'')+details+
        '<p class="career-sample">'+e.employers+' 个招聘方明文采用 · '+e.repeat+' 个跨届复用 · '+e.people+' 个独立签约或入职案例</p>'+
        (e.score===null?'':'<p>就业分项　招聘方覆盖 '+e.points.breadth+'/35，待遇 '+e.points.effect+'/40，跨届 '+e.points.repeat+'/15，去向 '+e.points.outcome+'/10。</p>')+
        e.records.map(id=>evidence(rows.get(id),{missing:[]},false)).join('');
      return {...r,rank,subtitle:e.employers+' 个明确招聘方 · '+r.admission.schools+' 所当届推免采信学校',metrics:[e.score,r.admission.score],detail};
    }
    const all=list.map(ratingRow),ranked=all.filter(r=>r.rank!==null),pending=all.filter(r=>r.rank===null);
    const table=(items,caption)=>rankingTable(items,['就业帮助','保研帮助'],'通用分',caption);
    region.innerHTML=window.JinghengSearch.prompt(similar,esc)+rankingHeading(ranked.length+' 项已排名 · '+pending.length+' 项待补证')+
      table(ranked,'通用排名')+(coverage==='pending'?table(pending,'待补证赛事'):pending.length?'<details class="pending-ranks"'+(q?' open':'')+'><summary>待补证赛事 <span>'+pending.length+' 项</span></summary>'+table(pending,'待补证赛事')+'</details>':'')+
      (!all.length?'<p class="rs-empty">当前条件下没有匹配的赛事。</p>':'')+
      '<div class="career-actions"><button class="btn" type="button" data-live>到联网检索查原文</button><a class="source-link" href="#employment-evidence">浏览完整就业证据库</a></div>';
  }
  async function draw(host) {
    const region=host.querySelector('#career-results');
    if (!region) return;
    request?.abort(); const current=++sequence; request=new AbortController();
    region.removeAttribute('aria-busy');
    if(state.mode==='rating'){drawRatings(region);return;}
    const byEvent=state.mode==='event';
    if(byEvent&&!state.event.trim()){region.innerHTML='<p class="rs-empty">选择或输入比赛名称，可以进一步按你拿到的奖级查岗位。</p>';return;}
    const names=byEvent?window.JinghengSearch.lookup(state.event,catalog.events):null;
    if(names&&!names.exact.length&&(names.partial.length||names.near.length)){
      region.innerHTML=window.JinghengSearch.prompt(names.partial.length?names.partial:names.near,esc);
      return;
    }
    if(state.cohort&&!/^(19|20)\d{2}$/.test(state.cohort)){region.innerHTML='<p class="rs-empty">请填写四位数毕业届别，例如 2027。</p>';return;}
    region.setAttribute('aria-busy','true');
    try {
      const response=await fetch('/functions/v1/app/api/employment/match?'+new URLSearchParams({...state,event:names?.exact[0]?.name||state.event}),{signal:request.signal});
      if(!response.ok)throw Error();
      const result=await response.json();
      if(current!==sequence||!region.isConnected)return;
      const rows=new Map(catalog.records.map(r=>[r.id,r]));
      const sections=[[g=>g.rank>=3,'有明确招聘条款'],[g=>g.rank===2,'仍需要核对条件'],[g=>g.rank<2,'获奖者去向与个人线索']];
      const profile=model.profiles[state.profile];
      region.innerHTML='<div class="rs-section-head"><h2>'+(byEvent?'对应的公司和岗位':'值得考虑的比赛')+'</h2><span role="status">'+result.results.length+(byEvent?' 个公司岗位组合':' 项赛事或平台赛事')+'</span></div><p class="career-caption">'+esc(profile.need)+'。本次按待遇 '+profile.effect+'%、雇主覆盖 '+profile.breadth+'%、奖级适配 '+profile.entry+'% 匹配。</p>'+
        sections.map(([predicate,label])=>{const groups=result.results.filter(predicate);return groups.length?'<section class="career-section"><h3>'+label+'</h3><div class="career-grid">'+groups.map(g=>renderGroup(g,rows,byEvent,result.eventId)).join('')+'</div></section>':'';}).join('')+
        (result.results.length?'':'<p class="rs-empty">现有样本没有匹配记录。可以放宽条件，或查找新的公开招聘原文。</p>')+
        '<div class="career-actions"><button class="btn" type="button" data-live>到联网检索查原文</button><a class="source-link" href="#employment-evidence">浏览完整就业证据库</a></div>';
    } catch(error) {
      if(error.name!=='AbortError'&&current===sequence&&region.isConnected)region.innerHTML='<p class="rs-empty">匹配结果暂时无法读取。<button class="btn" type="button" data-retry>重试</button></p>';
    } finally {if(current===sequence)region.removeAttribute('aria-busy');}
  }
  async function mount(host) {
    host.innerHTML='<div class="atlas-page"><div class="career-query">正在读取岗位和赛事…</div><div id="career-results" class="rs-section"></div></div>';
    const box=host.querySelector('.career-query'),region=host.querySelector('#career-results');
    let disposeProfile;
    const refresh=()=>{
      disposeProfile?.();box.innerHTML=form();box.querySelector('[data-results-slot]').append(region);draw(host);
      const controls=box.querySelector('#profile-controls');
      if(controls)disposeProfile=window.JinghengPersonal.mount(controls,model,region,active=>{
        clearTimeout(timer);box.querySelector('.atlas-discover').hidden=active;
        box.querySelector('.need-label').textContent=active?'调整我的推荐条件':'按你的需求选赛';
        if(!active){state.find='';box.querySelector('[name=find]').value='';drawRatings(region);}
      });
    };
    try {
      if(!catalog||!model){const get=async path=>{const r=await fetch(path);if(!r.ok)throw Error();return r.json();};[catalog,model]=await Promise.all([get('/functions/v1/app/api/employment'),get('/functions/v1/app/api/ratings')]);}
      if(!box.isConnected)return;
      if(!state.jobWeight)state.jobWeight=String(model.defaultJobWeight);
      host.insertAdjacentHTML('beforeend','<dialog class="rank-help-dialog" aria-labelledby="rank-help-title"><header><h2 id="rank-help-title"></h2><button type="button" class="btn">关闭</button></header><div class="rank-help-body"></div></dialog>');
      const dialog=host.querySelector('.rank-help-dialog');
      dialog.querySelector('button').onclick=()=>dialog.close();
    } catch {box.innerHTML='<p>加载失败。<button type="button" class="btn">重试</button></p>';box.querySelector('button').onclick=()=>mount(host);return;}
    box.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.coverage){coverage=button.dataset.coverage;box.querySelectorAll('[data-coverage]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));clearTimeout(timer);drawRatings(region);return;}
      if(button.dataset.mode){state.mode=button.dataset.mode;clearTimeout(timer);refresh();box.querySelector('[aria-pressed="true"]').focus();return;}
      if(button.dataset.example){state[state.mode==='event'?'event':'direction']=button.dataset.example;clearTimeout(timer);refresh();}
    });
    box.addEventListener('submit',e=>{if(e.target.id!=='career-form')return;e.preventDefault();clearTimeout(timer);draw(host);});
    const sync=e=>{
      if(!e.target.name||e.target.form?.id!=='career-form')return;
      state[e.target.name]=e.target.value.trim();
      request?.abort();sequence++;clearTimeout(timer);
      if(e.type==='change'){draw(host);return;}
      timer=setTimeout(()=>{if(box.isConnected)draw(host);},180);
    };
    box.addEventListener('input',sync);box.addEventListener('change',sync);
    region.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.suggestName){
        const k=state.mode==='event'?'event':'find',field=box.querySelector('[name='+k+']');
        state[k]=field.value=button.dataset.suggestName;clearTimeout(timer);draw(host);field.focus();return;
      }
      if(button.dataset.rankHelp){
        const dialog=host.querySelector('.rank-help-dialog'),weights=button.dataset.rankHelp==='weights';
        dialog.querySelector('h2').textContent=weights?'权重依据与排名敏感性':'通用含金量和个人推荐度怎么算？';
        dialog.querySelector('.rank-help-body').innerHTML=weights?auditDetails():guide();
        dialog.showModal();
        return;
      }
      if(button.classList.contains('rank-toggle')){
        const body=button.closest('tbody'),panel=body.querySelector('.rank-detail');
        panel.hidden=!panel.hidden;
        body.querySelectorAll('.rank-toggle').forEach(toggle=>toggle.setAttribute('aria-expanded',String(!panel.hidden)));
        return;
      }
      if(button.hasAttribute('data-retry'))draw(host);
      if(button.hasAttribute('data-live')){
        const award=state.mode==='event'&&state.prize?new Map(prizeOptions).get(state.prize):'';
        window.JinghengResearch.prepareCareer({event:state.mode==='rating'?state.find:state.mode==='event'?state.event:'',job:state.job,employer:state.company,year:state.cohort,award});
        location.hash='research';
      }
      if(button.dataset.event){state.mode='event';state.event=catalog.events[button.dataset.event][0];state.prize='';refresh();box.scrollIntoView({block:'start'});}
    });
    refresh();
  }
  window.JinghengCareer={mount,rankingHeading,rankingTable};
})();
