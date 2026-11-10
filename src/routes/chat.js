import { Router } from 'express';
import { config } from '../config.js';
import { askLlama } from '../llama.js';
import { rateLimit } from '../middleware.js';

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 10;

function validateChatInput(body) {
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return { error: 'الرجاء كتابة سؤالك أو طلبك قبل الإرسال.' };
  if (message.length > MAX_MESSAGE) return { error: `الرسالة طويلة جدًا (الحد الأقصى ${MAX_MESSAGE} حرف).` };

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((h) => h && ['user', 'assistant'].includes(h.role) && typeof h.content === 'string' && h.content.trim())
    .slice(-MAX_HISTORY)
    .map((h) => ({ role: h.role, content: h.content.trim().slice(0, MAX_MESSAGE) }));

  return { message, history };
}

export function chatRouter(store) {
  const router = Router();

  router.get('/services', (req, res) => {
    res.json({ businessName: config.businessName, currency: config.currency, services: store.list({ activeOnly: true }) });
  });

  router.post(
    '/chat',
    rateLimit({ windowMs: 60_000, max: config.rateLimit.chatPerMinute, message: 'أرسلت رسائل كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا.' }),
    async (req, res, next) => {
      const input = validateChatInput(req.body);
      if (input.error) return res.status(400).json({ error: input.error, code: 'INVALID_INPUT' });
      try {
        const result = await askLlama({ ...input, services: store.list({ activeOnly: true }) });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
