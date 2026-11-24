(() => {
  const normal=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  const key=s=>normal(s).replace(/全国|中国|大学生|国际|竞赛|大赛/g,'');
  const extra={cumcm:['数模国赛','国赛数模','高教社杯','本科数模'],graduateMath:['研究生数模','华为杯研究生数学建模'],
    lanqiao:['lanqiaobei','蓝桥'],nuedc:['大学生电赛'],computer:['计设大赛'],sanchuang:['三创挑战赛']};
  // Adjacent transpositions count as one edit, as do a deletion, insertion or replacement.
  function distance(a,b){
    let previous=Array.from({length:b.length+1},(_,j)=>j),older=previous;
    for(let i=1;i<=a.length;i++){
      const row=[i];
      for(let j=1;j<=b.length;j++){
        row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1]!==b[j-1]));
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);
      }
      older=previous;previous=row;
    }
    return previous[b.length];
  }
  function lookup(query,entries=window.JinghengEventDirectory){
    const q=normal(query),tokens=query.trim().split(/[\s，、]+/u).map(normal).filter(Boolean),needle=key(query);
    const exact=[],partial=[],near=[];
    if(!q)return {exact,partial,near};
    for(const [id,list] of Object.entries(entries)){
      const labels=list.concat(extra[id]||[]),names=labels.map(normal),hit={id,name:list[0]};
      if(names.includes(q)){exact.push(hit);continue;}
      if(names.some(n=>n.includes(q))||tokens.length>1&&tokens.every(t=>names.some(n=>n.includes(t)))){partial.push(hit);continue;}
      if(needle.length<2)continue;
      const limit=Math.min(3,Math.max(1,Math.floor(needle.length/4)));
      let best=0;
      for(const label of labels){
        const base=key(label);
        if(needle.length===2&&base.length!==3)continue;
        if(Math.abs(needle.length-base.length)>limit)continue;
        const edits=distance(needle,base);
        if(edits<=limit)best=Math.max(best,1-edits/Math.max(base.length,needle.length));
      }
      if(best>=.66)near.push({...hit,similarity:best});
    }
    near.sort((a,b)=>b.similarity-a.similarity||a.name.localeCompare(b.name,'zh'));
    return {exact,partial,near:near.slice(0,3)};
  }
  function prompt(items,esc,original=false){
    if(!items.length)return '';
    return '<div class="search-correction" role="group" aria-label="赛事名称建议"><span>你是不是想搜</span>'+
      items.slice(0,5).map(x=>'<button type="button" data-suggest-name="'+esc(x.name)+'">'+esc(x.name)+'</button>').join('')+
      (original?'<button type="button" class="keep-query" data-keep-query>按原词检索</button>':'')+'</div>';
  }
  window.JinghengSearch={lookup,prompt};
})();
