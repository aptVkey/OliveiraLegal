/* Oliveira Legal — movimento e interação
   Sem dependências. Todos os efeitos de scroll usam um valor suavizado (lerp)
   e apenas transform / opacity / clip-path, para se manterem fluidos. */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pageTop = el => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };

  const nav = $('#nav');
  const hero = $('.hero');
  const sticky = $('.hero__sticky');
  const heroContent = $('.hero__content');
  const veil = $('.hero__veil');
  const arch = $('.hero__arch');
  const archInner = $('.hero__arch-inner');
  const statement = $('[data-words]');
  const marquee = $('[data-marquee]');
  const track = marquee && $('.marquee__track', marquee);
  const footerWrap = $('.footer-wrap');
  const footer = $('.footer');

  /* ── Preparação do DOM ──────────────────────────────────────────────── */
  // Palavras da declaração (revelação ligada ao scroll)
  let words = [];
  if (statement && !reduce) {
    const text = statement.textContent.trim().split(/\s+/);
    statement.setAttribute('aria-label', statement.textContent.trim());
    statement.innerHTML = text.map(w => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    words = $$('.w', statement);
  }

  // Faixa em movimento: duplicar o conteúdo para um ciclo contínuo
  if (track) track.innerHTML += track.innerHTML + track.innerHTML;

  // Escalonamento automático das revelações entre irmãos
  const groups = new Map();
  $$('[data-reveal]').forEach(el => {
    const list = groups.get(el.parentElement) || [];
    list.push(el); groups.set(el.parentElement, list);
  });
  groups.forEach(list => list.forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 6) * 0.09}s`)));

  // Letras do logótipo no rodapé
  $$('.footer__wordmark g').forEach((p, i) => { p.style.transitionDelay = `${0.15 + i * 0.07}s`; });

  /* ── Medidas ────────────────────────────────────────────────────────── */
  let scrubEls = [];
  let vw = 0, vh = 0, heroRange = 1, slot = null, zones = [], parallax = [], inners = [];
  let stTop = 0, stH = 1, trackW = 1, marqueeTop = 0;

  function measure() {
    vw = html.clientWidth; vh = window.innerHeight;
    const small = vw < 760;

    if (hero) {
      heroRange = Math.max(1, hero.offsetHeight - sticky.offsetHeight * (reduce ? 1 : 2));
      slot = { l: arch.offsetLeft, t: arch.offsetTop, w: arch.offsetWidth, h: arch.offsetHeight, H: sticky.offsetHeight };
    }

    // Rodapé revelado por baixo do conteúdo (apenas se couber no ecrã)
    if (footerWrap) {
      footerWrap.classList.remove('is-reveal'); footerWrap.style.height = '';
      const fh = footer.offsetHeight;
      if (!reduce && fh <= vh) { footerWrap.style.height = fh + 'px'; footerWrap.classList.add('is-reveal'); }
    }

    zones = $$('main [data-tone="dark"]:not(.hero__veil):not(.hero__arch), .footer-wrap').map(el => {
      const top = pageTop(el); return [top, top + el.offsetHeight];
    });

    parallax = reduce ? [] : $$('[data-parallax]').map(el => ({
      el, top: pageTop(el), h: el.offsetHeight, speed: parseFloat(el.dataset.parallax) * (small ? .5 : 1)
    }));
    inners = reduce ? [] : $$('[data-inner]').map(el => {
      const f = el.parentElement; return { el, top: pageTop(f), h: f.offsetHeight };
    });

    if (statement) { stTop = pageTop(statement); stH = statement.offsetHeight; }
    if (track) { trackW = track.scrollWidth / 3; marqueeTop = pageTop(marquee); }
  }

  /* ── Ciclo de animação ──────────────────────────────────────────────── */
  let target = window.scrollY, sy = target, last = -1, intro = reduce ? 1 : 0, introStart = 0, t0 = performance.now();
  let navDark = null, wordsProg = -1;

  let prev = performance.now();
  function frame(now) {
    // Suavização independente da taxa de fotogramas (60 Hz, 120 Hz, …)
    const dt = Math.min(0.1, Math.max(0, now - prev) / 1000); prev = now;
    const k = r => 1 - Math.exp(-dt * r);
    target = window.scrollY;
    sy = reduce ? target : lerp(sy, target, k(6.5));
    if (Math.abs(target - sy) < 0.05) sy = target;

    let introTick = false;
    if (introStart && intro < 1) { intro = clamp((now - introStart) / 1900); introTick = true; }
    const moving = sy !== last || introTick;

    if (moving) {
      // Hero: o arco abre até ocupar o ecrã
      let p = 0;
      if (hero && veil && !reduce && slot) {
        p = clamp(sy / heroRange);
        if (sy < heroRange + vh) {
          const e = easeInOut(p), eh = easeInOut(clamp(p / 0.82));
          const rise = (1 - easeOut(intro)) * slot.h;
          const T = lerp(slot.t + rise, 0, e);
          const L = lerp(slot.l, 0, eh);
          const R = lerp(vw - slot.l - slot.w, 0, eh);
          const B = lerp(slot.H - slot.t - slot.h, 0, e);
          const r = lerp(slot.w / 2, 0, eh);
          veil.style.clipPath = `inset(${T.toFixed(2)}px ${R.toFixed(2)}px ${B.toFixed(2)}px ${L.toFixed(2)}px round ${r.toFixed(2)}px ${r.toFixed(2)}px 0 0)`;
          archInner.style.opacity = (1 - clamp((p - 0.08) / 0.34)).toFixed(3);
          archInner.style.transform = `translate3d(0,${(-p * vh * 0.22).toFixed(2)}px,0) scale(${(1 + p * 0.25).toFixed(4)})`;
          heroContent.style.transform = `translate3d(0,${(-p * vh * 0.14).toFixed(2)}px,0)`;
          heroContent.style.opacity = (1 - clamp((p - 0.35) / 0.45)).toFixed(3);
        }
      }

      // Serviços: texto surge à medida do scroll
      if (scrubEls.length) {
        const q0 = heroRange * 0.92, span = vh * 0.3;
        scrubEls.forEach((el, i) => {
          const q = easeOut(clamp((sy - q0 - i * span * 0.25) / span));
          el.style.opacity = q.toFixed(3);
          el.style.transform = `translate3d(0,${((1 - q) * 36).toFixed(2)}px,0)`;
        });
      }

      // Tom da navegação (claro sobre oliva)
      const probe = sy + 34;
      let dark = hero && !reduce && sy < heroRange + vh ? p > 0.78 : false;
      if (!dark) for (const z of zones) if (probe >= z[0] && probe < z[1]) { dark = true; break; }
      if (dark !== navDark) { navDark = dark; nav.classList.toggle('is-dark', dark); }

      // Parallax
      const mid = sy + vh / 2;
      for (const it of parallax) {
        if (sy + vh < it.top - vh * .5 || sy > it.top + it.h + vh * .5) continue;
        it.el.style.transform = `translate3d(0,${((mid - (it.top + it.h / 2)) * it.speed).toFixed(2)}px,0)`;
      }
      for (const it of inners) {
        if (sy + vh < it.top - 200 || sy > it.top + it.h + 200) continue;
        const n = clamp((mid - (it.top + it.h / 2)) / (vh / 2 + it.h / 2), -1, 1);
        it.el.style.transform = `translate3d(0,${(n * -6.5).toFixed(3)}%,0) scale(1.16)`;
      }

      // Declaração: palavras acendem com o scroll
      if (words.length) {
        const prog = clamp((sy + vh * 0.82 - stTop) / (stH + vh * 0.32));
        if (prog !== wordsProg) {
          wordsProg = prog;
          const f = prog * (words.length + 3);
          for (let i = 0; i < words.length; i++) words[i].style.opacity = (0.14 + 0.86 * clamp((f - i) / 3)).toFixed(3);
        }
      }
      last = sy;
    }

    // Faixa: deriva lenta + deslocação com o scroll
    if (track && !reduce && sy + vh > marqueeTop - 200 && sy < marqueeTop + 600) {
      const x = ((now - t0) * 0.028 + sy * 0.32) % trackW;
      track.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`;
    }

    // Cursor
    // (só escreve no DOM enquanto o cursor se move — em repouso o ciclo não toca na página)
    if (cursorOn && (Math.abs(cx - mx) > 0.05 || Math.abs(cy - my) > 0.05)) {
      cx = lerp(cx, mx, k(14)); cy = lerp(cy, my, k(14));
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    }
    // Botão magnético
    for (const m of magnets) {
      m.x = lerp(m.x, m.tx, k(9)); m.y = lerp(m.y, m.ty, k(9));
      if (Math.abs(m.x - m.tx) > 0.01 || Math.abs(m.y - m.ty) > 0.01 || m.tx) m.el.style.transform = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
    }

    requestAnimationFrame(frame);
  }

  /* ── Navegação: esconder ao descer, mostrar ao subir ────────────────── */
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (html.classList.contains('menu-open')) { lastY = y; return; }
    if (Math.abs(y - lastY) > 6) {
      nav.classList.toggle('is-hidden', y > lastY && y > vh * 0.9 && !autoScroll);
      lastY = y;
    }
  }, { passive: true });

  /* ── Âncoras com deslocação suave ───────────────────────────────────── */
  let autoScroll = false;
  function scrollToY(to, done) {
    if (reduce) { window.scrollTo(0, to); done && done(); return; }
    const from = window.scrollY, dist = to - from;
    const dur = clamp(Math.abs(dist) / 2.2, 900, 1900), start = performance.now();
    autoScroll = true;
    const cancel = () => { autoScroll = false; };
    window.addEventListener('wheel', cancel, { once: true, passive: true });
    window.addEventListener('touchstart', cancel, { once: true, passive: true });
    (function step(now) {
      if (!autoScroll) return;
      const t = clamp((now - start) / dur);
      window.scrollTo(0, from + dist * easeInOut(t));
      if (t < 1) requestAnimationFrame(step); else { autoScroll = false; done && done(); }
    })(start);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    e.preventDefault();
    if (id === '#') return;
    const el = $(id); if (!el) return;
    closeMenu();
    // No hero, o destino "Serviços" coincide com o fim da abertura do arco
    const to = id === '#inicio' ? 0 : pageTop(el);
    scrollToY(to, () => { history.replaceState(null, '', id); });
  });

  /* ── Menu (ecrãs pequenos) ──────────────────────────────────────────── */
  const toggle = $('.nav__toggle'), menu = $('#menu');
  function closeMenu() {
    if (!html.classList.contains('menu-open')) return;
    html.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menu');
    menu.setAttribute('aria-hidden', 'true');
  }
  toggle.addEventListener('click', () => {
    if (html.classList.contains('menu-open')) return closeMenu();
    html.classList.add('menu-open'); nav.classList.remove('is-hidden');
    toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Fechar menu');
    menu.setAttribute('aria-hidden', 'false');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ── Revelações ao entrar no ecrã ───────────────────────────────────── */
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
  // Cabeçalho de Serviços: o texto surge com o scroll, sobre o verde já preenchido
  const scrubHead = $('.services .sec-head');
  if (scrubHead && !reduce) {
    scrubHead.removeAttribute('data-lines');
    const lead = $('.sec-head__lead', scrubHead); if (lead) lead.removeAttribute('data-reveal');
    scrubHead.classList.add('scrub');
    scrubEls = [$('.eyebrow', scrubHead), $('.display', scrubHead), lead].filter(Boolean);
  }
  const ioEarly = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); ioEarly.unobserve(en.target); }
  }, { threshold: 0, rootMargin: '0px 0px 8% 0px' });
  $$('[data-reveal], [data-lines]:not(.hero__content), .footer-wrap').forEach(el => (el.closest('.services .sec-head') ? ioEarly : io).observe(el));

  /* ── Serviços: título em duas camadas (regular / itálico) para o hover ─ */
  if (matchMedia('(hover: hover)').matches) {
    $$('.svc__title').forEach(t => {
      const txt = t.textContent;
      t.textContent = '';
      const a = document.createElement('span'), b = document.createElement('span');
      a.textContent = txt; b.textContent = txt; b.setAttribute('aria-hidden', 'true');
      t.append(a, b); t.classList.add('is-split');
    });
  }

  /* ── Cursor e botão magnético ───────────────────────────────────────── */
  const cursor = $('.cursor');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let cursorOn = false, mx = 0, my = 0, cx = 0, cy = 0;
  const magnets = [];
  if (fine && !reduce) {
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (!cursorOn) { cursorOn = true; cx = mx; cy = my; cursor.classList.add('is-on'); }
      const t = e.target;
      cursor.classList.toggle('is-hover', !!t.closest('a, button, select, label.consent'));
      cursor.classList.toggle('is-dark', !!t.closest('[data-tone="dark"]') && !(t.closest('.hero__sticky') && navDark === false && !t.closest('.hero__arch')));
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-on'));
    document.addEventListener('mouseenter', () => cursorOn && cursor.classList.add('is-on'));

    $$('[data-magnetic]').forEach(el => {
      const m = { el, x: 0, y: 0, tx: 0, ty: 0 }; magnets.push(m);
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.22; m.ty = (e.clientY - (r.top + r.height / 2)) * 0.3;
      });
      el.addEventListener('mouseleave', () => { m.tx = 0; m.ty = 0; });
    });
  }

  /* ── Formulário ─────────────────────────────────────────────────────── */
  const form = $('.form');
  if (form) {
    const status = $('.form__status', form);
    form.addEventListener('input', e => { const f = e.target.closest('.field, .consent'); f && f.classList.remove('is-invalid'); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      let first = null;
      $$('[required]', form).forEach(inp => {
        const ok = inp.checkValidity();
        const box = inp.closest('.field, .consent'); box && box.classList.toggle('is-invalid', !ok);
        if (!ok && !first) first = inp;
      });
      if (first) { status.textContent = 'Por favor, confirme os campos assinalados.'; first.focus({ preventScroll: false }); return; }
      const d = new FormData(form), to = (form.dataset.email || '').trim();
      if (!to) { status.textContent = 'Obrigado. O envio ficará ativo assim que o e-mail do escritório for configurado.'; return; }
      const subject = `Pedido de contacto — ${d.get('assunto') || 'Geral'}`;
      const body = `Nome: ${d.get('nome')}\nE-mail: ${d.get('email')}\n\n${d.get('mensagem')}`;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'A abrir a sua aplicação de e-mail para concluir o envio.';
    });
  }

  /* ── Arranque ───────────────────────────────────────────────────────── */
  let started = false;
  function start() {
    if (started) return; started = true;    measure();
    html.classList.add('is-loaded');
    introStart = performance.now() + 450;
    setTimeout(() => heroContent && heroContent.classList.add('is-in'), 550);
    setTimeout(() => html.classList.add('is-ready'), 2400);
  }

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); last = -1; }, 120); });
  window.addEventListener('load', () => { measure(); last = -1; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); last = -1; });

  measure();
  requestAnimationFrame(frame);
  const minDelay = reduce ? 0 : 1250;
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.all([ready, new Promise(r => setTimeout(r, minDelay))]).then(start);
  setTimeout(start, 3500);
})();
