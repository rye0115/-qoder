const chinaToday=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const dayString=(year,month,day)=>[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
function validDay(value){
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
function readParticipation(body,need=''){
  const value=k=>fixedQuery(body[k],80);
  const today=chinaToday(),yearNow=Number(today.slice(0,4));
  const major=value('major')||need.match(/(?:所学专业[是为：:\s]*|(?:我的)?专业[是为：:\s]+)([\p{Script=Han}A-Za-z]{2,20}?)(?:专业|[，。；,\s]|$)/u)?.[1]||
    need.match(/(?:我是|我读(?:的是)?|我学(?:的是)?|就读于?|^|[，,；\s])([\p{Script=Han}A-Za-z]{2,16}?)专业(?:的?学生|本科生|[，,。；\s]|$)/u)?.[1]||'';
  const timeClause=need.split(/[，,。；;！？\n]/).filter(s=>!/(?:时间不限|时间不限制|没有时间限制|时间都可以|随时都可以)/.test(s))
    .filter(s=>/周末|工作日|周[一二三四五六日天]|月\d|[0-9]月|暑假|寒假|小时|没空|有空|备赛时间|撞期|拿奖时间|每周.{0,10}(?:天|晚)|备赛.{0,9}(?:周|天|个月)|时间(?:紧|比较紧)|(?:时间|周期)越短越好/.test(s)).join('，');
  const explicitYear=value('eventYear')||need.match(/(20\d{2})\s*年(?:度)?(?:参赛|参加比赛|的比赛)/)?.[1]||'';
  if(explicitYear&&!/^20\d{2}$/.test(explicitYear))throw Error('请填写四位参赛年份。');
  let year=Number(explicitYear||timeClause.match(/(20\d{2})年(?!毕业|届)/)?.[1]||0);
  if(!year&&/明年|今年|后年/.test(timeClause))year=yearNow+(/后年/.test(timeClause)?2:/明年/.test(timeClause)?1:0);
  let start=value('dateStart'),end=value('dateEnd');
  const hasDates=!!(start||end);
  const mode=value('dateMode')||(/没空|避开|撞期|不能参|无法参|没有时间|不方便/.test(timeClause)?'avoid':'available');
  const priority=value('timePriority')||(/最好|尽量|优先|偏好|倾向/.test(timeClause)?'prefer':'require');
  let weekday=value('weekday');
  if(!weekday&&/周末|工作日/.test(timeClause)){
    const weekend=/周末/.test(timeClause);
    const negative=/(?:周末|工作日)(?:都)?(?:没空|不能|不行|没时间)|(?:避开|排除)(?:周末|工作日)/.test(timeClause);
    weekday=weekend!==negative?'weekend':'workday';
  }
  if(!['available','avoid'].includes(mode)||!['prefer','require'].includes(priority)||!['','weekend','workday'].includes(weekday))throw Error('请检查时间条件。');
  const span=timeClause.match(/(\d{1,2})月(?:(\d{1,2})[日号]?)?(?:\s*(?:至|到|[-~—～])\s*(?:(\d{1,2})月)?(\d{1,2})?[日号]?)?/);
  const cap=timeClause.match(/(?:单场|每场|每次)(?:比赛|考试|参赛)?(?:时长|时间)?(?:最多|不超过|至多|上限|只能|仅能)[为是：:\s]*(\d+(?:\.\d+)?)个?小时/);
  const maxHours=value('maxHours')||cap?.[1]||'';
  if(maxHours&&(!/^\d+(\.\d+)?$/.test(maxHours)||Number(maxHours)<=0||Number(maxHours)>168))throw Error('单场时长请输入大于 0 且不超过 168 的小时数。');
  const remainder=cap?timeClause.replace(cap[0],''):timeClause;
  const complexTime=/小时|备赛|拿奖|出成绩|公示|报名|之前|以前|之后|以后|[日号月]前|[日号月]后|月底|月初|月中|上旬|中旬|下旬|上午|下午|晚上|\d点|暑假|寒假|周[一二三四五六日天]|(?:本|下|这)周末/.test(remainder);
  const manyDates=(timeClause.match(/\d{1,2}月/g)||[]).length>(span?.[3]?2:1)||/[、，和或].{0,3}\d{1,2}[日号]/.test(timeClause);
  let unresolved='';
  if(!hasDates&&span&&!complexTime&&!manyDates){
    const month=Number(span[1]),lastMonth=Number(span[3]||month);
    if(!year)year=yearNow+(month<Number(today.slice(5,7))?1:0);
    start=dayString(year,month,Number(span[2]||1));
    end=dayString(year,lastMonth,Number(span[4]||(!span[3]&&span[2])||new Date(Date.UTC(year,lastMonth,0)).getUTCDate()));
  }else if(timeClause&&(complexTime||manyDates||!hasDates&&!weekday&&!maxHours))unresolved=timeClause;
  if(hasDates&&/^(?:.*?)(?:暑假|寒假)(?:有空|参赛|可以|才能|能参加比赛)?$/.test(timeClause)&&!/小时|备赛/.test(timeClause))unresolved='';
  if(hasDates&&(!start||!end))throw Error('请同时填写开始和结束日期。单日可填写同一天。');
  if(start&&(!validDay(start)||!validDay(end)||end<start))throw Error('请检查日期和先后顺序。');
  if(explicitYear&&start&&(Number(explicitYear)<Number(start.slice(0,4))||Number(explicitYear)>Number(end.slice(0,4))))throw Error('参赛年份与填写的日期范围不一致。');
  if(!start&&!weekday&&!maxHours&&!unresolved&&!major&&!year)return null;
  const time=start||weekday||maxHours||unresolved?{start,end,mode,weekday,priority,unresolved,maxHours:Number(maxHours)||null}:null;
  return {major,year:year||null,time,today};
}

// Compare days only. A contest window does not establish hours of study or attendance.
function timeForSlot(slot,calendar,t){
  const days=[];
  for(let date=new Date(slot.start+'T00:00Z');date.toISOString().slice(0,10)<=slot.end;date.setUTCDate(date.getUTCDate()+1)){
    const day=date.toISOString().slice(0,10),weekend=[0,6].includes(date.getUTCDay());
    const inside=day>=t.start&&day<=t.end;
    days.push((!t.start||(t.mode==='available'?inside:!inside))&&(!t.weekday||(t.weekday==='weekend')===weekend));
  }
  if(!days.some(Boolean))return 'conflict';
  if(!days.every(Boolean)&&calendar.kind==='session')return 'conflict';
  if(t.maxHours&&calendar.hours>t.maxHours)return 'conflict';
  if(t.maxHours&&!calendar.hours||!days.every(Boolean))return 'unknown';
  return 'match';
}
// Admit only a national organizer notice that identifies the edition and an explicit contest window.
function liveMathCalendars(pages){
  const calendars=[];
  for(const page of pages){
    if(!page.doc||!['mcm.edu.cn','www.mcm.edu.cn'].includes(new URL(page.url).hostname))continue;
    const title=page.doc.title+' '+page.doc.lines.slice(0,15).filter(s=>s.length<100).join(' ');
    const edition=title.match(/(20\d{2})\s*年(?:高教社杯|“高教社杯”|\s)*全国大学生数学建模竞赛(?:第[一二三]次通知|通知)/);
    if(!edition||/赛区通知|征题|挑战赛|模拟赛|征求意见|取消|延期|调整/.test(page.doc.title))continue;
    for(const line of page.doc.lines){
      const span=line.match(/(?:竞赛|比赛)时间(?:定为|为|[：:])\s*(?:(20\d{2})年)?\s*(\d{1,2})月\s*(\d{1,2})日[^。；]{0,24}?(?:至|到)\s*(\d{1,2})月\s*(\d{1,2})日/);
      if(!span||span[1]&&span[1]!==edition[1]||/报名|暂定|预计|原定|去年|往年|上届/.test(line))continue;
      const year=Number(edition[1]),start=dayString(year,span[2],span[3]),end=dayString(year,span[4],span[5]);
      if(!validDay(start)||!validDay(end)||end<start||Date.parse(end)-Date.parse(start)>7*86400000)continue;
      calendars.push({year,scope:'全国统一作答窗口',kind:'window',slots:[{name:'竞赛作答',start,end}],
        note:'本次联网读取组委会通知。'+line.slice(0,180),url:page.url});
    }
  }
  return calendars;
}
function participationFit(event,p,live){
  const a=p.participation;
  const rules=participationRules[event]||{},checks=[];
  const t=a.time;
  const years=a.year?[a.year]:t?.start?[Number(t.start.slice(0,4)),Number(t.end.slice(0,4))]:[];
  const yearFits=y=>years.length?years.includes(y):y>=Number(a.today.slice(0,4));
  if(a.major){
    const m=rules.major;
    const applicable=m&&(m.year?yearFits(m.year):!years.length||years.every(y=>y>=m.from));
    const major=fold(a.major).replace(/专业$/,'');
    const state=applicable&&(m.kind==='open'||m.accepts?.includes(major))?'match':applicable&&m.excludes?.includes(major)?'conflict':'unknown';
    checks.push({label:'专业准入',state,required:true,note:applicable?(m.year?m.year+' 年 · ':'')+m.scope+'。'+m.note:'尚缺适用届次、组别的专业准入条文。',url:applicable?m.url:null});
  }
  if(t||a.year&&!a.major){
    const calendars=[...rules.calendars||[],...(event==='cumcm'?live:[])].filter(c=>yearFits(c.year)&&(years.length||c.slots.some(s=>s.end>=a.today)));
    const choices=[];
    const seen=new Set();
    let inconsistent=false;
    for(const c of calendars){
      if(event==='cumcm'){
        const same=calendars.filter(other=>c.year===other.year);
        if(same.some(other=>other.slots[0].start!==c.slots[0].start||other.slots[0].end!==c.slots[0].end))inconsistent=true;
      }
      const specific=event==='lanqiao'&&/蓝桥杯/.test(p.need||'');
      if(specific&&/电子赛|视觉艺术|鸿蒙|单片机|嵌入式|人工智能赛|数字科技创新|全国总决赛/.test(p.need))continue;
      const named=specific?c.slots.filter(s=>s.terms?.some(term=>fold(p.need).includes(fold(term)))):[];
      for(const slot of (named.length?named:c.slots)){
        const key=[c.scope,slot.name,slot.start,slot.end].join('|');
        if(seen.has(key))continue;
        seen.add(key);
        const state=t?.unresolved?'unknown':t?timeForSlot(slot,c,t):'match';
        choices.push({label:c.scope+' · '+slot.name,state,note:slot.start+(slot.end!==slot.start?' 至 '+slot.end:'')+'。'+c.note,url:c.url});
      }
    }
    const state=inconsistent?'unknown':choices.some(s=>s.state==='match')?'match':choices.length&&choices.every(s=>s.state==='conflict')?'conflict':'unknown';
    checks.push({label:'参赛时间',state,required:t?.priority!=='prefer',choices,
      note:inconsistent?'同届出现互不相符的官方日期，需核对最终安排。':t?.unresolved?'尚无法核对「'+t.unresolved+'」。假期可在补充条件中填写校历日期，备赛工时需另有依据。':!choices.length?'尚缺适用届次的赛程。':choices.length>1?'按所列场次分别核对。':'按所列阶段核对。'});
  }
  const required=checks.filter(c=>c.required);
  const status=required.some(c=>c.state==='conflict')?'conflict':required.some(c=>c.state==='unknown')?'unknown':'eligible';
  const preference=checks.find(c=>!c.required)?.state;
  return {checks,status,preference:preference||null};
}

function applyParticipation(rows,p,pages){
  if(!p.participation)return rows;
  const live=liveMathCalendars(pages);
  for(const r of rows){
    r.fit=participationFit(r.event,p,live);
    if(r.fit.status!=='eligible'){r.rank=null;r.score=null;r.byWeight=null;delete r.rankRange;}
  }
  const tier=r=>r.fit.status==='conflict'?5:r.fit.status==='unknown'?4:r.rank===null?3:({match:0,unknown:1,conflict:2})[r.fit.preference]??0;
  rows.sort((a,b)=>tier(a)-tier(b)||(a.rank??Infinity)-(b.rank??Infinity));
  const numbered=rows.filter(r=>r.rank!==null);
  const oldRanks=numbered.map(r=>r.rank);
  for(const [i,r] of numbered.entries()){
    r.rank=i&&tier(r)===tier(numbered[i-1])&&oldRanks[i]===oldRanks[i-1]?numbered[i-1].rank:i+1;
    if(r.byWeight){
      const ranks=r.byWeight.map((s,k)=>1+numbered.filter(other=>tier(other)<tier(r)||tier(other)===tier(r)&&other.byWeight?.[k]>s).length);
      r.rankRange=[Math.min(...ranks),Math.max(...ranks)];
    }
  }
  return rows;
}
