import { Router } from 'express';
import { config } from '../config.js';
import { checkCredentials, createSessionToken, rateLimit, requireAdmin, sessionCookie } from '../middleware.js';

export function adminRouter(store) {
  const router = Router();

  router.post(
    '/login',
    rateLimit({ windowMs: 15 * 60_000, max: config.rateLimit.loginPerFifteenMin, message: 'محاولات دخول كثيرة. حاول بعد 15 دقيقة.' }),
    (req, res) => {
      const { username, password } = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
        return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور.', code: 'INVALID_INPUT' });
      }
      if (!checkCredentials(username.trim(), password)) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.', code: 'BAD_CREDENTIALS' });
      }
      res.set('Set-Cookie', sessionCookie(createSessionToken(username.trim()), config.admin.sessionHours * 3600));
      res.json({ username: username.trim() });
    },
  );

  router.post('/logout', (req, res) => {
    res.set('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  });

  router.use(requireAdmin);

  router.get('/me', (req, res) => res.json({ username: req.admin.u }));

  router.get('/services', (req, res) => res.json({ currency: config.currency, services: store.list() }));

  router.post('/services', async (req, res, next) => {
    try {
      res.status(201).json(await store.create(req.body));
    } catch (err) {
      next(err);
    }
  });

  router.put('/services/:id', async (req, res, next) => {
    try {
      const updated = await store.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'الخدمة غير موجودة.', code: 'NOT_FOUND' });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/services/:id', async (req, res, next) => {
    try {
      if (!(await store.remove(req.params.id))) return res.status(404).json({ error: 'الخدمة غير موجودة.', code: 'NOT_FOUND' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
