function archivedEmployment(input) {
  const data = employmentData;
  const event = Object.keys(data.events).find(key =>
    data.events[key].some(alias => fold(alias) === fold(input.event)));
  if (!event) return [];
  return data.records.filter(record => {
    if (!record.events.includes(event)) return false;
    if (input.year && !record.years.includes(input.year)) return false;
    if (input.employer && !fold(data.organizations[record.org].name).includes(fold(input.employer))) return false;
    const roles = [record.role, ...(record.roleTerms || [])];
    if (input.job && !roles.some(role => fold(role).includes(fold(input.job)))) return false;
    if (!input.award) return true;
    const actual = awardFold(record.award), wanted = awardFold(input.award);
    if (actual.includes(wanted)) return true;
    if (record.kind !== 'policy') return false;
    const knownAward = /([一二三特]等奖|[金银铜][奖牌])/.test(wanted);
    if (record.award === '参赛经历即可') return knownAward || /参赛|参与/.test(wanted);
    if (!knownAward) return false;
    if (record.award === '获奖，奖级未限定') return true;
    const ranks = ['特等奖','一等奖','二等奖','三等奖'];
    const rank = ranks.findIndex(name => wanted.includes(name));
    const threshold = ranks.findIndex(name => actual.includes(name));
    return actual.endsWith('及以上') && rank >= 0 && threshold >= rank &&
      ['全国','省'].some(level => actual.startsWith(level) && wanted.startsWith(level));
  }).map(record => {
    const year=input.year||record.years.at(-1)||'';
    const [publisher,url] = data.sources[record.sourceByYear?.[year] || record.sources[0]];
    return {id:record.id,kind:record.kind,person:record.person,year,org:data.organizations[record.org].name,employerDomain:data.organizations[record.org].domain,
      title:data.organizations[record.org].name+' · '+record.role,quote:record.note,
      award:record.award,period:record.period,publisher,url,stage:record.stage,
      score:record.kind === 'policy' ? (record.effect === '直通' ? 90 : 75) : null};
  });
}
