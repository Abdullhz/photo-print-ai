import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, normalizeResult } from '../src/llama.js';

const services = [
  { id: 'print-10x15', name: 'طباعة 10×15', category: 'طباعة', price: 2, unit: 'صورة', active: true },
  { id: 'album', name: 'ألبوم', category: 'طباعة', price: 450, unit: 'ألبوم', active: true },
];

test('extractJson handles fenced and wrapped JSON', () => {
  assert.deepEqual(extractJson('```json\n{"reply":"hi"}\n```'), { reply: 'hi' });
  assert.deepEqual(extractJson('Sure! {"reply":"hi"} hope it helps'), { reply: 'hi' });
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson(''), null);
});

test('normalizeResult rejects missing reply', () => {
  assert.equal(normalizeResult({ intent: 'pricing_inquiry' }, services), null);
  assert.equal(normalizeResult({ reply: '   ' }, services), null);
  assert.equal(normalizeResult(null, services), null);
});

test('quote is computed from catalog prices, ignoring unknown ids and bad quantities', () => {
  const r = normalizeResult({
    reply: 'تفضل',
    intent: 'order_estimate',
    quoteItems: [
      { serviceId: 'print-10x15', quantity: 200, price: 0.01 },
      { serviceId: 'album', quantity: 1 },
      { serviceId: 'fake', quantity: 3 },
      { serviceId: 'album', quantity: -1 },
    ],
  }, services);
  assert.equal(r.quote.total, 850);
  assert.equal(r.quote.items.length, 2);
  assert.equal(r.intentLabel, 'تقدير تكلفة طلب');
});

test('unknown intent falls back and recommendations are deduped', () => {
  const r = normalizeResult({
    reply: 'ok', intent: 'weird',
    recommendations: [{ serviceId: 'album', reason: 'a' }, { serviceId: 'album', reason: 'b' }, { serviceId: 'nope' }],
  }, services);
  assert.equal(r.intent, 'general_question');
  assert.equal(r.recommendations.length, 1);
  assert.equal(r.quote, null);
});
