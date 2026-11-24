import { apiPost } from '../api.js';
import {
  dimensionBars, emptyState, evidenceTag, modal, openJobMatcher, personalContext,
  scopeBox, scoreClass, sourceLinks, sourceSummary, statusBadge, toast, awardLabel
} from '../components.js';
import {
  cleanText, dateCn, esc, fmt, icon, parseLocalStorage, writeLocalStorage
} from '../utils.js';

const WEIGHTS = [
  ['任务挑战', 25], ['评审与复核', 20], ['选拔强度', 15], ['结果透明', 10], ['就业帮助', 15], ['保研帮助', 15]
];

function needOpen(state) {
  if (state.needOpen != null) return state.needOpen;
  return window.innerWidth > 900;
}

function currentNeed(state) {
  return state.needText || parseLocalStorage('jh_need_text', '') || '';
}

function renderWeights() {
  return `<div class="weights card">
    <div class="weights-head"><h3>通用评分构成</h3><a href="#method">评分方法 →</a></div>
    ${WEIGHTS.map(([name, weight]) => `<div class="weight-row">
      <span class="w-label">${name}</span>
      <span class="weight-track"><span style="width:${weight * 4}%"></span></span>
      <span class="weight-value">${weight}%</span>
    </div>`).join('')}
    <div class="weights-total"><span>六维满分</span><span>100 · 缺失维度不补分</span></div>
  </div>`;
}

function renderNeedCard(state) {
  const open = needOpen(state);
  const need = currentNeed(state);
  const personal = state.personalResult;
  return `<section class="need-card card ${open ? 'open' : ''}" id="needCard">
    <button class="need-toggle" type="button" aria-expanded="${open}" aria-controls="needBody">
      <span class="need-title"><span class="mini-icon">${icon('target', 15)}</span> 按你的需求选赛</span>
      <span class="chevron">${icon('chevron', 15)}</span>
    </button>
    <div class="need-body" id="needBody">
      <p class="hint">写清学校、院系、届别、目标与团队顺位；没有同院系条款的赛事不会进入个人榜。</p>
      <textarea class="need-textarea" id="needText" placeholder="例如：云南民族大学数学与计算机科学学院，2027 届想保研，目标国一，团队第二。">${esc(need)}</textarea>
      <div class="quick-chips" id="needChips">
        <button class="chip" type="button" data-example="云南民族大学数学与计算机科学学院，2027 届想保研，目标国一，团队第二。">保研 · 数模/电赛</button>
        <button class="chip" type="button" data-example="云南民族大学数学与计算机科学学院，2027 届保研，目标国二，团队第一，目标是进入校级推荐名单。">换一个顺位</button>
        <button class="chip" type="button" data-example="2027 年只能参加 4 小时以内的单场赛事，想找编程类比赛。">日程限制</button>
      </div>
      <div class="need-actions">
        <button class="btn btn-outline btn-sm" type="button" id="needMore">补充条件</button>
        <button class="btn btn-primary btn-sm" type="button" id="needRun">生成推荐榜</button>
      </div>
      ${personal ? `<div class="need-example"><strong>个人条件已生效</strong><br>${esc(personal.context?.school || '')} · ${esc(personal.context?.unit || '')} · ${esc(personal.context?.cohort || '')} 届。目标适配占 ${Math.round((personal.context?.targetWeight || .5) * 100)}%。<br><button class="text-link mt-8" type="button" id="resetPersonal">恢复通用榜</button></div>` : `<div class="need-example"><strong>试试：</strong>“2027 届、目标国一、团队第二” 与 “团队第一” 会得到不同的目标适配分。</div>`}
    </div>
  </section>`;
}

function renderHero(state) {
  const ranked = state.data.ratings.filter((r) => r.score != null).length;
  return `<div class="hero">
    <div class="hero-content">
      <div class="eyebrow">Competition intelligence · 2026</div>
      <h1>同样是国奖，含金量差在哪？</h1>
      <p>竞衡把赛制、就业与保研拆成可以回到原文的六维证据。先用通用口径看整体，再写入你的学校、届别和团队顺位，让同一个榜单换成你的答案。</p>
      <div class="hero-meta">
        <span>${icon('shield', 13)} 六份研究输入即时计算</span>
        <span>${icon('doc', 13)} 15 项赛事 · ${ranked} 项六维完整</span>
        <span>${icon('clock', 13)} 2026.11 口径</span>
      </div>
    </div>
  </div>`;
}

function tabs() {
  return `<nav class="rank-tabs" aria-label="赛事推荐视图">
    <a class="rank-tab active" href="#rank">总分与通用榜</a>
    <a class="rank-tab" href="#rank/jobs">按岗找赛 <span class="tab-count">岗位</span></a>
    <a class="rank-tab" href="#rank/events">按赛找岗 <span class="tab-count">赛事</span></a>
  </nav>`;
}

function filterRatings(ratings, q, status) {
  const query = q.trim().toLowerCase();
  return ratings.filter((r) => {
    if (status === 'complete' && r.status !== 'complete') return false;
    if (status === 'partial' && r.status !== 'partial') return false;
    if (status === 'platform' && !r.platform) return false;
    if (!query) return true;
    return `${r.name} ${r.shortName} ${r.scope || ''}`.toLowerCase().includes(query);
  });
}

function rankRow(rating, personalItem = null) {
  const isPersonal = Boolean(personalItem);
  const rank = isPersonal ? personalItem.rank : rating.rank;
  const score = isPersonal ? personalItem.score : rating.score;
  const top = rank != null && rank <= 3;
  const pendingLabel = isPersonal ? '暂缓' : (rating.range ? `${fmt(rating.range[0])}–${fmt(rating.range[1])}` : '待补证');
  const meta = isPersonal
    ? `${esc(rating.scope || '规则范围待核')}`
    : `${esc(rating.scope || '规则范围待核')}`;
  return `<div class="rank-row ${top ? 'top' : ''}" data-expand="${esc(rating.id)}">
    <div class="rank-no">${rank == null ? '<span style="font-size:11px">—</span>' : String(rank).padStart(2, '0')}<span class="no-arrow">${top ? '▲' : ''}</span></div>
    <div class="rank-main-cell">
      <button class="rank-name" type="button" data-expand-btn="${esc(rating.id)}">${esc(rating.name)}
        ${rating.status === 'complete' ? `<span class="verified" title="六维完整">${icon('check', 9)}</span>` : ''}
      </button>
      <div class="rank-meta">${meta}<span class="dot"></span><span>${rating.employment.score != null ? `就业 ${fmt(rating.employment.score)}` : '就业待核'}</span><span class="dot"></span><span>${rating.admission.score != null ? `保研 ${fmt(rating.admission.score)}` : '保研待核'}</span></div>
      <div class="rank-mobile-scores">
        <span>就业 <b>${rating.employment.score == null ? '待核' : fmt(rating.employment.score)}</b></span>
        <span>保研 <b>${rating.admission.score == null ? '待核' : fmt(rating.admission.score)}</b></span>
        ${score != null ? `<span class="score-pill ${scoreClass(score)}">${fmt(score)}</span>` : `<span class="score-pill pending">${pendingLabel}</span>`}
      </div>
    </div>
    <div class="rank-cell-score col-employment">${rating.employment.score == null ? '<span class="muted tiny">待核</span>' : `<span class="mini-score"></span>${fmt(rating.employment.score)}`}</div>
    <div class="rank-cell-score col-admission">${rating.admission.score == null ? '<span class="muted tiny">待核</span>' : `<span class="mini-score"></span>${fmt(rating.admission.score)}`}</div>
    <div class="rank-cell-score">${score == null ? `<span class="score-pill pending">${isPersonal ? '暂缓' : '待补证'}</span>` : `<span class="score-pill ${scoreClass(score)}">${fmt(score)}</span>`}</div>
    <div class="rank-chevron">${icon('chevron', 14)}</div>
    <div class="detail" hidden></div>
  </div>`;
}

function personalSummary(result) {
  const top = result.items?.find((x) => x.rank === 1) || result.items?.[0];
  return `<div class="context-banner">
    <span class="icon">${icon('user', 16)}</span>
    <div>
      <h3>已按你的条件重排 · ${esc(result.context?.school || '')} ${esc(result.context?.unit || '')}</h3>
      <p>${result.stats?.ranked || 0} 项已排名 · ${result.stats?.pending || 0} 项暂缓 · ${result.stats?.excluded || 0} 项因无同院系条款未列入。目标适配占 ${Math.round((result.context?.targetWeight || .5) * 100)}%。</p>
      ${personalContext(result)}
    </div>
    <div class="context-actions">
      <button class="btn btn-outline btn-xs" type="button" id="adjustNeed">调整条件</button>
      <button class="btn btn-xs btn-soft" type="button" id="resetPersonalBanner">通用榜</button>
    </div>
  </div>
  <div class="personal-summary">
    <div class="personal-kpi"><div class="label">赛制质量</div><div class="value">${fmt(top?.quality)}<small> / 100</small></div></div>
    <div class="personal-kpi"><div class="label">目标适配</div><div class="value">${fmt(top?.target)}<small> / 100</small></div></div>
    <div class="personal-kpi"><div class="label">推荐分</div><div class="value" style="color:var(--purple-strong)">${fmt(top?.score)}<small> / 100</small></div></div>
  </div>
  <div class="confidence-strip">
    <button class="confidence-toggle" type="button" data-toggle-confidence>本次检索与置信度 <span>${result.stats?.parsedPages || 0} 个可解析页面 · 查看明细 ${icon('chevron', 12)}</span></button>
    <div class="confidence-body">
      <div>本轮核对 ${result.stats?.candidates || 0} 个候选赛事，取得 ${result.stats?.parsedPages || 0} 个可解析页面；个人分数只用同院系当届条款。</div>
      <div class="confidence-stats">
        <span>通用分：独立于个人条件</span>
        <span>赛制质量：前四维加权 ÷ 70%</span>
        <span>目标适配：条款分值 × 顺位系数 ÷ 同表上限</span>
      </div>
      <div class="mt-8"><strong>${esc(result.ledger?.target?.note || '')}</strong></div>
    </div>
  </div>`;
}

function personalDetail(item, rating) {
  const c = item.clause || {};
  const calc = item.targetCalc || {};
  return `<div class="rank-detail">
    <div class="detail-top">
      <div><h3>${esc(item.name)} · 个人推荐拆解</h3><p>同院系条款、奖级与团队顺位共同决定目标适配。</p></div>
      <div class="detail-actions">
        <span class="score-pill ${scoreClass(item.score)}">${fmt(item.score)}</span>
        <button class="btn btn-outline btn-xs" type="button" data-open-jobs="${esc(item.name)}">按这个条件匹配岗位</button>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">计算账本</div>
      <div class="scope-box">
        <strong>推荐分 = 赛制质量 × ${(1 - (item.school ? 0 : 0)).toFixed(0)}${''}</strong>
        ${esc((item.quality ?? 0).toFixed(1))} × ${(item.school ? '' : '')}
      </div>
      <div class="personal-summary mt-8">
        <div class="personal-kpi"><div class="label">赛制质量（通用）</div><div class="value">${fmt(item.quality)}</div><div class="tiny muted">前四维加权 ÷ 70%</div></div>
        <div class="personal-kpi"><div class="label">目标适配（个人）</div><div class="value">${fmt(item.target)}</div><div class="tiny muted">${esc(calc.formula || '')}</div></div>
        <div class="personal-kpi"><div class="label">推荐分</div><div class="value" style="color:var(--purple-strong)">${fmt(item.score)}</div><div class="tiny muted">通用分 ${fmt(item.base)}</div></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">适用条款</div>
      <div class="detail-card">
        <h4>${esc(c.mechanism === 'points' ? '明确加分' : c.mechanism === 'route' ? '专项遴选' : '正式条款')} <span class="badge badge-purple">${esc(item.school?.school || '')} ${esc(item.school?.unit || '')}</span></h4>
        <p>${esc(c.requirement || '')}</p>
        <p>${esc(c.effect || '')}</p>
        <div class="tiny muted">${esc(c.locator || '')} · 发布 ${esc(dateCn(item.school?.published))}</div>
        ${sourceLinks([{ title: item.school?.title, url: item.school?.url }], 2)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">通用六维</div>
      ${dimensionBars(rating)}
    </div>
  </div>`;
}

function ratingDetail(rating) {
  const major = rating.schedule?.major;
  const calendar = rating.schedule?.latest;
  const employment = rating.employment;
  const admission = rating.admission;
  const schools = (admission.schools || []).filter((s) => s.best).slice(0, 3);
  const orgs = (employment.orgs || []).slice(0, 3);
  return `<div class="rank-detail">
    <div class="detail-top">
      <div><h3>评分依据</h3><p>${esc(rating.scope || '本赛事的可解析范围')}</p></div>
      <div class="detail-actions">
        <span class="score-pill ${scoreClass(rating.score, rating.coverage)}">${rating.score == null ? '待补证' : fmt(rating.score)}</span>
        <button class="btn btn-outline btn-xs" type="button" data-open-jobs="${esc(rating.name)}">按我的条件匹配岗位</button>
        ${rating.score != null ? `<button class="btn btn-ghost btn-xs" type="button" data-research-event="${esc(rating.name)}">去检索影响力</button>` : ''}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">可核范围 <span class="hint">${rating.status === 'complete' ? '六维完整 · 可直接比较' : rating.status === 'partial' ? `已覆盖 ${rating.coverage}% 权重` : '待补关键证据'}</span></div>
      <div class="scope-box">${esc(rating.scope || '暂无当届规则原文。')}<br><span class="tiny">独立来源 ${rating.sourceCount} 个 · ${rating.status === 'complete' ? '通用分可直接比较' : '未用猜测补分，保留区间'}</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">专业与赛期</div>
      <div class="detail-cards">
        <div class="detail-card"><h4>专业准入</h4><p>${esc(major ? `${major.scope || ''} ${major.note || ''}` : '暂无可解析的当届专业限制。')}</p>${major?.url ? sourceLinks([{ url: major.url }], 1) : ''}</div>
        <div class="detail-card"><h4>最近赛期</h4><p>${calendar ? `${calendar.year} · ${(calendar.slots || []).map((s) => `${s.name || '赛期'} ${s.start || ''}${s.end && s.end !== s.start ? ` 至 ${s.end}` : ''}`).join('；')}` : '暂无可解析的赛期。'}</p>${calendar?.url ? sourceLinks([{ url: calendar.url }], 1) : ''}</div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">前四维 · 赛制质量 <span class="hint">${rating.quality == null ? '前四维未完整' : `质量 ${fmt(rating.quality)} / 100`}</span></div>
      ${dimensionBars(rating)}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">就业与保研</div>
      <div class="detail-cards">
        <div class="detail-card">
          <h4>就业帮助 <b>${employment.score == null ? '待核' : fmt(employment.score)}</b></h4>
          <p>${esc(employment.summary)}</p>
          ${orgs.length ? `<div class="tiny-list">${orgs.map((o) => `<span>${esc(o.name)} · ${o.records.length} 条原文</span>`).join('')}</div>` : '<div class="tiny muted">暂无独立招聘方。</div>'}
          ${sourceSummary((employment.records || []).flatMap((r) => r.sourceDetails || []), '暂无招聘原文')}
        </div>
        <div class="detail-card">
          <h4>保研帮助 <b>${admission.score == null ? '待核' : fmt(admission.score)}</b></h4>
          <p>${esc(admission.summary)}</p>
          ${schools.length ? `<div class="tiny-list">${schools.map((s) => `<span>${esc(s.school)} · ${esc(s.unit)} · ${s.best.strength} / 100</span>`).join('')}</div>` : '<div class="tiny muted">暂未发现当届正式条款。</div>'}
          ${sourceSummary(schools.map((s) => ({ title: s.title, url: s.url })), '暂无可核条款')}
        </div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">原文出处 <span class="hint">赛事规则 ${rating.sources?.length || 0} 个来源</span></div>
      ${sourceLinks(rating.sources || [], 4, '规则原文')}
    </div>
  </div>`;
}

function pendingBlock(ratings, personalPending = null) {
  const list = personalPending || ratings.filter((r) => r.score == null);
  if (!list.length) return '';
  return `<div class="pending-block" id="pendingBlock">
    <button class="pending-toggle" type="button" aria-expanded="false">
      <span class="pending-title">${icon('warn', 14)} 暂缓排名 <span class="count">· ${list.length} 项缺关键证据或六维不全</span></span>
      <span class="chevron">${icon('chevron', 14)}</span>
    </button>
    <div class="pending-body">
      ${list.map((r) => personalPending
        ? `<div class="pending-item"><div><div class="name">${esc(r.name)}</div><div class="meta">${esc(r.quality == null ? '赛制质量待核' : '目标适配可算')} · ${esc(r.status === 'pending' ? '暂缓排名' : '')}</div></div><div class="range">暂缓</div></div>`
        : `<div class="pending-item"><div><div class="name">${esc(r.name)}</div><div class="meta">${esc(r.scope || '缺当届规则原文')}</div></div><div class="range">${r.range ? `${fmt(r.range[0])} – ${fmt(r.range[1])}` : '暂无可核区间'}<br><span class="tiny">覆盖 ${r.coverage}% · 来源 ${r.sourceCount}</span></div></div>`
      ).join('')}
    </div>
  </div>`;
}

function mainTable(state, q, status) {
  const ratings = state.data.ratings;
  const personal = state.personalResult;
  if (personal) {
    const items = (personal.items || []).filter((item) => {
      const r = ratings.find((x) => x.id === item.event);
      if (!r) return false;
      if (!q.trim()) return true;
      return `${r.name} ${r.shortName} ${r.scope || ''}`.toLowerCase().includes(q.trim().toLowerCase());
    });
    return `<div class="rank-panel card">
      <div class="rank-table-head">
        <span>推荐</span><span>赛事 / 适用条款</span><span class="col-employment">赛制质量</span><span class="col-admission">目标适配</span><span>推荐分</span><span></span>
      </div>
      <div class="rank-list" id="rankRows">
        ${items.length ? items.map((item) => {
          const r = ratings.find((x) => x.id === item.event);
          const row = rankRow(r, item);
          return row.replace('data-expand="' + esc(r.id) + '"', `data-expand="${esc(r.id)}" data-personal="1"`);
        }).join('') : emptyState('没有符合条件的个人推荐', '换一个学校、院系、届别或清除搜索词。')}
      </div>
    </div>${pendingBlock(ratings, personal.pending || [])}`;
  }
  const filtered = filterRatings(ratings, q, status);
  return `<div class="rank-panel card">
    <div class="rank-table-head">
      <span>名次</span><span>赛事</span><span class="col-employment">就业帮助</span><span class="col-admission">保研帮助</span><span>通用分</span><span></span>
    </div>
    <div class="rank-list" id="rankRows">
      ${filtered.length ? filtered.map((r) => rankRow(r)).join('') : emptyState('没有符合条件的赛事', '试试清除搜索词或切换筛选。')}
    </div>
  </div>${status === 'all' ? pendingBlock(ratings) : ''}`;
}

function personalAdjustModal(state, onDone) {
  const f = state.needFilters || {};
  const body = `<div class="modal-section">
    <div class="modal-section-title">推免条件</div>
    <div class="modal-grid">
      <div class="field"><label for="nfSchool">学校</label><input id="nfSchool" value="${esc(f.school || '云南民族大学')}" placeholder="学校全称"></div>
      <div class="field"><label for="nfUnit">院系</label><input id="nfUnit" value="${esc(f.unit || '数学与计算机科学学院')}" placeholder="学院全称"></div>
      <div class="field"><label for="nfCohort">届别</label><select id="nfCohort"><option ${Number(f.cohort || 2027) === 2027 ? 'selected' : ''}>2027</option><option ${Number(f.cohort) === 2026 ? 'selected' : ''}>2026</option></select></div>
      <div class="field"><label for="nfAward">目标奖级</label><select id="nfAward">${[['nat1','国家级一等奖'],['nat2','国家级二等奖'],['nat3','国家级三等奖'],['prov1','省级一等奖'],['prov2','省级二等奖'],['prov3','省级三等奖']].map(([v,l]) => `<option value="${v}" ${f.award === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="nfPlace">团队顺位</label><select id="nfPlace"><option value="">未填写</option>${[1,2,3,4,5].map((n) => `<option value="${n}" ${String(f.place) === String(n) ? 'selected' : ''}>团队第 ${n}</option>`).join('')}</select></div>
      <div class="field"><label for="nfWeight">目标适配占比</label><select id="nfWeight">${[[.35,'35% · 更看赛制质量'],[.5,'50% · 均衡'],[.7,'70% · 更看本人条件']].map(([v,l]) => `<option value="${v}" ${Number(f.targetWeight || .5) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">日程限制（可选）</div>
    <div class="modal-grid">
      <div class="field"><label for="nfYear">赛事年份</label><input id="nfYear" type="number" value="${esc(f.eventYear || '')}" placeholder="例如 2027"></div>
      <div class="field"><label for="nfHours">单场最长时长（小时）</label><input id="nfHours" type="number" value="${esc(f.maxHours || '')}" placeholder="例如 3"></div>
      <div class="field"><label for="nfStart">允许参赛从</label><input id="nfStart" type="date" value="${esc(f.allowedStart || '')}"></div>
      <div class="field"><label for="nfEnd">允许参赛到</label><input id="nfEnd" type="date" value="${esc(f.allowedEnd || '')}"></div>
    </div>
    <p class="tiny muted mt-8">单场时长限制只适用于按场次计时的赛事；窗口型赛事不会套用该限制。</p>
  </div>
  <div class="modal-note">推免锁学校、院系和届别；奖项与顺位只改变目标适配。比赛没有同院系正式条款时不会进入个人榜。</div>`;
  modal({
    title: '补充条件',
    subtitle: '条件越完整，推荐越接近你所在院系的真实规则。',
    body,
    wide: true,
    footer: `<button class="btn btn-outline" data-close>取消</button><button class="btn btn-primary" id="nfRun">生成推荐榜</button>`,
    onMount(root, close) {
      root.querySelector('[data-close]').addEventListener('click', close);
      root.querySelector('#nfRun').addEventListener('click', async () => {
        const next = {
          school: root.querySelector('#nfSchool').value.trim(),
          unit: root.querySelector('#nfUnit').value.trim(),
          cohort: root.querySelector('#nfCohort').value,
          award: root.querySelector('#nfAward').value,
          place: root.querySelector('#nfPlace').value,
          targetWeight: root.querySelector('#nfWeight').value,
          eventYear: root.querySelector('#nfYear').value,
          maxHours: root.querySelector('#nfHours').value,
          allowedStart: root.querySelector('#nfStart').value,
          allowedEnd: root.querySelector('#nfEnd').value
        };
        state.needFilters = next;
        writeLocalStorage('jh_need_filters', next);
        close();
        await runRecommend(state, onDone);
      });
    }
  });
}

async function runRecommend(state, onDone) {
  const textarea = document.getElementById('needText');
  const need = (textarea?.value || currentNeed(state)).trim();
  if (!need) {
    toast('先写一句你的参赛目标，例如“2027 届想保研，目标国一”。', 'warn');
    textarea?.focus();
    return;
  }
  state.needText = need;
  writeLocalStorage('jh_need_text', need);
  const buttons = [...document.querySelectorAll('#needRun')];
  buttons.forEach((b) => { b.disabled = true; b.textContent = '检索中…'; });
  try {
    const result = await apiPost('/api/recommend', { need, ...(state.needFilters || {}) });
    if (result.ok === false) {
      toast(result.error || '没有找到对应条款', 'warn');
      return;
    }
    state.personalResult = result.mode === 'personal' ? result : null;
    if (result.mode === 'schedule') {
      state.scheduleResult = result;
      toast(result.fit === 'conflict' ? `赛期冲突：${result.reason}` : '赛期符合条件，已更新日程判断。', result.fit === 'conflict' ? 'warn' : 'ok');
      renderScheduleModal(result);
      return;
    }
    onDone();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    toast(error.message || '生成推荐失败', 'warn');
  } finally {
    buttons.forEach((b) => { b.disabled = false; b.textContent = '生成推荐榜'; });
  }
}

function renderScheduleModal(result) {
  const item = result.focused;
  modal({
    title: '日程核对结果',
    subtitle: '按赛事年份、单场时长和允许日期逐项判断。',
    body: `<div class="check-result ${result.fit === 'conflict' ? 'bad' : 'ok'}">
      <strong>${esc(item?.name || '赛事')}</strong> · ${result.fit === 'conflict' ? '赛期冲突' : result.fit === 'eligible' ? '可以参赛' : '暂无法判断'}
      <div class="mt-8">${esc(result.reason || '')}</div>
    </div>
    ${item?.schedule?.slots?.length ? `<div class="detail-card mt-12"><h4>赛期</h4><p>${item.schedule.slots.map((s) => `${esc(s.name || '赛期')}：${esc(s.start || '')}${s.end && s.end !== s.start ? ` 至 ${esc(s.end)}` : ''}${s.terms ? ` · ${esc(s.terms.join('、'))}` : ''}`).join('<br>')}</p></div>` : ''}
    <div class="modal-note mt-12">单场时长只适用于按场次计时的赛事。像数模、电赛这类窗口型赛事，不会因为窗口超过 4 小时就判为冲突。</div>`,
    footer: `<button class="btn btn-outline" data-close>知道了</button><button class="btn btn-primary" data-jobs>按赛事查岗位</button>`,
    onMount(root, close) {
      root.querySelector('[data-close]').addEventListener('click', close);
      root.querySelector('[data-jobs]').addEventListener('click', () => {
        sessionStorage.setItem('jh_job_event', item?.name || '');
        close();
        location.hash = '#rank/events';
      });
    }
  });
}

function bindList(state) {
  const rows = document.getElementById('rankRows');
  if (!rows) return;
  rows.addEventListener('click', (event) => {
    const researchBtn = event.target.closest('[data-research-event]');
    if (researchBtn) {
      state.researchSeed = researchBtn.dataset.researchEvent;
      location.hash = '#research';
      return;
    }
    const jobBtn = event.target.closest('[data-open-jobs]');
    if (jobBtn) {
      openJobMatcher(jobBtn.dataset.openJobs);
      return;
    }
    const row = event.target.closest('.rank-row');
    if (!row) return;
    if (event.target.closest('a')) return;
    const id = row.dataset.expand;
    const detail = row.querySelector('.detail');
    if (!detail) return;
    const isOpen = !detail.hidden;
    if (isOpen) {
      detail.hidden = true;
      row.classList.remove('expanded');
      return;
    }
    const ratings = state.data.ratings;
    const rating = ratings.find((r) => r.id === id);
    if (!rating) return;
    if (row.dataset.personal === '1' && state.personalResult) {
      const item = state.personalResult.items.find((x) => x.event === id);
      detail.innerHTML = personalDetail(item, rating);
    } else {
      detail.innerHTML = ratingDetail(rating);
    }
    detail.hidden = false;
    row.classList.add('expanded');
    bindDetailActions(detail, state);
  });
  const pending = document.getElementById('pendingBlock');
  pending?.addEventListener('click', (event) => {
    if (event.target.closest('.pending-toggle')) {
      pending.classList.toggle('open');
      pending.querySelector('.pending-toggle').setAttribute('aria-expanded', pending.classList.contains('open'));
    }
  });
}

function bindDetailActions(scope, state) {
  scope.querySelectorAll('[data-open-jobs]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openJobMatcher(btn.dataset.openJobs);
    });
  });
  scope.querySelectorAll('[data-research-event]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      state.researchSeed = btn.dataset.researchEvent;
      location.hash = '#research';
    });
  });
  scope.addEventListener('click', (event) => {
    const jobBtn = event.target.closest('[data-open-jobs]');
    if (jobBtn) {
      event.stopPropagation();
      openJobMatcher(jobBtn.dataset.openJobs);
    }
    const researchBtn = event.target.closest('[data-research-event]');
    if (researchBtn) {
      event.stopPropagation();
      state.researchSeed = researchBtn.dataset.researchEvent;
      location.hash = '#research';
    }
  });
}

function bindNeedCard(state, rerender) {
  const card = document.getElementById('needCard');
  const toggle = card?.querySelector('.need-toggle');
  toggle?.addEventListener('click', () => {
    const open = card.classList.toggle('open');
    state.needOpen = open;
    toggle.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('#needChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.example || '';
      document.getElementById('needText').value = text;
      state.needText = text;
    });
  });
  document.getElementById('needRun')?.addEventListener('click', () => runRecommend(state, rerender));
  document.getElementById('needMore')?.addEventListener('click', () => personalAdjustModal(state, rerender));
  document.getElementById('adjustNeed')?.addEventListener('click', () => personalAdjustModal(state, rerender));
  const reset = () => {
    state.personalResult = null;
    state.needFilters = {};
    writeLocalStorage('jh_need_filters', {});
    rerender();
    toast('已恢复通用榜。');
  };
  document.getElementById('resetPersonal')?.addEventListener('click', reset);
  document.getElementById('resetPersonalBanner')?.addEventListener('click', reset);
  const conf = document.querySelector('[data-toggle-confidence]');
  conf?.addEventListener('click', () => conf.closest('.confidence-strip').classList.toggle('open'));
}

export async function renderRanking(root, state) {
  const savedFilters = parseLocalStorage('jh_need_filters', {});
  state.needFilters = { ...savedFilters, ...(state.needFilters || {}) };
  const q = state.rankQuery || '';
  const status = state.rankStatus || 'all';
  const ratings = state.data.ratings;
  const completed = ratings.filter((r) => r.status === 'complete').length;
  const rerender = () => renderRanking(root, state);
  root.innerHTML = `<div class="page-wrap">
    ${renderHero(state)}
    ${tabs()}
    <div class="rank-layout">
      <aside class="side-stack">${renderNeedCard(state)}${renderWeights()}</aside>
      <section class="rank-main">
        <div class="list-toolbar">
          <div class="list-meta"><strong>${state.personalResult ? '个人推荐榜' : '通用榜'}</strong> · ${state.personalResult ? `${state.personalResult.stats?.ranked || 0} 项排名 · ${state.personalResult.stats?.pending || 0} 项暂缓` : `${ratings.length} 项收录 · ${completed} 项六维完整`}</div>
          <div class="toolbar-controls">
            <label class="search-box">${icon('search', 14)}<input id="rankSearch" type="search" placeholder="搜索赛事或简称" value="${esc(q)}" aria-label="搜索赛事"></label>
            <select class="select" id="rankStatus" aria-label="筛选赛事状态">
              <option value="all" ${status === 'all' ? 'selected' : ''}>全部赛事</option>
              <option value="complete" ${status === 'complete' ? 'selected' : ''}>六维完整</option>
              <option value="partial" ${status === 'partial' ? 'selected' : ''}>部分可核</option>
              <option value="platform" ${status === 'platform' ? 'selected' : ''}>平台赛事</option>
            </select>
          </div>
        </div>
        ${state.personalResult ? personalSummary(state.personalResult) : ''}
        <div id="rankTableWrap">${mainTable(state, q, status)}</div>
        <div class="flex-between mt-12" style="flex-wrap:wrap">
          <span class="tiny muted">${state.personalResult ? '个人榜只展示有同院系当届条款的赛事。' : '通用分只对六维完整赛事产生；缺项赛事保留可核区间，不用猜测补分。'}</span>
          <span class="flex gap-6"><a class="inline-link" href="#research">${icon('search', 12)} 联网核对一条证据</a><a class="inline-link" href="#method">${icon('book', 12)} 看评分口径</a></span>
        </div>
      </section>
    </div>
  </div>`;
  bindNeedCard(state, rerender);
  bindList(state);
  const search = document.getElementById('rankSearch');
  const update = () => {
    state.rankQuery = search.value;
    const wrap = document.getElementById('rankTableWrap');
    if (wrap) {
      wrap.innerHTML = mainTable(state, state.rankQuery, state.rankStatus || 'all');
      bindList(state);
    }
  };
  search?.addEventListener('input', () => {
    clearTimeout(search._timer);
    search._timer = setTimeout(update, 160);
  });
  const statusSelect = document.getElementById('rankStatus');
  statusSelect?.addEventListener('change', () => {
    state.rankStatus = statusSelect.value;
    update();
  });
}