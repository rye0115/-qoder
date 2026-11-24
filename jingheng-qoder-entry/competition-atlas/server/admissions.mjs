const policyCohort = 2027;
const mechanismScores = {points:80,route:70,priority:60,review:40,excluded:0};
const mechanismNames = {points:'计入推免评价分',route:'可申请专项遴选',priority:'同等条件优先',review:'纳入评议',excluded:'明文排除'};
function admissionEvidence(event, documents=admissionDocuments) {
  return documents.flatMap(doc=>doc.clauses.filter(c=>c.events.includes(event)).map(c=>({
    school:doc.school,unit:doc.unit,cohort:doc.cohort,published:doc.published,title:doc.title,url:doc.url,
    status:doc.status,notes:doc.notes,attachment:doc.attachment??null,
    corroboration:doc.corroboration&&(!doc.corroboration.events||doc.corroboration.events.includes(event))?doc.corroboration:null,...c,
    confidence:doc.status==='final'?'高 · 院系正式规则':'中 · 校方公示稿',
    strength:mechanismScores[c.mechanism],use:mechanismNames[c.mechanism]
  })));
}
function rateAdmission(event) {
  const records=admissionEvidence(event);
  const schools=new Map();
  for(const row of records){
    if(row.cohort!==policyCohort || row.status!=='final' || row.mechanism==='excluded')continue;
    schools.set(row.school,Math.max(schools.get(row.school)??0,row.strength));
  }
  const score=schools.size?roundRating([...schools.values()].reduce((a,b)=>a+b,0)/schools.size):null;
  return {score,schools:schools.size,records,cohort:policyCohort,
    summary:schools.size?schools.size+' 所学校有当届正式条款；定向样本的平均政策力度':'当届正式肯定条款待核',
    confidence:schools.size>=3?'多个学校有据，跨校代表性仍有限':schools.size?'单校或少数学校有据，跨校代表性低':'证据不足'};
}
