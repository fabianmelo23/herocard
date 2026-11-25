// Security middleware & helpers (no external deps).
import { createHash } from 'node:crypto';

/** Session tokens are stored hashed: a leaked database does not expose live sessions. */
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

/** HTTP security headers, including a strict Content-Security-Policy. */
export function securityHeaders({ https = false } = {}) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    // style attributes are used for dynamic widths (bars, progress) → 'unsafe-inline' for styles only
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    if (https || req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * CSRF defence for cookie-authenticated APIs: state-changing requests must come from our
 * own origin (Origin/Referer check) and carry a JSON body (forms cannot send application/json
 * cross-site without a CORS preflight, which we never grant).
 */
export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const src = req.headers.origin || req.headers.referer;
  if (src) {
    let ok = false;
    try { ok = new URL(src).host === host; } catch {}
    if (!ok) return res.status(403).json({ error: 'bad_origin' });
  }
  const ct = String(req.headers['content-type'] || '');
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
  if (hasBody && !ct.startsWith('application/json')) return res.status(415).json({ error: 'unsupported_media_type' });
  next();
}

/** Fixed-window rate limiter with periodic pruning (bounded memory). */
export class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs; this.max = max; this.hits = new Map();
    setInterval(() => this.prune(), Math.min(windowMs, 10 * 60000)).unref();
  }
  prune() {
    const now = Date.now();
    for (const [k, v] of this.hits) if (now - v.t > this.windowMs) this.hits.delete(k);
  }
  /** true when the key is over the limit (does not count). */
  blocked(key) {
    const v = this.hits.get(key);
    return !!v && Date.now() - v.t <= this.windowMs && v.n >= this.max;
  }
  hit(key) {
    const now = Date.now();
    const v = this.hits.get(key);
    if (!v || now - v.t > this.windowMs) this.hits.set(key, { n: 1, t: now });
    else v.n++;
  }
  reset(key) { this.hits.delete(key); }
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** Returns an error code or null. Requires length and at least a letter and a digit. */
export function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < PASSWORD_MIN) return 'password_too_short';
  if (s.length > PASSWORD_MAX) return 'password_too_long';
  if (!/[A-Za-zÀ-ÿ]/.test(s) || !/\d/.test(s)) return 'password_weak';
  return null;
}

export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
