(() => {
  'use strict';
  const M=globalThis.RatingModel, demo=M.demo(), key='jingheng.workspace.v1';
  const el=id=>document.getElementById(id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    gauge:'<path d="M4 18a9 9 0 1 1 16 0H4zM12 14l4-5"/><circle cx="12" cy="14" r="1.3"/>',
    link:'<path d="m10 13 4-4m-6 2-2 2a3.5 3.5 0 0 0 5 5l3-3m-4-6 3-3a3.5 3.5 0 0 1 5 5l-2 2"/>',
    award:'<circle cx="12" cy="8.5" r="5.5"/><path d="m8.5 13-2 8 5.5-3 5.5 3-2-8"/>',
    scope:'<path d="M3 6h9m4 0h5M3 12h3m4 0h11M3 18h11m4 0h3"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    shield:'<path d="m12 3 8 3v5c0 5-3.8 8-8 10-4.2-2-8-5-8-10V6z"/><path d="m8.5 11.5 2.5 2.5 4.5-5"/>',
    mountain:'<path d="m2 19 7-13 5 7 2-3 6 9zM7 10l2 2 2-2"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    box:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>',
    sail:'<path d="M12 3v13H4zM15 6v10h5zM3 19h18"/>', 
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
    leaf:'<path d="M20 3c1 11-4 17-10 16-9-2-5-13 3-13 3 0 5-1 7-3zM5 21l10-11"/>',
    graph:'<path d="M4 18V7m6 11V4m6 14v-7m5 10H2"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
    book:'<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2zM12 6v14"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18"/>'
  };
  const ic=name=>'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.grid)+'</svg>';
  const kinds=['mountain','spark','box','sail','compass','leaf','graph','award'],colors=['lav','blue','mint','peach','lav','mint','rose','blue'];
  const emark=(i)=>'<span class="mini-icon '+colors[i%colors.length]+'">'+ic(kinds[i%kinds.length])+'</span>';
  const num=(v,d=1)=>v===null||v===undefined?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d});
  const percent=x=>x===null||x===undefined?'—':num(x*100,2)+'%';
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const options=(arr,value)=>arr.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return '<option value="'+escape(v)+'" '+(v===value?'selected':'')+'>'+escape(t)+'</option>';}).join('');
  const tag=(t,kind)=>'<span class="tag '+kind+'"><i></i>'+escape(t)+'</span>';
  const stateTag=s=>tag(s,s==='资料齐全'?'ok':['暂停','组外'].includes(s)?'hold':'pending');
  const sortScore=(a,b)=>(b.metrics.score??-1)-(a.metrics.score??-1)||(b.metrics.quality??-1)-(a.metrics.quality??-1)||a.name.localeCompare(b.name,'zh');
  let personal={scope:M.emptyScope(),events:[]}, mode='demo', storageWarning='';
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved&&saved.scope&&Array.isArray(saved.scope.panel)&&Array.isArray(saved.events)){personal={scope:saved.scope,events:saved.events};mode=saved.mode==='mine'?'mine':'demo';}
  }catch{storageWarning='浏览器存储暂不可用，当前修改仅在本次打开期间保留。';}
  const dataset=()=>mode==='demo'?demo:personal;
  const rows=()=>M.assess(dataset().events,dataset().scope);
  let page='overview',search='',filter='',order='score',chartMetric='impact',dialogKind='',activeId='',draft=null,dirty=false,lastFocus=null;
  function save(person=personal,newMode=mode){
    try{localStorage.setItem(key,JSON.stringify({...person,mode:newMode}));storageWarning='';}
    catch{storageWarning='浏览器未能保存数据，当前修改只在本次打开期间保留。';}
    personal=person;mode=newMode;
  }
  function notify(t){const n=el('notice');n.textContent=t;n.className='shown';clearTimeout(notify.timer);notify.timer=setTimeout(()=>n.className='',3200);}
  function pageIntro(title,context,action=true){
    return '<section class="intro"><div><div class="title-line"><h1>'+title+'</h1></div><p>'+context+'</p></div><div class="toolbar"><select class="switcher" id="dataset" aria-label="切换数据样本">'+options([['demo','演示样本'],['mine','我的样本']],mode)+'</select>'+(action?'<button class="btn primary" data-action="new">'+ic('plus')+'录入赛事</button>':'')+'</div></section>';
  }
  const context=()=>{const s=dataset().scope;return (mode==='demo'?'虚构演示样本':'我的评价样本')+'　/　'+escape([s.year+' 年度',s.group,s.field].filter(Boolean).join(' · '));};
  function nav(){
    const list=[['employment','赛事推荐'],['research','联网检索'],['overview','样本总览'],['records','赛事档案'],['method','评价方法']];
    el('nav').innerHTML=list.map(([a,b])=>'<a href="#'+a+'" '+(page===a||page==='employment-evidence'&&a==='employment'?'aria-current="page"':'')+'>'+b+'</a>').join('');
    el('scope-icon').innerHTML=ic('scope');
  }
  const stat=(icon,color,label,value,unit,note)=>'<article class="stat"><div class="stat-label"><span class="mini-icon '+color+'">'+ic(icon)+'</span>'+label+'</div><div class="stat-value">'+value+'<small>'+unit+'</small></div><p class="stat-note">'+note+'</p></article>';
  function stats(list){
    const quality=list.map(x=>x.metrics.quality).filter(x=>x!==null), imp=list.map(x=>x.metrics.impact).filter(x=>x!==null), aw=list.flatMap(x=>x.awards.filter(a=>M.awardRate(a,x)!==null));
    return '<section class="stats" aria-label="样本统计">'+stat('layers','lav','纳入赛事',list.length,'项','同类组内已登记的赛事')+stat('gauge','blue','平均质量分',num(avg(quality)),'/ 100',quality.length+' 项赛事质量证据完整')+stat('link','mint','平均外部采信率',num(avg(imp)===null?null:avg(imp)*100),'%',imp.length+' 项赛事完成机构核查')+stat('award','peach','已评奖项记录',aw.length,'条','按奖级和参赛入口分别计数')+'</section>';
  }
  function charts(list){
    const available=list.filter(e=>e.metrics.quality!==null&&(chartMetric==='quality'||(chartMetric==='impact'?e.metrics.impact:e.metrics.score)!==null)).sort((a,b)=>b.metrics.quality-a.metrics.quality).slice(0,6);
    const second=chartMetric==='impact'?'外部采信率':'综合分';
    const chart=available.length?'<div class="chart"><div class="axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div class="plot"><div class="lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'+available.map(e=>{
      const other=chartMetric==='impact'?e.metrics.impact*100:e.metrics.score,label=e.name+'　质量 '+e.metrics.quality+' 分，'+second+' '+num(other)+(chartMetric==='impact'?'%':' 分');
      return '<button class="bar-group" data-id="'+escape(e.id)+'" data-action="detail" title="'+escape(label)+'" aria-label="'+escape(label)+'"><i class="vbar" style="--h:'+e.metrics.quality+'%"></i><i class="vbar lighter" style="--h:'+other+'%"></i><span class="bar-name">'+escape(e.short||e.name)+'</span></button>';
    }).join('')+'</div></div>':'<p class="empty-chart no-data">暂无已完成两项指标核验的赛事</p>';
    const done=list.filter(e=>e.metrics.score!==null).length,review=list.filter(e=>e.status!=='通过').length,partial=list.length-done-review;
    const p=list.length?done/list.length*100:0,q=list.length?(done+partial)/list.length*100:0;
    const legend=(color,label,n)=>'<div><i class="dot" style="background:'+color+'"></i>'+label+'<b>'+n+' 项</b></div>';
    return '<section class="analysis-grid"><article class="panel"><div class="panel-head"><div><h2>赛事指标对比</h2><p class="sub">按质量分选取最多六项可比赛事</p></div><select id="chart-choice" class="select" aria-label="选择对比指标">'+options([['impact','质量与采信'],['score','质量与综合分']],chartMetric)+'</select></div><div class="legend"><span><i class="swatch"></i>质量分</span><span><i class="swatch light"></i>'+second+(chartMetric==='impact'?'（%）':'')+'</span></div>'+chart+'</article><article class="panel on-dark"><div class="panel-head"><div><h2>证据核验进度</h2><p class="sub">当前样本的综合评分完成情况</p></div><span class="dark-icon">'+ic('shield')+'</span></div><div class="status-body"><div class="ring" style="--ring:conic-gradient(#b5aafa 0 '+p+'%,#efc985 '+p+'% '+q+'%,#807d98 '+q+'% 100%)"><div><strong>'+num(p,0)+'%</strong><span>完成核验</span></div></div><div class="status-legend">'+legend('#b5aafa','资料齐全',done)+legend('#efc985','待补材料',partial)+legend('#807d98','资格待核等',review)+'</div></div><div class="dark-foot">'+(done<20?'已有 '+done+' 项可计算综合分，满 20 项开放同类分区。':'已有 '+done+' 项可计算综合分，已开放同类分区。')+'</div></article></section>';
  }
  function listing(list,archive){
    return '<section class="panel listing"><div class="panel-head"><div><h2>'+(archive?'档案列表':'赛事评价明细')+'</h2><p class="sub">查看评分、采信依据和各奖级的获奖比例</p></div><div class="toolbar"><label class="search">'+ic('search')+'<input id="search" type="search" placeholder="搜索赛事" aria-label="搜索赛事" value="'+escape(search)+'"></label><select class="select" id="state-filter" aria-label="筛选核验状态">'+options([['','全部状态'],['done','资料齐全'],['partial','待补材料'],['review','资格待核等']],filter)+'</select>'+(archive?'<select class="select" id="order" aria-label="排序方式">'+options([['score','按综合分排序'],['quality','按质量分排序'],['name','按名称排序']],order)+'</select>':'')+'</div></div><div id="records-table">'+table(list)+'</div></section>';
  }
  function table(list){
    const matches=window.JinghengSearch.lookup(search,Object.fromEntries(list.map(e=>[e.id,[e.name,e.short].filter(Boolean)])));
    const ids=new Set([...matches.exact,...matches.partial].map(m=>m.id));
    const visible=list.filter(e=>(ids.has(e.id)||(e.name+' '+e.id+' '+e.host).toLowerCase().includes(search.trim().toLowerCase()))&&(!filter||filter===(e.metrics.score!==null?'done':e.status!=='通过'?'review':'partial'))).sort(order==='name'?(a,b)=>a.name.localeCompare(b.name,'zh'):order==='quality'?(a,b)=>(b.metrics.quality??-1)-(a.metrics.quality??-1)||sortScore(a,b):sortScore);
    const content=visible.map(e=>'<tr data-open="'+escape(e.id)+'"><td><div class="event-name">'+emark(list.findIndex(x=>x.id===e.id))+'<div><b>'+escape(e.name)+'</b><small>'+escape(e.host||'主办背景待录入')+'</small></div></div></td><td>'+num(e.metrics.quality)+'</td><td>'+percent(e.metrics.impact)+'</td><td class="number-strong">'+num(e.metrics.score)+'</td><td>'+escape(e.metrics.zone||(e.metrics.score===null?'—':'样本不足'))+'</td><td>'+stateTag(e.metrics.state)+'</td><td><button class="row-detail" data-action="detail" data-id="'+escape(e.id)+'" aria-label="查看'+escape(e.name)+'详情">详情</button></td></tr>').join('');
    return (!visible.length?window.JinghengSearch.prompt(matches.near,escape):'')+'<div class="table-scroll"><table><thead><tr>'+['赛事名称','质量分','影响因子','综合分','同类分区','核验状态','操作'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+content+'</tbody></table></div>'+(!visible.length?'<div class="no-data">'+(list.length?'没有符合条件的赛事。':'还没有赛事。先设置同类组，再录入第一项赛事。')+'</div>':'')+'<div class="table-foot">显示 '+visible.length+' / '+list.length+' 项赛事</div>';
  }
  function method(){
    const refs=[['Clarivate · 期刊评价指标','https://clarivate.libguides.com/jcr/'],['中科院期刊分区表团队 · 分类方法','https://lib.hqu.edu.cn/info/1147/3110.htm'],['教育部 · 中小学生全国性竞赛名单及适用范围','https://www.moe.gov.cn/srcsite/A29/202510/t20251029_1418393.html']];
    return '<section class="intro"><div><h1>评价方法</h1><p>赛事榜与样本工作台使用各自的评分口径。</p></div></section><section class="panel"><h2>赛事榜 · 通用含金量与个人综合分</h2><p class="explain">赛事榜以任务挑战、评审与复核、选拔强度、结果透明、就业帮助和保研帮助六项计算通用分。个人推荐榜按院系推免或招聘条款计算目标适配。用户填写专业、可参赛日期、每周可参赛日或单场时长后，按相应届次与组别的证据调整排名。</p><a class="source-link" href="#employment">查看赛事榜、权重及逐项原文</a></section><h2>样本工作台 · 手工录入与同类分区</h2><div class="method-grid"><article class="panel"><h2>赛事质量的八项判据</h2><p class="sub">满足得对应分值，确认未满足得 0 分，未知保留空缺。</p><div class="criteria-list">'+M.criteria.map(c=>'<div class="criterion"><span class="pts">'+c[2]+' 分</span><div><b>'+c[0]+' · '+c[1]+'</b><p>'+c[3]+'</p></div></div>').join('')+'</div></article><div><article class="panel"><h2>综合评价与同类分区</h2><div class="equation">综合分 ＝ 质量分 × 70% ＋ 外部采信率 × 100 × 30%</div><p class="explain">固定年度、人群、领域、赛制与准入条件。每项独立赛事选定一个组别。满 20 项有效赛事后，按综合分划分四个区。前列位置等于高分赛事数加半数同分赛事，再除以有效数；25%、50%、75% 为分区界线，并列同区。全组同分时单独标明。</p></article><article class="panel wide"><h2>外部采信与奖项稀缺度</h2><div class="method-block"><p>事前固定至少 10 家独立机构。评价年前两个完整自然年内，机构在适用的生效规则或正式决定中点名采用赛事结果，计一次。重复报道、赞助与转发均不计。未知机构按全部未采信及全部采信两种情况计算上下限。</p></div><div class="method-block"><p>稀缺度以同届同组本级及以上的去重获奖数除以该入口有效参赛数。人数、队数、作品数分别统计。资格、才艺和作品质量仍须直接核验。</p></div></article></div></div><section class="panel arch"><h2>适用边界与资料来源</h2><p class="explain">认证主体、目录范围与有效期作为背景。核实买奖、虚假认证或操纵结果时暂停评分。复评时由两人独立判定并留存异议。权重和门槛为试行参数，尚待真实样本校准。参考资料如下。</p><div class="criteria-list">'+refs.map(([n,u])=>'<a class="source-link" href="'+u+'" target="_blank" rel="noopener noreferrer">'+n+'</a>').join('')+'</div></section>';
  }
  function render(){
    page=['overview','records','method','research','employment','employment-evidence'].includes(location.hash.slice(1))?location.hash.slice(1):'employment';
    nav();document.querySelector('.header-help').hidden=['research','employment','employment-evidence'].includes(page);
    if(page==='employment'){window.JinghengCareer.mount(el('main'));document.title='赛事推荐 · 竞衡';return;}
    if(page==='employment-evidence'){window.JinghengEmployment.mount(el('main'));document.title='就业证据 · 竞衡';return;}
    if(page==='research'){window.JinghengResearch.mount(el('main'));document.title='联网检索 · 竞衡';return;}
    const list=rows();
    el('main').innerHTML=(storageWarning?'<p class="error">'+escape(storageWarning)+'</p>':'')+(page==='method'?method():pageIntro(page==='records'?'赛事档案':'样本总览',context())+(page==='overview'?stats(list)+charts(list):'')+listing(list,page==='records'));
    document.title=({'overview':'样本总览','records':'赛事档案','method':'评价方法'}[page])+' · 竞衡';
  }
  function modal(title,body,actions='',kind='detail'){
    const d=el('dialog');if(!d.open)lastFocus=document.activeElement;dialogKind=kind;dirty=false;
    el('dialog-body').innerHTML='<div class="modal-head"><h2 id="dialog-title">'+title+'</h2><button class="close" data-action="close" type="button" aria-label="关闭窗口">'+ic('close')+'</button></div>'+body+(actions?'<div class="modal-actions">'+actions+'</div>':'');
    d.setAttribute('aria-labelledby','dialog-title');if(!d.open)d.showModal();d.scrollTop=0;
  }
  function dismiss(force=false){if(!force&&dirty&&!window.confirm('放弃本次未保存的修改？'))return;el('dialog').close();dialogKind='';dirty=false;lastFocus?.focus?.();}
  const btn=(act,label,primary=false)=>'<button type="button" class="btn '+(primary?'primary':'')+'" data-action="'+act+'">'+label+'</button>';
  function detail(id){
    const list=rows(),e=list.find(x=>x.id===id);if(!e)return;activeId=id;
    const m=e.metrics,s=dataset().scope, idx=list.findIndex(x=>x.id===id);
    const kpi=(n,v)=>'<div class="detail-kpi"><span>'+n+'</span><strong>'+v+'</strong></div>';
    const dimHtml=M.dimensions.map((d,i)=>{
      const a=e.flags.slice(2*i,2*i+2),cap=M.criteria[2*i][2]+M.criteria[2*i+1][2],v=M.eligible(e)&&a.every(x=>x===0||x===1)?a.reduce((t,x,j)=>t+x*M.criteria[2*i+j][2],0):null;
      return '<div class="dim"><div><b>'+d+'</b><span>'+num(v)+' / '+cap+'</span></div><span class="track"><i style="width:'+(v===null?0:100*v/cap)+'%"></i></span></div>';
    }).join('');
    const flags=M.criteria.map((c,i)=>'<dt>'+c[1]+' · '+c[2]+' 分</dt><dd>'+(['未满足','满足'][e.flags[i]]||'待核')+'。'+c[3]+'</dd>').join('');
    const obs=M.names(s).map(p=>{const o=Object.hasOwn(e.observations,p)?e.observations[p]:null;return '<dt>'+escape(p)+'</dt><dd>'+escape(!o?.source?'未查':(o.value==='采'?'有采信':'查完未见采信')+' · '+o.source)+'</dd>';}).join('');
    const awardArea=e.awards.length?'<label class="field">奖项与统计入口<select class="select" id="award-select">'+options(e.awards.map((a,i)=>[String(i),a.name+' · '+a.entry]),'0')+'</select></label><div id="award-result">'+awardRead(e,e.awards[0])+'</div>':'<p class="sub">尚未录入奖项及入口。</p>';
    modal('赛事评价详情','<div class="modal-content"><div class="detail-title">'+emark(idx)+'<div><h3>'+escape(e.name)+'</h3><p class="sub">'+escape(e.host||'主办背景待录入')+' · '+escape(e.id)+'　'+stateTag(m.state)+'</p></div></div><div class="detail-grid">'+kpi('质量分 / 100',num(m.quality))+kpi('外部影响因子',percent(m.impact))+kpi('综合分 / 100',num(m.score))+'</div><p class="sub">同类分区　'+escape(m.zone||(m.score===null?'待完成核验':'有效样本不足 20 项'))+'</p><div class="block"><h3>赛事质量</h3><div class="scores">'+dimHtml+'</div><details class="evidence"><summary>查看八项判据和核验依据</summary><dl>'+flags+'</dl><p class="detail-source">'+escape(e.source||'待补依据')+'</p></details></div><div class="block"><h3>独立机构采信</h3><p class="sub">观察窗 '+(s.year-2)+'—'+(s.year-1)+' 年 · '+escape(e.history)+'　｜　已查 '+m.m+' / '+m.n+' 家，确认采信 '+m.k+' 家</p><p class="sub">采信率范围　'+(m.lo===null?'待补范围或历史资料':percent(m.lo)+' 至 '+percent(m.hi))+'</p><details class="evidence"><summary>查看机构核查记录</summary><dl>'+ (obs||'尚未设置机构名册。')+'</dl></details></div><div class="block"><h3>奖项稀缺度</h3>'+awardArea+'</div></div>',(mode==='mine'?btn('edit','编辑赛事',true):'')+btn('close','关闭'));
  }
  function awardRead(e,a){const rate=M.awardRate(a,e);return '<div class="award-result"><div><b>'+escape(a.name)+'比例</b><small>'+escape(a.won??'—')+' / '+escape(a.total??'—')+' '+escape(a.unit)+'</small></div><strong>'+percent(rate)+'</strong></div><p class="sub detail-source">'+escape(a.source||'统计依据待补')+(rate===null?' · 请核对赛事资格、统计口径和数量。':'')+'</p>';}
  const field=(label,name,value,opts={})=>'<label class="field '+(opts.full?'full':'')+'">'+label+(opts.area?'<textarea name="'+name+'" rows="'+(opts.rows||2)+'" '+(opts.required?'required':'')+'>'+escape(value)+'</textarea>':'<input name="'+name+'" type="'+(opts.type||'text')+'" value="'+escape(value)+'" '+(opts.required?'required':'')+' '+(opts.type==='number'?'step="1" min="'+(opts.min??0)+'"':'')+'>')+'</label>';
  const pick=(label,name,values,v)=>'<label class="field">'+label+'<select class="select" name="'+name+'">'+options(values,v)+'</select></label>';
  const formActions=(id,label)=>btn('close','取消')+'<button class="btn primary" type="submit" form="'+id+'">'+label+'</button>';
  function scopeDialog(edit=false){
    const s=edit?personal.scope:dataset().scope;
    if(!edit&&mode==='demo'){
      const lines=[['评价年度',s.year],['人群与领域',s.group+' · '+s.field],['赛制与准入',s.format+' · '+s.entry],['候选范围',s.roster],['采信机构',s.sampling]];
      modal('演示样本设置','<div class="modal-content">'+lines.map(([n,v])=>'<div class="criterion"><span class="pts">'+n+'</span><p>'+escape(v)+'</p></div>').join('')+'</div>',btn('scope-mine','设置我的样本',true)+btn('close','关闭'),'scope-view');return;
    }
    const fields=[['评价年度','year',{type:'number',min:1902,required:true}],['参赛人群','group'],['专业领域','field'],['竞赛形态','format'],['赛段、范围和准入条件','entry',{full:true}],['候选赛事抽取口径、版本与冻结日期','roster',{area:true,full:true}],['独立机构抽取口径与冻结日期','sampling',{area:true,full:true}]];
    modal('我的样本设置','<form class="modal-content" id="scope-form"><p class="sub">固定同一年度与同类组。历史观察窗为评价年度之前的两个完整自然年。</p><div class="form-grid form-group">'+fields.map(([l,k,o])=>field(l,k,s[k],o)).join('')+field('独立机构名册（每行一家）','panel',s.panel.join('\n'),{area:true,full:true,rows:5})+'</div><p class="field-note">同一控制关系合并统计。完整影响因子至少需要 10 家。变更比较范围后，需要按新口径复核已有赛事。</p><p class="error" id="form-error" role="alert"></p></form>',formActions('scope-form','保存样本设置'),'scope-edit');
  }
  const newAward=()=>({name:'',entry:'',unit:'队',total:null,won:null,source:''});
  function blankEvent(){return {id:globalThis.crypto?.randomUUID?.()||'EV-'+Date.now(),name:'',short:'',host:'',status:'待核',history:'待核',flags:Array(8).fill(null),source:'',observations:{},awards:[]};}
  function awardEdit(a,i){return '<div class="award-edit" data-award><div class="inline"><b>奖项记录 '+(i+1)+'</b><button type="button" class="small-btn" data-action="remove-award">移除此条</button></div><div class="form-grid">'+field('奖级或专项奖','aw-name',a.name,{required:true})+field('统计入口','aw-entry',a.entry,{required:true})+pick('计数单位','aw-unit',['人','队','作品'],a.unit)+field('有效参赛数','aw-total',a.total,{type:'number',min:1})+field('本级及以上去重数','aw-won',a.won,{type:'number'})+field('分子、分母及去重依据','aw-source',a.source)+'</div></div>';}
  function eventDialog(e=null){
    draft=e?structuredClone(e):blankEvent();activeId=draft.id;
    const s=personal.scope, panel=M.names(s);
    const qs=M.criteria.map((c,i)=>'<label class="check-row"><span>'+c[0]+' · '+c[1]+'（'+c[2]+'）</span><select class="select" name="flag'+i+'">'+options([['','待核'],['1','满足'],['0','未满足']],draft.flags[i]===null?'':String(draft.flags[i]))+'</select></label>').join('');
    const surveys=panel.map((p,i)=>{const o=Object.hasOwn(draft.observations,p)?draft.observations[p]:{};return '<div class="survey-row"><span>'+escape(p)+'</span><select class="select" name="obs'+i+'" aria-label="'+escape(p)+'核查结论">'+options([['','未查'],['采','有采信'],['查','查完未见']],o.value||'')+'</select><input name="proof'+i+'" aria-label="'+escape(p)+'证据出处" placeholder="文件、日期及页码或链接" value="'+escape(o.source)+'"></div>';}).join('');
    modal(e?'编辑赛事':'录入赛事','<form class="modal-content" id="event-form"><div class="form-group"><h3>赛事档案</h3><p class="sub">保存至“我的样本”。每项赛事选定一个届次和组别。</p><div class="form-grid">'+field('赛事名称、届次及组别','name',draft.name,{required:true,full:true})+field('图表显示简称（选填）','short',draft.short)+field('主办与认证背景（选填）','host',draft.host)+pick('资格与诚信核验','status',['通过','待核','暂停','组外'],draft.status)+pick('历史观察窗口','history',['完整','不足','待核'],draft.history)+'</div></div><div class="form-group"><h3>质量证据</h3><p class="sub">有材料支持再选“满足”或“未满足”，其余选“待核”。</p>'+qs+field('逐项材料出处、页码及核验人','source',draft.source,{area:true,full:true})+'</div><div class="form-group"><h3>外部机构采信</h3>'+(surveys||'<p class="sub">可先保存赛事，在样本设置中填写机构名册后补录。</p>')+'</div><div class="form-group"><h3>奖项与统计入口</h3><div id="award-rows">'+draft.awards.map(awardEdit).join('')+'</div><button type="button" class="small-btn" data-action="add-award">'+ic('plus')+'添加奖项记录</button></div><p class="error" id="form-error" role="alert"></p></form>',formActions('event-form','保存赛事'),'event-edit');
  }
  function formError(msg){const s=el('form-error');s.textContent=msg;s.scrollIntoView({block:'nearest'});}
  function submitEvent(form){
    const fd=new FormData(form),get=k=>String(fd.get(k)??'').trim();
    if(!get('name'))return formError('请填写赛事名称、届次及组别。');
    if(personal.events.some(x=>x.id!==draft.id&&x.name.trim()===get('name')))return formError('同类组已有同名记录，请编辑原记录。');
    const observations=Object.create(null);
    for(const [i,p] of M.names(personal.scope).entries()){const value=get('obs'+i),source=get('proof'+i);if(value&&!source)return formError('请补充“'+p+'”的证据出处，或将结论改为“未查”。');if(value)observations[p]={value,source};}
    const awards=[];
    for(const row of form.querySelectorAll('[data-award]')){
      const v=k=>row.querySelector('[name="aw-'+k+'"]').value.trim(),n=k=>v(k)===''?null:Number(v(k));
      const a={name:v('name'),entry:v('entry'),unit:v('unit'),total:n('total'),won:n('won'),source:v('source')};
      if(!a.name||!a.entry)return formError('请填写奖级及统计入口。');
      if((a.total!==null&&(!Number.isSafeInteger(a.total)||a.total<1))||(a.won!==null&&(!Number.isSafeInteger(a.won)||a.won<0))||(a.total!==null&&a.won!==null&&a.won>a.total))return formError('请检查奖项数量。获奖数不得超过有效参赛数。');
      awards.push(a);
    }
    const event={id:draft.id,name:get('name'),short:get('short'),host:get('host'),status:get('status'),history:get('history'),source:get('source'),flags:M.criteria.map((_,i)=>get('flag'+i)===''?null:Number(get('flag'+i))),observations,awards};
    const list=personal.events.slice(),i=list.findIndex(x=>x.id===event.id);if(i<0)list.push(event);else list[i]=event;
    save({...personal,events:list},'mine');search='';filter='';dismiss(true);render();detail(event.id);notify(storageWarning||'赛事已保存');
  }
  function submitScope(form){
    const fd=new FormData(form),get=k=>String(fd.get(k)??'').trim(),scope={...M.emptyScope()};
    for(const k of ['group','field','format','entry','roster','sampling'])scope[k]=get(k);
    scope.year=Number(get('year'));if(!Number.isInteger(scope.year)||scope.year<1902||scope.year>9999)return formError('请输入有效的评价年度。');
    scope.panel=get('panel').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(new Set(scope.panel).size!==scope.panel.length)return formError('机构名册中有重复名称，请按独立机构去重。');
    const prev=personal.scope,changed=['year','group','field','format','entry','sampling','roster'].some(k=>String(prev[k])!==String(scope[k]));
    const removed=prev.panel.some(p=>!scope.panel.includes(p));
    if(personal.events.length&&(changed||removed)&&!window.confirm('修改样本范围或移除机构会影响现有记录。'+(changed?'赛事资格将转为待核，旧的机构核查将清空。':'移除的机构核查记录将清除。')+'继续保存？'))return;
    const events=personal.events.map(e=>changed?{...e,status:'待核',history:'待核',observations:{}}:{...e,observations:Object.fromEntries(Object.entries(e.observations).filter(([p])=>scope.panel.includes(p)))});
    save({scope,events},'mine');dismiss(true);render();notify(storageWarning||'样本设置已保存');
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-action]');if(!b){const tr=ev.target.closest('[data-open]');if(tr)detail(tr.dataset.open);return;}
    const a=b.dataset.action;if(a==='close')dismiss();else if(a==='new')eventDialog();else if(a==='scope')scopeDialog();else if(a==='scope-mine')scopeDialog(true);
    else if(a==='detail')detail(b.dataset.id);else if(a==='edit')eventDialog(personal.events.find(x=>x.id===activeId));
    else if(a==='add-award'){const node=el('award-rows');node.insertAdjacentHTML('beforeend',awardEdit(newAward(),node.childElementCount));dirty=true;node.lastElementChild.querySelector('input').focus();}
    else if(a==='remove-award'){b.closest('[data-award]').remove();dirty=true;document.querySelectorAll('[data-award] .inline b').forEach((n,i)=>n.textContent='奖项记录 '+(i+1));}
  });
  document.addEventListener('input',ev=>{if(ev.target.closest('#dialog form'))dirty=true;if(ev.target.id==='search'){search=ev.target.value;el('records-table').innerHTML=table(rows());}});
  document.addEventListener('click',ev=>{const pick=ev.target.closest('#records-table [data-suggest-name]');if(pick){search=el('search').value=pick.dataset.suggestName;el('records-table').innerHTML=table(rows());el('search').focus();}});
  document.addEventListener('change',ev=>{
    const t=ev.target;if(t.id==='dataset'){save(personal,t.value==='mine'?'mine':'demo');search='';filter='';render();}
    else if(t.id==='chart-choice'){chartMetric=t.value;render();}
    else if(t.id==='state-filter'||t.id==='order'){if(t.id==='order')order=t.value;else filter=t.value;el('records-table').innerHTML=table(rows());}
    else if(t.id==='award-select'){const e=rows().find(x=>x.id===activeId);el('award-result').innerHTML=awardRead(e,e.awards[Number(t.value)]);}
  });
  document.addEventListener('submit',ev=>{ev.preventDefault();if(ev.target.id==='scope-form')submitScope(ev.target);if(ev.target.id==='event-form')submitEvent(ev.target);});
  el('dialog').addEventListener('cancel',ev=>{ev.preventDefault();dismiss();});
  window.addEventListener('hashchange',()=>{search='';filter='';render();scrollTo(0,0);});
  render();
})();
