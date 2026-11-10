'use strict';

/** أدوات مشتركة بين واجهة العميل ولوحة التحكم. */
const App = (() => {
  const fmt = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2 });

  function money(value, currency) {
    return `${fmt.format(value)} ${currency || ''}`.trim();
  }

  /** إنشاء عنصر DOM بأمان (النصوص تُضاف كـ textContent لمنع XSS). */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = 'GET', body, timeoutMs = 60000 } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') throw new ApiError('انتهت مهلة الطلب. تحقق من اتصالك وحاول مرة أخرى.', 0, 'TIMEOUT');
      throw new ApiError('تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.', 0, 'NETWORK');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(data?.error || `حدث خطأ غير متوقع (${res.status}).`, res.status, data?.code);
    }
    if (data === null) throw new ApiError('وصلت استجابة غير صالحة من الخادم.', res.status, 'BAD_RESPONSE');
    return data;
  }

  function toast(message, type = 'info') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
      document.body.append(stack);
    }
    const node = el('div', { class: `toast ${type === 'error' ? 'error' : ''}`, text: message });
    stack.append(node);
    setTimeout(() => node.remove(), 3500);
  }

  return { money, el, api, ApiError, toast };
})();
