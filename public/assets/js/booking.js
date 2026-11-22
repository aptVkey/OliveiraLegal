/* Oliveira Legal — marcação de consultas (contactos → data e hora → detalhes → pagamento Stripe)
   A secção só aparece quando o backoffice a ativou e o pagamento está configurado. */
(() => {
  'use strict';

  const root = document.getElementById('agendar');
  if (!root || !window.fetch) return;
  const bk = root.querySelector('[data-bk]');
  const $ = (s, c = bk) => c.querySelector(s);
  const $$ = (s, c = bk) => Array.from(c.querySelectorAll(s));
  const TZ = 'Europe/Lisbon';
  const KEY = 'ol-booking';
  const MODES = {
    presencial: { label: 'Presencial', icon: 'i-local', desc: 'No nosso escritório em Albufeira.' },
    online: { label: 'Online', icon: 'i-video', desc: 'Por videochamada, onde estiver.' },
  };

  let cfg = null;
  let st = { step: 1 };
  let days = {};          // { 'AAAA-MM-DD': [{ t: '10:00', at: ISO }] }
  let dayList = [];

  /* ── Utilitários ──────────────────────────────────────────────────── */
  const fmt = (o) => new Intl.DateTimeFormat('pt-PT', Object.assign({ timeZone: TZ }, o));
  const longDate = (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
  const money = (c) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: (cfg.currency || 'eur').toUpperCase() }).format(c / 100);
  const todayLisbon = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const noon = (ymd) => new Date(ymd + 'T12:00:00Z');
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* modo privado */ } };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const clear = () => { try { sessionStorage.removeItem(KEY); } catch (e) { /* */ } };
  const err = (msg) => { const el = $('[data-bk-error]'); el.textContent = msg || ''; };
  const relayout = () => window.dispatchEvent(new Event('resize'));
  const mode = () => cfg && cfg.modes.find((m) => m.id === st.mode);

  async function api(path, body) {
    const res = await fetch('/api/agendamento/' + path, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin',
    } : { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Não foi possível concluir o pedido. Tente novamente.'), { status: res.status });
    return data;
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on; btn.classList.toggle('is-busy', on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  /* ── Passos ───────────────────────────────────────────────────────── */
  function go(step, opts) {
    st.step = step; save(); err('');
    $$('[data-bk-step]').forEach((el) => el.classList.toggle('is-active', el.dataset.bkStep === String(step)));
    bk.classList.toggle('is-done', step === 'done');
    $$('[data-bk-stepnav]').forEach((li) => {
      const n = +li.dataset.bkStepnav;
      li.classList.toggle('is-current', n === step);
      li.classList.toggle('is-done', typeof step === 'number' && n < step);
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (typeof step === 'number') $('[data-bk-bar]').style.transform = `scaleX(${step / 4})`;
    if (step === 2) renderDays();
    if (step === 4) renderReview();
    summary();
    relayout();
    if (!opts || !opts.silent) {
      // Em ecrãs pequenos, voltar ao topo do painel ao mudar de passo
      const top = bk.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - 90, behavior: 'smooth' });
      const focusEl = $(`[data-bk-step="${step}"] .bk__title`);
      if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
    }
  }

  function summary() {
    const s = st.slot;
    $('[data-bk-sum="date"]').textContent = s ? fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(s.at)) : '—';
    $('[data-bk-sum="time"]').textContent = s ? s.t : '—';
    $('[data-bk-sum="mode"]').textContent = st.mode ? MODES[st.mode].label : '—';
    const m = mode();
    $('[data-bk-sum="total"]').textContent = m ? money(m.price) : (cfg && cfg.modes.length ? 'desde ' + money(Math.min(...cfg.modes.map((x) => x.price))) : '—');
    $$('[data-bk-sum]').forEach((dd) => dd.parentElement.classList.toggle('is-empty', dd.textContent === '—'));
    bk.classList.toggle('has-slot', !!s && st.step !== 'done');
  }

  /* ── 1 · Contactos ────────────────────────────────────────────────── */
  const f1 = $('[data-bk-step="1"]');
  f1.addEventListener('input', (e) => { const f = e.target.closest('.field, .consent'); if (f) f.classList.remove('is-invalid'); });
  f1.addEventListener('submit', async (e) => {
    e.preventDefault(); err('');
    let first = null;
    $$('input[required]', f1).forEach((inp) => {
      const ok = inp.checkValidity() && (inp.type !== 'text' || inp.value.trim().length >= 2);
      const box = inp.closest('.field, .consent'); if (box) box.classList.toggle('is-invalid', !ok);
      if (!ok && !first) first = inp;
    });
    if (first) { err('Por favor, confirme os campos assinalados.'); first.focus(); return; }
    const d = new FormData(f1);
    const btn = $('button[type="submit"]', f1); busy(btn, true);
    try {
      const r = await api('inicio', {
        name: d.get('name'), email: d.get('email'), phone: d.get('phone'), website: d.get('website'),
        consent: d.get('consent') === 'on', token: st.token || null,
      });
      Object.assign(st, { token: r.token, name: String(d.get('name')).trim(), email: String(d.get('email')).trim(), phone: String(d.get('phone') || '').trim() });
      go(2);
      loadSlots();
    } catch (ex) { err(ex.message); } finally { busy(btn, false); }
  });

  /* ── 2 · Data e hora ──────────────────────────────────────────────── */
  const daysEl = $('[data-bk-days]'), slotsEl = $('[data-bk-slots]'), next2 = $('[data-bk-next="3"]');

  async function loadSlots() {
    const from = todayLisbon(), to = addDays(from, Math.min(cfg.maxDays || 30, 62));
    dayList = []; for (let d = from; d <= to; d = addDays(d, 1)) dayList.push(d);
    slotsEl.innerHTML = '<span class="bk__skeleton"></span>'.repeat(6);
    daysEl.innerHTML = '';
    try {
      days = (await api(`horarios?de=${from}&ate=${to}`)).days || {};
    } catch (ex) { days = {}; err(ex.message); }
    // A hora guardada pode ter deixado de estar livre
    if (st.slot && !(days[st.day] || []).some((s) => s.at === st.slot.at)) { st.slot = null; }
    if (!st.day || !days[st.day]) st.day = dayList.find((d) => days[d]) || null;
    renderDays();
  }

  function renderDays() {
    if (!dayList.length) return;
    const wd = fmt({ weekday: 'short' }), dn = fmt({ day: 'numeric' }), mo = fmt({ month: 'short' });
    daysEl.innerHTML = dayList.map((d) => {
      const n = noon(d), has = !!days[d];
      return `<button type="button" class="bk__day" role="option" data-day="${d}" aria-selected="${d === st.day}" ${has ? '' : 'disabled aria-disabled="true"'}
        aria-label="${fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(n)}${has ? '' : ' — sem horários'}">
        <small>${wd.format(n).replace('.', '')}</small><b>${dn.format(n)}</b><small>${mo.format(n).replace('.', '')}</small></button>`;
    }).join('');
    renderSlots();
    const sel = daysEl.querySelector('[aria-selected="true"]');
    if (sel) daysEl.scrollLeft = Math.max(0, sel.offsetLeft - daysEl.offsetLeft - 2 - (window.innerWidth < 760 ? 0 : 0));
    arrows();
  }

  function renderSlots() {
    const list = st.day ? days[st.day] || [] : [];
    const month = st.day ? fmt({ month: 'long', year: 'numeric' }).format(noon(st.day)) : '';
    $('[data-bk-month]').textContent = month.charAt(0).toUpperCase() + month.slice(1);
    slotsEl.innerHTML = list.length
      ? list.map((s) => `<button type="button" class="bk__slot" role="option" data-at="${s.at}" data-t="${s.t}" aria-selected="${!!st.slot && st.slot.at === s.at}">${s.t}</button>`).join('')
      : `<p class="bk__empty">${Object.keys(days).length ? 'Sem horários neste dia.' : 'De momento não há horários disponíveis. Contacte-nos através do formulário abaixo.'}</p>`;
    next2.disabled = !st.slot;
    relayout();
  }

  daysEl.addEventListener('click', (e) => {
    const b = e.target.closest('.bk__day'); if (!b || b.disabled) return;
    st.day = b.dataset.day;
    if (st.slot && !(days[st.day] || []).some((s) => s.at === st.slot.at)) st.slot = null;
    $$('.bk__day', daysEl).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderSlots(); summary(); save();
  });
  slotsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.bk__slot'); if (!b) return;
    st.slot = { at: b.dataset.at, t: b.dataset.t };
    $$('.bk__slot', slotsEl).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    next2.disabled = false; summary(); save();
  });
  // Setas e teclado na faixa de dias
  function arrows() {
    const [prev, nxt] = $$('[data-bk-scroll]');
    prev.disabled = daysEl.scrollLeft < 4;
    nxt.disabled = daysEl.scrollLeft + daysEl.clientWidth >= daysEl.scrollWidth - 4;
  }
  daysEl.addEventListener('scroll', () => requestAnimationFrame(arrows), { passive: true });
  $$('[data-bk-scroll]').forEach((b) => b.addEventListener('click', () => {
    daysEl.scrollBy({ left: +b.dataset.bkScroll * daysEl.clientWidth * 0.8, behavior: 'smooth' });
  }));
  daysEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const all = $$('.bk__day:not([disabled])', daysEl), i = all.indexOf(document.activeElement);
    const t = all[i + (e.key === 'ArrowRight' ? 1 : -1)]; if (t) { e.preventDefault(); t.focus(); t.click(); }
  });
  next2.addEventListener('click', () => { if (st.slot) go(3); });

  /* ── 3 · Detalhes ─────────────────────────────────────────────────── */
  const f3 = $('[data-bk-step="3"]'), modesEl = $('[data-bk-modes]'), areaEl = $('[data-bk-areas]');
  function renderModes() {
    if (cfg.modes.length === 1) st.mode = cfg.modes[0].id;
    modesEl.innerHTML = cfg.modes.map((m) => `
      <button type="button" class="bk__mode" role="radio" aria-checked="${st.mode === m.id}" data-mode="${m.id}">
        <svg aria-hidden="true"><use href="#${MODES[m.id].icon}"/></svg>
        <strong>${MODES[m.id].label}</strong>
        <span>${m.id === 'presencial' && cfg.address ? cfg.address.replace(/</g, '&lt;') : MODES[m.id].desc}</span>
        <em>${money(m.price)}</em>
      </button>`).join('');
  }
  modesEl.addEventListener('click', (e) => {
    const b = e.target.closest('.bk__mode'); if (!b) return;
    st.mode = b.dataset.mode;
    $$('.bk__mode', modesEl).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    err(''); summary(); save();
  });
  modesEl.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const all = $$('.bk__mode', modesEl), i = all.indexOf(document.activeElement);
    const t = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
    if (t) { e.preventDefault(); t.focus(); t.click(); }
  });
  f3.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!st.mode) { err('Escolha se prefere uma reunião presencial ou online.'); return; }
    st.areaId = areaEl.value || null;
    st.areaName = areaEl.value ? areaEl.selectedOptions[0].textContent : null;
    st.topic = $('#bk-topic', f3).value.trim();
    go(4);
  });

  /* ── 4 · Pagamento ────────────────────────────────────────────────── */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderReview() {
    const m = mode(); if (!st.slot || !m) return;
    const rows = [
      ['Quando', `${longDate(st.slot.at)}, às ${st.slot.t}`],
      ['Formato', MODES[st.mode].label + (st.mode === 'presencial' && cfg.address ? ` · ${cfg.address}` : '')],
      ['Duração', `${cfg.duration} minutos`],
      st.areaName && ['Área', st.areaName],
      ['Nome', st.name], ['E-mail', st.email], st.phone && ['Telefone', st.phone],
      st.topic && ['Assunto', st.topic],
      ['Total', money(m.price)],
    ].filter(Boolean);
    $('[data-bk-review]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('[data-bk-total]').textContent = money(m.price);
  }
  const payBtn = $('[data-bk-pay]');
  payBtn.addEventListener('click', async () => {
    err(''); busy(payBtn, true);
    try {
      const r = await api('pagar', { token: st.token, startsAt: st.slot.at, mode: st.mode, areaId: st.areaId, topic: st.topic });
      st.reference = r.reference; save();
      window.location.assign(r.url);
    } catch (ex) {
      busy(payBtn, false);
      if (ex.status === 409 && /horário/i.test(ex.message)) {
        st.slot = null; save(); go(2); loadSlots(); err(ex.message);
      } else err(ex.message);
    }
  });

  /* ── Navegação entre passos ───────────────────────────────────────── */
  $$('[data-bk-back]').forEach((b) => b.addEventListener('click', () => go(Math.max(1, st.step - 1))));
  $('[data-bk-restart]').addEventListener('click', () => {
    clear(); st = { step: 1 }; f1.reset(); f3.reset(); renderModes(); $('[data-bk-restart]').hidden = true; go(1);
  });

  /* ── Regresso do Stripe ───────────────────────────────────────────── */
  async function confirmPayment() {
    go('done', { silent: true });
    const title = $('[data-bk-done-title]'), text = $('[data-bk-done-text]');
    const done = (t, x) => { title.textContent = t; text.textContent = x; $('[data-bk-restart]').hidden = false; relayout(); };
    if (!st.token) return done('Pagamento recebido', 'Obrigado. Vai receber a confirmação e o convite para o calendário por e-mail.');
    for (let i = 0; i < 8; i++) {
      try {
        const r = await api('estado', { token: st.token });
        if (r.status === 'pago') {
          const when = `${longDate(r.startsAt)}, às ${fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(r.startsAt))}`;
          clear();
          return done('Consulta confirmada.', `${when} · ${MODES[r.mode].label}. Enviámos a confirmação e o convite para o calendário para ${r.email}. Referência ${r.reference}.`);
        }
        if (r.status === 'conflito') { clear(); return done('Pagamento recebido.', 'O horário foi ocupado enquanto o pagamento era processado. Vamos contactá-lo para acertar uma nova data.'); }
      } catch (e) { /* tenta de novo */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    done('Pagamento em processamento', 'Assim que o pagamento for confirmado, recebe a confirmação e o convite para o calendário por e-mail.');
  }

  /* ── Arranque ─────────────────────────────────────────────────────── */
  async function init() {
    try { cfg = await api('config'); } catch (e) { return; }
    if (!cfg || !cfg.enabled || !cfg.modes || !cfg.modes.length) return;

    // Título e texto definidos no backoffice
    if (cfg.title) {
      const words = cfg.title.trim().replace(/\.$/, '').split(/\s+/);
      const last = words.pop();
      root.querySelector('[data-bk-title1]').textContent = words.join(' ') || ' ';
      root.querySelector('[data-bk-title2]').textContent = last + '.';
    }
    if (cfg.intro) root.querySelector('[data-bk-intro]').textContent = cfg.intro;
    $('[data-bk-duration]').textContent = `Cada consulta tem a duração de ${cfg.duration} minutos.`;
    areaEl.insertAdjacentHTML('beforeend', cfg.areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(''));

    // Mostrar a secção e apontar "Marcar consulta" para aqui
    root.hidden = false;
    const cn = document.querySelector('[data-contact-num]'); if (cn) cn.textContent = '04';
    document.querySelectorAll('.nav__cta').forEach((a) => a.setAttribute('href', '#agendar'));
    if ('ResizeObserver' in window) { let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(relayout, 150); }).observe(root); }

    // Recuperar uma marcação em curso (p. ex. depois de cancelar o pagamento)
    const saved = load();
    if (saved && saved.token) st = saved;
    if (st.name) { const el = (n) => f1.elements.namedItem(n); el('name').value = st.name; el('email').value = st.email || ''; el('phone').value = st.phone || ''; el('consent').checked = true; }
    if (st.areaId) areaEl.value = st.areaId;
    if (st.topic) $('#bk-topic', f3).value = st.topic;
    renderModes();

    const params = new URLSearchParams(location.search);
    const ret = params.get('agendamento');
    if (ret) history.replaceState(null, '', location.pathname + '#agendar');
    if (ret === 'sucesso') { confirmPayment(); setTimeout(() => root.scrollIntoView(), 400); return; }

    if (st.token && typeof st.step === 'number' && st.step > 1) {
      await loadSlots();
      const step = !st.slot ? 2 : !st.mode ? 3 : st.step;
      go(step, { silent: true });
      if (ret === 'cancelado') {
        err(st.slot ? 'O pagamento foi cancelado. A sua escolha mantém-se — pode tentar novamente.' : 'O pagamento foi cancelado e o horário deixou de estar disponível. Escolha outro, por favor.');
        setTimeout(() => root.scrollIntoView(), 400);
      }
    } else go(1, { silent: true });
  }

  // Não compete com o carregamento inicial: arranca quando o browser estiver livre
  // (logo de imediato no regresso do pagamento)
  if (/[?&]agendamento=/.test(location.search) || !('requestIdleCallback' in window)) setTimeout(init, 0);
  else requestIdleCallback(init, { timeout: 2500 });
})();
