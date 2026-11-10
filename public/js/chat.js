'use strict';

(() => {
  const { el, api, money } = App;
  const MAX_LEN = 2000;
  const MAX_HISTORY = 10;

  const $ = (id) => document.getElementById(id);
  const form = $('chat-form');
  const input = $('chat-input');
  const sendBtn = $('send-btn');
  const messages = $('messages');
  const emptyState = $('empty-state');
  const alertBox = $('chat-alert');
  const alertText = $('chat-alert-text');
  const retryBtn = $('retry-btn');
  const resetBtn = $('reset-chat');
  const charCount = $('char-count');
  const hint = $('input-hint');
  const defaultHint = hint.textContent;

  let history = [];
  let busy = false;
  let pending = null; // آخر رسالة فشلت لإعادة المحاولة
  let currency = 'ر.س';

  $('year').textContent = new Date().getFullYear();

  // ---------------- الإدخال ----------------
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }

  function setFieldError(message) {
    input.classList.toggle('invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    hint.textContent = message || defaultHint;
    hint.classList.toggle('field-error', Boolean(message));
  }

  input.addEventListener('input', () => {
    autoGrow();
    charCount.textContent = `${input.value.length} / ${MAX_LEN}`;
    if (input.value.trim()) setFieldError('');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      setFieldError('الرجاء كتابة سؤالك أو طلبك قبل الإرسال.');
      input.focus();
      return;
    }
    if (text.length > MAX_LEN) {
      setFieldError(`الرسالة طويلة جدًا (الحد الأقصى ${MAX_LEN} حرف).`);
      return;
    }
    send(text);
  });

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-prompt]');
    if (!chip || busy) return;
    if (chip.dataset.fill !== undefined) {
      input.value = chip.dataset.prompt;
      input.dispatchEvent(new Event('input'));
      document.getElementById('assistant').scrollIntoView({ behavior: 'smooth' });
      input.focus();
    } else {
      send(chip.dataset.prompt);
    }
  });

  retryBtn.addEventListener('click', () => pending && send(pending.text, { retry: true }));

  resetBtn.addEventListener('click', () => {
    history = [];
    pending = null;
    messages.replaceChildren(emptyState);
    emptyState.hidden = false;
    resetBtn.hidden = true;
    hideAlert();
    input.focus();
  });

  // ---------------- العرض ----------------
  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function showAlert(message, canRetry) {
    alertText.textContent = message;
    retryBtn.hidden = !canRetry;
    alertBox.hidden = false;
  }

  function hideAlert() {
    alertBox.hidden = true;
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    input.readOnly = value;
    sendBtn.replaceChildren(
      ...(value
        ? [el('span', { class: 'spinner', 'aria-hidden': 'true' }), el('span', { class: 'label', text: 'جارٍ…' })]
        : [el('span', { class: 'label', text: 'إرسال' }), sendIcon.cloneNode(true)]),
    );
    sendBtn.setAttribute('aria-busy', String(value));
  }
  const sendIcon = sendBtn.querySelector('svg').cloneNode(true);

  function addUserMessage(text) {
    emptyState.hidden = true;
    resetBtn.hidden = false;
    const node = el('div', { class: 'msg user' },
      el('span', { class: 'avatar', 'aria-hidden': 'true', text: '👤' }),
      el('div', { class: 'bubble', text }),
    );
    messages.append(node);
    scrollToBottom();
    return node;
  }

  function addTyping() {
    const status = el('span', { text: 'المساعد يكتب…' });
    const node = el('div', { class: 'msg bot', 'aria-label': 'المساعد يكتب' },
      el('span', { class: 'avatar', 'aria-hidden': 'true', text: '✦' }),
      el('div', { class: 'bubble typing' }, el('span', { class: 'dots' }, el('i'), el('i'), el('i')), status),
    );
    messages.append(node);
    scrollToBottom();
    const slowTimer = setTimeout(() => { status.textContent = 'ما زلت أجهّز إجابة دقيقة لك…'; }, 8000);
    return () => { clearTimeout(slowTimer); node.remove(); };
  }

  function renderRecommendations(recs) {
    return el('div', { class: 'result-block' },
      el('h4', {}, '✨ خدمات مقترحة'),
      el('div', { class: 'recs' }, recs.map((r) =>
        el('div', { class: 'rec' },
          el('div', {}, el('div', { class: 'name', text: r.name }), el('div', { class: 'cat', text: r.category })),
          el('div', { class: 'price', text: `${money(r.price, currency)} / ${r.unit}` }),
          r.reason && el('div', { class: 'reason', text: r.reason }),
        ))),
    );
  }

  function renderQuote(quote) {
    return el('div', { class: 'result-block' },
      el('h4', {}, '🧾 عرض سعر تقديري'),
      el('div', { class: 'quote-wrap' },
        el('table', { class: 'quote' },
          el('thead', {}, el('tr', {},
            el('th', { text: 'الخدمة' }), el('th', { class: 'num', text: 'الكمية' }),
            el('th', { class: 'num', text: 'سعر الوحدة' }), el('th', { class: 'num', text: 'المجموع' }))),
          el('tbody', {}, quote.items.map((i) => el('tr', {},
            el('td', { text: i.name }),
            el('td', { class: 'num', text: `${i.quantity} × ${i.unit}` }),
            el('td', { class: 'num', text: money(i.unitPrice, quote.currency) }),
            el('td', { class: 'num', text: money(i.subtotal, quote.currency) })))),
          el('tfoot', {}, el('tr', {},
            el('td', { colspan: '3', text: 'الإجمالي التقديري' }),
            el('td', { class: 'num', text: money(quote.total, quote.currency) }))),
        )),
      el('p', { class: 'quote-note', text: 'محسوب من الأسعار الرسمية الحالية، ولا يشمل الضريبة أو أي خصومات.' }),
    );
  }

  function addBotMessage(result) {
    const content = el('div', { class: 'content' },
      result.intentLabel && el('span', { class: 'badge', text: `التصنيف: ${result.intentLabel}` }),
      el('div', { class: 'bubble', text: result.reply }),
      result.recommendations?.length > 0 && renderRecommendations(result.recommendations),
      result.quote?.items?.length > 0 && renderQuote(result.quote),
      result.followUpQuestions?.length > 0 && el('div', { class: 'followups' },
        result.followUpQuestions.map((q) => el('button', { class: 'chip', type: 'button', 'data-prompt': q, text: q }))),
    );
    messages.append(el('div', { class: 'msg bot' }, el('span', { class: 'avatar', 'aria-hidden': 'true', text: '✦' }), content));
    scrollToBottom();
  }

  // ---------------- الإرسال ----------------
  async function send(text, { retry = false } = {}) {
    if (busy) return;
    hideAlert();
    setFieldError('');
    if (!retry) {
      pending?.node.remove(); // رسالة فاشلة سابقة استُبدلت برسالة جديدة
      pending = { text, node: addUserMessage(text) };
      input.value = '';
      input.dispatchEvent(new Event('input'));
    }
    setBusy(true);
    const stopTyping = addTyping();

    try {
      const result = await api('/api/chat', { method: 'POST', body: { message: text, history } });
      stopTyping();
      if (!result || typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new App.ApiError('وصلت إجابة فارغة من المساعد. حاول مرة أخرى.', 502, 'EMPTY');
      }
      addBotMessage(result);
      history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
      history = history.slice(-MAX_HISTORY);
      pending = null;
    } catch (err) {
      stopTyping();
      const isInputError = err.status === 400;
      if (isInputError) {
        pending?.node.remove();
        pending = null;
        input.value = text;
        input.dispatchEvent(new Event('input'));
        setFieldError(err.message);
      } else {
        showAlert(err.message, true);
      }
    } finally {
      setBusy(false);
      if (!matchMedia('(max-width: 640px)').matches) input.focus();
    }
  }

  // ---------------- قائمة الأسعار ----------------
  const grid = $('price-grid');
  const tabs = $('category-tabs');
  let services = [];
  let activeCategory = 'الكل';

  function renderPrices() {
    const list = activeCategory === 'الكل' ? services : services.filter((s) => s.category === activeCategory);
    grid.replaceChildren(...list.map((s) =>
      el('article', { class: 'price-card' },
        el('span', { class: 'cat', text: s.category }),
        el('h3', { text: s.name }),
        el('p', { text: s.description || '' }),
        el('div', { class: 'amount' }, money(s.price, currency), ' ', el('small', { text: `/ ${s.unit}` })),
        el('button', { class: 'btn btn-ghost btn-sm ask', type: 'button', 'data-fill': '', 'data-prompt': `أريد الاستفسار عن خدمة "${s.name}"، ` , text: 'اسأل المساعد' }),
      )));
    if (!list.length) grid.replaceChildren(el('p', { text: 'لا توجد خدمات في هذه الفئة حاليًا.' }));
  }

  function renderTabs() {
    const categories = ['الكل', ...new Set(services.map((s) => s.category))];
    tabs.replaceChildren(...categories.map((c) =>
      el('button', {
        class: 'tab', type: 'button', 'aria-pressed': String(c === activeCategory), text: c,
        onclick: () => { activeCategory = c; renderTabs(); renderPrices(); },
      })));
  }

  async function loadServices() {
    try {
      const data = await api('/api/services', { timeoutMs: 15000 });
      currency = data.currency || currency;
      services = data.services || [];
      if (data.businessName) {
        document.querySelectorAll('[data-business-name]').forEach((n) => { n.textContent = data.businessName; });
      }
      renderTabs();
      renderPrices();
    } catch (err) {
      grid.replaceChildren(el('div', { class: 'alert', role: 'alert' },
        el('span', { class: 'grow', text: `تعذّر تحميل قائمة الأسعار: ${err.message}` }),
        el('button', { type: 'button', text: 'إعادة المحاولة', onclick: loadServices }),
      ));
    }
  }

  loadServices();
})();
