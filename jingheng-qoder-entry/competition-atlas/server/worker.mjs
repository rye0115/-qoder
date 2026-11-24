const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(request){
  const u=new URL(request.url),path=u.pathname;
  if(path==='/api/ratings'){
    if(request.method!=='GET')return json({error:'请用 GET 读取比赛含金量。'},405);
    return json({version:'通用含金量 3.0（试行）',asOf:competitionEvidence.reviewed,employmentAsOf:employmentData.reviewed,
      rubric:ratingRubric,profiles:careerProfiles,jobWeights:profileJobWeights,defaultJobWeight,ratings:generalRatings,
      audit:weightAudit(),policyCohort,policyScopes:admissionDocuments.map(({school,unit,cohort})=>({school,unit,cohort}))});
  }
  if(path==='/api/employment/ratings'){
    if(request.method!=='GET')return json({error:'请用 GET 读取赛事系数。'},405);
    return json({version:'就业系数 1.0',asOf:employmentData.reviewed,profiles:careerProfiles,ratings:competitionRatings(employmentData)});
  }
  if(path==='/api/employment/match'){
    if(request.method!=='GET')return json({error:'请用 GET 查询。'},405);
    try{return json(careerMatch(u.searchParams));}catch(e){return json({error:e.message},400);}
  }
  if(path==='/api/employment'){
    if(request.method!=='GET')return json({error:'请用 GET 读取就业证据。'},405);
    return json(employmentData);
  }
  if(path==='/api/research'||path==='/api/recommend'){
    if(request.method!=='POST')return json({error:'请提交查询条件。'},405);
    if(request.headers.has('origin')){
      const origin=request.headers.get('origin');
      let sameOrigin=false;
      try{
        const stated=new URL(origin).host;
        const forwarded=(request.headers.get('x-forwarded-host')||request.headers.get('host')||u.host).split(',')[0].trim();
        sameOrigin=stated===u.host||stated===forwarded;
      }catch{}
      if(!sameOrigin)return json({error:'来源不匹配。'},403);
    }
    if(!/^application\/json\b/i.test(request.headers.get('content-type')||''))return json({error:'需要 JSON 请求。'},415);
    const isPersonal=path==='/api/recommend';
    let input;try{const text=await request.text();if(text.length>2000)return json({error:'查询条件过长。'},413);input=(isPersonal?readProfile:parseInput)(JSON.parse(text));}catch(e){return json({error:e instanceof SyntaxError?'查询格式无效。':e.message},400);}
    try{return json(await (isPersonal?recommend(input):research(input)));}catch{return json({error:'本次检索未能完成，请重试。'},502);}
  }
  const key=path==='/'?'/index.html':path;
  if(!Object.hasOwn(assets,key))return new Response('Not found',{status:404});
  if(!['HEAD','GET'].includes(request.method))return new Response(null,{status:405});
  const type=key.endsWith('.html')?'text/html':key.endsWith('.css')?'text/css':'text/javascript';
  return new Response(request.method==='HEAD'?null:assets[key],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}};
