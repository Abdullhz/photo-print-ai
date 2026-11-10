# المساعد الذكي لخدمات التصوير والمطبوعات

تطبيق ويب جاهز للإنتاج: مساعد دردشة يعمل بنموذج **Llama**. يجيب العملاء عن خدمات التصوير والطباعة، ويقترح الخدمات المناسبة، ويحسب عرض سعر تقديريًا. يضم أيضًا **لوحة تحكم للمدير** لتعديل الأسعار، وأي تعديل فيها ينعكس فورًا على إجابات المساعد.

## التشغيل السريع

```bash
cp .env.example .env      # ثم عدّل المفتاح وكلمة مرور المدير
npm install
npm start                 # http://localhost:3000
```

- الصفحة الرئيسية والمساعد: `/`
- لوحة التحكم: `/admin` (تُستخدم `ADMIN_USERNAME` و`ADMIN_PASSWORD`)

### اختيار مزوّد Llama
يعمل التطبيق مع أي واجهة متوافقة مع OpenAI، ويكفي ضبط ثلاثة متغيرات:

| المزوّد | `LLAMA_API_URL` | `LLAMA_MODEL` |
|---|---|---|
| Groq (افتراضي) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Ollama محليًا | `http://localhost:11434/v1` | `llama3.1:8b` |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

### التجربة بدون مفتاح API
```bash
node test/mock-llama.js                                   # نافذة 1
LLAMA_API_URL=http://localhost:11500/v1 ADMIN_PASSWORD=testpass123 npm start   # نافذة 2
```

## ما الذي يُرجعه Llama؟
يُلزَم النموذج بإرجاع JSON بهذا الشكل (انظر `src/llama.js`):

```json
{
  "reply": "إجابة عربية للعميل",
  "intent": "pricing_inquiry | service_recommendation | order_estimate | general_question | complaint | out_of_scope",
  "recommendations": [{ "serviceId": "photo-album", "reason": "..." }],
  "quoteItems": [{ "serviceId": "print-10x15", "quantity": 200 }],
  "followUpQuestions": ["..."]
}
```

**معالجة الاستجابة:**
- يُستخرج JSON حتى لو أحاطه النموذج بعلامات Markdown أو نص إضافي.
- إذا غاب حقل `reply` أو كانت الاستجابة غير صالحة، يُعاد الطلب مرة واحدة، ثم تظهر رسالة خطأ واضحة.
- تُحذف أي خدمة غير موجودة في قاعدة البيانات، ويُستبدل أي تصنيف غير معروف بالتصنيف `general_question`.
- **الأسعار لا تؤخذ من النموذج أبدًا.** الخادم يحسب عرض السعر من الأسعار الرسمية، فلا يمكن أن يخترع النموذج سعرًا.

## واجهة API

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/api/health` | فحص حالة الخادم |
| GET | `/api/services` | الخدمات المفعّلة وأسعارها |
| POST | `/api/chat` | `{ message, history? }` ← نتيجة منظّمة |
| POST | `/api/admin/login` / `logout` | جلسة المدير (كوكي httpOnly موقّع) |
| GET/POST | `/api/admin/services` | عرض الخدمات وإضافة خدمة |
| PUT/DELETE | `/api/admin/services/:id` | تعديل خدمة أو حذفها |

جميع الأخطاء تُرجَع بالشكل `{ "error": "رسالة بالعربية", "code": "..." }`، ومنها:
`INVALID_INPUT` (400)، `RATE_LIMITED` (429)، `LLAMA_TIMEOUT` (504)، `LLAMA_UNREACHABLE`/`LLAMA_AUTH`/`LLAMA_RATE_LIMIT` (503)، `LLAMA_INVALID_RESPONSE` (502).

## الحماية
- كلمة مرور المدير تُقارَن بزمن ثابت، والجلسة رمز موقّع بـ HMAC داخل كوكي `HttpOnly` و`SameSite=Strict` (و`Secure` في بيئة الإنتاج).
- تحديد معدل الطلبات للمحادثة ولتسجيل الدخول.
- رؤوس أمان صارمة، منها CSP بلا سكربتات مضمّنة، وجميع النصوص تُعرض كـ `textContent` لمنع XSS.
- الطلبات المعدِّلة تتطلب `application/json`، والحجم الأقصى للطلب 32KB.
- الأسعار تُحفظ في `data/services.json` بكتابة ذرّية، وتُنشأ تلقائيًا من `src/seed.js` عند أول تشغيل.

## النشر
```bash
docker build -t photo-print-ai .
docker run -d -p 3000:3000 --env-file .env -v ppa-data:/app/data photo-print-ai
```
في بيئة الإنتاج (`NODE_ENV=production`) يرفض التطبيق العمل بدون `ADMIN_PASSWORD` قوية. شغّله خلف HTTPS، واضبط `TRUST_PROXY=true` عند استخدام Nginx أو موازن أحمال.

## الاختبارات
```bash
npm test
```
