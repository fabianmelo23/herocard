// Small dependency-free SVG/HTML charts with hover tooltips.
import { fmtDate } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Vertical bar chart, one series. data: [{date, value, note}]
 */
export function barChart(data, { valueLabel = '', width = 640 } = {}) {
  const W = Math.round(width), H = 220, padL = 32, padR = 8, padT = 12, padB = 28;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const iw = W - padL - padR, ih = H - padT - padB;
  const step = iw / data.length;
  const bw = Math.max(6, Math.min(32, step * 0.56));
  const ticks = [0, max / 2, max];
  const y = (v) => padT + ih - (v / max) * ih;

  const grid = ticks.map((tk) => `
    <line x1="${padL}" x2="${W - padR}" y1="${y(tk)}" y2="${y(tk)}" class="cg"/>
    <text x="${padL - 8}" y="${y(tk) + 4}" text-anchor="end" class="ct">${tk}</text>`).join('');

  const labelEvery = Math.max(1, Math.ceil(28 / step));
  const bars = data.map((d, i) => {
    const cx = padL + step * i + step / 2;
    const h = Math.max(0, (d.value / max) * ih);
    const r = Math.min(4, bw / 2, h);
    const x0 = cx - bw / 2, top = padT + ih - h, base = padT + ih;
    const path = h > 0
      ? `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z`
      : '';
    const tip = `${fmtDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}|${d.value} ${valueLabel}${d.note ? '|' + d.note : ''}`;
    const lbl = i % labelEvery === 0 || i === data.length - 1
      ? `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="ct">${esc(fmtDate(d.date, { day: 'numeric' }))}</text>` : '';
    return `<g class="bar" data-tip="${esc(tip)}">
      <rect x="${cx - step / 2}" y="${padT}" width="${step}" height="${ih}" fill="transparent"/>
      ${path ? `<path d="${path}" class="cb"/>` : ''}${lbl}</g>`;
  }).join('');

  return `<div class="chart" data-chart>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(valueLabel)}">${grid}${bars}
      <line x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}" class="ca"/></svg>
    <div class="ctip" hidden></div></div>`;
}

/** Horizontal ranked bars. rows: [{label, value, sub}] */
export function hBars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="hbars">${rows.map((r) => `
    <div class="hbar" title="${esc(r.label)}: ${r.value}">
      <div class="hbar-top"><span>${esc(r.label)}</span><b>${r.value}</b></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max) * 100}%"></div></div>
      ${r.sub ? `<div class="hbar-sub">${esc(r.sub)}</div>` : ''}
    </div>`).join('')}</div>`;
}

/** 100% stacked S / I / C rows. rows: [{label, s, i, c}] */
export function stackRows(rows, names) {
  return `<div class="stack-legend">
      <span><i class="sw sw-s"></i>${esc(names.s)}</span>
      <span><i class="sw sw-c"></i>${esc(names.c)}</span>
      <span><i class="sw sw-i"></i>${esc(names.i)}</span>
    </div>
    <div class="stacks">${rows.map((r) => {
      const tot = r.s + r.i + r.c || 1;
      const pct = (v) => (v / tot) * 100;
      const seg = (k, v, n) => v ? `<div class="seg seg-${k}" style="width:${pct(v)}%" data-tip="${esc(r.label)}|${esc(n)}: ${v} (${Math.round(pct(v))}%)"></div>` : '';
      return `<div class="stack-row">
        <div class="stack-label"><span>${esc(r.label)}</span><b>${Math.round(pct(r.s))}%</b></div>
        <div class="stack-bar" data-chart>${seg('s', r.s, names.s)}${seg('c', r.c, names.c)}${seg('i', r.i, names.i)}<div class="ctip" hidden></div></div>
      </div>`;
    }).join('')}</div>`;
}

// Delegated tooltip behaviour for any [data-chart] container.
export function bindChartTips(root) {
  root.querySelectorAll('[data-chart]').forEach((chart) => {
    const tip = chart.querySelector('.ctip');
    const show = (el, ev) => {
      const parts = el.dataset.tip.split('|');
      tip.innerHTML = `<b>${esc(parts[0])}</b>${parts.slice(1).map((p) => `<div>${esc(p)}</div>`).join('')}`;
      tip.hidden = false;
      const box = chart.getBoundingClientRect();
      const x = Math.min(Math.max(ev.clientX - box.left, 70), box.width - 70);
      tip.style.left = `${x}px`;
      tip.style.top = `${ev.clientY - box.top - 12}px`;
      chart.querySelectorAll('.is-hot').forEach((n) => n.classList.remove('is-hot'));
      el.classList.add('is-hot');
    };
    const hide = () => { tip.hidden = true; chart.querySelectorAll('.is-hot').forEach((n) => n.classList.remove('is-hot')); };
    chart.addEventListener('pointermove', (ev) => {
      const el = ev.target.closest('[data-tip]');
      el && chart.contains(el) ? show(el, ev) : hide();
    });
    chart.addEventListener('pointerleave', hide);
  });
}
