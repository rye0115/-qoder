const $ = sel => document.querySelector(sel);

const state = {
  meta: null,
  events: [],
  current: null,
  preset: 'balanced',
  view: 'overview',
  busy: false
};

const STAGE_FALLBACK = [
  ['parse', '解析条件'],
  ['plan', '生成检索计划'],
  ['search', '检索'],
  ['fetch', '抓取与快照'],
  ['extract', '抽取证据'],
  ['score', '维度打分'],
  ['finalize', '指数与置信度']
];

const MODE_LABEL = {
  archive: '已核验档案',
  import: '导入 · 早期研究数据',
  live: '实时检索 · 模型抽取',
  'live-heuristic': '实时检索 · 启发式抽取'
};

const nf = new Intl.NumberFormat('zh-CN');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  try {
    const u = new URL(String(url), location.href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

function fmtNum(n) {
  return typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—';
}

function pct(ratio, digits = 2) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '—';
  const v = ratio * 100;
  return `${v.toFixed(v < 1 ? digits : 1)}%`;
}

function domainOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function dimName(id) {
  return state.meta?.dimensions.find(d => d.id === id)?.name || id;
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- navigation ---------- */

function showView(view) {
  const known = ['overview', 'board', 'method'];
  if (!known.includes(view)) view = 'overview';
  state.view = view;
  for (const id of known) $(`#view-${id}`).hidden = id !== view;
  document.querySelectorAll('#nav button').forEach(btn => {
    if (btn.dataset.view === view) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function wireNavigation() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', ev => {
      const view = el.dataset.view;
      if (!view) return;
      if (el.tagName === 'A') ev.preventDefault();
      if (location.hash === `#${view}`) showView(view);
      else location.hash = view;
    });
  });
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
}

/* ---------- header / meta ---------- */

function renderMeta() {
  const { providers, archive } = state.meta;
  const list = $('#archive-list');
  list.innerHTML = archive.map(item => `<option value="${esc(item.name)}"></option>`).join('');

  const chip = $('#mode-chip');
  const live = Boolean(providers.search);
  const imported = archive.filter(item => item.origin === 'import').length;
  chip.classList.toggle('live', live);
  chip.textContent = live
    ? `${providers.search}${providers.llm ? ' · 模型' : ' · 无模型'}`
    : `档案 + 导入 · ${archive.length} 项`;

  const note = $('#provider-note');
  note.classList.remove('warn');
  if (providers.search && providers.llm) {
    note.textContent = `实时检索已启用：${providers.search} 检索，${providers.llm} 抽取证据。未命中档案的赛事会现场检索，结果存入本地库。`;
  } else if (providers.search) {
    note.textContent = `实时检索已启用（${providers.search}），但未配置模型，新赛事将使用关键词启发式抽取，结论需人工复核。`;
    note.classList.add('warn');
  } else {
    note.textContent = `当前为档案模式：可回放 ${archive.length} 项档案，其中 ${imported} 项为早期研究数据导入，可查看证据链但不再实时核验。在 .env 填入检索与模型密钥并重启，即可现场研究新赛事。`;
    note.classList.add('warn');
  }
}

/* ---------- scoring helpers (client-side preset switch) ---------- */

function indexFor(result, key) {
  const s = result.scores;
  const weights = state.meta.weights[key];
  let sum = 0;
  let mass = 0;
  for (const [dim, w] of Object.entries(weights)) {
    if (typeof s[dim] === 'number') {
      sum += s[dim] * w;
      mass += w;
    }
  }
  return mass ? sum / mass : null;
}

function compositeFor(post, career, preset) {
  if (post == null && career == null) return null;
  if (post == null) return career;
  if (career == null) return post;
  const mix = state.meta.composite[preset] || state.meta.composite.balanced;
  return post * mix.postgrad + career * mix.career;
}

function currentScores(result, preset) {
  const post = indexFor(result, 'postgrad');
  const career = indexFor(result, 'career');
  const usable = result.indexes.coverage >= 0.6;
  return {
    postgrad: usable && post != null ? Math.round(post) : null,
    career: usable && career != null ? Math.round(career) : null,
    composite: usable ? Math.round(compositeFor(post, career, preset)) : null,
    coverage: result.indexes.coverage
  };
}

/* ---------- board ---------- */

function renderBoard() {
  const body = $('#board-body');
  if (!body) return;
  const rows = state.events
    .map(r => ({ r, sc: currentScores(r, 'balanced') }))
    .sort((a, b) => {
      if (a.sc.composite == null && b.sc.composite == null) return a.r.name.localeCompare(b.r.name, 'zh');
      if (a.sc.composite == null) return 1;
      if (b.sc.composite == null) return -1;
      return b.sc.composite - a.sc.composite;
    });

  if (!rows.length) {
    body.innerHTML = '<div class="empty"><p>还没有已完成的赛事研究。</p></div>';
    return;
  }

  const has = r => (r.scores ? Object.values(r.scores).filter(v => typeof v === 'number').length : 0);
  const stateChip = r => {
    if (r.indexes?.composite != null) return '<span class="state ok">已出分</span>';
    if (has(r)) return '<span class="state partial">部分维度</span>';
    return '<span class="state">待核</span>';
  };

  body.innerHTML = `
    <table class="board-table">
      <thead>
        <tr>
          <th>赛事</th><th>升学</th><th>就业</th><th>综合</th><th>置信度</th><th>分区</th><th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(({ r, sc }) => `
          <tr data-id="${esc(r.id)}" tabindex="0">
            <td>
              <span class="bname">${esc(r.name)}</span>
              <span class="bmeta">${esc([r.meta?.host, r.meta?.field, r.updatedAt].filter(Boolean).join(' · '))}${r.mode === 'import' ? ' · 导入' : ''}</span>
            </td>
            <td class="mono">${sc.postgrad ?? '—'}</td>
            <td class="mono">${sc.career ?? '—'}</td>
            <td class="mono">${sc.composite ?? '—'}</td>
            <td class="mono">${typeof r.confidence === 'number' ? r.confidence.toFixed(2) : '—'}</td>
            <td>${esc(r.tier?.label || '—')}</td>
            <td>${stateChip(r)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <p class="provider-note" style="margin-top:12px">点任意一行载入研究详情。综合分按均衡口径（升学 45 / 就业 55）排序；覆盖不足六成的赛事不出分。</p>
  `;

  body.querySelectorAll('tr[data-id]').forEach(row => {
    const open = () => {
      const item = state.events.find(e => e.id === row.dataset.id);
      if (!item) return;
      state.preset = 'balanced';
      state.current = item;
      syncForm(item, { preset: 'balanced' });
      renderResult(item);
      location.hash = 'overview';
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
    });
  });
}

/* ---------- result ---------- */

function renderResult(result) {
  state.current = result;
  const sc = currentScores(result, state.preset);

  const mix = state.meta.composite[state.preset];
  const presetName = state.meta.presets.find(p => p.id === state.preset)?.name || '均衡';
  const metaBits = [
    result.meta?.host ? `主办 ${result.meta.host}` : null,
    result.meta?.founded ? `${result.meta.founded} 年创办` : null,
    result.meta?.level,
    result.meta?.field
  ].filter(Boolean).map(esc).join(' · ');

  const domains = new Set(result.evidence.map(e => e.domain).filter(Boolean)).size;
  const scored = Object.values(result.scores).filter(v => typeof v === 'number').length;
  const conf = typeof result.confidence === 'number' ? result.confidence : 0;

  const root = $('#canvas');
  root.innerHTML = `
    <article class="result">
      <header class="result-head">
        <div>
          <p class="kicker">${esc(MODE_LABEL[result.mode] || result.mode)} · ${esc(result.id)}</p>
          <h2>${esc(result.name)}</h2>
          <p class="meta">${metaBits || '主办与层级待核'}</p>
          <p class="meta">档案更新 ${esc(result.updatedAt || '—')} · ${scored}/8 维出分 · ${domains} 个独立来源</p>
          ${result.mode === 'import' ? `<p class="meta">${esc(result.coverageNote || '')}</p>` : ''}
        </div>
        <div class="conf">
          <span>置信度</span>
          <b>${typeof result.confidence === 'number' ? result.confidence.toFixed(2) : '—'}</b>
          <div class="meter"><i style="width:${Math.round(conf * 100)}%"></i></div>
          <span style="margin-top:6px">覆盖 ${pct(result.indexes.coverage, 0)} · ${result.evidence.length} 条采信</span>
        </div>
      </header>

      <div class="score-grid" id="score-grid">
        <div class="score s-post">
          <span>升学影响力</span>
          <b>${sc.postgrad ?? '—'}</b>
          <small>${sc.postgrad == null ? '覆盖不足，暂不出分' : '高校采信 30 · 官方准入 20 · 评审 15'}</small>
        </div>
        <div class="score s-career">
          <span>就业影响力</span>
          <b>${sc.career ?? '—'}</b>
          <small>${sc.career == null ? '覆盖不足，暂不出分' : '企业采信 30 · 评审 15 · 稀缺 15'}</small>
        </div>
        <div class="score s-comp">
          <span>综合（${esc(presetName)}）</span>
          <b>${sc.composite ?? '—'}</b>
          <small>${sc.composite == null ? '覆盖不足，暂不出分' : `升学 ${Math.round(mix.postgrad * 100)}% · 就业 ${Math.round(mix.career * 100)}%`}</small>
        </div>
      </div>

      <div class="preset-bar" role="group" aria-label="综合口径">
        <span>综合口径</span>
        ${state.meta.presets.map(p => `
          <button type="button" data-preset="${esc(p.id)}" aria-pressed="${p.id === state.preset}">${esc(p.name)}</button>
        `).join('')}
        <span>切换只改变综合分，两条通道指数不变</span>
      </div>

      <section class="tier">
        <div class="tier-label">${esc(result.tier?.label || '未分区')}</div>
        <div>
          <p>${esc(result.tier?.reason || tierExplain(result))}</p>
          <p class="mono">同组样本 ${fmtNum(result.input?.cohortN)} 项 · 分区门槛 20 项 · 同一指数下同年度 / 同人群 / 同领域</p>
        </div>
      </section>

      ${renderDims(result)}
      ${renderScarcity(result)}
      ${renderEvidence(result)}
      ${renderExcluded(result)}
      ${renderGaps(result)}
      ${renderQueries(result)}
    </article>
  `;

  root.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.busy) return;
      state.preset = btn.dataset.preset;
      renderResult(state.current);
    });
  });
}

function tierExplain(result) {
  if (result.indexes.composite == null) return '有效证据覆盖不足 60%，按规则不出指数，也就不进入分区。';
  return '同组样本不足 20 项，只给指数与置信度，不给一区到四区；补齐同组赛事后再判定。';
}

function renderDims(result) {
  const weightsOn = state.meta.weights;
  const rows = result.dims.map(d => {
    const has = typeof d.score === 'number';
    const evLinks = d.evidence.length
      ? d.evidence.map(id => `<a class="ev-link" href="#ev-${esc(keyOf(result))}-${esc(id)}" title="跳转到证据 ${esc(id)}">${esc(id)}</a>`).join('')
      : '<span style="color:var(--muted);font-size:11.5px">无</span>';
    return `
      <tr>
        <td class="dname">${esc(d.name)}<span class="dhint">${esc(d.hint)}</span></td>
        <td>
          <div class="bar ${has ? '' : 'na'}"><i style="width:${has ? Math.max(2, d.score) : 100}%"></i></div>
        </td>
        <td class="num ${has ? '' : 'na'}">${has ? d.score : '待核'}</td>
        <td class="wt">${d.postgrad} / ${d.career}</td>
        <td class="ev-count">${evLinks}</td>
      </tr>`;
  }).join('');

  return `
    <section class="block">
      <div class="block-head">
        <h3>八个维度</h3>
        <p>权重按「升学 / 就业」显示 · 缺失维度从分母中剔除，不按 0 分计</p>
      </div>
      <table class="dims">
        <thead>
          <tr><th>维度</th><th>强度</th><th>分数</th><th>权重</th><th>证据</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="hint" style="margin-top:10px">权重总量：升学 ${Object.values(weightsOn.postgrad).reduce((a, b) => a + b, 0)} · 就业 ${Object.values(weightsOn.career).reduce((a, b) => a + b, 0)}。点证据编号跳转到原文摘录。</p>
    </section>`;
}

function renderScarcity(result) {
  const s = result.scarcity;
  if (!s || typeof s.numerator !== 'number' || typeof s.denominator !== 'number') {
    return `
      <section class="block">
        <div class="block-head"><h3>奖项稀缺</h3><p>未取得同届同组的分子与分母，暂不打分</p></div>
        <p class="hint">需要国奖数量 ÷ 同届、同组、同一入口的有效参赛数；省奖与校赛不能混入分母。</p>
      </section>`;
  }
  const ratio = s.numerator / s.denominator;
  return `
    <section class="block">
      <div class="block-head"><h3>奖项稀缺口径</h3><p>${esc(s.unit || '')}${s.year ? ` · ${esc(s.year)}` : ''}</p></div>
      <div class="callout" style="margin-bottom:0">
        <span class="num" style="display:inline">${fmtNum(s.numerator)}</span>
        &nbsp;÷&nbsp;
        <span class="num" style="display:inline">${fmtNum(s.denominator)}</span>
        &nbsp;=&nbsp;
        <b style="font-family:var(--mono)">${pct(ratio)}</b>
        <span style="color:var(--muted);display:block;margin-top:6px">${esc(s.note || '')}</span>
      </div>
    </section>`;
}

function keyOf(result) {
  return String(result.id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function renderEvidence(result) {
  if (!result.evidence.length) {
    return `<section class="block"><div class="block-head"><h3>证据链</h3></div><p class="hint">尚未采信任何来源。</p></section>`;
  }
  const items = result.evidence.map(e => {
    const url = safeUrl(e.url);
    const title = e.title || e.domain || '未命名来源';
    const tags = [
      e.publishedAt,
      ...(e.dims || []).map(dimName),
      e.kind
    ].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `
      <li id="ev-${esc(keyOf(result))}-${esc(e.id)}">
        <div class="ev-head">
          <span class="grade g-${esc(e.grade || 'C')}" title="证据等级 ${esc(e.grade || 'C')}">${esc(e.grade || 'C')}</span>
          ${url
            ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`
            : `<span style="font-weight:600">${esc(title)}</span>`}
          <span class="domain">${esc(e.domain || domainOf(e.url))}</span>
          <span class="domain">${esc(e.id)}</span>
        </div>
        ${e.quote ? `<p class="quote">${esc(e.quote)}</p>` : ''}
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </li>`;
  }).join('');
  return `
    <section class="block">
      <div class="block-head"><h3>证据链</h3><p>A 政府 / 官方 · B 高校 / 学会 · C 二手或待核 · 共 ${result.evidence.length} 条</p></div>
      <ol class="evidence">${items}</ol>
    </section>`;
}

function renderExcluded(result) {
  if (!result.excluded.length) return '';
  return `
    <section class="block">
      <details class="excluded">
        <summary>已排除 ${result.excluded.length} 条材料 <span>不计入采信</span></summary>
        <ul class="excluded-list">
          ${result.excluded.map(x => `<li><b>${esc(x.title)}</b><span>${esc(x.reason)}</span></li>`).join('')}
        </ul>
      </details>
    </section>`;
}

function renderGaps(result) {
  const gaps = result.gaps || [];
  const conflicts = result.conflicts || [];
  if (!gaps.length && !conflicts.length) return '';
  return `
    <section class="block">
      <div class="block-head"><h3>缺口与矛盾</h3><p>未取得或相互冲突的信息会压低置信度</p></div>
      ${conflicts.length ? `<ul class="conflicts">${conflicts.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${gaps.length ? `<ol class="gaps">${gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ol>` : ''}
    </section>`;
}

function renderQueries(result) {
  if (!result.queries?.length) return '';
  return `
    <section class="block">
      <details class="excluded">
        <summary>研究轨迹 · ${result.queries.length} 条查询 <span>${esc(result.coverageNote || '')}</span></summary>
        <ul class="excluded-list">
          ${result.queries.map(q => `<li><b>${esc(result.name)}</b><span>${esc(q.replace(result.name, '').trim() || q)}</span></li>`).join('')}
        </ul>
      </details>
    </section>`;
}

/* ---------- research ---------- */

function readInput() {
  const scope = document.querySelector('input[name="scope"]:checked')?.value || 'balanced';
  const year = Number($('#f-year').value);
  const cohort = Number($('#f-cohort').value);
  return {
    name: $('#f-name').value.trim(),
    year: Number.isFinite(year) && year > 1900 ? Math.round(year) : null,
    level: $('#f-level').value,
    field: $('#f-field').value.trim() || null,
    scope,
    cohortN: Number.isFinite(cohort) ? Math.max(0, Math.min(200, Math.round(cohort))) : 0
  };
}

function setBusy(busy) {
  state.busy = busy;
  const btn = $('#run-btn');
  btn.disabled = busy;
  btn.textContent = busy ? '研究中…' : '开始研究';
}

function renderProgress(stages, input) {
  const list = stages.length
    ? stages
    : STAGE_FALLBACK.map(([id, name]) => ({ id, name, status: 'pending', note: '' }));
  const statusClass = { pending: '', running: 'running', done: 'done', error: 'error' };
  $('#canvas').innerHTML = `
    <div class="progress">
      <h2>正在研究 ${esc(input.name)}</h2>
      <p class="sub">${esc([input.year, input.level, input.field].filter(Boolean).join(' · '))} · 口径 ${esc(input.scope)}</p>
      <ul class="stages">
        ${list.map(s => `
          <li class="st ${statusClass[s.status] || ''}">
            <span class="dot"></span>
            <b>${esc(s.name)}</b>
            <em>${esc(s.note || (s.status === 'running' ? '进行中' : '等待'))}</em>
          </li>`).join('')}
      </ul>
    </div>`;
}

function renderError(title, message) {
  $('#canvas').innerHTML = `
    <div class="error-box">
      <p class="kicker">中断</p>
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
    </div>`;
}

async function pollJob(jobId, input) {
  for (let i = 0; i < 200; i += 1) {
    await new Promise(r => setTimeout(r, 400));
    let job;
    try {
      job = await api(`/api/jobs/${encodeURIComponent(jobId)}`);
    } catch (err) {
      if (err.status === 404) throw new Error('任务已过期，请重新提交。');
      throw err;
    }
    renderProgress(job.stages || [], input);
    if (job.status === 'done') return job.result;
    if (job.status === 'error') throw new Error(job.error || '研究失败');
  }
  throw new Error('研究超时，请缩小范围后重试。');
}

async function onSubmit(ev) {
  ev.preventDefault();
  if (state.busy) return;
  const input = readInput();
  if (!input.name) {
    toast('请填写赛事名称');
    $('#f-name').focus();
    return;
  }
  state.preset = input.scope;
  setBusy(true);
  renderProgress([], input);
  try {
    const { jobId } = await api('/api/research', { method: 'POST', body: JSON.stringify(input) });
    const result = await pollJob(jobId, input);
    const idx = state.events.findIndex(e => e.id === result.id);
    if (idx >= 0) state.events[idx] = result;
    else state.events.unshift(result);
    renderBoard();
    renderResult(result);
    toast(`完成：置信度 ${result.confidence.toFixed(2)}${result.indexes.composite == null ? ' · 覆盖不足未出分' : ''}`);
  } catch (err) {
    renderError(err.status === 404 ? '研究任务不存在' : '研究未能完成', err.message);
  } finally {
    setBusy(false);
  }
}

/* ---------- method ---------- */

function renderMethod() {
  const { dimensions, weights, composite } = state.meta;
  const total = key => Object.values(weights[key]).reduce((a, b) => a + b, 0);
  const importedCount = state.meta.archive.filter(a => a.origin === 'import').length;
  $('#method-body').innerHTML = `
    <div class="method-grid">
      <div class="prose">
        <h2>三问，而不是一个排行榜</h2>
        <p>“含金量”是三个问题的叠加：赛事本身办得是否严格；外部机构是否真的采信；奖项是否稀缺。三者互不替代，所以竞衡不合并成一个模糊的印象分，而是分别量化后给出两条指数。</p>

        <h2>两个通道</h2>
        <p>升学影响力与就业影响力使用同一组维度、不同的权重。升学看高校采信与官方准入；就业看企业采信与奖项稀缺。两个通道都缺证据时，不出指数。</p>
        <table class="weights">
          <thead><tr><th>维度</th><th style="text-align:right">升学</th><th style="text-align:right">就业</th></tr></thead>
          <tbody>
            ${dimensions.map(d => `<tr><td>${esc(d.name)}</td><td class="n">${weights.postgrad[d.id]}</td><td class="n">${weights.career[d.id]}</td></tr>`).join('')}
            <tr><td><b>合计</b></td><td class="n">${total('postgrad')}</td><td class="n">${total('career')}</td></tr>
          </tbody>
        </table>
        <p class="hint" style="margin-top:10px">缺失维度不按 0 分计，而是从分母中剔除并按剩余权重重新归一；因此“证据少”体现为置信度低，而不是分数被拉低。</p>

        <h2>两个指数怎么合成</h2>
        <p>默认均衡口径：升学 ${Math.round(composite.balanced.postgrad * 100)}% + 就业 ${Math.round(composite.balanced.career * 100)}%。升学优先为 ${Math.round(composite.postgrad.postgrad * 100)} / ${Math.round(composite.postgrad.career * 100)}，就业优先为 ${Math.round(composite.career.postgrad * 100)} / ${Math.round(composite.career.career * 100)}。切换只影响综合分，不改变两条通道本身。</p>

        <h2>置信度，不是装饰</h2>
        <p>置信度 = 覆盖度 × 0.5 + 来源独立性 × 0.25 + 证据质量 × 0.25 − 冲突惩罚。冲突每条扣 0.09，最多扣 0.30。覆盖度低于 60% 时，宁可不给指数。</p>
        <div class="callout">分区是排名工具，不是质量断言。必须同年度、同人群、同领域至少 20 项，才生成一区到四区；不足 20 项一律“未分区”。竞衡不拿单项赛事去和全领域混排。</div>

        <h2>反刷分规则</h2>
        <ul>
          <li>主办方自述、赞助商与关联企业的表述，不计入“高校采信 / 企业采信”。</li>
          <li>二手榜单、培训机构宣传、聚合站信息，只能作 C 级线索，不足以单独出分。</li>
          <li>同名赛事必须分开：全国大学生数学建模竞赛 ≠ 华为杯研究生数学建模竞赛。</li>
          <li>获奖率必须同届、同组、同一入口：国奖数 ÷ 本科组有效参赛队，省奖与校赛不得混入分母。</li>
          <li>“有推免资格”不等于“该赛事加推免分”，必须落到本校条款原文。</li>
        </ul>

        <h2>证据等级</h2>
        <ul>
          <li><b>A</b> 政府、教育行政部门、赛事官方章程与公示。</li>
          <li><b>B</b> 高校官网细则、学会公告、可核验的企业招聘页。</li>
          <li><b>C</b> 新闻转述、聚合榜单、机构宣传，仅作线索。</li>
        </ul>

        <h2>启动时导入的数据</h2>
        <p>服务启动时会自动载入早期研究阶段整理的 ${importedCount} 项赛事档案：84 项目录、9 项赛事证据、15 份推免细则、16 条招聘记录。它们与现场研究走同一套八维公式；缺证据的维度仍标为待核，不因“导入”而默认可信。</p>

        <h2>实时模式的边界</h2>
        <p>未命中档案时，研究代理会按固定查询模板检索公开网页，抓取政府、高校与学会页面，再交给模型抽取证据并打分；也可在没有模型时用启发式规则兜底，但会明确标注“需人工复核”。没有配置检索与模型密钥时，只能回放已核验档案，不能研究新赛事。</p>
      </div>
      <aside class="prose">
        <h2>分数怎么读</h2>
        <p>80 分以上表示有直接、可核验的制度性采信；60–79 表示有零散证据但不成体系；60 以下表示以宣传或间接信息为主。任何分数都必须和置信度一起读。</p>

        <h2>奖项稀缺映射</h2>
        <p>把“国奖率”取对数后映射到 0–100，避免头部赛事之间因小数点差异被无限放大。</p>
        <table class="weights">
          <thead><tr><th>国奖率</th><th style="text-align:right">稀缺分</th></tr></thead>
          <tbody>
            <tr><td>0.3%</td><td class="n">96</td></tr>
            <tr><td>0.5%</td><td class="n">93</td></tr>
            <tr><td>1%</td><td class="n">88</td></tr>
            <tr><td>2%</td><td class="n">82</td></tr>
            <tr><td>5%</td><td class="n">70</td></tr>
            <tr><td>10%</td><td class="n">60</td></tr>
            <tr><td>20%</td><td class="n">46</td></tr>
            <tr><td>33%</td><td class="n">33</td></tr>
          </tbody>
        </table>

        <h2>已知局限</h2>
        <ul>
          <li>企业采信样本天然少于高校条款，就业指数对招聘页覆盖更敏感。</li>
          <li>各校推免细则差异大，本校结论必须回查本校文件。</li>
          <li>档案库中的历史数据有归档日期，政策变化后需重新核验。</li>
          <li>分区阈值与权重是可讨论的方法选择，不是自然常数。</li>
        </ul>

        <h2>引用与核验</h2>
        <p>每条采信证据都保留来源链接、原文摘录、等级与所属维度。结论页的排除清单列出未采信的材料及原因，方便逐条复核，而不是只给一个分数。</p>
      </aside>
    </div>`;
}

/* ---------- init ---------- */

function syncForm(result, { preset } = {}) {
  if (!result) return;
  const input = result.input || {};
  $('#f-name').value = result.name || '';
  if (Number.isInteger(input.year) && input.year > 1900) $('#f-year').value = input.year;
  if (input.level) {
    const select = $('#f-level');
    if (![...select.options].some(o => o.value === input.level)) {
      select.add(new Option(input.level, input.level));
    }
    select.value = input.level;
  }
  if (input.field) $('#f-field').value = input.field;
  if (Number(input.cohortN) > 0) $('#f-cohort').value = input.cohortN;
  const scope = preset || input.scope || 'balanced';
  state.preset = scope;
  const radio = document.querySelector(`input[name="scope"][value="${scope}"]`);
  if (radio) radio.checked = true;
}

async function init() {
  wireNavigation();
  $('#research-form').addEventListener('submit', onSubmit);
  try {
    const [meta, events] = await Promise.all([api('/api/meta'), api('/api/events')]);
    state.meta = meta;
    state.events = events.events || [];
    renderMeta();
    renderMethod();
    renderBoard();

    const wanted = new URLSearchParams(location.search).get('event');
    const first = (wanted && state.events.find(e => e.id === wanted)) ||
      state.events.find(e => e.indexes?.composite != null) || state.events[0];
    if (first) {
      state.current = first;
      syncForm(first);
      renderResult(first);
    }
    showView(location.hash.slice(1) || 'overview');
  } catch (err) {
    renderError('无法载入研究台', `${err.message}。请确认本地服务已启动。`);
  }
}

init();