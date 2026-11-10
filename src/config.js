import crypto from 'node:crypto';
import path from 'node:path';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const cloudflareAccountId = (env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const cloudflareUrl = cloudflareAccountId
  ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccountId)}/ai/v1`
  : '';

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  isProd,
  port: int(env.PORT, 3000),
  dataDir: path.resolve(env.DATA_DIR || 'data'),
  businessName: env.BUSINESS_NAME || 'استوديو لقطة',
  currency: env.CURRENCY || 'ر.س',

  llama: {
    // أي نقطة نهاية متوافقة مع OpenAI: Cloudflare Workers AI / Groq / Ollama / Together / OpenRouter / vLLM
    baseUrl: (env.LLAMA_API_URL || cloudflareUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    apiKey: env.LLAMA_API_KEY || '',
    model: env.LLAMA_MODEL || (cloudflareUrl ? '@cf/meta/llama-3.3-70b-instruct-fp8-fast' : 'llama-3.3-70b-versatile'),
    timeoutMs: int(env.LLAMA_TIMEOUT_MS, 30000),
    maxTokens: int(env.LLAMA_MAX_TOKENS, 1024),
    jsonMode: env.LLAMA_JSON_MODE !== 'false',
  },

  admin: {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    sessionHours: int(env.SESSION_HOURS, 8),
  },

  rateLimit: {
    chatPerMinute: int(env.CHAT_RATE_PER_MINUTE, 20),
    loginPerFifteenMin: int(env.LOGIN_RATE_PER_15MIN, 10),
  },
};

export function validateConfig(logger = console) {
  const problems = [];
  if (!config.admin.password) problems.push('ADMIN_PASSWORD غير مضبوط — لن يتمكن المدير من تسجيل الدخول.');
  else if (config.admin.password.length < 8) problems.push('ADMIN_PASSWORD قصير جدًا (8 أحرف على الأقل).');
  if (!process.env.SESSION_SECRET) problems.push('SESSION_SECRET غير مضبوط — ستنتهي جلسات المدير عند كل إعادة تشغيل.');
  const isLocal = /localhost|127\.0\.0\.1|ollama/.test(config.llama.baseUrl);
  if (!config.llama.apiKey && !isLocal) problems.push('LLAMA_API_KEY غير مضبوط — طلبات الذكاء الاصطناعي ستفشل.');
  for (const p of problems) logger.warn(`⚠️  ${p}`);
  if (isProd && (!config.admin.password || config.admin.password.length < 8)) {
    throw new Error('في بيئة الإنتاج يجب ضبط ADMIN_PASSWORD (8 أحرف على الأقل).');
  }
}
