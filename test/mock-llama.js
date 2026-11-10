// خادم Llama وهمي متوافق مع OpenAI لاختبار التطبيق محليًا بدون مفتاح API:
//   node test/mock-llama.js   ثم   LLAMA_API_URL=http://localhost:11500/v1 npm start
import http from 'node:http';

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { messages } = JSON.parse(body || '{}');
    const last = messages?.at(-1)?.content || '';
    const content = JSON.stringify({
      reply: `استلمت طلبك: "${last.slice(0, 60)}". هذه إجابة تجريبية من الخادم الوهمي.`,
      intent: 'order_estimate',
      recommendations: [{ serviceId: 'photo-album', reason: 'مناسب لحفظ صورك' }],
      quoteItems: [{ serviceId: 'print-10x15', quantity: 200 }, { serviceId: 'photo-album', quantity: 1 }],
      followUpQuestions: ['هل تفضل الورق اللامع أم المطفي؟'],
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
  });
}).listen(11500, () => console.log('mock llama on http://localhost:11500/v1'));
