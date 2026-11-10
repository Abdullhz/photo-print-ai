import { config } from './config.js';

/**
 * عقد الاستجابة المتوقّع من Llama (يجب أن يُرجع JSON فقط بهذا الشكل):
 * {
 *   "reply": string,                       // إجابة عربية واضحة للعميل (إلزامي)
 *   "intent": one of INTENTS,              // تصنيف طلب العميل
 *   "recommendations": [{ "serviceId": string, "reason": string }],
 *   "quoteItems": [{ "serviceId": string, "quantity": number }],
 *   "followUpQuestions": [string]
 * }
 * الأسعار لا تُؤخذ من النموذج أبدًا: الخادم يحسب عرض السعر من قاعدة البيانات.
 */
export const INTENTS = {
  pricing_inquiry: 'استفسار عن سعر',
  service_recommendation: 'توصية بخدمة',
  order_estimate: 'تقدير تكلفة طلب',
  general_question: 'سؤال عام',
  complaint: 'شكوى أو ملاحظة',
  out_of_scope: 'خارج نطاق الخدمات',
};

export class LlamaError extends Error {
  constructor(message, { status = 502, code = 'LLAMA_ERROR', cause } = {}) {
    super(message, { cause });
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function catalogText(services) {
  return services
    .map((s) => `- id: ${s.id} | ${s.name} | الفئة: ${s.category} | السعر: ${s.price} ${config.currency} / ${s.unit}${s.description ? ` | ${s.description}` : ''}`)
    .join('\n');
}

export function buildSystemPrompt(services) {
  return `أنت "مساعد ${config.businessName}" — مساعد مبيعات وخدمة عملاء لمحل متخصص في التصوير الفوتوغرافي والطباعة والمطبوعات.

قائمة الخدمات والأسعار الحالية (المصدر الوحيد للأسعار):
${catalogText(services) || '- لا توجد خدمات متاحة حاليًا.'}

القواعد:
1. أجب بالعربية الفصحى المبسطة وبأسلوب ودود ومهني وموجز.
2. لا تخترع خدمات أو أسعارًا غير موجودة في القائمة. إن طلب العميل شيئًا غير متوفر فأخبره بلطف واقترح الأقرب.
3. عند ذكر سعر استخدم القيمة كما هي في القائمة مع العملة ${config.currency}.
4. إذا طلب العميل تقدير تكلفة، ضع البنود في quoteItems مع الكمية بعدد الوحدات (مثال: 300 صورة 10×15 → quantity: 300، و1000 بطاقة أعمال وحدتها 500 بطاقة → quantity: 2).
5. إذا كانت المعلومات ناقصة لتقدير السعر، اطرح أسئلة توضيحية في followUpQuestions.
6. إذا كان السؤال خارج مجال التصوير والطباعة، اعتذر بلطف واجعل intent = "out_of_scope".

أرجع JSON صالحًا فقط، دون أي نص أو علامات Markdown خارجه، بهذا الشكل بالضبط:
{
  "reply": "نص الإجابة للعميل",
  "intent": "${Object.keys(INTENTS).join('" | "')}",
  "recommendations": [{ "serviceId": "id من القائمة", "reason": "سبب قصير" }],
  "quoteItems": [{ "serviceId": "id من القائمة", "quantity": 1 }],
  "followUpQuestions": ["سؤال قصير"]
}
اجعل المصفوفات فارغة [] إن لم تكن ذات صلة. الحد الأقصى: 4 توصيات و3 أسئلة متابعة.`;
}

/** يستخرج كائن JSON من نص النموذج حتى لو أحاطه بعلامات ``` أو نص إضافي. */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** يتحقق من استجابة النموذج ويطابقها مع الكتالوج، ويحسب عرض السعر من الأسعار الحقيقية. */
export function normalizeResult(raw, services) {
  if (!raw || typeof raw !== 'object') return null;
  const reply = str(raw.reply, 4000);
  if (!reply) return null;

  const byId = new Map(services.map((s) => [s.id, s]));
  const intent = Object.hasOwn(INTENTS, raw.intent) ? raw.intent : 'general_question';

  const seenRec = new Set();
  const recommendations = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
    .filter((r) => r && byId.has(r.serviceId) && !seenRec.has(r.serviceId) && seenRec.add(r.serviceId))
    .slice(0, 4)
    .map((r) => {
      const s = byId.get(r.serviceId);
      return { serviceId: s.id, name: s.name, category: s.category, price: s.price, unit: s.unit, reason: str(r.reason, 300) };
    });

  const merged = new Map();
  for (const item of Array.isArray(raw.quoteItems) ? raw.quoteItems : []) {
    const qty = Number(item?.quantity);
    if (!item || !byId.has(item.serviceId) || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(item.serviceId, (merged.get(item.serviceId) || 0) + Math.min(qty, 100000));
  }
  const items = [...merged].map(([id, quantity]) => {
    const s = byId.get(id);
    const qty = Math.round(quantity * 100) / 100;
    return { serviceId: id, name: s.name, unit: s.unit, unitPrice: s.price, quantity: qty, subtotal: Math.round(s.price * qty * 100) / 100 };
  });
  const quote = items.length
    ? { items, total: Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100, currency: config.currency }
    : null;

  const followUpQuestions = (Array.isArray(raw.followUpQuestions) ? raw.followUpQuestions : [])
    .map((q) => str(q, 200))
    .filter(Boolean)
    .slice(0, 3);

  return { reply, intent, intentLabel: INTENTS[intent], recommendations, quote, followUpQuestions };
}

async function callModel(messages, { jsonMode, temperature }) {
  const { baseUrl, apiKey, model, timeoutMs, maxTokens } = config.llama;
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey && { Authorization: `Bearer ${apiKey}` }) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new LlamaError('استغرق المساعد وقتًا أطول من المعتاد. حاول مرة أخرى.', { status: 504, code: 'LLAMA_TIMEOUT', cause: err });
    }
    throw new LlamaError('تعذّر الاتصال بخدمة الذكاء الاصطناعي حاليًا.', { status: 503, code: 'LLAMA_UNREACHABLE', cause: err });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[llama] HTTP ${res.status}: ${detail.slice(0, 500)}`);
    // بعض المزوّدين لا يدعمون response_format — نعيد المحاولة بدونه
    if (res.status === 400 && jsonMode && /response_format|json/i.test(detail)) {
      return callModel(messages, { jsonMode: false, temperature });
    }
    if (res.status === 401 || res.status === 403) {
      throw new LlamaError('خدمة الذكاء الاصطناعي غير مهيّأة بشكل صحيح. يرجى إبلاغ إدارة الموقع.', { status: 503, code: 'LLAMA_AUTH' });
    }
    if (res.status === 429) {
      throw new LlamaError('المساعد مشغول حاليًا بسبب كثرة الطلبات. حاول بعد لحظات.', { status: 503, code: 'LLAMA_RATE_LIMIT' });
    }
    throw new LlamaError('حدث خطأ في خدمة الذكاء الاصطناعي. حاول مرة أخرى.', { status: 502, code: 'LLAMA_HTTP_ERROR' });
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new LlamaError('لم يُرجع المساعد أي إجابة. حاول مرة أخرى.', { status: 502, code: 'LLAMA_EMPTY' });
  }
  return content;
}

/**
 * يرسل رسالة العميل (مع سياق المحادثة) إلى Llama ويُرجع نتيجة منظّمة ومُتحقَّق منها.
 * يعيد المحاولة مرة واحدة إذا كانت الاستجابة غير صالحة.
 */
export async function askLlama({ message, history = [], services }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(services) },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const content = await callModel(messages, { jsonMode: config.llama.jsonMode, temperature: attempt === 1 ? 0.4 : 0.1 });
    const result = normalizeResult(extractJson(content), services);
    if (result) return result;
    console.warn(`[llama] invalid structured response (attempt ${attempt}): ${content.slice(0, 300)}`);
    messages.push(
      { role: 'assistant', content },
      { role: 'user', content: 'استجابتك ليست JSON صالحًا بالشكل المطلوب. أعد الإجابة كـ JSON فقط مع حقل "reply" غير فارغ.' },
    );
  }
  throw new LlamaError('وصلت إجابة غير مفهومة من المساعد. حاول إعادة صياغة سؤالك.', { status: 502, code: 'LLAMA_INVALID_RESPONSE' });
}
