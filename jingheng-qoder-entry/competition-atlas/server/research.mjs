const PDF='https://statics.scnu.edu.cn/pics/xsb/2025/0103/1735893141731811.pdf';
const digest='1af69dd6b5a29fa52f55a4c30896e0d324dadda0657bbaee714a77b86b059c02';
const editions=[
  {url:PDF,title:'《2024全国普通高校大学生竞赛分析报告》竞赛目录',year:'2024',publisher:'全国普通高校大学生竞赛分析报告（华南师范大学存档）',catalogType:'全国分析目录'},
  {url:'https://seee.sues.edu.cn/_t189/61/9d/c11025a287133/page.htm',year:'2025',publisher:'上海工程技术大学',catalogType:'校级分级目录'}
];
const coreSources={
  recommendation:[
    {url:'https://notice.ysu.edu.cn/info/2264/25244.htm',publisher:'燕山大学',only:'全国大学生数学建模竞赛'},
    {url:'https://cre.ucas.edu.cn/index.php/zh-CN/bkyd/bkxwgg/12241-2026-08-26-02-03-39',publisher:'中国科学院大学资源与环境学院'},
    {url:'https://maths.swjtu.edu.cn/info/1149/5367.htm',publisher:'西南交通大学数学学院',year:'2018'}
  ],
  employment:[
    {url:'https://thu.ncss.cn/student/jobs/CfaudQtT4VZrMJzD7CLaG/detail.html',publisher:'深圳市默贝克驱动技术有限公司',only:'全国大学生电子设计竞赛'},
    {url:'https://career.hznu.edu.cn/job/view/id/1028006',only:'全国大学生电子设计竞赛'},
    {url:'https://jobs.ecoflow.com/602892/m/position/7678913209302780223/detail',only:'全国大学生电子设计竞赛',publisher:'正浩创新'}
  ],exam:[
    {url:'https://dqxy.ntu.edu.cn/2026/0321/c1570a287730/page.htm',publisher:'南通大学电气与自动化学院'},
    {url:'https://ele.cdu.edu.cn/info/1061/10848.htm',publisher:'成都大学电子信息与电气工程学院'}
  ],catalog:editions
};
const tracks={
  exam:{label:'考研统考复试',query:'硕士研究生 复试录取 材料 获奖 site:edu.cn'},
  recommendation:{label:'推荐免试',query:'推免 加分 细则 site:edu.cn'},
  employment:{label:'求职招聘',query:'招聘 岗位 获奖 优先'},
  catalog:{label:'榜单与目录',query:'学科竞赛 竞赛目录 分级 site:edu.cn'}
};
const fold=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s“”‘’"'·《》]/g,'');
const awardFold=s=>fold(s).replace(/国家级|全国赛|国家赛|国赛/g,'全国').replace(/省级|省赛|省部级/g,'省');
const aliases=[
  ['全国大学生数学建模竞赛','CUMCM','高教社杯全国大学生数学建模竞赛'],
  ['全国大学生电子设计竞赛','NUEDC'],
  ['蓝桥杯全国软件和信息技术专业人才大赛','蓝桥杯'],
  ['ACM-ICPC国际大学生程序设计竞赛','ACM-ICPC','国际大学生程序设计竞赛','ICPC']
];
function terms(s){const found=aliases.find(group=>group.some(v=>fold(v)===fold(s)));return found||[s];}
function hasEvent(text,t){const line=fold(text);return t.some(v=>line.includes(fold(v)))&&!(/青少(年|组)/.test(line)&&t.includes('蓝桥杯'));}
function decodeEntities(s){return s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,v=>{
  const fixed={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
  if(v[1]!=='#')return fixed[v.toLowerCase()]??' ';
  const n=v[2].toLowerCase()==='x'?parseInt(v.slice(3),16):parseInt(v.slice(2),10);
  return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
});}
const flat=s=>decodeEntities(s.replace(/<[^>]{1,2400}>/g,' ')).replace(/\s+/g,' ').trim();
function documentText(html){
  const title=flat(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,220);
  let main=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  main=main.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,(_,row)=>'\n'+[...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(x=>flat(x[1])).join(' ｜ ')+'\n');
  const lines=main.replace(/<\/?(?:p|div|li|br|h[1-6]|section|article)\b[^>]*>/gi,'\n').split('\n').map(flat).filter(x=>x.length>1);
  const posted=html.match(/(?:article:published_time|publishdate|PubDate|datePublished)["'][^>]{0,70}?(20\d{2})/i)?.[1]||lines.join(' ').match(/(?:发布时间|发布日期|发布时间为|发布于|发稿时间|时间)\s*[:：]?\s*(20\d{2})[年.\/-]/)?.[1];
  return {title,lines,year:title.match(/(20\d{2})\s*(?:年|届|版)/)?.[1]||posted||''};
}
function publicSource(url){
  try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.port||u.username||u.password)return null;
    const h=u.hostname.toLowerCase();
    if(!/(?:^|\.)(?:edu\.cn|gov\.cn|org\.cn|ncss\.cn|ccen\.com\.cn|cahe\.edu\.cn|moocollege\.com|zhiye\.com)$/.test(h)&&! /^(career|careers|jobs|campus|join|recruit|zhaopin|hr)\.[a-z0-9-]+\.(?:com|cn|com\.cn)$/.test(h))return null;
    if(/(?:^|\.)(?:localhost|internal|local)(?:\.|$)/.test(h))return null;
    u.protocol='https:';u.hash='';return u.href;
  }catch{return null;}
}
const searchHosts=new Set(['www.so.com','html.duckduckgo.com','www.nowcoder.com']);
async function readRemote(start,search=false){
  let address=start;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{
    for(let hop=0;hop<3;hop++){
      if(search?!searchHosts.has(new URL(address).hostname):!publicSource(address))throw Error('来源范围受限');
      const r=await fetch(address,{signal:controller.signal,redirect:'manual',headers:{'Accept':'text/html,application/pdf;q=0.9,*/*;q=0.5','Accept-Language':'zh-CN,zh;q=0.9,en;q=0.5'}});
      if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');if(!location)throw Error('原文重定向异常');address=new URL(location,address).href;continue;}
      if(!r.ok||!r.body)throw Error('来源返回 HTTP '+r.status);
      const limit=search?950000:1250000;const reader=r.body.getReader(),chunks=[];let length=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('原文超出读取范围');}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const mime=r.headers.get('content-type')||'';
      const sniff=new TextDecoder().decode(bytes.subarray(0,1300));
      if(mime.includes('application/pdf')||sniff.startsWith('%PDF'))return {url:address,bytes,pdf:true};
      if(!/html|text\/plain/i.test(mime)&&!/<(?:!doctype|html|head)/i.test(sniff))throw Error('原文格式待核');
      const charset=(mime.match(/charset\s*=\s*["']?([\w-]+)/i)||sniff.match(/charset\s*=\s*["']?([\w-]+)/i))?.[1]||'utf-8';
      return {url:address,html:new TextDecoder(/gb2312|gbk|gb18030/i.test(charset)?'gb18030':'utf-8').decode(bytes)};
    }
    throw Error('原文跳转次数过多');
  }finally{clearTimeout(timer);}
}
const getAttr=(attrs,key)=>decodeEntities(attrs.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'');
function forumPost(raw){
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    if(!/^(?:www\.)?nowcoder\.com$/.test(u.hostname)||!/^\/(?:feed\/main\/detail\/[\da-f]{32}|discuss\/\d+)(?:\/)?$/i.test(u.pathname))return null;
    return 'https://www.nowcoder.com'+u.pathname.replace(/\/$/,'');
  }catch{return null;}
}
async function searchCommunity(input){
  const query=[input.event,input.employer,input.job,input.award,input.year,'offer'].filter(Boolean).join(' ');
  const origin='https://www.nowcoder.com';
  const links=new Map();
  try{
    const {html}=await readRemote(origin+'/search/all?query='+encodeURIComponent(query),true);
    const posts=/<a\b([^>]{1,1400})>([\s\S]{1,420}?)<\/a>/gi;
    for(const [,attrs,body] of html.matchAll(posts)){
      const path=getAttr(attrs,'href');
      if(!/^\/(?:feed\/main\/detail\/|discuss\/)/.test(path))continue;
      const url=forumPost(origin+path),title=flat(body);
      if(url&&title&&title.length<=100&&!links.has(url))links.set(url,{url,title});
      if(links.size===4)break;
    }
    if(links.size)return {query,status:'牛客公开搜索 · 已检索',links:[...links.values()]};
  }catch{}
  try{
    const scoped=query+' site:nowcoder.com';
    const r=await discover(scoped,'360 搜索',true);
    return {query:scoped,status:'360 搜索 · '+r.status,links:[...new Map(r.found.map(v=>[v.url,v])).values()].slice(0,4)};
  }catch{return {query,status:'检索服务暂不可用',links:[]};}
}
async function discover(query,provider,forum=false){
  const ddg=provider==='DuckDuckGo',url=(ddg?'https://html.duckduckgo.com/html/?q=':'https://www.so.com/s?q=')+encodeURIComponent(query);
  const {html}=await readRemote(url,true),found=[];
  const re=ddg?/<a\b([^>]*\bclass=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi:/<h3\b[^>]*class=["'][^"']*res-title[^"']*["'][^>]*>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let parsed=0;for(const m of html.matchAll(re)){parsed++;let href=getAttr(m[1],ddg?'href':'data-mdurl');if(ddg&&href){try{const u=new URL(href,url);href=u.searchParams.get('uddg')||u.href;}catch{continue;}}
    const target=forum?forumPost(href):publicSource(href);if(target)found.push({url:target,title:flat(m[2])});if(parsed>=14)break;}
  const blocked=/anomaly-modal|captcha|访问验证|安全验证|机器人验证/i.test(html.slice(0,12000))&&!parsed;
  return {found,provider,status:parsed?'已检索':blocked?'检索受限':'未取到结果页'};
}
function queryFor(i,track){
  const target=track==='employment'?[i.employer,i.job]:track==='catalog'?[]:[i.school];
  return [terms(i.event)[0],...target,i.year,track==='catalog'?'':i.award,tracks[track].query].filter(Boolean).join(' ');
}
const proofNames={0:'条款明确排除',30:'可作为申请材料',50:'纳入评议或遴选',75:'明确优先或计入加分',90:'明确分值或直通环节',60:'校级目录收录',80:'全国统计目录收录'};
function effect(line){
  if(/(?:不(?:予|得|能|再)?(?:加分|计分|作为.{0,10}(?:依据|条件))|不纳入|不计入|不享受.{0,5}加分|取消.{0,6}加分)/.test(line))return 0;
  if(/(?:加|计|记|赋|奖励)\s*\d+(?:\.\d+)?\s*分|(?:直通|直接进入|免去|免除).{0,8}(?:面试|终面|笔试)/.test(line))return 90;
  if(/优先(?:录用|考虑|推荐|入选)?|绩点加分|予以加分|可加分|加分项|计入.{0,10}成绩|给予.{0,8}加分/.test(line))return 75;
  if(/纳入.{0,8}(?:评价|评议|遴选)|列为.{0,5}(?:条件|依据)|作为.{0,8}(?:依据|条件)|予以认定/.test(line))return 50;
  if(/(?:可|须|需|可另行|可以)?提交.{0,14}(?:获奖|证明|证书|材料)|作为.{0,8}(?:材料|参考)/.test(line))return 30;
  return null;
}
function matchTier(line,award){
  if(!award)return true;
  const text=awardFold(line),wanted=awardFold(award);
  if(text.includes(wanted))return true;
  if(/(?:省|全国|校)[一二三特]等奖|[一二三特]等奖|[金银铜]奖|[金银铜]牌|国家级|省级/.test(line))return false;
  return /获奖(?:者|经历|选手|学生|团队)|并获奖|有获奖|获得.{0,3}奖项/.test(line);
}
const fixedQuery=(v,max=80)=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,max):'';
function parseInput(b){
  if(!b||!Object.hasOwn(tracks,b.track))throw Error('请选择一个有效维度。');
  const i=Object.fromEntries(['event','school','job','employer','award','year'].map(k=>[k,fixedQuery(b[k])]));
  if(i.event.length<2||!/[\p{L}\p{N}]/u.test(i.event)||i.year&&!/^(?:19|20)\d{2}$/.test(i.year))throw Error('请填写可识别的赛事名，年份使用四位数字。');
  if(['竞赛','大赛','数学建模','挑战杯','一等奖','大学生竞赛','设计大赛'].includes(i.event))throw Error('这个名称可能对应多项赛事，请填写具体赛项全称。');
  const similar=catalog.filter(row=>hasEvent(row[2],terms(i.event)));
  const knownEmployment=b.track==='employment'&&Object.values(employmentData.events).some(names=>names.some(n=>fold(n)===fold(i.event)));
  if(!knownEmployment&&similar.length>1&&!similar.some(row=>fold(row[2])===fold(i.event))&&!aliases.some(group=>group.some(x=>fold(x)===fold(i.event))))throw Error('名称匹配多项赛事，请使用具体赛事全称，例如“'+similar[0][2]+'”。');
  return {...i,track:b.track};
}
function candidateLines(doc,t){
  const lines=doc.lines.flatMap(line=>line.length>220?line.split(/(?<=[。；;！!?])|\s{2,}/u):[line]);
  return lines.filter(line=>line.length<750&&hasEvent(line,t));
}
function inspectDoc(doc,item,input){
  const {track,school,job,employer,award,year}=input,t=terms(input.event);
  const host=new URL(item.url).hostname,title=doc.title||item.title||host,issuer=item.publisher||title.split(/\s*[-_｜|]\s*/).at(-1)||host;
  const info={url:item.url,title,publisher:issuer===title&&!item.publisher?host:issuer,year:item.year||doc.year||'',status:'未见对应条款'};
  if(!doc.lines.length||/验证码|访问验证|安全验证|access denied|captcha|页面不存在|找不到页面/i.test(title))return {...info,status:'原文未开放或无法解析'};
  const candidates=candidateLines(doc,t),focused=hasEvent(title,t);
  if(year&&year!==info.year)return {...info,status:'资料年份未匹配'};
  const heading=title+' '+(item.publisher||'')+' '+doc.lines.filter(l=>l.length<120).slice(0,5).join(' ');
  const campus=track==='exam'||track==='recommendation';
  if(campus&&school&&!fold(heading).includes(fold(school)))return {...info,status:'院校归属待核'};
  if(!candidates.length&&!focused){
    if(track==='exam'&&/硕士研究生/.test(title)&&/复试/.test(title)&&!/推免|免试/.test(title)&&/\.edu\.cn$/.test(host)){
      const common=doc.lines.find(l=>l.length<440&&/(?:学科|竞赛).{0,5}获奖(?:证书|证明)/.test(l)&&/材料|提供|提交|原件|复印件/.test(l));
      if(common)return {...info,status:'通用复试材料',quote:common};
    }
    return {...info,status:'原文未匹配赛事'};
  }
  if(track==='employment'){
    if(employer&&!fold(heading+' '+doc.lines.filter(l=>l.includes('招聘')&&l.length<100).slice(0,8).join(' ')).includes(fold(employer)))return {...info,status:'招聘单位未匹配'};
    if(job&&!fold(title).includes(fold(job)))return {...info,status:'岗位名称未匹配'};
  }
  function evidence(line,score){return {...info,status:'已匹配',quote:line.trim().slice(0,340),score,rule:proofNames[score]};}
  if(track==='catalog'){
    if(!/目录|清单|分级分类/.test(title)||!/(?:edu\.cn|gov\.cn|org\.cn|moocollege\.com)$/.test(host))return info;
    const hit=candidates.find(l=>l.length<230&&(/｜|^[A-D][1-4][-－]|^\d{1,3}[、.\s]/i.test(l)||item.catalogType&&fold(l)===fold(t[0])));
    return hit?evidence(hit,60):info;
  }
  if(campus&&!/(?:\.edu\.cn|\.gov\.cn)$/.test(host))return info;
  if(track==='exam'&&(!/硕士|研究生招生/.test(title)||!/复试|复试录取/.test(title)||/推免|免试|选拔赛|夏令营/.test(title)))return info;
  if(track==='recommendation'&&!/推免|推荐.{0,16}免试/.test(title)&&!focused)return info;
  if(track==='employment'&&(!/招聘|岗位|工程师|开发|程序员|实习|技术员|研究员|设计师|职位|管培生|专员/.test(title)||/招聘会|就业质量报告|获奖新闻|就业喜报/.test(title)))return info;
  if(track==='employment'&&(/\/(?:hotword|search|joblist|category)(?:\/|\?|$)/i.test(item.url)||!doc.lines.some(l=>/岗位(?:职责|要求)|招聘(?:单位|人数)|职位(?:描述|要求|详情)|任职(?:条件|资格|要求)/.test(l))))return {...info,status:'缺少具体招聘岗位原文'};
  const related=candidates.map(line=>({line,table:line.includes('｜')}));
  if(focused&&track==='recommendation')for(const line of doc.lines)if(line.length<220&&/全国赛|本项竞赛|该项竞赛/.test(line)&&/推免.{0,12}加分/.test(line))related.push({line,table:false});
  const hits=[];
  for(const {line,table} of related){
    if(/咨询|传言|能否|是否|有望|拟申请|建议争取|报名参赛即可/.test(line))continue;
    if(track==='recommendation'&&!/推免|免试/.test(title+' '+line))continue;
    if(track==='exam'&&/推免|免试/.test(line))continue;
    if(!matchTier(line,award))continue;
    let score=effect(line);
    if(score===null&&table&&track==='recommendation'&&/推免|免试/.test(title)&&/国家级|省级|省部级/.test(line))score=50;
    if(score!==null)hits.push(evidence(line,score));
  }
  if(hits.some(h=>h.score===0)&&hits.some(h=>h.score>0))return {...info,status:'文件存在不同条件，请人工复核',strengths:hits.map(h=>h.score)};
  return hits.sort((a,b)=>b.score-a.score)[0]||{...info,status:award?'未核实指定奖级及条款':'未见可量化条款'};
}
async function verify(item,input){
  const fallback={url:item.url,title:item.title||new URL(item.url).hostname,publisher:item.publisher||new URL(item.url).hostname,year:item.year||''};
  try{
    const raw=await readRemote(item.url);
    if(raw.pdf){
      if(item.url!==PDF)return {...fallback,status:'PDF 待核读'};
      const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw.bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(sha!==digest)return {...fallback,status:'目录版本已变更，待复核'};
      if(input.year&&input.year!==item.year)return {...fallback,status:'目录版年未匹配'};
      const matches=catalog.filter(r=>hasEvent(r[2],terms(input.event)));
      if(matches.length!==1)return {...fallback,status:matches.length?'赛项名称不唯一':'此版未匹配赛事'};
      const [page,n,name]=matches[0];return {...fallback,status:'已匹配',score:80,rule:proofNames[80],quote:'第 '+page+' 页 · 序号 '+n+'　'+name,version:'已核对原始 PDF 指纹'};
    }
    return inspectDoc(documentText(raw.html),{...item,url:raw.url},input);
  }catch(e){return {...fallback,status:e.name==='AbortError'||e.name==='TimeoutError'?'原文读取超时':/^来源返回 HTTP |原文|来源范围/.test(e.message)?e.message:'原文暂时无法读取'};}
}
async function research(input){
  const track=input.track,query=queryFor(input,track),lookup=[],t=terms(input.event);
  async function search(provider){try{const r=await discover(query,provider);lookup.push({provider,status:r.status,usable:r.found.length});return r.found;}catch{lookup.push({provider,status:'检索服务暂不可用',usable:0});return [];}}
  const [channels,communitySearch]=await Promise.all([Promise.all([search('360 搜索'),search('DuckDuckGo')]),track==='employment'?searchCommunity(input):null]);
  const found=channels.flat();
  const weight=c=>{
    const title=c.title||'',patterns={exam:/复试|硕士研究生招生/,recommendation:/推免|免试|加分/,employment:/招聘|工程师|职位|岗位/,catalog:/目录|分级|清单/};
    return (patterns[track].test(title)?4:0)+(hasEvent(title,t)?1:0)+(input.school&&title.includes(input.school)?3:0)+(input.job&&title.includes(input.job)?3:0);
  };
  found.sort((a,b)=>weight(b)-weight(a));
  const seeds=coreSources[track].filter(c=>(!c.only||hasEvent(c.only,t))&&(!(track==='recommendation'||track==='exam')||!input.school||!c.publisher||fold(c.publisher).includes(fold(input.school))));
  const urls=new Map();
  const perHost=new Map();
  for(const item of [...seeds,...found]){const host=new URL(item.url).hostname;if(!urls.has(item.url)&&(perHost.get(host)||0)<2){urls.set(item.url,item);perHost.set(host,(perHost.get(host)||0)+1);}}
  const selected=[...urls.values()].slice(0,8),checked=[];
  for(let i=0;i<selected.length;i+=4)checked.push(...await Promise.all(selected.slice(i,i+4).map(item=>verify(item,input))));
  const archived=track==='employment'?archivedEmployment(input):[];
  for(const row of researchArchive(input,checked)){
    if(checked.some(r=>r.url===row.url&&r.status==='文件存在不同条件，请人工复核'))continue;
    const existing=checked.find(r=>r.url===row.url&&r.status===row.status&&r.score===row.score);
    if(!existing)checked.push(row);
    else if(!existing.version)Object.assign(existing,{version:row.version});
  }
  if(communitySearch){
    const reviewed=new Set(archived.filter(row=>row.kind==='community').map(row=>row.url));
    communitySearch.links=communitySearch.links.filter(row=>!reviewed.has(row.url));
  }
  const assessment=researchAssessment(input,checked,archived);
  const incomplete=!lookup.some(l=>l.status==='已检索')||!checked.length||checked.every(x=>/无法|超时|HTTP|受限|未开放/.test(x.status));
  const states={direct:'已核实适用条款',outcome:'有去向记录，岗位优待待核',general:'通用复试材料，专项待遇待核',community:'仅有个人自述',none:incomplete?'检索不完整':'暂无适用证据'};
  return {track,label:tracks[track].label,at:new Date().toISOString(),query,lookup,checked,archived,communitySearch,...assessment,state:assessment.confidence.conflict?'正负条件待拆分':states[assessment.measurement.kind]};
}
