(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const kinds = {policy:'企业招聘条款', outcome:'校方披露去向', community:'社区自述'};
  let data;
  const filters = {search:'', kind:'', size:''};
  const normalize = s => s.normalize('NFKC').replace(/\s/g,'').toLowerCase();
  const options = pairs => pairs.map(([v,label]) => '<option value="'+esc(v)+'">'+esc(label)+'</option>').join('');
  const link = ([label,url]) => '<a class="source-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';

  function filtered() {
    const words = filters.search.trim().split(/\s+/).filter(Boolean).map(normalize);
    return data.records.filter(row => {
      const org = data.organizations[row.org];
    const fields = [org.name, row.role, ...(row.roleTerms || []), ...row.events.flatMap(e => data.events[e]),
        row.award, row.period, row.stage || '', row.effect || '', org.size || ''].map(normalize);
      return (!filters.kind || row.kind === filters.kind) && (!filters.size || org.hundreds) &&
        words.every(word => fields.some(field => field.includes(word)));
    });
  }
  function summary(rows) {
    const count = (subset,key) => new Set(subset.map(r => r[key])).size;
    const policies = rows.filter(r => r.kind === 'policy');
    const outcomes = rows.filter(r => r.kind === 'outcome');
    const metrics = [
      [count(policies,'org'), '明文采信的招聘方', '联合简章按一个招聘方计算'],
      [count(outcomes,'person'), '校方披露的获奖者', '同一人多次获奖只计一次'],
      [rows.filter(r => r.kind === 'community').length, '社区自述', '单列待核，独立于前两项']
    ];
    return metrics.map(([n,title,detail]) => '<article class="emp-stat"><h3>'+title+'</h3><strong>'+n+'</strong><p>'+detail+'</p></article>').join('');
  }
  function record(row) {
    const org = data.organizations[row.org];
    const labels = row.events.map(id => data.events[id][0]).join('、');
    const confidence = {policy:'招聘条款可核',outcome:'校方单源披露',community:'个人陈述，待独立核实'}[row.kind];
    const school = data.schools.filter(s => row.events.includes(s.event)).map(s =>
      '<p class="emp-school">同项校内对照 · '+esc(s.name)+' '+esc(s.year)+' 年 '+esc(s.level)+'　'+link(data.sources[s.source])+'</p>').join('');
    return '<article class="emp-record"><header><span class="emp-type '+row.kind+'">'+esc(kinds[row.kind])+'</span><span>'+esc(row.period)+'</span></header>'+
      '<h3>'+esc(org.name)+'</h3><p class="emp-role">'+esc(row.role)+'</p>'+
      '<p><b>'+esc(labels)+'</b> · '+esc(row.award)+'</p><p>'+esc(row.note)+'</p>'+
      '<dl><dt>证据状态</dt><dd>'+esc(confidence)+'</dd><dt>'+ (row.kind==='policy'?'条款力度':'披露进展')+'</dt><dd>'+
      esc(row.kind==='policy'?(row.effect==='直通'?'90 / 100 · 直通面试':'75 / 100 · 优先或加分项'):row.stage)+'</dd>'+
      (org.size?'<dt>企业规模</dt><dd>'+esc(org.size)+' · '+esc(org.sizeBasis)+'</dd>':'')+'</dl>'+
      (row.claims?'<details class="emp-claims"><summary>逐项核验</summary><dl>'+row.claims.map(([claim,status])=>'<dt>'+esc(claim)+'</dt><dd>'+esc(status)+'</dd>').join('')+'</dl></details>':'')+
      '<div class="emp-sources">'+row.sources.map(id=>link(data.sources[id])).join('')+'</div>'+school+'</article>';
  }
  function draw() {
    const region = document.querySelector('#employment-results');
    if (!region || !data) return;
    const rows = filtered();
    region.innerHTML = '<div class="emp-stats">'+summary(rows)+'</div><div class="rs-section-head"><h2>证据明细</h2><span role="status">'+rows.length+' 条符合条件</span></div>'+
      (rows.length?'<div class="emp-grid">'+rows.map(record).join('')+'</div>':'<p class="rs-empty">当前样本没有匹配记录。可以清除筛选或到联网检索中查找新来源。</p>');
  }
  const guide = '<details class="emp-guide"><summary>论坛评论的可信度怎么判断？</summary>'+
    '<ol><li><b>转述或信息不足 · 线索。</b>“听说这比赛大厂认”可用来寻找原文。点赞数、回帖量和转载次数都不给结论加权。</li>'+
    '<li><b>当事人原帖 · 自述。</b>逐项记录公司、岗位、届别、奖项和进展，缺失项标为待核。区分实习与全职、面试邀请、offer、签约及入职。同一作者的截图、跨站搬运均合并。</li>'+
    '<li><b>独立证据 · 只升级能对上的事实。</b>官方获奖名单只核奖项。学校或用人单位还需把同一人、同一公司和同一次求职对应起来，才能核实去向。岗位简章可以证明企业偏好。</li>'+
    '<li><b>同一事实有矛盾 · 暂缓计入。</b>先排除实习与校招、不同届别等差异，再保留各方原文和争议点。公开成功案例缺少落选者分母，无法据此估算录用率。</li></ol></details>';
  async function mount(target) {
    target.innerHTML = '<section class="intro"><div><h1>就业证据</h1><p>按赛事、公司或岗位查找招聘条款、签约去向和求职者自述。</p></div></section>'+
      '<section class="emp-tools panel"><label>搜索<input type="search" id="emp-search" placeholder="如 蓝桥杯、石犀、芯片研发"></label>'+
      '<label>证据类型<select id="emp-kind">'+options([['','全部证据'],...Object.entries(kinds)])+'</select></label>'+
      '<label>企业规模<select id="emp-size">'+options([['','全部规模'],['hundreds','已披露百人规模']])+'</select></label>'+
      '<button id="emp-reset" type="button" class="btn">清除筛选</button></section>'+guide+'<div id="employment-results"><p role="status">正在读取就业证据…</p></div>'+
      '<p class="emp-foot" id="employment-review"></p>';
    const controls = {search:target.querySelector('#emp-search'),kind:target.querySelector('#emp-kind'),size:target.querySelector('#emp-size')};
    for (const [key,control] of Object.entries(controls)) {
      control.value=filters[key];
      control.addEventListener(key==='search'?'input':'change',()=>{filters[key]=control.value;draw();});
    }
    target.querySelector('#emp-reset').onclick=()=>{
      for (const [key,control] of Object.entries(controls)) {filters[key]='';control.value='';}
      draw();
    };
    const region=target.querySelector('#employment-results');
    try {
      if (!data) {
        const response = await fetch('/functions/v1/app/api/employment');
        if (!response.ok) throw Error();
        data = await response.json();
      }
      if (!region.isConnected) return;
      draw();
      target.querySelector('#employment-review').textContent='样本核对日期 '+data.reviewed+' · 分值表示公开条款的力度。招聘存档保留原届别，岗位开放状态以企业为准。';
    } catch {
      if (region.isConnected) region.innerHTML='<p class="rs-empty">就业证据未能载入。<button class="btn" type="button">重试</button></p>';
      const retry=region.querySelector('button');
      if (retry) retry.onclick=()=>mount(target);
    }
  }
  window.JinghengEmployment={mount};
})();
