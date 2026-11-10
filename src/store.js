import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { seedServices } from './seed.js';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const LIMITS = { name: 120, category: 60, unit: 60, description: 400 };

function cleanText(value, field, { required = true } = {}) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (required && !text) throw new ValidationError(`الحقل "${field}" مطلوب.`);
  if (text.length > LIMITS[field]) throw new ValidationError(`الحقل "${field}" أطول من ${LIMITS[field]} حرفًا.`);
  return text;
}

function cleanPrice(value) {
  const price = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 1_000_000) {
    throw new ValidationError('السعر يجب أن يكون رقمًا بين 0 و 1,000,000.');
  }
  return Math.round(price * 100) / 100;
}

export function validateService(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object') throw new ValidationError('بيانات الخدمة غير صالحة.');
  const out = {};
  const has = (k) => !partial || input[k] !== undefined;
  if (has('name')) out.name = cleanText(input.name, 'name');
  if (has('category')) out.category = cleanText(input.category, 'category');
  if (has('unit')) out.unit = cleanText(input.unit, 'unit');
  if (has('description')) out.description = cleanText(input.description ?? '', 'description', { required: false });
  if (has('price')) out.price = cleanPrice(input.price);
  if (input.active !== undefined) out.active = Boolean(input.active);
  else if (!partial) out.active = true;
  return out;
}

function makeId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  return `${slug || 'service'}-${crypto.randomBytes(3).toString('hex')}`;
}

export class ServiceStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'services.json');
    this.services = [];
    this.writeChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('services.json must contain an array');
      this.services = parsed;
    } catch (err) {
      if (err.code !== 'ENOENT') throw new Error(`تعذّر قراءة ملف الأسعار ${this.file}: ${err.message}`);
      const now = new Date().toISOString();
      this.services = seedServices.map((s) => ({ ...s, active: true, updatedAt: now }));
      await this.persist();
    }
    return this;
  }

  // كتابة ذرّية ومتسلسلة لتجنّب تلف الملف عند الطلبات المتزامنة
  persist() {
    const snapshot = JSON.stringify(this.services, null, 2);
    this.writeChain = this.writeChain.catch(() => {}).then(async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, snapshot, 'utf8');
      await fs.rename(tmp, this.file);
    });
    return this.writeChain;
  }

  list({ activeOnly = false } = {}) {
    const items = activeOnly ? this.services.filter((s) => s.active) : this.services;
    return items.map((s) => ({ ...s }));
  }

  get(id) {
    return this.services.find((s) => s.id === id) || null;
  }

  async create(input) {
    const data = validateService(input);
    const service = { id: makeId(data.name), ...data, updatedAt: new Date().toISOString() };
    this.services.push(service);
    await this.persist();
    return { ...service };
  }

  async update(id, input) {
    const service = this.get(id);
    if (!service) return null;
    Object.assign(service, validateService(input, { partial: true }), { updatedAt: new Date().toISOString() });
    await this.persist();
    return { ...service };
  }

  async remove(id) {
    const index = this.services.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.services.splice(index, 1);
    await this.persist();
    return true;
  }
}
