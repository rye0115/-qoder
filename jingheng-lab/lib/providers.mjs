const TIMEOUT = 15000;

export function providerInfo() {
  const search = process.env.TAVILY_API_KEY ? 'tavily' : process.env.SERPER_API_KEY ? 'serper' : null;
  const llm = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY) ? (process.env.LLM_MODEL || 'gpt-4.1-mini') : null;
  return { search, llm };
}

export const hasSearch = () => Boolean(providerInfo().search);
export const hasLLM = () => Boolean(providerInfo().llm);

async function postJSON(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`上游接口 ${res.status}: ${text.slice(0, 180)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('上游接口返回了非 JSON 内容');
  }
}

export async function searchWeb(query) {
  if (process.env.TAVILY_API_KEY) {
    const data = await postJSON('https://api.tavily.com/search', {
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`
    }, { query, max_results: 6, search_depth: 'basic', include_answer: false });
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.content || '').slice(0, 600)
    }));
  }
  if (process.env.SERPER_API_KEY) {
    const data = await postJSON('https://google.serper.dev/search', {
      'x-api-key': process.env.SERPER_API_KEY
    }, { q: query, num: 10, gl: 'cn', hl: 'zh-cn' });
    return (data.organic || []).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: (r.snippet || '').slice(0, 600)
    }));
  }
  throw Object.assign(new Error('未配置检索服务'), { code: 'NO_PROVIDER' });
}

export async function chatJSON(system, user) {
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'gpt-4.1-mini';
  if (!key) throw Object.assign(new Error('未配置模型服务'), { code: 'NO_PROVIDER' });
  const data = await postJSON(`${base}/chat/completions`, {
    authorization: `Bearer ${key}`
  }, {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });
  const raw = data.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('模型返回的内容不是合法 JSON');
  }
}

export async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; JinghengResearch/0.1; +local)',
      accept: 'text/html,application/xhtml+xml'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT)
  });
  const type = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`抓取失败 ${res.status}`);
  if (!type.includes('html') && !type.includes('text/plain')) throw new Error(`不支持的内容类型 ${type.split(';')[0]}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return {
    url,
    finalUrl: res.url,
    domain: new URL(res.url).hostname,
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim(),
    text: text.slice(0, 14000)
  };
}