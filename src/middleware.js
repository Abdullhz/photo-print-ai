import crypto from 'node:crypto';
import { config } from './config.js';

export const COOKIE_NAME = 'ppa_admin';

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/** محدِّد معدل بسيط في الذاكرة (نافذة ثابتة لكل IP). */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message, code: 'RATE_LIMITED' });
    }
    next();
  };
}

/** يتطلب Content-Type: application/json للطلبات المعدِّلة — يحمي من CSRF عبر النماذج البسيطة. */
export function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'يجب إرسال البيانات بصيغة JSON.', code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  next();
}

// ---------- جلسات المدير: رمز موقّع بـ HMAC داخل كوكي httpOnly ----------

const sign = (payload) => crypto.createHmac('sha256', config.admin.sessionSecret).update(payload).digest('base64url');

export function createSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + config.admin.sessionHours * 3600_000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function checkCredentials(username, password) {
  if (!config.admin.password) return false;
  // نقارن الاثنين دائمًا لتفادي هجمات التوقيت
  const userOk = safeEqual(username, config.admin.username);
  const passOk = safeEqual(password, config.admin.password);
  return userOk && passOk;
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token, maxAgeSec) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/api/admin',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSec}`,
    config.isProd ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function requireAdmin(req, res, next) {
  const session = verifySessionToken(readCookie(req, COOKIE_NAME));
  if (!session) return res.status(401).json({ error: 'انتهت الجلسة أو لم يتم تسجيل الدخول.', code: 'UNAUTHORIZED' });
  req.admin = session;
  next();
}
