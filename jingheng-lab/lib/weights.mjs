export const DIMENSIONS = [
  {
    id: 'official',
    name: '官方准入',
    hint: '目录 / 主办层级',
    desc: '是否进入教育行政部门或中国高等教育学会的竞赛目录，主办方层级如何。',
    guide: '优先核对 84 项竞赛目录、高校竞赛分析报告、主办单位章程。'
  },
  {
    id: 'university',
    name: '高校采信',
    hint: '推免 / 复试',
    desc: '推免细则、复试评分办法、学分认定中是否有明文条款，是否设名额门槛。',
    guide: '查 edu.cn 的推免细则与复试办法；区分“具有推免资格”和“综合测评加分”。'
  },
  {
    id: 'employer',
    name: '企业采信',
    hint: '校招 / JD',
    desc: '独立企业的校招岗位是否点名该赛事，是否有免笔试、直通面试等硬政策。',
    guide: '查企业官方招聘页和岗位 JD；合作企业、赞助企业的表述不计入。'
  },
  {
    id: 'rigor',
    name: '评审严格',
    hint: '评阅 / 查重',
    desc: '评阅是否分级、是否双评、有无答辩与查重阈值、违纪如何处理。',
    guide: '查章程、评阅工作规范、相似度通报与违纪处理公告。'
  },
  {
    id: 'scarcity',
    name: '奖项稀缺',
    hint: '获奖率',
    desc: '国奖数量除以同届、同组、同一入口的有效参赛数。',
    guide: '用国奖数除以本科组队数；省奖和校赛不得混入分母。'
  },
  {
    id: 'longevity',
    name: '历史稳定',
    hint: '届数 / 规模',
    desc: '连续举办年限、参赛规模趋势与赛事是否停办、改名。',
    guide: '查创办年份、近三年参赛规模与名单公布情况。'
  },
  {
    id: 'compliance',
    name: '透明合规',
    hint: '收费 / 公示 / 异议',
    desc: '收费与捆绑培训、获奖公示、异议受理与答复、处罚是否公开。',
    guide: '查章程经费条款、公示期、异议制度与处理通报。'
  },
  {
    id: 'accessibility',
    name: '可及性',
    hint: '成本 / 门槛',
    desc: '报名与器材成本、是否强制培训、组队与专业门槛。成本越低得分越高。',
    guide: '查报名费、是否指定器材、是否需要跨校组队或昂贵设备。'
  }
];

export const WEIGHTS = {
  postgrad: {
    official: 20,
    university: 30,
    employer: 5,
    rigor: 15,
    scarcity: 10,
    longevity: 5,
    compliance: 10,
    accessibility: 5
  },
  career: {
    official: 5,
    university: 5,
    employer: 30,
    rigor: 15,
    scarcity: 15,
    longevity: 10,
    compliance: 10,
    accessibility: 10
  }
};

export const COMPOSITE = {
  postgrad: { postgrad: 0.7, career: 0.3 },
  balanced: { postgrad: 0.45, career: 0.55 },
  career: { postgrad: 0.3, career: 0.7 }
};

export const PRESETS = [
  { id: 'postgrad', name: '升学优先', note: '保研与复试主导' },
  { id: 'balanced', name: '均衡', note: '默认口径' },
  { id: 'career', name: '就业优先', note: '校招与求职主导' }
];