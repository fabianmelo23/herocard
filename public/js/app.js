import { api, outbox, submitCard, ApiError } from './api.js';
import { t, label, getLang, setLang, fmtDate, fmtTime } from './i18n.js';
import { icon } from './icons.js';
import { CHECKLIST, ALL_ITEMS } from './checklist.js';
import { barChart, hBars, stackRows, bindChartTips } from './charts.js';

// ---------------------------------------------------------------- utilities
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const initials = (n) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const errMsg = (e) => { const k = `err_${e?.code}`; const m = t(k); return m === k ? t('err_generic') : m; };
const ITEM = Object.fromEntries(ALL_ITEMS.map((i) => [i.key, i]));
const CAT = Object.fromEntries(CHECKLIST.map((c) => [c.key, c]));

const state = { user: null, installPrompt: null, demo: false };

// ---------------------------------------------------------------- theme
function applyTheme() {
  const th = localStorage.getItem('hc_theme') || 'system';
  if (th === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
  const dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#0A1628' : '#0B2545';
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------------------------------------------------------------- toasts & modal
export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  const ic = { err: 'alert', warn: 'wifiOff', info: 'mail' }[kind] || 'checkCircle';
  el.innerHTML = `${icon(ic, 18)}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

function modal(html, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', close));
  onMount?.($('.modal', root), close);
  $('.modal input, .modal textarea', root)?.focus();
  return close;
}

// ---------------------------------------------------------------- shared bits
const statusBadge = (s) => {
  const ic = s === 'open' ? 'alert' : s === 'closed' ? 'shield' : 'checkCircle';
  return `<span class="badge badge-${s}">${icon(ic, 14)}${t('status_' + s)}</span>`;
};
const avatar = (name, size = '') => `<span class="avatar ${size}" aria-hidden="true">${esc(initials(name))}</span>`;

function cardRow(c, showName = false) {
  return `<a class="card-row" href="#/cards/${c.id}">
    <div class="card-row-date"><b>${esc(fmtDate(c.card_date, { day: 'numeric' }))}</b><span>${esc(fmtDate(c.card_date, { month: 'short' }))}</span></div>
    <div class="card-row-main">
      <div class="card-row-title">${showName ? esc(c.user_name) : esc(c.location)}</div>
      <div class="card-row-meta">${showName ? `${icon('mapPin', 13)}${esc(c.location)} · ` : ''}${icon('clock', 13)}${esc(fmtTime(c.card_time))}</div>
    </div>
    <div class="card-row-counts">
      <span class="pill pill-s" title="${t('legend_s')}">${c.count_s}</span>
      ${c.count_i ? `<span class="pill pill-i" title="${t('legend_i')}">${c.count_i}</span>` : ''}
      ${c.count_c ? `<span class="pill pill-c" title="${t('legend_c')}">${c.count_c}</span>` : ''}
    </div>
    ${statusBadge(c.status)}
    ${icon('chevronRight', 18, 'chev')}
  </a>`;
}

const skeleton = (n = 3) => `<div class="stack-gap">${'<div class="sk"></div>'.repeat(n)}</div>`;

// ---------------------------------------------------------------- shell
function navItems() {
  return state.user.role === 'supervisor'
    ? [
        { href: '#/', ic: 'chart', key: 'nav_dashboard' },
        { href: '#/cards', ic: 'list', key: 'nav_cards' },
        { href: '#/new', ic: 'plus', key: 'nav_new', fab: true },
        { href: '#/team', ic: 'users', key: 'nav_team' },
        { href: '#/profile', ic: 'user', key: 'nav_profile' },
      ]
    : [
        { href: '#/', ic: 'home', key: 'nav_home' },
        { href: '#/cards', ic: 'list', key: 'nav_history' },
        { href: '#/new', ic: 'plus', key: 'nav_new', fab: true },
        { href: '#/profile', ic: 'user', key: 'nav_profile' },
      ];
}

function renderShell() {
  const u = state.user;
  $('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/"><img src="/icons/icon.svg" alt="" width="36" height="36"/><div><b>HERO Card</b><span>${t(u.role)}</span></div></a>
        <nav class="side-nav">
          ${navItems().map((n) => `<a href="${n.href}" data-nav="${n.href}" class="${n.fab ? 'side-cta' : ''}">${icon(n.ic, 20)}<span>${t(n.key)}</span></a>`).join('')}
        </nav>
        <div class="side-user">${avatar(u.name)}<div><b>${esc(u.name)}</b><span>${esc(u.observer_id)}</span></div>
          <button class="icon-btn" data-logout title="${t('sign_out')}">${icon('logout', 18)}</button></div>
      </aside>
      <div class="main-col">
        <div class="net-banner" hidden></div>
        <main id="view" class="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="${t('nav_main')}">
        <svg class="tab-bump" viewBox="0 0 96 66" aria-hidden="true">
          <defs><linearGradient id="bumpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="bump-stop-a"/><stop offset="1" class="bump-stop-b"/>
          </linearGradient></defs>
          <path class="bump-fill" d="M0 64.5 C24 64.5 26 7 48 7 C70 7 72 64.5 96 64.5 Z"/>
          <path class="bump-line" d="M0 64.5 C24 64.5 26 7 48 7 C70 7 72 64.5 96 64.5"/>
        </svg>
        ${navItems().map((n) => `<a href="${n.href}" data-nav="${n.href}" aria-label="${t(n.key)}">
          <i class="tab-ic">${icon(n.ic, 22)}</i><span>${t(n.key)}</span></a>`).join('')}
      </nav>
    </div>`;
  $('[data-logout]').addEventListener('click', logout);
  updateNetBanner();
}

function updateNetBanner() {
  const b = $('.net-banner');
  if (!b) return;
  const n = outbox.list().length;
  if (!navigator.onLine) { b.hidden = false; b.className = 'net-banner off'; b.innerHTML = `${icon('wifiOff', 16)} ${t('offline')}${n ? ' · ' + t('pending_sync', { n }) : ''}`; }
  else if (n) { b.hidden = false; b.className = 'net-banner sync'; b.innerHTML = `${icon('clock', 16)} ${t('pending_sync', { n })}`; }
  else b.hidden = true;
}

async function syncOutbox() {
  const n = await outbox.flush();
  if (n) { toast(t('synced')); route(); }
  updateNetBanner();
}
addEventListener('online', syncOutbox);
addEventListener('offline', updateNetBanner);

async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  navigator.serviceWorker?.controller?.postMessage('clear-api-cache');
  state.user = null;
  location.hash = '#/';
  renderLogin();
}

// ---------------------------------------------------------------- router
const routes = [
  [/^#?\/?$/, () => (state.user.role === 'supervisor' ? viewDashboard() : viewHome())],
  [/^#\/new$/, () => viewNewCard()],
  [/^#\/cards$/, () => (state.user.role === 'supervisor' ? viewSupCards() : viewHistory())],
  [/^#\/cards\/(\d+)$/, (m) => viewCard(Number(m[1]))],
  [/^#\/team$/, () => (state.user.role === 'supervisor' ? viewTeam() : (location.hash = '#/'))],
  [/^#\/profile$/, () => viewProfile()],
];

function route() {
  if (!state.user) return;
  const h = location.hash || '#/';
  const base = '#/' + (h.split('/')[1] || '');
  document.body.classList.toggle('is-form', base === '#/new');
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (base === '#/' ? '#/' : base)));
  placeBump();
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      const v = $('#view');
      v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
      window.scrollTo({ top: 0 });
      fn(m);
      return;
    }
  }
  location.hash = '#/';
}
addEventListener('hashchange', route);

// Moves the neon "bump" of the mobile tab bar under the active tab (CSS animates the move).
function placeBump() {
  const bar = $('.tabbar');
  if (!bar) return;
  const a = $('a.active', bar);
  bar.classList.toggle('has-active', !!a);
  if (a) bar.style.setProperty('--bump-x', `${a.offsetLeft + a.offsetWidth / 2}px`);
}
addEventListener('resize', placeBump);

// ---------------------------------------------------------------- login / register
// Same rules as server/security.js (the server is the authority; this is just fast feedback).
const passwordProblem = (pw) => (pw.length < 8 ? 'password_too_short' : pw.length > 128 ? 'password_too_long'
  : !/[A-Za-zÀ-ÿ]/.test(pw) || !/\d/.test(pw) ? 'password_weak' : null);
// Password input with a show/hide eye button (wired by one delegated handler below).
function pwField(name, labelText, autocomplete, extra = '') {
  return `<label class="field"><span>${labelText}</span>
    <span class="pw-wrap"><input name="${name}" type="password" autocomplete="${autocomplete}" required ${extra}/>
    <button type="button" class="pw-toggle" aria-label="${t('show_password')}" aria-pressed="false">${icon('eye', 20)}</button></span></label>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.pw-toggle');
  if (!b) return;
  const input = b.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.setAttribute('aria-pressed', String(show));
  b.setAttribute('aria-label', t(show ? 'hide_password' : 'show_password'));
  b.innerHTML = icon(show ? 'eyeOff' : 'eye', 20);
  input.focus();
});

// Floating-label input with a leading icon (label stays visible: accessible, no placeholder-only labels).
function flField({ id, name, type = 'text', label: text, ic, auto = 'off', extra = '', pw = false }) {
  return `<div class="fl ${pw ? 'pw-wrap' : ''}">
    <input id="${id}" name="${name}" type="${type}" placeholder=" " autocomplete="${auto}" required ${extra}/>
    <label for="${id}">${text}</label>${icon(ic, 18, 'fl-ic')}
    ${pw ? `<button type="button" class="pw-toggle" aria-label="${t('show_password')}" aria-pressed="false">${icon('eye', 20)}</button>` : ''}
  </div>`;
}

// Decorative animated circuit board for the auth background (pure SVG, no assets).
function circuitSvg() {
  const traces = [
    'M0 160 H260 L300 200 H520', 'M0 420 H140 L190 370 H360 L400 330', 'M1440 120 H1180 L1140 160 H960',
    'M1440 380 H1270 L1230 420 H1080', 'M0 720 H220 L270 770 H480', 'M1440 760 H1210 L1160 710 H990',
    'M330 0 V90 L370 130 V240', 'M1100 0 V70 L1060 110 V210', 'M620 900 V800 L660 760 V690', 'M880 900 V820 L840 780 V720',
  ];
  const nodes = [[520, 200], [400, 330], [960, 160], [1080, 420], [480, 770], [990, 710], [370, 240], [1060, 210], [660, 690], [840, 720], [260, 160], [1180, 120]];
  return `<svg class="circuit" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g class="c-traces">${traces.map((d) => `<path d="${d}"/>`).join('')}</g>
    <g class="c-pulses">${traces.map((d, i) => `<path d="${d}" style="animation-delay:${(i * 0.7) % 5}s"/>`).join('')}</g>
    <g class="c-nodes">${nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" style="animation-delay:${(i * 0.45) % 4}s"/>`).join('')}</g>
  </svg>`;
}

function renderLogin(mode = 'login') {
  const reg = mode === 'register';
  const langSwitch = `<div class="lang-switch auth-lang">${['en', 'es'].map((l) => `<button type="button" data-lang="${l}" class="${getLang() === l ? 'on' : ''}">${l === 'en' ? 'English' : 'Español'}</button>`).join('')}</div>`;
  $('#app').innerHTML = `
  <div class="auth ${reg ? 'is-register' : ''}">
    ${circuitSvg()}
    <header class="auth-brand"><img src="/icons/icon.svg" alt="" width="40" height="40"/><b>HERO <span>Card</span></b></header>
    <main class="auth-card">
      <section class="auth-pane auth-login" aria-hidden="${reg}">
        <form class="auth-form" data-form="login" novalidate>
          <h2>${t('sign_in')}</h2>
          ${flField({ id: 'li-email', name: 'email', type: 'email', label: t('email'), ic: 'mail', auto: 'username', extra: 'inputmode="email"' })}
          ${flField({ id: 'li-pw', name: 'password', type: 'password', label: t('password'), ic: 'key', auto: 'current-password', pw: true })}
          <p class="form-error" hidden></p>
          <button class="btn btn-primary btn-lg btn-block" type="submit">${t('sign_in')}</button>
          <p class="switch-mode">${t('no_account')} <button type="button" class="link" data-mode="register">${t('register_here')}</button></p>
          ${state.demo ? `<details class="demo">
            <summary>${icon('sparkles', 16)} ${t('demo_accounts')}</summary>
            <div class="demo-grid">
              <button type="button" data-demo="worker@herocard.app">${icon('hardhat', 18)}<div><b>${t('worker')}</b><span>worker@herocard.app</span></div></button>
              <button type="button" data-demo="supervisor@herocard.app">${icon('chart', 18)}<div><b>${t('supervisor')}</b><span>supervisor@herocard.app</span></div></button>
            </div>
            <p class="small">${t('demo_pw')}: <code>Hero2026!</code></p>
          </details>` : ''}
        </form>
      </section>
      <section class="auth-pane auth-register" aria-hidden="${!reg}">
        <form class="auth-form" data-form="register" novalidate>
          <h2>${t('create_account')}</h2>
          ${flField({ id: 'rg-name', name: 'name', label: t('name'), ic: 'user', auto: 'name', extra: 'maxlength="120"' })}
          ${flField({ id: 'rg-email', name: 'email', type: 'email', label: t('email'), ic: 'mail', auto: 'email', extra: 'inputmode="email"' })}
          <div class="two-col">
            ${flField({ id: 'rg-id', name: 'observer_id', label: t('worker_id'), ic: 'hash', extra: 'maxlength="40"' })}
            ${flField({ id: 'rg-craft', name: 'craft', label: t('profession'), ic: 'hardhat', auto: 'organization-title', extra: 'maxlength="80"' })}
          </div>
          ${flField({ id: 'rg-pw', name: 'password', type: 'password', label: t('password'), ic: 'key', auto: 'new-password', pw: true, extra: 'minlength="8"' })}
          ${flField({ id: 'rg-pw2', name: 'confirm', type: 'password', label: t('repeat_password'), ic: 'key', auto: 'new-password', pw: true, extra: 'minlength="8"' })}
          <small class="hint">${t('pw_hint')}</small>
          <p class="form-error" hidden></p>
          <button class="btn btn-primary btn-lg btn-block" type="submit">${t('register')}</button>
          <p class="switch-mode">${t('have_account')} <button type="button" class="link" data-mode="login">${t('sign_in')}</button></p>
        </form>
      </section>
      <aside class="auth-overlay" aria-hidden="true">
        <div class="auth-msg msg-login"><img src="/icons/icon.svg" alt="" width="54" height="54"/><h3>${t('welcome_back')}</h3><p>${t('welcome_sub')}</p></div>
        <div class="auth-msg msg-register"><img src="/icons/icon.svg" alt="" width="54" height="54"/><h3>${t('hello_friend')}</h3><p>${t('hello_sub')}</p></div>
      </aside>
    </main>
    ${langSwitch}
  </div>`;

  const root = $('.auth');
  const setMode = (m) => {
    mode = m;
    root.classList.toggle('is-register', m === 'register');
    $('.auth-login', root).setAttribute('aria-hidden', String(m === 'register'));
    $('.auth-register', root).setAttribute('aria-hidden', String(m !== 'register'));
    $$('.form-error', root).forEach((e) => (e.hidden = true));
    setTimeout(() => $(`.auth-${m} input`, root)?.focus({ preventScroll: true }), 380);
  };
  $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $$('[data-lang]', root).forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); renderLogin(mode); }));
  const loginForm = $('[data-form="login"]', root);
  $$('[data-demo]', root).forEach((b) => b.addEventListener('click', () => {
    loginForm.email.value = b.dataset.demo; loginForm.password.value = 'Hero2026!'; loginForm.requestSubmit();
  }));

  $$('.auth-form', root).forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isReg = form.dataset.form === 'register';
    const btn = $('button[type=submit]', form), err = $('.form-error', form);
    const label = t(isReg ? 'register' : 'sign_in');
    err.hidden = true;
    const fail = (msg) => { err.textContent = msg; err.hidden = false; btn.disabled = false; btn.textContent = label; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); };
    let body;
    if (isReg) {
      body = Object.fromEntries(new FormData(form));
      if (Object.values(body).some((v) => !String(v).trim())) return fail(t('err_missing_fields'));
      const pwErr = passwordProblem(body.password);
      if (pwErr) return fail(t('err_' + pwErr));
      if (body.password !== body.confirm) return fail(t('err_password_mismatch'));
    } else {
      body = { email: form.email.value, password: form.password.value };
      if (!body.email.trim() || !body.password) return fail(t('err_missing_fields'));
    }
    btn.disabled = true; btn.textContent = t(isReg ? 'registering' : 'signing_in');
    try {
      const { user } = await api(isReg ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body });
      state.user = user;
      if (isReg) toast(t('welcome_new'));
      await boot();
    } catch (ex) { fail(errMsg(ex)); }
  }));
}

// ---------------------------------------------------------------- worker home
async function viewHome() {
  const v = $('#view');
  const u = state.user;
  const h = new Date().getHours();
  const greet = t(h < 12 ? 'good_morning' : h < 18 ? 'good_afternoon' : 'good_evening');
  v.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${esc(fmtDate(localDate(), { weekday: 'long', month: 'long', day: 'numeric' }))}</p>
      <h1>${greet}, ${esc(u.name.split(' ')[0])}</h1></div>
      ${avatar(u.name, 'lg mobile-only')}
    </header>
    <div id="home-body">${skeleton(3)}</div>`;
  try {
    const [st, { cards }] = await Promise.all([api('/api/stats/me'), api('/api/cards?limit=5')]);
    const pending = outbox.list().length;
    const done = st.done_today || pending > 0;
    $('#home-body').innerHTML = `
      <section class="today ${done ? 'is-done' : ''}">
        <div class="today-ic">${icon(done ? 'checkCircle' : 'clipboard', 30)}</div>
        <div class="today-txt"><h2>${t(done ? 'today_done' : 'today_pending')}</h2><p>${t(done ? 'today_done_sub' : 'today_pending_sub')}</p></div>
        <a class="btn ${done ? 'btn-ghost-light' : 'btn-accent'} btn-lg" href="#/new">${icon('plus', 18)} ${t(done ? 'another_card' : 'start_card')}</a>
      </section>

      <section class="grid-stats">
        <div class="stat stat-streak"><div class="stat-ic">${icon('flame', 20)}</div><b>${st.streak}</b><span>${t('streak')}</span></div>
        <div class="stat"><div class="stat-ic">${icon('clipboard', 20)}</div><b>${st.total}</b><span>${t('total_cards')}</span></div>
        <div class="stat"><div class="stat-ic ok">${icon('shield', 20)}</div><b>${st.last30.safe_pct ?? '—'}${st.last30.safe_pct != null ? '%' : ''}</b><span>${t('safe_obs')}</span></div>
        <div class="stat"><div class="stat-ic ${st.open ? 'warn' : ''}">${icon('alert', 20)}</div><b>${st.open}</b><span>${t('open_int')}</span></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('this_week')}</h3></div>
        <div class="week">${st.week.map((d) => `
          <div class="day ${d.done ? 'done' : ''} ${d.date === localDate() ? 'is-today' : ''}">
            <span>${esc(fmtDate(d.date, { weekday: 'narrow' }))}</span>
            <i>${d.done ? icon('check', 16) : ''}</i>
            <small>${esc(fmtDate(d.date, { day: 'numeric' }))}</small>
          </div>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('recent')}</h3><a href="#/cards" class="link">${t('see_all')} ${icon('chevronRight', 16)}</a></div>
        ${cards.length ? `<div class="list">${cards.map((c) => cardRow(c)).join('')}</div>` : `<p class="empty">${t('no_cards')}</p>`}
      </section>`;
  } catch (e) {
    $('#home-body').innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`;
  }
}

// ---------------------------------------------------------------- new card (stepper)
const DRAFT_KEY = () => `hc_draft_${state.user.id}`;

function viewNewCard() {
  const v = $('#view');
  const u = state.user;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY()) || 'null'); } catch {}
  const form = draft || {
    ratings: {}, date: localDate(), time: localTime(), location: localStorage.getItem('hc_last_location') || '',
    craft: u.craft || '', intervention_summary: '', what_was_done: '', step: 0,
  };
  const steps = [...CHECKLIST.map((c) => ({ type: 'cat', cat: c })), { type: 'details' }];
  let step = Math.min(form.step || 0, steps.length - 1);

  const save = () => { form.step = step; localStorage.setItem(DRAFT_KEY(), JSON.stringify(form)); };
  const counts = () => {
    const vals = Object.values(form.ratings);
    return { s: vals.filter((x) => x === 'S').length, i: vals.filter((x) => x === 'I').length, c: vals.filter((x) => x === 'C').length, n: vals.length };
  };
  const catCount = (c) => c.items.filter((i) => form.ratings[i.key]).length;

  v.innerHTML = `
    <header class="form-head">
      <a href="#/" class="icon-btn" aria-label="${t('back')}">${icon('x', 20)}</a>
      <div class="form-head-txt"><p class="eyebrow" id="step-of"></p><h1 id="step-title"></h1></div>
      <div class="form-count" id="form-count"></div>
    </header>
    <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
    <div class="steps-chips" id="chips"></div>
    ${draft ? `<div class="draft-note">${icon('note', 16)} ${t('draft_restored')} <button class="link" id="discard">${t('discard_draft')}</button></div>` : ''}
    <div class="legend">
      <span><b class="rk rk-s">S</b>${t('legend_s')}</span><span><b class="rk rk-i">I</b>${t('legend_i')}</span><span><b class="rk rk-c">C</b>${t('legend_c')}</span>
    </div>
    <div id="step-body" class="step-body"></div>
    <div class="form-foot">
      <button class="btn btn-ghost btn-lg" id="prev">${icon('chevronLeft', 18)} ${t('back')}</button>
      <button class="btn btn-primary btn-lg" id="next"></button>
    </div>`;

  $('#discard')?.addEventListener('click', () => { localStorage.removeItem(DRAFT_KEY()); viewNewCard(); });

  function renderChips() {
    $('#chips').innerHTML = steps.map((s, i) => {
      const name = s.type === 'cat' ? label(s.cat) : t('details');
      const ic = s.type === 'cat' ? s.cat.icon : 'note';
      const n = s.type === 'cat' ? catCount(s.cat) : '';
      return `<button class="chip ${i === step ? 'on' : ''} ${n ? 'has' : ''}" data-step="${i}">${icon(ic, 16)}<span>${esc(name)}</span>${n ? `<em>${n}</em>` : ''}</button>`;
    }).join('');
    $$('#chips [data-step]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.step))));
    $('#chips .on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function renderHeader() {
    const s = steps[step], c = counts();
    $('#step-of').textContent = `${t('step')} ${step + 1} ${t('of')} ${steps.length}`;
    $('#step-title').textContent = s.type === 'cat' ? label(s.cat) : t('review');
    $('#progress-bar').style.width = `${((step + 1) / steps.length) * 100}%`;
    $('#form-count').innerHTML = `<b>${c.n}</b><span>${t('rated')}</span>`;
    $('#prev').style.visibility = step === 0 ? 'hidden' : 'visible';
    $('#next').innerHTML = step === steps.length - 1 ? `${icon('check', 18)} ${t('submit')}` : `${t('next')} ${icon('chevronRight', 18)}`;
  }

  function renderCat(cat) {
    $('#step-body').innerHTML = `
      <div class="cat-tools">
        <span class="muted small">${t('na_hint')}</span>
        <div><button class="btn btn-soft btn-sm" id="all-s">${icon('check', 16)} ${t('mark_all_s')}</button>
        <button class="btn btn-ghost btn-sm" id="clear-cat">${t('clear')}</button></div>
      </div>
      <div class="items">${cat.items.map((it) => `
        <div class="item" data-item="${it.key}">
          <div class="item-label"><b>${esc(label(it))}</b>${getLang() !== 'en' ? `<span>${esc(it.en)}</span>` : ''}</div>
          <div class="seg-ctl" role="radiogroup" aria-label="${esc(label(it))}">
            ${['S', 'I', 'C'].map((r) => `<button type="button" role="radio" class="rate rate-${r.toLowerCase()}" data-r="${r}"
              aria-checked="${form.ratings[it.key] === r}" title="${t('legend_' + r.toLowerCase())}">${r}</button>`).join('')}
          </div>
        </div>`).join('')}
      </div>`;
    $$('.item').forEach((row) => {
      row.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        const k = row.dataset.item;
        form.ratings[k] = form.ratings[k] === b.dataset.r ? undefined : b.dataset.r;
        if (!form.ratings[k]) delete form.ratings[k];
        if (navigator.vibrate) navigator.vibrate(8);
        $$('[data-r]', row).forEach((x) => x.setAttribute('aria-checked', String(form.ratings[k] === x.dataset.r)));
        row.classList.toggle('flash', true); setTimeout(() => row.classList.remove('flash'), 250);
        save(); renderHeader(); renderChips();
      });
    });
    $('#all-s').addEventListener('click', () => {
      cat.items.forEach((i) => { if (!form.ratings[i.key]) form.ratings[i.key] = 'S'; });
      save(); render();
    });
    $('#clear-cat').addEventListener('click', () => { cat.items.forEach((i) => delete form.ratings[i.key]); save(); render(); });
  }

  function renderDetails() {
    const c = counts();
    const needs = c.i + c.c > 0;
    $('#step-body').innerHTML = `
      <div class="summary-tiles">
        <div class="sum sum-s"><b>${c.s}</b><span>${t('legend_s')}</span></div>
        <div class="sum sum-i"><b>${c.i}</b><span>${t('legend_i')}</span></div>
        <div class="sum sum-c"><b>${c.c}</b><span>${t('legend_c')}</span></div>
      </div>
      <form class="details-grid" id="details" novalidate>
        <div class="field full"><span>${t('completed_by')}</span>
          <div class="seg-static"><span class="${u.role === 'supervisor' ? 'on' : ''}">${t('supervisor')}</span><span class="${u.role === 'worker' ? 'on' : ''}">${t('worker')}</span></div></div>
        <label class="field"><span>${icon('calendar', 14)} ${t('date')}</span><input type="date" name="date" value="${esc(form.date)}" max="${localDate()}"/></label>
        <label class="field"><span>${icon('clock', 14)} ${t('time')}</span><input type="time" name="time" value="${esc(form.time)}"/></label>
        <label class="field full"><span>${icon('mapPin', 14)} ${t('location')} *</span><input name="location" value="${esc(form.location)}" placeholder="${t('location_ph')}" maxlength="160" autocomplete="off"/></label>
        <label class="field"><span>${icon('hardhat', 14)} ${t('craft')}</span><input name="craft" value="${esc(form.craft)}" maxlength="80"/></label>
        <label class="field"><span>${icon('hash', 14)} ${t('observer_id')}</span><input value="${esc(u.observer_id)}" readonly class="ro"/></label>
        <label class="field full ${needs ? 'need' : ''}"><span>${t('intervention_summary')}${needs ? ' *' : ''}</span>
          <textarea name="intervention_summary" rows="3" placeholder="${t('summary_ph')}" maxlength="2000">${esc(form.intervention_summary)}</textarea>
          ${needs ? `<small>${t('required_when')}</small>` : ''}</label>
        <label class="field full"><span>${t('what_was_done')}</span>
          <textarea name="what_was_done" rows="3" placeholder="${t('done_ph')}" maxlength="2000">${esc(form.what_was_done)}</textarea></label>
        <p class="form-error full" hidden></p>
      </form>
      ${needs ? `<div class="flagged"><h4>${icon('alert', 16)} ${t('observations')}</h4>${Object.entries(form.ratings).filter(([, r]) => r !== 'S').map(([k, r]) =>
        `<div class="flag-row"><b class="rk rk-${r.toLowerCase()}">${r}</b><span>${esc(label(ITEM[k]))}</span><small>${esc(label(CAT[ITEM[k].category]))}</small></div>`).join('')}</div>` : ''}`;
    $('#details').addEventListener('input', (e) => { if (e.target.name) { form[e.target.name] = e.target.value; save(); } });
  }

  function render() {
    renderHeader(); renderChips();
    const s = steps[step];
    s.type === 'cat' ? renderCat(s.cat) : renderDetails();
  }
  const last = steps.length - 1;
  let lastCat = Math.min(step, last - 1); // category the user came from, so "Back" returns to it
  function go(i) {
    step = Math.max(0, Math.min(last, i));
    if (step < last) lastCat = step;
    save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#prev').addEventListener('click', () => go(step === last ? lastCat : step - 1));
  $('#next').addEventListener('click', async () => {
    // Once anything has been rated, "Next" jumps straight to the details/submit step.
    if (step < last) return go(counts().n > 0 ? last : step + 1);
    const err = $('.form-error');
    const c = counts();
    const fail = (k) => { err.textContent = t(k); err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    if (!c.n) return fail('err_no_ratings');
    if (!form.location.trim()) { $('[name=location]').focus(); return fail('err_location'); }
    if (c.i + c.c > 0 && !form.intervention_summary.trim()) { $('[name=intervention_summary]').focus(); return fail('err_summary'); }
    const btn = $('#next'); btn.disabled = true; btn.textContent = t('submitting');
    try {
      const payload = { ...form, client_uuid: form.client_uuid || (form.client_uuid = uuid()) };
      delete payload.step;
      save();
      const r = await submitCard(payload);
      localStorage.setItem('hc_last_location', form.location.trim());
      localStorage.removeItem(DRAFT_KEY());
      updateNetBanner();
      viewSubmitted(r, c);
    } catch (e) {
      btn.disabled = false; renderHeader(); fail('err_generic'); err.textContent = errMsg(e);
    }
  });

  render();
}

function viewSubmitted(r, c) {
  $('#view').innerHTML = `
    <div class="success">
      <div class="success-badge">${icon(r.offline ? 'wifiOff' : 'check', 44)}</div>
      <h1>${t('submitted_title')}</h1>
      <p>${r.offline ? t('saved_offline') : t('submitted_sub')}</p>
      <div class="summary-tiles small">
        <div class="sum sum-s"><b>${c.s}</b><span>S</span></div>
        <div class="sum sum-i"><b>${c.i}</b><span>I</span></div>
        <div class="sum sum-c"><b>${c.c}</b><span>C</span></div>
      </div>
      <div class="success-actions">
        <a class="btn btn-primary btn-lg" href="#/">${t('go_home')}</a>
        ${r.id ? `<a class="btn btn-ghost btn-lg" href="#/cards/${r.id}">${t('view_card')}</a>` : ''}
      </div>
    </div>`;
  $$('[data-nav]').forEach((a) => a.classList.remove('active'));
  placeBump();
  document.body.classList.remove('is-form');
  history.replaceState(null, '', '#/done'); // lets "New card" navigate again
}

// ---------------------------------------------------------------- history (worker)
async function viewHistory() {
  const v = $('#view');
  let status = '';
  let offset = 0;
  v.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">${t('nav_history')}</p><h1>${t('nav_history')}</h1></div></header>
    <div class="tabs" id="tabs">${[['', 'all'], ['open', 'status_open'], ['closed', 'status_closed'], ['submitted', 'status_submitted']]
      .map(([k, l]) => `<button data-s="${k}" class="${k === status ? 'on' : ''}">${t(l)}</button>`).join('')}</div>
    <div id="list" class="list">${skeleton(5)}</div>
    <div class="center"><button class="btn btn-ghost" id="more" hidden>${t('load_more')}</button></div>`;
  async function load(reset) {
    if (reset) { offset = 0; $('#list').innerHTML = skeleton(5); }
    const r = await api(`/api/cards?limit=20&offset=${offset}${status ? '&status=' + status : ''}`);
    const html = r.cards.map((c) => cardRow(c)).join('');
    if (reset) $('#list').innerHTML = html || `<p class="empty">${t('no_cards')}</p>`; else $('#list').insertAdjacentHTML('beforeend', html);
    offset += r.cards.length;
    $('#more').hidden = !r.has_more;
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => {
    status = b.dataset.s; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(true);
  }));
  $('#more').addEventListener('click', () => load(false));
  load(true).catch((e) => ($('#list').innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`));
}

// ---------------------------------------------------------------- card detail
async function viewCard(id) {
  const v = $('#view');
  v.innerHTML = skeleton(4);
  let card;
  try { ({ card } = await api(`/api/cards/${id}`)); }
  catch (e) { v.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
  const sup = state.user.role === 'supervisor';
  v.innerHTML = `
    <header class="page-head">
      <div><a class="back-link" href="#/cards">${icon('chevronLeft', 16)} ${t(sup ? 'nav_cards' : 'nav_history')}</a>
      <h1>${t('card')} #${card.id}</h1>
      <p class="muted">${esc(card.user_name)} · ${esc(fmtDate(card.card_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</p></div>
      ${statusBadge(card.status)}
    </header>

    <div class="detail-grid">
      <div class="detail-main">
        <section class="panel meta">
          <div><span>${icon('calendar', 14)} ${t('date')}</span><b>${esc(fmtDate(card.card_date))}</b></div>
          <div><span>${icon('clock', 14)} ${t('time')}</span><b>${esc(fmtTime(card.card_time))}</b></div>
          <div><span>${icon('mapPin', 14)} ${t('location')}</span><b>${esc(card.location)}</b></div>
          <div><span>${icon('hardhat', 14)} ${t('craft')}</span><b>${esc(card.craft)}</b></div>
          <div><span>${icon('hash', 14)} ${t('observer_id')}</span><b>${esc(card.observer_id)}</b></div>
          <div><span>${icon('user', 14)} ${t('completed_by')}</span><b>${t(card.completed_by)}</b></div>
        </section>

        ${CHECKLIST.map((cat) => {
          const rated = cat.items.filter((i) => card.ratings[i.key]);
          return `<section class="panel cat-panel">
            <div class="panel-head"><h3>${icon(cat.icon, 18)} ${esc(label(cat))}</h3><span class="muted small">${rated.length}/${cat.items.length}</span></div>
            ${rated.length ? `<div class="rated">${rated.map((i) => `<div class="rated-row"><span>${esc(label(i))}</span><b class="rk rk-${card.ratings[i.key].toLowerCase()}">${card.ratings[i.key]}</b></div>`).join('')}</div>`
              : `<p class="muted small">${t('not_rated')}</p>`}
          </section>`;
        }).join('')}
      </div>
      <aside class="detail-side">
        <section class="panel">
          <div class="summary-tiles small">
            <div class="sum sum-s"><b>${card.count_s}</b><span>S</span></div>
            <div class="sum sum-i"><b>${card.count_i}</b><span>I</span></div>
            <div class="sum sum-c"><b>${card.count_c}</b><span>C</span></div>
          </div>
        </section>
        <section class="panel">
          <h3 class="h-sm">${t('intervention_summary')}</h3>
          <p class="prose">${esc(card.intervention_summary) || '<span class="muted">—</span>'}</p>
          <h3 class="h-sm">${t('what_was_done')}</h3>
          <p class="prose">${esc(card.what_was_done) || '<span class="muted">—</span>'}</p>
        </section>
        ${card.status === 'closed' && card.reviewer_name ? `<section class="panel review-box">
          <h3 class="h-sm">${icon('shield', 16)} ${t('reviewed_by')} ${esc(card.reviewer_name)}</h3>
          <p class="muted small">${esc(fmtDate(card.reviewed_at))}</p>
          ${card.review_comment ? `<p class="prose">${esc(card.review_comment)}</p>` : ''}
        </section>` : ''}
        ${sup && card.status !== 'closed' ? `<button class="btn btn-primary btn-lg btn-block" id="close-card">${icon('shield', 18)} ${t('close_card')}</button>` : ''}
        ${card.status === 'closed' ? `<section class="panel share-box">
          <h3 class="h-sm">${icon('fileText', 16)} ${t('share_card')}</h3>
          <div class="share-actions">
            <button class="btn btn-primary btn-block" data-pdf>${icon('download', 18)} ${t('download_pdf')}</button>
            ${sup ? `<button class="btn btn-ghost btn-block" data-email>${icon('mail', 18)} ${t('send_email')}</button>
            <p class="muted small center">${t('sends_to')} <b>${esc(card.user_email)}</b></p>` : ''}
          </div>
        </section>` : ''}
      </aside>
    </div>`;
  $('[data-pdf]', v)?.addEventListener('click', () => downloadPdf(card));
  $('[data-email]', v)?.addEventListener('click', () => emailDialog(card));
  $('#close-card')?.addEventListener('click', () => {
    modal(`
      <h2>${t('close_card')}</h2>
      <p class="muted">${t('card')} #${card.id} · ${esc(card.user_name)}</p>
      <label class="field"><span>${t('close_comment')}</span><textarea rows="4" id="cmt" placeholder="${t('close_comment_ph')}"></textarea></label>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary" id="ok">${t('confirm_close')}</button></div>`,
    (m, close) => {
      $('#ok', m).addEventListener('click', async () => {
        try {
          await api(`/api/cards/${card.id}/close`, { method: 'POST', body: { comment: $('#cmt', m).value } });
          close();
          await viewCard(card.id);
          closedDialog({ ...card, status: 'closed' });
        } catch (e) { toast(errMsg(e), 'err'); }
      });
    });
  });
}

// Right after closing: offer PDF download and email in one step.
function closedDialog(card) {
  modal(`
    <div class="closed-hero">
      <div class="closed-badge">${icon('check', 34)}</div>
      <h2>${t('closed_ok')}</h2>
      <p class="muted">${t('card')} #${card.id} · ${esc(card.user_name)}</p>
    </div>
    <div class="share-actions">
      <button class="btn btn-primary btn-lg btn-block" data-pdf>${icon('download', 18)} ${t('download_pdf')}</button>
      <button class="btn btn-ghost btn-lg btn-block" data-email>${icon('mail', 18)} ${t('send_email')}</button>
      <p class="muted small center">${t('sends_to')} <b>${esc(card.user_email)}</b></p>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>${t('done')}</button></div>`,
  (m, close) => {
    $('[data-pdf]', m).addEventListener('click', () => downloadPdf(card));
    $('[data-email]', m).addEventListener('click', () => { close(); emailDialog(card); });
  });
}

function downloadPdf(card) {
  const a = document.createElement('a');
  a.href = `/api/cards/${card.id}/pdf?lang=${getLang()}`;
  a.download = `HERO-Card-${card.id}.pdf`;
  document.body.append(a); a.click(); a.remove();
  toast(t('pdf_ready'));
}

function emailDialog(card) {
  modal(`
    <h2>${icon('mail', 22)} ${t('send_email')}</h2>
    <p class="muted">${t('email_explain')}</p>
    <div class="field"><span>${t('recipient')}</span><div class="recipient">${icon('user', 16)}<b>${esc(card.user_name)}</b><span>${esc(card.user_email)}</span></div></div>
    <div class="attach-chip">${icon('fileText', 18)}<div><b>HERO-Card-${card.id}.pdf</b><span>${t('attached')}</span></div></div>
    <p class="form-error" hidden></p>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary" id="send">${icon('mail', 16)} ${t('send')}</button></div>`,
  (m, close) => {
    const btn = $('#send', m), err = $('.form-error', m);
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = t('sending'); err.hidden = true;
      try {
        const r = await api(`/api/cards/${card.id}/email`, { method: 'POST', body: { lang: getLang() } });
        close();
        toast(r.mode === 'preview' ? t('email_preview', { to: r.to }) : t('email_sent', { to: r.to }), r.mode === 'preview' ? 'info' : 'ok');
      } catch (e) {
        err.textContent = errMsg(e); err.hidden = false;
        btn.disabled = false; btn.innerHTML = `${icon('mail', 16)} ${t('send')}`;
      }
    });
  });
}

// ---------------------------------------------------------------- supervisor dashboard
const chartWidth = () => {
  const v = $('#view').clientWidth;
  return Math.max(300, v - (innerWidth <= 900 ? 32 + 42 : 72 + 42));
};
async function viewDashboard(days = 14) {
  const v = $('#view');
  const u = state.user;
  v.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${esc(fmtDate(localDate(), { weekday: 'long', month: 'long', day: 'numeric' }))}</p><h1>${t('nav_dashboard')}</h1></div>
      <div class="head-actions">
        <div class="tabs compact" id="range">${[7, 14, 30].map((d) => `<button data-d="${d}" class="${d === days ? 'on' : ''}">${d}d</button>`).join('')}</div>
        <a class="btn btn-ghost desktop-only" href="/api/export.csv">${icon('download', 18)} ${t('export_csv')}</a>
      </div>
    </header>
    <div id="dash">${skeleton(4)}</div>`;
  $$('#range button').forEach((b) => b.addEventListener('click', () => viewDashboard(Number(b.dataset.d))));
  let s, openCards;
  try {
    [s, { cards: openCards }] = await Promise.all([api(`/api/stats/team?days=${days}`), api('/api/cards?status=open&limit=6')]);
  } catch (e) { $('#dash').innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
  const pct = s.team_size ? Math.round((s.submitted_today / s.team_size) * 100) : 0;
  $('#dash').innerHTML = `
    <section class="grid-kpi">
      <div class="kpi kpi-hero">
        <div class="ring" style="--p:${pct}"><div><b>${s.submitted_today}/${s.team_size}</b></div></div>
        <div><span>${t('submitted_today')}</span><b class="kpi-big">${pct}%</b></div>
      </div>
      <a class="kpi" href="#/cards?status=open" data-open-filter><span>${icon('alert', 16)} ${t('open_int')}</span><b class="kpi-big ${s.open_interventions ? 'warn' : ''}">${s.open_interventions}</b></a>
      <div class="kpi"><span>${icon('shield', 16)} ${t('team_safe')}</span><b class="kpi-big">${s.totals.safe_pct ?? '—'}${s.totals.safe_pct != null ? '%' : ''}</b><small>${t('last_n_days', { n: days })}</small></div>
      <div class="kpi"><span>${icon('clipboard', 16)} ${t('cards_period')}</span><b class="kpi-big">${s.totals.cards}</b><small>${s.totals.observations} ${t('observations').toLowerCase()}</small></div>
    </section>

    <div class="dash-grid">
      <section class="panel span-2">
        <div class="panel-head"><h3>${t('cards_per_day')}</h3><span class="muted small">${t('last_n_days', { n: days })}</span></div>
        ${barChart(s.trend.map((d) => ({ date: d.date, value: d.cards, note: d.interventions ? `${d.interventions} I/C` : '' })), { valueLabel: t('cards_period').toLowerCase(), width: chartWidth() })}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('missing_today')}</h3><span class="count-chip">${s.missing_today.length}</span></div>
        ${s.missing_today.length ? `<div class="people">${s.missing_today.map((w) => `<div class="person">${avatar(w.name)}<div><b>${esc(w.name)}</b><span>${esc(w.craft || '')} · ${esc(w.observer_id)}</span></div></div>`).join('')}</div>`
          : `<p class="empty ok">${t('all_in')}</p>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('open_int')}</h3><a class="link" href="#/cards">${t('see_all')} ${icon('chevronRight', 16)}</a></div>
        ${openCards.length ? `<div class="list compact">${openCards.map((c) => cardRow(c, true)).join('')}</div>` : `<p class="empty ok">${t('none_open')}</p>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('top_risks')}</h3></div>
        ${s.risks.length ? hBars(s.risks.map((r) => ({ label: label(ITEM[r.item_key] || { en: r.label }), value: r.total, sub: label(CAT[ITEM[r.item_key]?.category] || { en: '' }) }))) : `<p class="empty ok">—</p>`}
      </section>

      <section class="panel">
        <div class="panel-head"><h3>${t('by_category')}</h3></div>
        ${stackRows(CHECKLIST.map((c) => { const r = s.by_category.find((x) => x.category === c.key) || { s: 0, i: 0, c: 0 }; return { label: label(c), s: r.s, i: r.i, c: r.c }; }),
          { s: t('legend_s'), i: t('legend_i'), c: t('legend_c') })}
      </section>

      <section class="panel span-2">
        <div class="panel-head"><h3>${t('leaderboard')}</h3><span class="muted small">${t('last_n_days', { n: days })}</span></div>
        <div class="leader">${s.leaderboard.map((w) => `
          <div class="leader-row">${avatar(w.name)}<span>${esc(w.name)}</span>
            <div class="leader-track"><div style="width:${Math.min(100, (w.cards / days) * 100)}%"></div></div><b>${w.cards}/${days}</b></div>`).join('')}
        </div>
      </section>
    </div>`;
  $('[data-open-filter]').addEventListener('click', (e) => { e.preventDefault(); sessionStorage.setItem('hc_filter_status', 'open'); location.hash = '#/cards'; });
  bindChartTips($('#dash'));
}

// ---------------------------------------------------------------- supervisor cards list
async function viewSupCards() {
  const v = $('#view');
  const f = { status: sessionStorage.getItem('hc_filter_status') || '', user: '', from: '', to: '', search: '' };
  sessionStorage.removeItem('hc_filter_status');
  let offset = 0;
  let users = [];
  try { ({ users } = await api('/api/users')); } catch {}
  v.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${t('team')}</p><h1>${t('nav_cards')}</h1></div>
      <a class="btn btn-ghost" id="csv" href="/api/export.csv">${icon('download', 18)} <span class="desktop-only">${t('export_csv')}</span></a>
    </header>
    <div class="tabs" id="tabs">${[['', 'all'], ['open', 'status_open'], ['closed', 'status_closed'], ['submitted', 'status_submitted']]
      .map(([k, l]) => `<button data-s="${k}" class="${k === f.status ? 'on' : ''}">${t(l)}</button>`).join('')}</div>
    <div class="filters">
      <label class="search">${icon('search', 18)}<input id="q" placeholder="${t('search')}" type="search"/></label>
      <select id="fu"><option value="">${t('any_worker')}</option>${users.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
      <label class="date-f"><span>${t('from')}</span><input type="date" id="ff"/></label>
      <label class="date-f"><span>${t('to')}</span><input type="date" id="ft"/></label>
    </div>
    <div id="list" class="list">${skeleton(6)}</div>
    <div class="center"><button class="btn btn-ghost" id="more" hidden>${t('load_more')}</button></div>`;
  const qs = () => new URLSearchParams(Object.entries(f).filter(([, x]) => x)).toString();
  async function load(reset) {
    if (reset) { offset = 0; $('#list').innerHTML = skeleton(6); }
    $('#csv').href = `/api/export.csv?${new URLSearchParams({ ...(f.from && { from: f.from }), ...(f.to && { to: f.to }) })}`;
    const r = await api(`/api/cards?limit=25&offset=${offset}&${qs()}`);
    const html = r.cards.map((c) => cardRow(c, true)).join('');
    if (reset) $('#list').innerHTML = html || `<p class="empty">${t('no_results')}</p>`; else $('#list').insertAdjacentHTML('beforeend', html);
    offset += r.cards.length; $('#more').hidden = !r.has_more;
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => { f.status = b.dataset.s; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(true); }));
  let tmr;
  $('#q').addEventListener('input', (e) => { clearTimeout(tmr); tmr = setTimeout(() => { f.search = e.target.value.trim(); load(true); }, 300); });
  $('#fu').addEventListener('change', (e) => { f.user = e.target.value; load(true); });
  $('#ff').addEventListener('change', (e) => { f.from = e.target.value; load(true); });
  $('#ft').addEventListener('change', (e) => { f.to = e.target.value; load(true); });
  $('#more').addEventListener('click', () => load(false));
  load(true).catch((e) => ($('#list').innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`));
}

// ---------------------------------------------------------------- team
async function viewTeam() {
  const v = $('#view');
  v.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">${t('supervisor')}</p><h1>${t('team')}</h1></div>
      <button class="btn btn-primary" id="add">${icon('plus', 18)} ${t('add_member')}</button></header>
    <div id="team" class="team-grid">${skeleton(4)}</div>`;
  $('#add').addEventListener('click', addMember);
  let users;
  try { ({ users } = await api('/api/users')); } catch (e) { $('#team').innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
  const today = localDate();
  $('#team').innerHTML = users.map((m) => `
    <article class="member ${m.active ? '' : 'off'}">
      <div class="member-top">${avatar(m.name, 'lg')}<div><b>${esc(m.name)}</b><span>${esc(m.craft || '—')}</span></div>
        <span class="dot ${m.last_card === today ? 'on' : ''}" title="${m.last_card === today ? t('today_done') : t('today_pending')}"></span></div>
      <dl>
        <div><dt>${t('observer_id')}</dt><dd>${esc(m.observer_id)}</dd></div>
        <div><dt>${t('total_cards')}</dt><dd>${m.card_count}</dd></div>
        <div><dt>${t('last_card')}</dt><dd>${m.last_card ? esc(fmtDate(m.last_card, { month: 'short', day: 'numeric' })) : t('never')}</dd></div>
        <div><dt>${t('role')}</dt><dd>${t(m.role)}</dd></div>
      </dl>
      <p class="muted small ellipsis">${esc(m.email)}</p>
      <div class="member-actions">
        <button class="btn btn-ghost btn-sm" data-pw="${m.id}">${icon('key', 15)} ${t('reset_pw')}</button>
        <button class="btn btn-ghost btn-sm" data-toggle="${m.id}" data-active="${m.active}">${t(m.active ? 'deactivate' : 'activate')}</button>
      </div>
    </article>`).join('') || `<p class="empty">—</p>`;
  $$('[data-toggle]', $('#team')).forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/users/${b.dataset.toggle}`, { method: 'PATCH', body: { active: b.dataset.active !== 'true' } }); toast(t('updated')); viewTeam(); }
    catch (e) { toast(errMsg(e), 'err'); }
  }));
  $$('[data-pw]', $('#team')).forEach((b) => b.addEventListener('click', () => modal(`
    <h2>${t('reset_pw')}</h2>
    <label class="field"><span>${t('new_password')}</span><input type="text" id="npw" minlength="8" autocomplete="off"/></label>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary" id="ok">${t('save')}</button></div>`,
  (m, close) => $('#ok', m).addEventListener('click', async () => {
    try { await api(`/api/users/${b.dataset.pw}`, { method: 'PATCH', body: { password: $('#npw', m).value } }); close(); toast(t('updated')); }
    catch (e) { toast(errMsg(e), 'err'); }
  }))));
}

function addMember() {
  modal(`
    <h2>${t('add_member')}</h2>
    <form id="mf" class="details-grid" novalidate>
      <label class="field full"><span>${t('name')} *</span><input name="name" required/></label>
      <label class="field full"><span>${t('email')} *</span><input name="email" type="email" required/></label>
      <label class="field"><span>${t('observer_id')} *</span><input name="observer_id" required placeholder="EMP-0000"/></label>
      <label class="field"><span>${t('craft')}</span><input name="craft" placeholder="Pipefitter"/></label>
      <label class="field"><span>${t('role')}</span><select name="role"><option value="worker">${t('worker')}</option><option value="supervisor">${t('supervisor')}</option></select></label>
      <label class="field"><span>${t('temp_password')} *</span><input name="password" type="text" minlength="8" autocomplete="off"/></label>
      <p class="form-error full" hidden></p>
    </form>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary" id="ok">${t('create')}</button></div>`,
  (m, close) => $('#ok', m).addEventListener('click', async () => {
    const body = Object.fromEntries(new FormData($('#mf', m)));
    try { await api('/api/users', { method: 'POST', body }); close(); toast(t('member_created')); viewTeam(); }
    catch (e) { const er = $('.form-error', m); er.textContent = errMsg(e); er.hidden = false; }
  }));
}

// ---------------------------------------------------------------- profile
function viewProfile() {
  const u = state.user;
  const theme = localStorage.getItem('hc_theme') || 'system';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('#view').innerHTML = `
    <header class="profile-hero">
      ${avatar(u.name, 'xl')}
      <div><h1>${esc(u.name)}</h1><p>${t(u.role)} · ${esc(u.craft || '')}</p>
      <div class="chips-row"><span class="tag">${icon('hash', 14)} ${esc(u.observer_id)}</span>
      ${u.supervisor_name ? `<span class="tag">${icon('user', 14)} ${t('reports_to')} ${esc(u.supervisor_name)}</span>` : ''}</div></div>
    </header>
    <div class="settings">
      ${!standalone ? `<section class="panel setting">
        <div class="setting-ic">${icon('smartphone', 20)}</div>
        <div><b>${t('install_app')}</b><p class="muted small">${t('install_sub')}</p></div>
        <button class="btn btn-primary btn-sm" id="install">${t('install_app')}</button>
      </section>` : ''}
      <section class="panel setting">
        <div class="setting-ic">${icon('globe', 20)}</div><div><b>${t('language')}</b></div>
        <div class="tabs compact">${['en', 'es'].map((l) => `<button data-lang="${l}" class="${getLang() === l ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>
      </section>
      <section class="panel setting">
        <div class="setting-ic">${icon('sun', 20)}</div><div><b>${t('appearance')}</b></div>
        <div class="tabs compact">${['system', 'light', 'dark'].map((x) => `<button data-theme="${x}" class="${theme === x ? 'on' : ''}">${t('theme_' + x)}</button>`).join('')}</div>
      </section>
      <section class="panel">
        <h3 class="h-sm">${icon('key', 16)} ${t('change_password')}</h3>
        <form id="pwf" class="details-grid" novalidate>
          <label class="field"><span>${t('current_password')}</span><input type="password" name="current" autocomplete="current-password"/></label>
          <label class="field"><span>${t('new_password')}</span><input type="password" name="next" autocomplete="new-password" minlength="8"/></label>
          <p class="form-error full" hidden></p>
          <div class="full"><button class="btn btn-soft" type="submit">${t('save')}</button></div>
        </form>
      </section>
      <button class="btn btn-danger btn-lg btn-block" id="out">${icon('logout', 18)} ${t('sign_out')}</button>
      <p class="muted small center">HERO Card Digital · v1.0</p>
    </div>`;
  // Scope to the view: <html> itself carries data-theme="dark|light", so an unscoped
  // [data-theme] query would bind this handler to the whole page (every click → Profile).
  const pv = $('#view');
  $$('button[data-lang]', pv).forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); renderShell(); route(); }));
  $$('button[data-theme]', pv).forEach((b) => b.addEventListener('click', () => { localStorage.setItem('hc_theme', b.dataset.theme); applyTheme(); viewProfile(); }));
  $('#out').addEventListener('click', logout);
  $('#install')?.addEventListener('click', async () => {
    if (state.installPrompt) { state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt = null; viewProfile(); }
    else modal(`<h2>${t('install_app')}</h2>
      <p>${getLang() === 'es'
        ? '<b>iPhone (Safari):</b> toca Compartir → “Agregar a pantalla de inicio”.<br/><br/><b>Android (Chrome):</b> menú ⋮ → “Instalar app”.<br/><br/><b>PC (Chrome/Edge):</b> ícono de instalar en la barra de direcciones.'
        : '<b>iPhone (Safari):</b> tap Share → “Add to Home Screen”.<br/><br/><b>Android (Chrome):</b> ⋮ menu → “Install app”.<br/><br/><b>Desktop (Chrome/Edge):</b> install icon in the address bar.'}</p>
      <div class="modal-actions"><button class="btn btn-primary" data-close>OK</button></div>`);
  });
  $('#pwf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const er = $('.form-error', e.target);
    try { await api('/api/me/password', { method: 'POST', body: fd }); e.target.reset(); er.hidden = true; toast(t('password_changed')); }
    catch (ex) { er.textContent = errMsg(ex); er.hidden = false; }
  });
}

// ---------------------------------------------------------------- boot
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });
addEventListener('appinstalled', () => toast(t('installed')));

async function boot() {
  renderShell();
  route();
  syncOutbox();
}

(async function init() {
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      if (location.hash.startsWith('#/new')) toast(t('app_updated')); // keep the draft on screen
      else { sessionStorage.setItem('hc_updated', '1'); location.reload(); }
    });
    if (sessionStorage.getItem('hc_updated')) { sessionStorage.removeItem('hc_updated'); setTimeout(() => toast(t('app_updated')), 600); }
  }
  try { state.demo = (await api('/api/config')).demo; } catch { state.demo = false; }
  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
    boot();
  } catch (e) {
    if (e instanceof ApiError) renderLogin();
  }
})();
