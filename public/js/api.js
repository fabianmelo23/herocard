// Fetch wrapper + offline outbox for card submissions.
const OUTBOX = 'hc_outbox';

export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('offline', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
  return data;
}

export const outbox = {
  list: () => JSON.parse(localStorage.getItem(OUTBOX) || '[]'),
  save: (arr) => localStorage.setItem(OUTBOX, JSON.stringify(arr)),
  add(card) { const l = outbox.list(); l.push(card); outbox.save(l); },
  async flush() {
    const pending = outbox.list();
    if (!pending.length || !navigator.onLine) return 0;
    let sent = 0;
    const keep = [];
    for (const card of pending) {
      try { await api('/api/cards', { method: 'POST', body: card }); sent++; }
      catch (e) { if (e.code === 'offline' || e.status >= 500 || e.status === 401) keep.push(card); }
    }
    outbox.save(keep);
    return sent;
  },
};

// Submits a card, falling back to the outbox when the network is unavailable.
export async function submitCard(card) {
  try {
    const r = await api('/api/cards', { method: 'POST', body: card });
    return { id: r.id, offline: false };
  } catch (e) {
    if (e.code === 'offline' || e.status === 503) {
      outbox.add(card);
      return { id: null, offline: true };
    }
    throw e;
  }
}
