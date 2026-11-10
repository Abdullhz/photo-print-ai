'use strict';

(() => {
  const { el, api, money, toast } = App;
  const $ = (id) => document.getElementById(id);

  let services = [];
  let currency = 'ر.س';
  let editingId = null;

  // ---------------- الجلسة ----------------
  function showView(view) {
    $('login-view').hidden = view !== 'login';
    $('dash-view').hidden = view !== 'dash';
    $('logout-link').hidden = view !== 'dash';
  }

  function handleAuthError(err) {
    if (err.status === 401) {
      showView('login');
      toast('انتهت الجلسة، يرجى تسجيل الدخول مجددًا.', 'error');
      return true;
    }
    return false;
  }

  async function boot() {
    try {
      await api('/api/admin/me');
      showView('dash');
      await loadServices();
    } catch (err) {
      showView('login');
      if (err.status !== 401) showLoginError(err.message);
      $('username').focus();
    }
  }

  function showLoginError(message) {
    const box = $('login-error');
    box.textContent = message;
    box.hidden = !message;
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) return showLoginError('أدخل اسم المستخدم وكلمة المرور.');
    const btn = $('login-btn');
    btn.disabled = true;
    btn.replaceChildren(el('span', { class: 'spinner' }), ' جارٍ الدخول…');
    showLoginError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: { username, password } });
      $('password').value = '';
      showView('dash');
      await loadServices();
    } catch (err) {
      showLoginError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  });

  $('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await api('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {});
    services = [];
    showView('login');
  });

  // ---------------- الجدول ----------------
  async function loadServices() {
    const body = $('svc-body');
    body.replaceChildren(el('tr', {}, el('td', { colspan: '5', class: 'table-empty' }, el('span', { class: 'spinner' }))));
    try {
      const data = await api('/api/admin/services');
      services = data.services;
      currency = data.currency || currency;
      $('currency-hint').textContent = `بالعملة: ${currency}`;
      render();
    } catch (err) {
      if (handleAuthError(err)) return;
      body.replaceChildren(el('tr', {}, el('td', { colspan: '5' },
        el('div', { class: 'alert' }, el('span', { class: 'grow', text: err.message }),
          el('button', { type: 'button', text: 'إعادة المحاولة', onclick: loadServices })))));
    }
  }

  function categories() {
    return [...new Set(services.map((s) => s.category))];
  }

  function render() {
    $('stat-total').textContent = services.length;
    $('stat-active').textContent = services.filter((s) => s.active).length;
    $('stat-cats').textContent = categories().length;

    const filter = $('cat-filter');
    const selected = filter.value;
    filter.replaceChildren(el('option', { value: '', text: 'كل الفئات' }), ...categories().map((c) => el('option', { value: c, text: c })));
    filter.value = categories().includes(selected) ? selected : '';
    $('cat-list').replaceChildren(...categories().map((c) => el('option', { value: c })));

    const q = $('search').value.trim().toLowerCase();
    const rows = services.filter((s) =>
      (!filter.value || s.category === filter.value) &&
      (!q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)));

    $('table-empty').hidden = rows.length > 0;
    $('svc-body').replaceChildren(...rows.map(row));
  }

  function row(s) {
    const priceInput = el('input', {
      type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: String(s.price),
      'aria-label': `سعر ${s.name}`,
    });
    const saveBtn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', hidden: true, text: 'حفظ' });

    const savePrice = async () => {
      const value = priceInput.value.trim();
      if (value === '' || !(Number(value) >= 0)) {
        toast('أدخل سعرًا صحيحًا (رقم أكبر من أو يساوي صفر).', 'error');
        priceInput.focus();
        return;
      }
      if (Number(value) === s.price) return;
      saveBtn.disabled = true;
      await update(s.id, { price: Number(value) }, `تم تحديث سعر "${s.name}"`);
      saveBtn.disabled = false;
    };

    priceInput.addEventListener('input', () => {
      const dirty = priceInput.value !== String(s.price);
      priceInput.classList.toggle('dirty', dirty);
      saveBtn.hidden = !dirty;
    });
    priceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') savePrice();
      if (e.key === 'Escape') { priceInput.value = String(s.price); priceInput.dispatchEvent(new Event('input')); }
    });
    saveBtn.addEventListener('click', savePrice);

    return el('tr', { class: s.active ? '' : 'inactive' },
      el('td', { 'data-label': 'الخدمة' },
        el('div', { class: 'svc-name', text: s.name }),
        s.description && el('div', { class: 'svc-desc', text: s.description })),
      el('td', { 'data-label': 'الفئة', text: s.category }),
      el('td', { 'data-label': `السعر (${currency})` },
        el('div', { class: 'price-input' }, priceInput, el('span', { class: 'unit', text: `/ ${s.unit}` }), saveBtn)),
      el('td', { 'data-label': 'الحالة' },
        el('button', {
          class: `pill ${s.active ? 'on' : 'off'}`, type: 'button', title: 'اضغط للتبديل',
          text: s.active ? 'مفعّلة' : 'موقوفة',
          onclick: () => update(s.id, { active: !s.active }, s.active ? 'تم إيقاف الخدمة' : 'تم تفعيل الخدمة'),
        })),
      el('td', {},
        el('div', { class: 'row-actions' },
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'تعديل', onclick: () => openForm(s) }),
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'حذف', onclick: () => confirmDelete(s) }))),
    );
  }

  $('search').addEventListener('input', render);
  $('cat-filter').addEventListener('change', render);

  async function update(id, patch, successMessage) {
    try {
      const updated = await api(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'PUT', body: patch });
      services = services.map((s) => (s.id === id ? updated : s));
      render();
      toast(successMessage);
      return true;
    } catch (err) {
      if (!handleAuthError(err)) toast(err.message, 'error');
      return false;
    }
  }

  // ---------------- الحوارات ----------------
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  const dialog = $('svc-dialog');
  const form = $('svc-form');

  function formError(message) {
    $('form-error').textContent = message;
    $('form-error').hidden = !message;
  }

  function openForm(service = null) {
    editingId = service?.id || null;
    $('dialog-title').textContent = service ? 'تعديل خدمة' : 'إضافة خدمة';
    form.reset();
    formError('');
    if (service) {
      $('f-name').value = service.name;
      $('f-category').value = service.category;
      $('f-unit').value = service.unit;
      $('f-price').value = service.price;
      $('f-description').value = service.description || '';
      $('f-active').checked = service.active;
    }
    dialog.showModal();
    $('f-name').focus();
  }

  $('add-btn').addEventListener('click', () => openForm());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: $('f-name').value.trim(),
      category: $('f-category').value.trim(),
      unit: $('f-unit').value.trim(),
      price: $('f-price').value.trim() === '' ? NaN : Number($('f-price').value),
      description: $('f-description').value.trim(),
      active: $('f-active').checked,
    };
    if (!payload.name || !payload.category || !payload.unit) return formError('يرجى تعبئة الحقول المطلوبة (*).');
    if (!Number.isFinite(payload.price) || payload.price < 0) return formError('السعر يجب أن يكون رقمًا أكبر من أو يساوي صفر.');

    const btn = $('save-btn');
    btn.disabled = true;
    formError('');
    try {
      if (editingId) {
        const updated = await api(`/api/admin/services/${encodeURIComponent(editingId)}`, { method: 'PUT', body: payload });
        services = services.map((s) => (s.id === editingId ? updated : s));
        toast('تم حفظ التعديلات');
      } else {
        services.push(await api('/api/admin/services', { method: 'POST', body: payload }));
        toast('تمت إضافة الخدمة');
      }
      dialog.close();
      render();
    } catch (err) {
      if (handleAuthError(err)) dialog.close();
      else formError(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  const confirmDialog = $('confirm-dialog');
  let deleteTarget = null;

  function confirmDelete(service) {
    deleteTarget = service;
    $('confirm-text').textContent = `هل أنت متأكد من حذف "${service.name}" (${money(service.price, currency)} / ${service.unit})؟ لا يمكن التراجع عن هذا الإجراء. يمكنك بدلًا من ذلك إيقاف الخدمة مؤقتًا.`;
    confirmDialog.showModal();
  }

  $('confirm-yes').addEventListener('click', async () => {
    if (!deleteTarget) return;
    const btn = $('confirm-yes');
    btn.disabled = true;
    try {
      await api(`/api/admin/services/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE', body: {} });
      services = services.filter((s) => s.id !== deleteTarget.id);
      render();
      toast('تم حذف الخدمة');
      confirmDialog.close();
    } catch (err) {
      confirmDialog.close();
      if (!handleAuthError(err)) toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      deleteTarget = null;
    }
  });

  boot();
})();
