(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(url,label)=>'<a class="source-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
  function mount(host,model,result,setPersonal){
    const input=(key,label,list='')=>'<label>'+label+'<input name="'+key+'" maxlength="80" '+(list?'list="'+list+'"':'')+'></label>';
    const select=(key,label,choices)=>'<label>'+label+'<select name="'+key+'">'+choices.map(([v,k])=>'<option value="'+esc(v)+'">'+esc(k)+'</option>').join('')+'</select></label>';
    const list=(id,items)=>'<datalist id="'+id+'">'+[...new Set(items)].map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist>';
    const date=(key,label)=>'<label>'+label+'<input type="date" name="'+key+'"></label>';
    host.innerHTML='<form id="personal-form"><div class="need-composer"><textarea id="personal-need" name="need" maxlength="500" rows="2" aria-label="你的参赛需求" placeholder="写下你的想法、兴趣或时间安排…"></textarea></div>'+
      '<div class="need-actions"><button class="need-more" type="button" aria-haspopup="dialog" aria-controls="need-options"><i aria-hidden="true"></i>补充条件</button><button class="need-clear" type="button" data-reset-profile hidden>清除</button><button class="btn primary" type="submit">生成推荐榜</button></div>'+
      '<dialog class="need-options" id="need-options" aria-labelledby="need-options-title"><header><h2 id="need-options-title">补充条件</h2><button type="button" data-close-options aria-label="关闭补充条件">×</button></header><div class="need-option-body"><div class="career-fields">'+
      select('goal','细化条款查询',[['','按我的描述'],['admission','指定推免院系'],['employment','指定招聘岗位']])+input('cohort','毕业届别')+
      select('weight','目标权重',[['50','50%（默认）'],['35','35%'],['70','70%']])+'</div>'+
      '<div class="career-fields" data-fields="admission">'+input('school','本科所在学校','p-schools')+input('unit','本科所在院系','p-units')+input('place','团队署名顺位')+'</div>'+
      '<div class="career-fields" data-fields="employment">'+input('job','目标岗位或方向')+input('company','目标公司')+
      select('degree','求职时学历',[['','从描述中识别'],...['专科','本科','硕士','博士'].map(s=>[s,s])])+select('profile','求职偏好',[['','从描述中识别'],...Object.entries(model.profiles).map(([k,v])=>[k,v.name])])+'</div>'+
      '<div class="career-fields">'+select('award','奖级',[['','从描述中识别'],['nat1','全国一等奖'],['nat2','全国二等奖'],['nat3','全国三等奖'],['prov1','省级一等奖'],['prov2','省级二等奖'],['prov3','省级三等奖']])+'</div>'+
      '<fieldset class="participation-fields"><legend>参赛条件</legend><div class="career-fields">'+input('major','所学专业')+input('eventYear','参赛年份')+
      select('weekday','每周可参赛日',[['','从描述中识别'],['weekend','周末'],['workday','周一至周五']])+input('maxHours','单场最长时间（小时）')+'</div><div class="career-fields">'+
      select('dateMode','日期含义',[['','从描述中识别'],['available','可参赛'],['avoid','需避开']])+date('dateStart','开始日期')+date('dateEnd','结束日期')+
      select('timePriority','时间要求',[['','从描述中识别'],['require','必须满足'],['prefer','优先考虑']])+'</div></fieldset></div><div class="need-option-foot"><button class="btn primary" type="button" data-close-options>完成</button></div></dialog>'+
      list('p-schools',model.policyScopes.map(d=>d.school))+list('p-units',model.policyScopes.map(d=>d.unit))+
      '</form><p class="career-caption" aria-live="polite" data-profile-status></p>';
    const f=host.querySelector('form'),status=host.querySelector('[data-profile-status]'),submit=f.querySelector('[type=submit]');
    let controller,personalActive=false;
    const dialog=f.querySelector('.need-options'),more=f.querySelector('.need-more'),clear=f.querySelector('[data-reset-profile]');
    more.onclick=()=>dialog.showModal();
    dialog.querySelectorAll('[data-close-options]').forEach(button=>button.onclick=()=>dialog.close());
    dialog.addEventListener('invalid',()=>{if(!dialog.open)dialog.showModal();},true);
    function showActions(){
      const changed=Array.from(f.elements).some(el=>
        el.tagName==='SELECT'?el.value!==el.options[0]?.value:('defaultValue' in el&&el.type!=='button'&&el.value!==el.defaultValue));
      clear.hidden=!changed&&!personalActive;
      clear.textContent=personalActive?'恢复通用榜':'清除';
    }
    function syncExtras(){
      for(const group of f.querySelectorAll('[data-fields]')){
        group.hidden=!!f.elements.goal.value && group.dataset.fields!==f.elements.goal.value;
        for(const el of group.querySelectorAll('input,select'))el.disabled=group.hidden;
      }
    }
    f.elements.cohort.pattern=f.elements.eventYear.pattern='20[0-9]{2}';f.elements.place.pattern='[1-9][0-9]?';
    f.elements.goal.onchange=syncExtras;
    f.elements.school.onchange=()=>{const school=f.elements.school.value.trim();f.querySelector('#p-units').outerHTML=list('p-units',model.policyScopes.filter(d=>!school||d.school===school).map(d=>d.unit));};
    f.oninput=()=>{controller?.abort();submit.disabled=false;status.textContent='';showActions();};
    clear.onclick=()=>{
      controller?.abort();f.reset();syncExtras();f.elements.school.onchange();if(dialog.open)dialog.close();submit.disabled=false;status.textContent='';personalActive=false;showActions();setPersonal(false);
      f.elements.need.focus();
    };
    f.onsubmit=async e=>{
      e.preventDefault();
      if(dialog.open){dialog.close();return;}
      const fields=Object.fromEntries(new FormData(f));
      if(![fields.need.trim(),fields.goal,fields.major,fields.dateStart,fields.dateEnd,fields.weekday,fields.eventYear,fields.maxHours].some(Boolean)){status.textContent='请写下需求或填写参赛条件。';f.elements.need.focus();return;}
      if(!fields.need.trim())delete fields.need;
      if(!fields.need){fields.cohort||=String(model.policyCohort);fields.profile||='explore';}
      controller?.abort();const own=new AbortController();controller=own;
      submit.disabled=true;status.textContent='正在检索原文并更新排名…';
      try{
        const r=await fetch('/functions/v1/app/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields),signal:own.signal});
        const data=await r.json();if(!r.ok)throw Error(data.error||'查询失败');
        if(!own.signal.aborted&&f.isConnected){personalActive=true;showActions();setPersonal(true);result.innerHTML=render(data);status.textContent='排名已更新。';}
      }catch(err){if(!own.signal.aborted)status.textContent=err.message;}
      finally{if(controller===own)submit.disabled=false;}
    };
    return ()=>controller?.abort();
  }
  function render(data){
    const p=data.profile,admission=p.goal==='admission';
    const verified=data.pages.filter(x=>x.status==='已读取网页').length;
    const a=p.participation,t=a?.time;
    const timeLabels={match:'相符',unknown:'待核',conflict:'冲突'};
    const criteriaText=[a?.major,a?.year?a.year+' 年参赛':'',t?.start?(t.mode==='available'?'可参赛 ':'避开 ')+t.start+' 至 '+t.end:'',
      t?.weekday==='weekend'?'周末可参赛':t?.weekday==='workday'?'周一至周五可参赛':'',t?.maxHours?'单场最多 '+t.maxHours+' 小时':'',t?.unresolved,t?(t.priority==='prefer'?'时间优先考虑':'时间必须满足'):''].filter(Boolean).join(' · ');
    const conditionCopy=a?'<p class="career-caption"><b>我的参赛条件</b>　'+esc(criteriaText)+'</p><p class="career-caption">按已核赛项和阶段核对。必需条件待核或冲突时暂缓个人排名。时间偏好依次展示相符、待核和冲突的赛事，各组内沿用原排序。</p>':'';
    const statusText=fit=>fit?.checks.map(c=>c.label+' '+timeLabels[c.state]).join(' · ')||'';
    const fitDetails=fit=>fit?'<h3>参赛条件核对</h3>'+fit.checks.map(c=>'<div class="career-proof"><b>'+esc(c.label+' · '+timeLabels[c.state])+'</b><p>'+esc(c.note)+'</p>'+
      (c.url?link(c.url,'查看准入原文'):'')+(c.choices||[]).map(s=>'<p><b>'+esc(s.label+' · '+timeLabels[s.state])+'</b>　'+esc(s.note)+'　'+link(s.url,'查看赛程原文')+'</p>').join('')+'</div>').join(''):'';
    const groupTable=(rows,labels,scoreLabel,title)=>{
      const table=(items,name)=>window.JinghengCareer.rankingTable(items,labels,scoreLabel,name);
      const ranked=rows.filter(r=>r.rank!=null),pending=rows.filter(r=>r.rank==null&&r.fit?.status!=='conflict'),conflicts=rows.filter(r=>r.fit?.status==='conflict');
      return (ranked.length?table(ranked,title):'<p class="rs-empty">当前没有足够证据确认符合条件的赛事。</p>')+
        (pending.length?'<h3 class="rank-section-title">条件或证据待核</h3>'+table(pending,'待核赛事'):'')+
        (conflicts.length?'<h3 class="rank-section-title">与必需条件冲突</h3>'+table(conflicts,'条件冲突的赛事'):'');
    };
    if(p.goal==='open'){
      const rows=data.rows.map(r=>({...r,score:r.base,metrics:[r.covered.length+' / '+p.wishes.length],
        subtitle:[statusText(r.fit),r.covered.join('、')].filter(Boolean).join(' · '),
        detail:fitDetails(r.fit)+(r.missing.length?'<p>尚待核对　'+esc(r.missing.join('、'))+'</p>':'')+
          r.evidence.map(e=>'<div class="career-proof"><b>'+esc(e.wish)+'</b><p>'+esc(e.detail)+'</p><p>'+esc(e.source)+'　'+link(e.url,e.title)+'</p></div>').join('')}));
      return window.JinghengCareer.rankingHeading(rows.filter(r=>r.rank!=null).length+' 项已排名')+
        '<p class="career-caption"><b>你的需求</b>　'+esc(p.need)+'</p>'+conditionCopy+
        '<p class="career-caption">按有原文支持的需求项数排序，同数时参考通用分。'+
        (p.wishes.some(w=>w.kind==='admission')&&(!p.school||!p.unit)?'推免条款列明适用院校，个人资格须结合本科院系核对。':'')+'</p>'+
        (rows.length?groupTable(rows,['有据需求'],'通用分','按自由需求匹配的赛事'):'<p class="rs-empty">已按你的原话检索，目前没有找到能支持这些需求的赛事材料。</p>')+
        '<details class="emp-guide"><summary>本次检索与依据</summary><p>'+esc(data.query)+'</p><p>'+esc(data.lookup.map(s=>s.provider+' · '+s.status).join('　'))+'</p>'+
        data.pages.map(s=>'<p>'+link(s.url,s.title||s.url)+'　'+esc(s.status)+'</p>').join('')+'</details>';
    }
    if(p.goal==='interest'||p.goal==='participation'){
      const interest=p.goal==='interest';
      const rows=data.rows.map(r=>({...r,score:r.base,metrics:interest?[r.topics.length,r.evidence.length]:r.fit.checks.map(c=>timeLabels[c.state]),
        subtitle:[statusText(r.fit),r.topics?.join(' · ')].filter(Boolean).join(' · '),
        detail:fitDetails(r.fit)+(r.evidence||[]).map(e=>'<div class="career-proof"><b>'+esc(e.source)+'</b><p>'+esc(e.detail)+'</p>'+link(e.url,e.title)+'</div>').join('')}));
      return window.JinghengCareer.rankingHeading(rows.filter(r=>r.rank!=null).length+' 项已排名')+conditionCopy+
        (interest?'<p class="career-caption">按原文匹配的主题词数量排序，同数按已核通用分排序。主题词为 '+esc(p.topics.join('、'))+'。'+(p.excluded.length?'排除 '+esc(p.excluded.join('、'))+'。':'')+'</p>':'<p class="career-caption">条件相同的赛事按已有通用分排序，通用分待评的赛事列在其后。</p>')+
        groupTable(rows,interest?['主题词数','来源数']:data.rows[0]?.fit.checks.map(c=>c.label)||[],'通用分','按我的需求选赛')+
        '<details class="emp-guide"><summary>本次检索</summary><p>'+esc(data.query)+'</p><p>'+esc(data.lookup.map(l=>l.provider+' · '+l.status).join('　'))+'</p><p>本轮取得 '+verified+' 个可解析网页。</p></details>';
    }
    const criteria=[p.referenceCohort?'参考 '+p.cohort+' 届公开资料':p.cohort+' 届',...(admission?[p.school,p.unit]:[p.company,p.job,p.degree]),
      ({nat1:'全国一等奖',nat2:'全国二等奖',nat3:'全国三等奖',prov1:'省级一等奖',prov2:'省级二等奖',prov3:'省级三等奖'})[p.award],
      admission&&p.place?'团队顺位 '+p.place:''].filter(Boolean);
    function personalRow(r){
      const range=r.rankRange?'<p class="career-caption">目标权重取 35%、50%、70% 时，'+(r.rankRange[0]===r.rankRange[1]?'均列第 '+r.rankRange[0]+' 名。':'排名在第 '+r.rankRange[0]+' 至 '+r.rankRange[1]+' 名之间。')+'</p>':'';
      const proofs=r.evidence.map(c=>'<div class="career-proof"><b>'+esc(c.title)+'</b><p>'+esc(c.detail)+'</p>'+
        (c.calculation?'<p>'+esc(c.calculation)+'</p>':'')+(c.notes?'<p>'+esc(c.notes)+'</p>':'')+
        '<p class="career-meta">'+esc([c.source,c.confidence,c.status,c.locator].filter(Boolean).join(' · '))+'</p>'+
        link(c.url,'核对原文')+(c.attachment?'　'+link(c.attachment.url,c.attachment.title):'')+(c.corroboration?'　'+link(c.corroboration.url,c.corroboration.title):'')+'</div>').join('');
      return {...r,metrics:[r.base,r.quality,r.target],subtitle:[statusText(r.fit),r.confidence].filter(Boolean).join(' · '),
        detail:fitDetails(r.fit)+'<h3>适用条件与原文（'+r.evidence.length+' 条）</h3><p>'+esc(r.state)+'</p>'+range+proofs};
    }
    const ranked=data.rows.filter(r=>r.rank!==null),pending=data.rows.filter(r=>r.rank===null);
    return window.JinghengCareer.rankingHeading(ranked.length+' 项已排名 · '+pending.length+' 项暂缓')+conditionCopy+
      '<p class="career-caption">当前依据　'+esc(criteria.join(' · '))+'</p>'+
      '<p class="career-caption">推荐度＝赛制质量 × '+(100-p.weight)+'% ＋ '+(admission?'本院系推免条款适配':'目标岗位适配')+' × '+p.weight+'%。'+
      (admission?'未填奖级时按达到条款门槛规划；主力身份、学业成绩、名额和院系审核仍以原文为准。':'待遇、独立雇主覆盖与奖级门槛按所选求职偏好加权。')+' 同分并列。</p>'+
      '<p class="career-caption">本轮核对 '+data.pool+' 个候选名称，取得 '+verified+' 个可解析网页；'+(verified?'已核档案与本轮提取分别标注。':'当前结果仅可能来自已核档案。')+'</p>'+
      groupTable(data.rows.map(personalRow),['通用分','赛制质量','目标适配'],'推荐度','个人推荐度排名')+
      '<details class="emp-guide"><summary>本次检索与置信度</summary><p>'+esc(data.query)+'</p><p>'+esc(data.lookup.map(l=>l.provider+' · '+l.status+'（'+l.count+' 条候选）').join('　'))+'</p>'+
      data.pages.map(x=>'<div class="lookup-row">'+link(x.url,x.title||x.url)+'<span>'+esc(x.status)+'</span></div>').join('')+
      '<p>正式规则或可追溯的适用岗位条款支持本单位的条件性判断。自动匹配为中置信；待定稿、条件未对齐、正负冲突均暂缓。置信标签只描述证据，不能换算为个人录用或推免概率。</p></details>';
  }
  window.JinghengPersonal={mount};
})();
