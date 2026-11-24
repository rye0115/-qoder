export async function apiGet(path) {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const error = new Error(data?.error || data?.detail || `请求失败（${res.status}）`);
    error.payload = data;
    throw error;
  }
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || data?.reason || data?.verification?.reason || `请求失败（${res.status}）`);
    error.payload = data;
    throw error;
  }
  return data;
}

export async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `请求失败（${res.status}）`);
  return data;
}