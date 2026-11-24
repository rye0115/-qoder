import fs from 'node:fs';

export const CORPUS = [
  {
    id: 'cumcm',
    name: '全国大学生数学建模竞赛',
    aliases: ['cumcm', '国赛', '高教社杯', '数学建模国赛', '全国大学生数学建模大赛'],
    meta: {
      host: '中国工业与应用数学学会',
      founded: 1992,
      level: '本科 / 高职高专',
      field: '数学建模',
      cadence: '每年一届'
    },
    updatedAt: '2026-11-21',
    coverageNote: '12 条查询、9 个来源、11 条采信证据（2026-11-21 归档）',
    queries: [
      '全国大学生数学建模竞赛 2025 参赛队数 获奖名单',
      '教育部 全国性竞赛 名单 数学建模',
      '全国大学生数学建模竞赛 推免 加分 高校 细则',
      '全国大学生数学建模竞赛 招聘 优先录用 企业',
      '全国大学生数学建模竞赛 报名费 收费 章程',
      '全国大学生数学建模竞赛 评阅 查重 异议 申诉',
      '全国大学生数学建模竞赛 代做 作弊 通报',
      '全国大学生数学建模竞赛 历年参赛队数 规模',
      '全国普通高校大学生竞赛排行榜 数学建模 第五',
      '浙江大学 数学建模 推免 实施细则',
      '2026 数学建模 国赛 获奖 比例',
      '数学建模 国赛 主办单位 教育部'
    ],
    scores: {
      official: 92,
      university: 85,
      employer: 60,
      rigor: 82,
      scarcity: 95,
      longevity: 97,
      compliance: 78,
      accessibility: 85
    },
    scarcity: {
      numerator: 294,
      denominator: 61463,
      unit: '本科组参赛队',
      year: 2025,
      note: '全国一等奖 294 项 ÷ 本科组 61463 队 ≈ 0.48%'
    },
    evidence: [
      {
        id: 'E1',
        title: '全国大学生数学建模竞赛章程（2023 年修订稿）',
        url: 'https://www.mcm.edu.cn/html_cn/block/44e92058f537729c6b6a62a3662ee417.html',
        domain: 'mcm.edu.cn',
        grade: 'A',
        kind: 'official',
        publishedAt: '2023-12-01',
        dims: ['rigor', 'compliance'],
        quote: '竞赛设立公示制度，全国和各赛区获奖名单公示期为 7 天。竞赛设立异议制度。竞赛开始至竞赛结束后 6 个月内，任何个人和单位都可以提出异议，由全国组委会（或各赛区组委会）负责受理。'
      },
      {
        id: 'E2',
        title: '全国普通高校学科竞赛排行榜（2024）：84 项竞赛目录',
        url: 'https://www.sdaeu.edu.cn/jwc/info/1061/2526.htm',
        domain: 'sdaeu.edu.cn',
        grade: 'A',
        kind: 'directory',
        publishedAt: '2025-04-14',
        dims: ['official'],
        quote: '5、全国大学生数学建模竞赛 http://www.mcm.edu.cn/'
      },
      {
        id: 'E3',
        title: '南京邮电大学：2025 年数模竞赛获一等奖 4 项',
        url: 'https://www.njupt.edu.cn/p17117c53/list18.psp',
        domain: 'njupt.edu.cn',
        grade: 'B',
        kind: 'university',
        publishedAt: '2025-11-11',
        dims: ['scarcity', 'longevity'],
        quote: '2025 年，共有来自中国及美国、英国、加拿大、芬兰、马来西亚的 1837 所院校/校区、68311 队、20 多万人报名参赛。本科组共评出全国一等奖 294 项、二等奖 1204 项，本科组一等奖的获奖率约为 0.48%、二等奖的获奖率约为 1.96%。'
      },
      {
        id: 'E4',
        title: '北京理工大学：2026 年数模竞赛成绩',
        url: 'http://math.bit.edu.cn/zhxw/',
        domain: 'math.bit.edu.cn',
        grade: 'B',
        kind: 'university',
        publishedAt: '2026-11-09',
        dims: ['scarcity', 'longevity'],
        quote: '2026 年，共有来自全国及美国、英国、澳大利亚、新加坡、马来西亚的 1963 所院校/校区、89543 队参赛。其中仅有 300 个队被授予本科组全国一等奖，1195 个队被授予本科组全国二等奖。'
      },
      {
        id: 'E5',
        title: '浙江大学：数学建模竞赛获奖学生推免选拔实施细则',
        url: 'http://www.mathweb.zju.edu.cn:8080/mmb/news.asp?NewsID=101',
        domain: 'mathweb.zju.edu.cn',
        grade: 'A',
        kind: 'university-rule',
        publishedAt: '2019-01-01',
        dims: ['university'],
        quote: '获得全国大学生数学建模竞赛全国一等奖（含高教社杯、Matlab 创新奖）的参赛队的所有队员具有推免资格……每年因全国数模竞赛获奖获得推免的人数不超过 6 名。'
      },
      {
        id: 'E6',
        title: '东华大学：2026 年数模竞赛报名通知',
        url: 'https://jw.dhu.edu.cn/dhu/news/2540/index.psp',
        domain: 'jw.dhu.edu.cn',
        grade: 'B',
        kind: 'university',
        publishedAt: '2026-08-20',
        dims: ['compliance', 'accessibility'],
        quote: '每支队伍需要支付竞赛报名费 300 元。费用由校财务处代收。'
      },
      {
        id: 'E7',
        title: '安徽赛区：2024 年数模竞赛报名通知',
        url: 'https://www.hfitu.cn/sljys/newscontent/45093/',
        domain: 'hfitu.cn',
        grade: 'B',
        kind: 'university',
        publishedAt: '2024-08-08',
        dims: ['compliance'],
        quote: '各高校向安徽省工业与应用数学学会缴纳参赛费的标准为每队 200 元，其中 50 元交给全国大学生数学建模竞赛组委会。'
      },
      {
        id: 'E8',
        title: '2025 年各赛区参赛作品相似度情况通报',
        url: 'https://www.cmathc.org.cn/mcm/tz/350.html',
        domain: 'cmathc.org.cn',
        grade: 'A',
        kind: 'official',
        publishedAt: '2025-11-02',
        dims: ['rigor'],
        quote: '按赛区列出了竞赛系统中全文库或自建库相似度不低于 60% 的参赛作品的统计数据。'
      },
      {
        id: 'E9',
        title: '数学建模对考研和就业的促进作用（机构汇编）',
        url: 'https://www.saikr.com/a/477594',
        domain: 'saikr.com',
        grade: 'C',
        kind: 'secondhand',
        publishedAt: '2022-12-10',
        dims: ['employer'],
        quote: '中国石油化工集团公司把数学建模获奖作为优才引进的一个条件，要求建模获得一等奖及其以上奖项可以免笔试，直接进入面试。'
      }
    ],
    conflicts: [
      '2025 年国一数量存在 294 与 295 两种表述（南邮与南京信息工程大学）。',
      '主办表述不一致：章程写“学会主办”，多所高校新闻写“教育部高教司与学会共同主办”。',
      '0.3% 与 0.37% 的分母不同：前者对全部参赛队，后者对本科组。'
    ],
    gaps: [
      '未取得 2025 年全国获奖名单原始 PDF 全量，采用高校通报转述。',
      '企业采信缺近三年可核验的岗位 JD 样本，现有案例年代较早。',
      '各省赛区“省奖不超过三分之一”的执行情况未逐省核验。',
      '评委回避与双评执行记录未公开。'
    ],
    excluded: [
      { title: '深圳大学“获奖率 55.8%”', reason: '分母为该校报名队且包含省奖、校赛，不等于国奖概率。' },
      { title: '“华为杯二等奖免笔试”', reason: '属研究生数学建模竞赛，与本赛事不是同一项目。' },
      { title: '“人社部报告：竞赛获奖简历通过率 +42%”', reason: '二手引用，未取得原报告，不计分。' },
      { title: '“国一可加 20–30 分”', reason: '机构对多校口径的汇总，与浙大“仅国一、每年≤6 人”的细则冲突。' }
    ]
  },
  {
    id: 'tiaozhanbei',
    name: '“挑战杯”全国大学生课外学术科技作品竞赛',
    aliases: ['挑战杯', '大挑', '课外学术科技作品竞赛'],
    meta: {
      host: '共青团中央等',
      founded: 1989,
      level: '本科 / 高职高专',
      field: '综合学术科技',
      cadence: '两年一届'
    },
    updatedAt: '2026-11-21',
    coverageNote: '仅完成目录核验（1 个来源），其余维度待研究',
    queries: ['挑战杯 全国大学生课外学术科技作品竞赛 84项 目录'],
    scores: {
      official: 88,
      university: null,
      employer: null,
      rigor: null,
      scarcity: null,
      longevity: null,
      compliance: null,
      accessibility: null
    },
    scarcity: null,
    evidence: [
      {
        id: 'E1',
        title: '全国普通高校学科竞赛排行榜（2024）：84 项竞赛目录',
        url: 'https://www.sdaeu.edu.cn/jwc/info/1061/2526.htm',
        domain: 'sdaeu.edu.cn',
        grade: 'A',
        kind: 'directory',
        publishedAt: '2025-04-14',
        dims: ['official'],
        quote: '2、“挑战杯”全国大学生课外学术科技作品竞赛 http://www.tiaozhanbei.net/'
      }
    ],
    conflicts: [],
    gaps: [
      '高校推免条款、企业采信、评阅规则、获奖规模均未检索。',
      '目录仅证明“在册”，不能证明加分幅度。'
    ],
    excluded: []
  },
  {
    id: 'lanqiao',
    name: '蓝桥杯全国软件和信息技术专业人才大赛',
    aliases: ['蓝桥杯', '蓝桥杯大赛'],
    meta: {
      host: '大赛组委会',
      founded: 2010,
      level: '本科 / 高职高专',
      field: '软件与信息技术',
      cadence: '每年一届'
    },
    updatedAt: '2026-11-21',
    coverageNote: '仅取得违纪处理报道，尚未完成目录与采信研究',
    queries: ['蓝桥杯 省赛 违规 作弊 处理 通报'],
    scores: {
      official: null,
      university: null,
      employer: null,
      rigor: 62,
      scarcity: null,
      longevity: null,
      compliance: 55,
      accessibility: null
    },
    scarcity: null,
    evidence: [
      {
        id: 'E1',
        title: '新京报快评：买论文参加大赛，输掉了诚信',
        url: 'https://m.sohu.com/a/895500147_616821',
        domain: 'm.sohu.com',
        grade: 'B',
        kind: 'media',
        publishedAt: '2025-05-15',
        dims: ['rigor', 'compliance'],
        quote: '第十六届蓝桥杯大赛省赛共甄别违规选手 312 人，作弊选手 1133 人……取消作弊选手比赛成绩，禁赛三年，并向所在院校通报。'
      }
    ],
    conflicts: [],
    gaps: [
      '未核对是否进入 84 项竞赛目录。',
      '高校采信、企业采信、获奖规模与报名费均未检索。',
      '违纪规模较大，但处理公开，暂按“执行可查、风险偏高”记 62 分。'
    ],
    excluded: []
  }
];

// 启动时载入早期研究阶段整理的数据（由 scripts/build-import.mjs 生成）。
// 只补缺失维度与新增赛事，不改写已核验档案的既有分数。
try {
  const raw = fs.readFileSync(new URL('../data/imported-dossiers.json', import.meta.url), 'utf8');
  const imported = JSON.parse(raw);
  for (const dossier of imported) {
    const existing = CORPUS.find(d => d.id === dossier.id);
    if (!existing) {
      CORPUS.push(dossier);
      continue;
    }
    const filled = [];
    for (const [dim, value] of Object.entries(dossier.scores || {})) {
      if (existing.scores[dim] == null && typeof value === 'number') {
        existing.scores[dim] = value;
        filled.push(dim);
      }
    }
    if (!filled.length) continue;
    const seen = new Set(existing.evidence.map(e => `${e.url}|${e.quote}`));
    for (const item of dossier.evidence || []) {
      if (seen.has(`${item.url}|${item.quote}`)) continue;
      seen.add(`${item.url}|${item.quote}`);
      existing.evidence.push({ ...item, id: `E${existing.evidence.length + 1}` });
    }
    existing.gaps = [...new Set([...(existing.gaps || []), ...(dossier.gaps || [])])];
    existing.coverageNote = `${existing.coverageNote}；已补入早期研究数据的 ${filled.length} 个维度`;
    existing.updatedAt = dossier.updatedAt || existing.updatedAt;
  }
} catch {
  // 没有导入数据时退回纯档案模式。
}

export function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s“”"'’·（）()《》\-—_]/g, '');
}

export function findDossier(name) {
  const key = normalizeName(name);
  if (!key) return null;
  return CORPUS.find(d => {
    const names = [d.name, ...d.aliases].map(normalizeName);
    return names.some(n => key === n || key.includes(n) || n.includes(key));
  }) || null;
}