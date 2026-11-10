import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, validateConfig } from './src/config.js';
import { ServiceStore } from './src/store.js';
import { requireJson, securityHeaders } from './src/middleware.js';
import { chatRouter } from './src/routes/chat.js';
import { adminRouter } from './src/routes/admin.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const store = await new ServiceStore(config.dataDir).init();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use(securityHeaders);
  app.use('/api', requireJson, express.json({ limit: '32kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', model: config.llama.model }));
  app.use('/api', chatRouter(store));
  app.use('/api/admin', adminRouter(store));
  app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود.', code: 'NOT_FOUND' }));

  app.use(express.static(path.join(root, 'public'), { extensions: ['html'], maxAge: config.isProd ? '1h' : 0 }));
  app.use((req, res) => res.status(404).sendFile(path.join(root, 'public', 'index.html')));

  // معالج أخطاء موحّد: رسالة واضحة للمستخدم دون تسريب تفاصيل داخلية
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'صيغة البيانات المرسلة غير صحيحة.', code: 'BAD_JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'حجم الطلب كبير جدًا.', code: 'TOO_LARGE' });
    const status = err.status || 500;
    if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err.code || '', err.message, err.cause?.message || '');
    res.status(status).json({
      error: status < 500 || err.expose ? err.message : 'حدث خطأ غير متوقع في الخادم. حاول لاحقًا.',
      code: err.expose && err.code ? err.code : status < 500 ? 'BAD_REQUEST' : 'SERVER_ERROR',
    });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateConfig();
  const app = await createApp();
  const server = app.listen(config.port, () => {
    console.log(`✅ ${config.businessName} يعمل على http://localhost:${config.port}`);
    console.log(`   النموذج: ${config.llama.model} @ ${config.llama.baseUrl}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
