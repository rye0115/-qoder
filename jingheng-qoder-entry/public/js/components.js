import { apiPost } from './api.js';
import { esc, icon, hostLabel, safeUrl, fmt, cleanText, dateCn } from './utils.js';

export const NAV = [
  { href: '#rank', key: 'rank', label: '赛事推荐' },
  { href: '#research', key: 'research', label: '联网检索' },
  { href: '#overview', key: 'overview', label: '样本总览' },
  { href: '#records', key: 'records', label: '赛事档案' },
  { href: '#method', key: 'method', label: '评价方法' }
];

export function logoMark(size = 38) {
  return `<span class="brand-mark" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.29)}px" aria-hidden="true">
    <svg viewBox="0 0 64 64" width="${Math.round(size * 0.6)}" height="${Math.round(size * 0.6)}">
      <path d="M12 16h10v32H12zM27 16h27v9H38v3h15v8H38v3h16v9H27z" fill="currentColor"/>
    </svg>
  </span>`;
}

export function renderHeader(active = 'rank') {
  const nav = NAV.map((item) => `<a class="nav-link ${active === item.key ? 'active' : ''}" href="${item.href}" ${active === item.key ? 'aria-current="page"' : ''}>${item.label}</a>`).join('');
  return `<div class="header-inner">
    <a class="brand" href="#rank" aria-label="竞衡首页">
      ${logoMark(38)}
      <span><span class="brand-name">竞衡</span><span class="brand-sub">STUDYHACK · 竞赛价值评估</span></span>
    </a>
    <nav class="header-nav" aria-label="主要导航">${nav}</nav>
    <div class="header-side">
      <span class="status-dot" aria-hidden="true"></span>
      <span>六份输入已核对</span>
      <span class="header-pill">2026.11 口径</span>
    </div>
  </div>`;
}

export function renderFooter() {
  return `<div class="footer-inner">
    <div class="footer-brand">
      ${logoMark(32)}
      <div>
        <div class="footer-title">竞衡 · 让竞赛选择有据可查</div>
        <div class="footer-desc">把赛事规则、招聘原文、去向案例与推免细则放在同一套可核口径里。演示样本与推荐榜数据相互独立。</div>
      </div>
    </div>
    <div class="footer-links">
      <a href="#rank">赛事推荐</a>
      <a href="#research">联网检索</a>
      <a href="#employment">就业证据库</a>
      <a href="#method">评价方法</a>
      <a href="#overview">样本总览</a>
    </div>
    <div class="footer-meta">
      <span>研究口径 · 2026 年 11 月 · 六份输入即时计算</span>
      <span>本机评审版 · 不代理原项目 · 公网发布前需独立复核</span>
    </div>
  </div>`;
}

export function bindHeader() {
  // Header is static; the active state is re-rendered by the router.
}

export function scoreClass(score, coverage = 100) {
  if (score == null) return 'pending';
  if (coverage >= 100) return 'good';
  return '';
}

export function statusBadge(status) {
  if (status === 'complete') return '<span class="badge badge-green"><span class="dot-live"></span>六维完整</span>';
  if (status === 'partial') return '<span class="badge badge-amber">部分可核</span>';
  if (status === 'platform') return '<span class="badge badge-blue">平台线索</span>';
  return '<span class="badge badge-gray">待补证</span>';
}

export function sourceLinks(sources, max = 3, label = '原文') {
  const valid = (sources || []).filter((s) => s && s.url);
  if (!valid.length) return '<span class="tiny muted">目录索引，原文链接待补</span>';
  return `<div class="source-links">${valid.slice(0, max).map((s) => {
    const url = safeUrl(s.url);
    if (!url) return '';
    return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('link', 9)} ${esc(hostLabel(url) || label)}</a>`;
  }).join('')}${valid.length > max ? `<span class="source-link">+${valid.length - max}</span>` : ''}</div>`;
}

export function dimensionBars(rating) {
  return `<div class="dim-grid">${rating.dimensions.map((d) => {
    const value = d.score;
    return `<div class="dim-item">
      <div class="dim-head"><span>${esc(d.name)}</span><span>${value == null ? '待核' : fmt(value)}</span></div>
      <div class="dim-bar" aria-hidden="true"><span style="width:${value == null ? 0 : Math.max(2, value)}%"></span></div>
      <p class="dim-fact">${d.evidence?.text ? esc(cleanText(d.evidence.text, 110)) : '暂无可解析原文，保留待核。'}</p>
    </div>`;
  }).join('')}</div>`;
}

export function scopeBox(text, note = '') {
  return `<div class="scope-box">${esc(text)}${note ? `<br><span class="tiny">${esc(note)}</span>` : ''}</div>`;
}

export function modal({ title, subtitle = '', body = '', footer = '', wide = false, onMount = null, className = '' }) {
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<section class="modal ${wide ? 'wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
    <button class="modal-close" type="button" aria-label="关闭">${icon('close', 16)}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </section>`;
  root.appendChild(wrap);
  const close = () => {
    wrap.remove();
    if (!document.querySelector('.modal-backdrop')) document.body.style.overflow = '';
  };
  document.body.style.overflow = 'hidden';
  wrap.querySelector('.modal-close')?.addEventListener('click', close);
  wrap.addEventListener('click', (event) => { if (event.target === wrap) close(); });
  const onKey = (event) => {
    if (event.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('input, button, textarea, select')?.focus();
  if (onMount) onMount(wrap, close);
  return { root: wrap, close };
}

export function toast(message, type = '') {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => el.remove(), 220);
  }, 3400);
}

export function emptyState(title, text, action = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon('search', 20)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

export function evidenceLink(item) {
  const url = safeUrl(item.url);
  if (!url) return `<span class="badge badge-gray">目录索引</span>`;
  return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('external', 10)} ${esc(hostLabel(url) || '原文')}</a>`;
}

export function evidenceTag(item) {
  if (item.class === 'community') return '<span class="badge badge-amber">社区自述</span>';
  if (item.class === 'outcome') return '<span class="badge badge-purple">签约去向</span>';
  if (item.class === 'general') return '<span class="badge badge-gray">通用材料</span>';
  if ((item.policyScore ?? 0) >= 90 || (item.effect === '直通')) return '<span class="badge badge-green">明确分值 / 直通</span>';
  return '<span class="badge badge-blue">明确条款</span>';
}

export function openJobMatcher(eventName) {
  const { close } = modal({
    title: '按我的条件匹配岗位',
    subtitle: '岗位结果只使用招聘原文与校方去向；没有适用条款的组合会明确待核。',
    body: `
      <div class="modal-grid">
        <div class="field"><label for="jmRole">目标岗位</label><input id="jmRole" placeholder="例如：后端、算法、机械工程师"></div>
        <div class="field"><label for="jmCompany">目标公司（可留空）</label><input id="jmCompany" placeholder="例如：腾讯、华为"></div>
        <div class="field"><label for="jmAward">你的最高奖级</label><select id="jmAward"><option value="">尚未填写</option><option value="nat1">国家级一等奖</option><option value="nat2">国家级二等奖</option><option value="nat3">国家级三等奖</option><option value="prov1">省级一等奖</option><option value="prov2">省级二等奖</option><option value="prov3">省级三等奖</option></select></div>
        <div class="field"><label for="jmDirection">求职目标</label><select id="jmDirection"><option>探索方向</option><option>积累项目经历</option><option>争取校招面试</option></select></div>
      </div>
      <div class="modal-note mt-8">${esc(eventName)} · 匹配分 = 政策力度 × 25% + 招聘方覆盖 × 55% + 进入条件 × 20%。已限定公司且命中时覆盖取 100。</div>
      <div id="jmResult" class="mt-12"></div>`,
    footer: `<button class="btn btn-outline" data-close>稍后再看</button><button class="btn btn-primary" id="jmRun">计算匹配</button>`,
    onMount(root, done) {
      root.querySelector('[data-close]')?.addEventListener('click', done);
      root.querySelector('#jmRun')?.addEventListener('click', async () => {
        const out = root.querySelector('#jmResult');
        const run = root.querySelector('#jmRun');
        run.disabled = true;
        run.textContent = '计算中…';
        out.innerHTML = '<div class="modal-note">正在核对招聘原文…</div>';
        try {
          const data = await apiPost('/api/jobs', {
            event: eventName,
            role: root.querySelector('#jmRole').value.trim(),
            company: root.querySelector('#jmCompany').value.trim(),
            award: root.querySelector('#jmAward').value,
            direction: root.querySelector('#jmDirection').value
          });
          if (!data.ok) throw new Error(data.error || '没有识别出赛事');
          const item = data.items?.[0];
          if (!item) {
            out.innerHTML = `<div class="check-result bad">没有找到适用条款。${data.error ? esc(data.error) : '可改用“按岗找赛”查看其他赛事。'}</div>`;
          } else {
            const fit = item.fitDetail || {};
            out.innerHTML = `<div class="check-result ok">
              <strong>${esc(item.name)}</strong> · 需求匹配 <strong>${fmt(item.fit)}</strong> / 100
              <div class="check-list">
                <span class="ok">政策力度 ${fit.policy == null ? '待核' : fit.policy}</span>
                <span class="ok">招聘方覆盖 ${fmt(fit.coverage)}</span>
                <span class="ok">进入条件 ${fit.entry == null ? '待核' : fit.entry}</span>
              </div>
              <div class="tiny mt-8">${fit.fit == null ? '当前奖级与岗位组合仍缺可核条款。' : `个人综合分 ${fmt(item.composite)}（就业占比 35%）`}</div>
            </div>`;
          }
        } catch (error) {
          out.innerHTML = `<div class="check-result bad">${esc(error.message)}</div>`;
        } finally {
          run.disabled = false;
          run.textContent = '再算一次';
        }
      });
    }
  });
  return close;
}

export function sourceSummary(sources, empty = '原文待补') {
  const list = (sources || []).filter((s) => s && s.url);
  if (!list.length) return `<span class="tiny muted">${esc(empty)}</span>`;
  return list.slice(0, 2).map((s) => `<a class="source-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${icon('external', 9)} ${esc(hostLabel(s.url))}</a>`).join('') + (list.length > 2 ? `<span class="source-link">+${list.length - 2}</span>` : '');
}

export function personalContext(result) {
  const c = result.context || {};
  return `<div class="context-tags">
    <span class="context-tag">${esc(c.school || '')} · ${esc(c.unit || '')}</span>
    <span class="context-tag">${esc(c.cohort || '')} 届</span>
    <span class="context-tag">目标 ${awardLabel(c.award)}</span>
    <span class="context-tag">${c.place ? `团队第 ${c.place}` : '顺位未填'}</span>
    <span class="context-tag">目标适配 ${Math.round((c.targetWeight || 0.5) * 100)}%</span>
  </div>`;
}

export function awardLabel(award) {
  return ({
    nat1: '国一', nat2: '国二', nat3: '国三',
    prov1: '省一', prov2: '省二', prov3: '省三'
  })[award] || '未填奖级';
}

export function publishedLabel(value) {
  return value ? dateCn(value) : '日期待核';
}