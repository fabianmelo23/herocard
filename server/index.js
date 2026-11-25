import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Optional .env (SMTP settings etc.) — must load before modules that read process.env.
const ENV_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const { db, DEMO_MODE } = await import('./db.js');
const { cardPdf } = await import('./pdf.js');
const { sendMail, cardEmail, mailConfigured } = await import('./mailer.js');
import { hashPassword, verifyPassword, newToken, DUMMY_HASH } from './auth.js';
import { securityHeaders, sameOriginOnly, RateLimiter, hashToken, passwordProblem, EMAIL_RE } from './security.js';
import { ALL_ITEMS, ITEM_KEYS, RATINGS, CHECKLIST } from '../public/js/checklist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 30;
const COOKIE = 'hc_session';

// Bind to localhost by default; set HOST=0.0.0.0 to test from other devices on the LAN.
const HOST = process.env.HOST || '127.0.0.1';
// Only trust X-Forwarded-* when actually behind a reverse proxy (set TRUST_PROXY=1 there).
// Trusting it blindly lets clients spoof their IP and bypass rate limits.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY ? 1 : false);
app.use(securityHeaders({ https: TRUST_PROXY }));
app.use('/api', sameOriginOnly);
app.use(express.json({ limit: '100kb' }));

// ---------- helpers ---------------------------------------------------------
const ITEM_CATEGORY = Object.fromEntries(ALL_ITEMS.map((i) => [i.key, i.category]));
const ITEM_LABEL = Object.fromEntries(ALL_ITEMS.map((i) => [i.key, i.en]));

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = req.secure;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`
  );
}

const publicUser = (u) =>
  u && {
    id: u.id, name: u.name, email: u.email, role: u.role, observer_id: u.observer_id,
    craft: u.craft, supervisor_id: u.supervisor_id, active: !!u.active, created_at: u.created_at,
  };

function auth(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return res.status(401).json({ error: 'auth_required' });
  const row = db
    .prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
              WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`)
    .get(hashToken(token));
  if (!row) return res.status(401).json({ error: 'auth_required' });
  req.user = row;
  req.sessionHash = hashToken(token);
  next();
}

const supervisorOnly = (req, res, next) =>
  req.user.role === 'supervisor' ? next() : res.status(403).json({ error: 'forbidden' });

// ids of the users whose cards the current user may see
function visibleUserIds(user) {
  if (user.role !== 'supervisor') return [user.id];
  return db
    .prepare('SELECT id FROM users WHERE supervisor_id = ? OR id = ?')
    .all(user.id, user.id)
    .map((r) => r.id);
}

const placeholders = (arr) => arr.map(() => '?').join(',');
// Local (server time zone) calendar dates, YYYY-MM-DD.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const today = () => daysAgo(0);
const clean = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- auth ------------------------------------------------------------
function startSession(req, res, userId) {
  const token = newToken();
  db.prepare(`INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,datetime('now', ?))`)
    .run(hashToken(token), userId, `+${SESSION_DAYS} days`);
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
  setSessionCookie(req, res, token, SESSION_DAYS * 86400);
}

const loginByIp = new RateLimiter({ windowMs: 15 * 60000, max: 20 });
const loginByEmail = new RateLimiter({ windowMs: 15 * 60000, max: 8 });
const registerByIp = new RateLimiter({ windowMs: 60 * 60000, max: 8 });
const mailBySupervisor = new RateLimiter({ windowMs: 60 * 60000, max: 40 });
app.post('/api/auth/login', async (req, res) => {
  const email = clean(req.body?.email, 200).toLowerCase();
  const password = String(req.body?.password || '').slice(0, 256);
  // Per-IP and per-account limits: slows down both spraying and targeted guessing.
  if (loginByIp.blocked(req.ip) || loginByEmail.blocked(email)) return res.status(429).json({ error: 'too_many_attempts' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Always run scrypt, even for unknown emails, so timing does not reveal which accounts exist.
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !user.active || !ok) {
    loginByIp.hit(req.ip); loginByEmail.hit(email);
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  loginByEmail.reset(email);
  startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

// Public self-registration: always creates a *worker*, assigned to the default supervisor
// (the first active supervisor) so the new card history is visible to someone.
app.post('/api/auth/register', async (req, res) => {
  if (registerByIp.blocked(req.ip)) return res.status(429).json({ error: 'too_many_attempts' });
  registerByIp.hit(req.ip);

  const b = req.body || {};
  const name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase(), observer_id = clean(b.observer_id, 40);
  const craft = clean(b.craft, 80), password = String(b.password || ''), confirm = String(b.confirm || '');
  if (!name || !observer_id || !craft || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'missing_fields' });
  const weak = passwordProblem(password);
  if (weak) return res.status(400).json({ error: weak });
  if (password !== confirm) return res.status(400).json({ error: 'password_mismatch' });

  const sup = db.prepare(`SELECT id FROM users WHERE role = 'supervisor' AND active = 1 ORDER BY id LIMIT 1`).get();
  try {
    const r = db.prepare(`INSERT INTO users (name,email,password_hash,role,observer_id,craft,supervisor_id) VALUES (?,?,?,?,?,?,?)`)
      .run(name, email, await hashPassword(password), 'worker', observer_id, craft, sup?.id ?? null);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid));
    startSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'duplicate_user' });
    throw e;
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  const sup = req.user.supervisor_id
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.supervisor_id)
    : null;
  res.json({ user: { ...publicUser(req.user), supervisor_name: sup?.name || null }, mail_configured: mailConfigured() });
});

const pwChangeByUser = new RateLimiter({ windowMs: 15 * 60000, max: 6 });
app.post('/api/me/password', auth, async (req, res) => {
  if (pwChangeByUser.blocked(req.user.id)) return res.status(429).json({ error: 'too_many_attempts' });
  const { current, next: nextPw } = req.body || {};
  if (!(await verifyPassword(String(current || '').slice(0, 256), req.user.password_hash))) {
    pwChangeByUser.hit(req.user.id);
    return res.status(400).json({ error: 'wrong_password' });
  }
  const weak = passwordProblem(nextPw);
  if (weak) return res.status(400).json({ error: weak });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(nextPw), req.user.id);
  // Sign out every other device; keep the current session.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(req.user.id, req.sessionHash);
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => res.json({ demo: DEMO_MODE }));

// ---------- checklist ---------------------------------------------------------
app.get('/api/checklist', (_req, res) => res.json({ checklist: CHECKLIST }));

// ---------- cards -------------------------------------------------------------
app.post('/api/cards', auth, (req, res) => {
  const b = req.body || {};
  const ratings = b.ratings && typeof b.ratings === 'object' ? b.ratings : {};
  const entries = Object.entries(ratings).filter(([k, v]) => ITEM_KEYS.has(k) && RATINGS.includes(v));
  if (!entries.length) return res.status(400).json({ error: 'no_ratings' });

  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : today();
  const time = /^\d{2}:\d{2}$/.test(b.time) ? b.time : new Date().toTimeString().slice(0, 5);
  const location = clean(b.location, 160);
  const craft = clean(b.craft, 80) || req.user.craft || '';
  if (!location) return res.status(400).json({ error: 'location_required' });

  const ci = entries.filter(([, v]) => v === 'I').length;
  const cc = entries.filter(([, v]) => v === 'C').length;
  const cs = entries.length - ci - cc;
  const summary = clean(b.intervention_summary);
  const done = clean(b.what_was_done);
  if ((ci || cc) && !summary) return res.status(400).json({ error: 'summary_required' });

  const uuid = clean(b.client_uuid, 64) || null;
  if (uuid) {
    const dup = db.prepare('SELECT id FROM cards WHERE client_uuid = ?').get(uuid);
    if (dup) return res.json({ id: dup.id, duplicate: true });
  }

  db.exec('BEGIN');
  try {
    const r = db.prepare(`INSERT INTO cards
        (client_uuid,user_id,completed_by,card_date,card_time,location,craft,observer_id,
         intervention_summary,what_was_done,count_s,count_i,count_c,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uuid, req.user.id, req.user.role, date, time, location, craft, req.user.observer_id,
           summary || null, done || null, cs, ci, cc, ci ? 'open' : 'submitted');
    const id = Number(r.lastInsertRowid);
    const ins = db.prepare('INSERT INTO card_items (card_id,item_key,category,rating) VALUES (?,?,?,?)');
    for (const [k, v] of entries) ins.run(id, k, ITEM_CATEGORY[k], v);
    db.exec('COMMIT');
    res.status(201).json({ id });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

app.get('/api/cards', auth, (req, res) => {
  const ids = visibleUserIds(req.user);
  const where = [`c.user_id IN (${placeholders(ids)})`];
  const params = [...ids];
  const q = req.query;
  if (q.status && ['submitted', 'open', 'closed'].includes(q.status)) { where.push('c.status = ?'); params.push(q.status); }
  if (q.user && req.user.role === 'supervisor') { where.push('c.user_id = ?'); params.push(Number(q.user)); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || '')) { where.push('c.card_date >= ?'); params.push(q.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.to || '')) { where.push('c.card_date <= ?'); params.push(q.to); }
  if (q.search) {
    where.push('(c.location LIKE ? OR u.name LIKE ? OR c.intervention_summary LIKE ?)');
    const s = `%${clean(q.search, 80)}%`;
    params.push(s, s, s);
  }
  const limit = Math.min(Number(q.limit) || 50, 200);
  const offset = Math.max(Number(q.offset) || 0, 0);
  const rows = db
    .prepare(`SELECT c.*, u.name AS user_name FROM cards c JOIN users u ON u.id = c.user_id
              WHERE ${where.join(' AND ')}
              ORDER BY c.card_date DESC, c.card_time DESC, c.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit + 1, offset);
  res.json({ cards: rows.slice(0, limit), has_more: rows.length > limit });
});

function loadCard(req, res) {
  const card = db
    .prepare(`SELECT c.*, u.name AS user_name, u.email AS user_email, r.name AS reviewer_name FROM cards c
              JOIN users u ON u.id = c.user_id LEFT JOIN users r ON r.id = c.reviewed_by
              WHERE c.id = ?`)
    .get(Number(req.params.id));
  if (!card || !visibleUserIds(req.user).includes(card.user_id)) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return card;
}

const withRatings = (card) => {
  const items = db.prepare('SELECT item_key, rating FROM card_items WHERE card_id = ?').all(card.id);
  return { ...card, ratings: Object.fromEntries(items.map((i) => [i.item_key, i.rating])) };
};
const pickLang = (v) => (v === 'es' ? 'es' : 'en');

app.get('/api/cards/:id', auth, (req, res) => {
  const card = loadCard(req, res);
  if (!card) return;
  res.json({ card: withRatings(card) });
});

// Printable PDF of a card (anyone who can see the card).
app.get('/api/cards/:id/pdf', auth, async (req, res) => {
  const card = loadCard(req, res);
  if (!card) return;
  const pdf = await cardPdf(withRatings(card), pickLang(req.query.lang));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="HERO-Card-${card.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
});

// Supervisor emails the card PDF — by default to the email of the card's owner
// (the address entered when the account was created).
app.post('/api/cards/:id/email', auth, supervisorOnly, async (req, res) => {
  const card = loadCard(req, res);
  if (!card) return;
  if (mailBySupervisor.blocked(req.user.id)) return res.status(429).json({ error: 'too_many_attempts' });
  // The recipient is always the card owner's registered email — never a client-supplied
  // address — so the endpoint cannot be abused to send mail to arbitrary people.
  const to = card.user_email;
  if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'invalid_email' });
  const lang = pickLang(req.body?.lang);
  const full = withRatings(card);
  try {
    const pdf = await cardPdf(full, lang);
    const { subject, html, text } = cardEmail(full, lang);
    const r = await sendMail({
      to, subject, html, text, replyTo: req.user.email,
      attachments: [{ filename: `HERO-Card-${card.id}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
    mailBySupervisor.hit(req.user.id);
    res.json({ ok: true, to, mode: r.mode });
  } catch (e) {
    console.error('email failed:', e.message);
    res.status(502).json({ error: 'email_failed' });
  }
});

// Supervisor closes a card: every open "I" becomes "C" (corrected).
app.post('/api/cards/:id/close', auth, supervisorOnly, (req, res) => {
  const card = loadCard(req, res);
  if (!card) return;
  const comment = clean(req.body?.comment, 1000);
  db.exec('BEGIN');
  db.prepare(`UPDATE card_items SET rating = 'C' WHERE card_id = ? AND rating = 'I'`).run(card.id);
  db.prepare(`UPDATE cards SET status = 'closed', count_c = count_c + count_i, count_i = 0,
              reviewed_by = ?, reviewed_at = datetime('now', 'localtime'), review_comment = ? WHERE id = ?`)
    .run(req.user.id, comment || null, card.id);
  db.exec('COMMIT');
  res.json({ ok: true });
});

app.get('/api/export.csv', auth, supervisorOnly, (req, res) => {
  const ids = visibleUserIds(req.user);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : daysAgo(30);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : today();
  const cards = db
    .prepare(`SELECT c.*, u.name AS user_name FROM cards c JOIN users u ON u.id = c.user_id
              WHERE c.user_id IN (${placeholders(ids)}) AND c.card_date BETWEEN ? AND ?
              ORDER BY c.card_date, c.card_time`)
    .all(...ids, from, to);
  const items = db.prepare('SELECT item_key, rating FROM card_items WHERE card_id = ?');
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // CSV formula-injection guard
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Card #', 'Date', 'Time', 'Observer', 'Observer ID', 'Completed By', 'Location', 'Craft', 'Status',
    'S', 'I', 'C', ...ALL_ITEMS.map((i) => i.en), 'Intervention Summary', 'What was done', 'Review comment'];
  const lines = [head.map(esc).join(',')];
  for (const c of cards) {
    const r = Object.fromEntries(items.all(c.id).map((i) => [i.item_key, i.rating]));
    lines.push([c.id, c.card_date, c.card_time, c.user_name, c.observer_id, c.completed_by, c.location, c.craft,
      c.status, c.count_s, c.count_i, c.count_c, ...ALL_ITEMS.map((i) => r[i.key] || ''),
      c.intervention_summary, c.what_was_done, c.review_comment].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hero-cards_${from}_${to}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

// ---------- stats -------------------------------------------------------------
app.get('/api/stats/me', auth, (req, res) => {
  const uid = req.user.id;
  const dates = new Set(
    db.prepare('SELECT DISTINCT card_date FROM cards WHERE user_id = ? AND card_date >= ?').all(uid, daysAgo(400)).map((r) => r.card_date)
  );
  let streak = 0;
  for (let d = dates.has(today()) ? 0 : 1; dates.has(daysAgo(d)); d++) streak++;
  const t = db.prepare(`SELECT COUNT(*) AS cards, COALESCE(SUM(count_s),0) s, COALESCE(SUM(count_i),0) i,
                               COALESCE(SUM(count_c),0) c FROM cards WHERE user_id = ? AND card_date >= ?`).get(uid, daysAgo(29));
  const total = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE user_id = ?').get(uid).n;
  const open = db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND status = 'open'`).get(uid).n;
  const week = [];
  for (let d = 6; d >= 0; d--) week.push({ date: daysAgo(d), done: dates.has(daysAgo(d)) });
  const obs = t.s + t.i + t.c;
  res.json({
    streak, total, open, done_today: dates.has(today()), week,
    last30: { cards: t.cards, observations: obs, safe_pct: obs ? Math.round((t.s / obs) * 100) : null, interventions: t.i + t.c },
  });
});

app.get('/api/stats/team', auth, supervisorOnly, (req, res) => {
  const ids = visibleUserIds(req.user);
  const ph = placeholders(ids);
  const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);
  const from = daysAgo(days - 1);

  const workers = db.prepare(`SELECT id, name, craft, observer_id FROM users WHERE supervisor_id = ? AND active = 1 ORDER BY name`).all(req.user.id);
  const todayRows = db.prepare(`SELECT DISTINCT user_id FROM cards WHERE card_date = ? AND user_id IN (${ph})`).all(today(), ...ids);
  const doneToday = new Set(todayRows.map((r) => r.user_id));

  const totals = db.prepare(`SELECT COUNT(*) cards, COALESCE(SUM(count_s),0) s, COALESCE(SUM(count_i),0) i, COALESCE(SUM(count_c),0) c
                             FROM cards WHERE card_date >= ? AND user_id IN (${ph})`).get(from, ...ids);
  const open = db.prepare(`SELECT COUNT(*) n FROM cards WHERE status = 'open' AND user_id IN (${ph})`).get(...ids).n;

  const perDay = db.prepare(`SELECT card_date d, COUNT(*) cards, SUM(count_i + count_c) interventions
                             FROM cards WHERE card_date >= ? AND user_id IN (${ph}) GROUP BY card_date`).all(from, ...ids);
  const dayMap = Object.fromEntries(perDay.map((r) => [r.d, r]));
  const trend = [];
  for (let d = days - 1; d >= 0; d--) {
    const k = daysAgo(d);
    trend.push({ date: k, cards: dayMap[k]?.cards || 0, interventions: dayMap[k]?.interventions || 0 });
  }

  const risks = db.prepare(`SELECT ci.item_key, SUM(ci.rating = 'I') open, SUM(ci.rating IN ('I','C')) total
                            FROM card_items ci JOIN cards c ON c.id = ci.card_id
                            WHERE c.card_date >= ? AND c.user_id IN (${ph}) AND ci.rating IN ('I','C')
                            GROUP BY ci.item_key ORDER BY total DESC LIMIT 6`).all(from, ...ids)
    .map((r) => ({ ...r, label: ITEM_LABEL[r.item_key] }));

  const byCat = db.prepare(`SELECT ci.category, SUM(ci.rating='S') s, SUM(ci.rating='I') i, SUM(ci.rating='C') c
                            FROM card_items ci JOIN cards c ON c.id = ci.card_id
                            WHERE c.card_date >= ? AND c.user_id IN (${ph}) GROUP BY ci.category`).all(from, ...ids);

  const leaderboard = db.prepare(`SELECT u.id, u.name, COUNT(c.id) cards FROM users u
                                  LEFT JOIN cards c ON c.user_id = u.id AND c.card_date >= ?
                                  WHERE u.supervisor_id = ? AND u.active = 1 GROUP BY u.id ORDER BY cards DESC`).all(from, req.user.id);

  const obs = totals.s + totals.i + totals.c;
  res.json({
    days,
    team_size: workers.length,
    submitted_today: workers.filter((w) => doneToday.has(w.id)).length,
    missing_today: workers.filter((w) => !doneToday.has(w.id)),
    open_interventions: open,
    totals: { ...totals, observations: obs, safe_pct: obs ? Math.round((totals.s / obs) * 1000) / 10 : null },
    trend, risks, by_category: byCat, leaderboard,
  });
});

// ---------- users (supervisor) -------------------------------------------------
app.get('/api/users', auth, supervisorOnly, (req, res) => {
  const rows = db.prepare(`SELECT u.*, (SELECT MAX(card_date) FROM cards WHERE user_id = u.id) AS last_card,
                                  (SELECT COUNT(*) FROM cards WHERE user_id = u.id) AS card_count
                           FROM users u WHERE u.supervisor_id = ? ORDER BY u.active DESC, u.name`).all(req.user.id);
  res.json({ users: rows.map((u) => ({ ...publicUser(u), last_card: u.last_card, card_count: u.card_count })) });
});

app.post('/api/users', auth, supervisorOnly, async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase(), observer_id = clean(b.observer_id, 40);
  const craft = clean(b.craft, 80), password = String(b.password || '');
  const role = b.role === 'supervisor' ? 'supervisor' : 'worker';
  if (!name || !EMAIL_RE.test(email) || !observer_id) return res.status(400).json({ error: 'missing_fields' });
  const weak = passwordProblem(password);
  if (weak) return res.status(400).json({ error: weak });
  try {
    const r = db.prepare(`INSERT INTO users (name,email,password_hash,role,observer_id,craft,supervisor_id) VALUES (?,?,?,?,?,?,?)`)
      .run(name, email, await hashPassword(password), role, observer_id, craft || null, req.user.id);
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid))) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'duplicate_user' });
    throw e;
  }
});

app.patch('/api/users/:id', auth, supervisorOnly, async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND supervisor_id = ?').get(Number(req.params.id), req.user.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  if (typeof b.active === 'boolean') {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, u.id);
    if (!b.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  if (b.craft !== undefined) db.prepare('UPDATE users SET craft = ? WHERE id = ?').run(clean(b.craft, 80) || null, u.id);
  if (b.password) {
    const weak = passwordProblem(b.password);
    if (weak) return res.status(400).json({ error: weak });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(String(b.password)), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id); // force re-login everywhere
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

// ---------- static / SPA ----------------------------------------------------------
const PUBLIC = join(__dirname, '..', 'public');
app.use(express.static(PUBLIC, {
  dotfiles: 'ignore', index: 'index.html', redirect: false,
  setHeaders(res, path) {
    if (path.endsWith('sw.js') || path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    if (path.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
  },
}));
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((req, res) => res.sendFile(join(PUBLIC, 'index.html')));

app.use((err, _req, res, _next) => {
  // Malformed / oversized JSON → client error, without echoing details back.
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, HOST, () => console.log(`HERO Card running → http://${HOST}:${PORT}`));
