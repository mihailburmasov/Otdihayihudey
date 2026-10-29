/* Отдыхай и Худей — интерактив */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  // Цели Метрики: подключить, когда появится счётчик
  const goal = name => { if (window.ym && window.YM_ID) window.ym(window.YM_ID, 'reachGoal', name); };

  if (/[?&]review\b/.test(location.search)) root.classList.add('review');

  /* Первый экран */
  const hero = $('.hero');
  requestAnimationFrame(() => setTimeout(() => hero && hero.classList.add('is-ready'), 120));

  /* Видео: грузим только когда видно, без звука; при reduced-motion и экономии трафика — постер */
  const videos = $$('video[data-src]');
  const load = v => { if (!v.src) { v.src = v.dataset.src; } };
  const play = v => { load(v); const p = v.play(); if (p) p.catch(() => {}); };
  if (!reduce && !saveData && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (v.classList.contains('story__v')) return; // ими управляет сюжет
      e.isIntersecting ? play(v) : v.pause();
    }), { rootMargin: '150px 0px' });
    videos.forEach(v => vio.observe(v));
  }

  /* Шапка: прозрачная на первом экране, тёмная над тёмными секциями, прячется при скролле вниз */
  const hdr = $('#hdr');
  const darkSecs = $$('.breath, .spa, .quote, .contacts, .ftr');
  const mbar = $('#mbar');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    const heroH = hero ? hero.offsetHeight : 0;
    const past = y > heroH - 80;
    hdr.classList.toggle('is-solid', past);
    const probe = 40;
    const dark = past && darkSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom >= probe; });
    hdr.classList.toggle('is-dark', dark);
    if (!hdr.classList.contains('is-open')) hdr.classList.toggle('is-hidden', past && y > lastY + 4 && y > heroH + 200);
    if (y < lastY - 4) hdr.classList.remove('is-hidden');
    lastY = y;
    if (mbar) mbar.classList.toggle('is-on', y > heroH * .6);
    words();
    parallax();
  };

  /* Меню */
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = !hdr.classList.contains('is-open');
    hdr.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('#nav a').forEach(a => a.addEventListener('click', () => {
    hdr.classList.remove('is-open'); burger.setAttribute('aria-expanded', false); document.body.style.overflow = '';
  }));

  /* Текст, проявляющийся по словам */
  const wordEls = $$('.words');
  wordEls.forEach(el => {
    const html = el.innerHTML.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span>${w}</span>`).join('');
    el.innerHTML = html;
  });
  function words() {
    const vh = innerHeight;
    wordEls.forEach(el => {
      const r = el.getBoundingClientRect();
      const spans = el.children;
      const p = Math.min(1, Math.max(0, (vh * .88 - r.top) / (r.height + vh * .35)));
      const n = reduce ? spans.length : Math.round(p * spans.length);
      for (let i = 0; i < spans.length; i++) spans[i].classList.toggle('is-in', i < n);
    });
  }

  /* Лёгкий параллакс */
  const par = reduce ? [] : [
    ...$$('.intro__pic img').map((el, i) => ({ el, k: [.06, -.08, .1][i] })),
    ...$$('.quote__video').map(el => ({ el, k: .12 }))
  ];
  function parallax() {
    const vh = innerHeight;
    par.forEach(({ el, k }) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const c = (r.top + r.height / 2 - vh / 2);
      el.style.transform = `translate3d(0,${(-c * k).toFixed(1)}px,0) scale(${el.tagName === 'IMG' ? 1.15 : 1})`;
    });
  }

  /* Появление блоков */
  if ('IntersectionObserver' in window) {
    const rio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    $$('.reveal').forEach(el => rio.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('is-in'));

  /* Сюжет спа-ритуала: шаг на экране — своё видео */
  const steps = $$('.story__step');
  const sv = $$('.story__v');
  const bars = $$('.story__progress i');
  let cur = -1;
  const setStep = i => {
    if (i === cur) return; cur = i;
    sv.forEach((v, j) => {
      v.classList.toggle('is-on', j === i);
      if (j === i) { if (!reduce && !saveData) play(v); } else v.pause();
    });
    bars.forEach((b, j) => b.classList.toggle('is-on', j <= i));
  };
  if ('IntersectionObserver' in window) {
    const sio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); setStep(steps.indexOf(e.target)); }
    }), { threshold: .55 });
    steps.forEach(s => sio.observe(s));
  }
  // подгружаем первое видео сюжета, когда секция близко
  const story = $('#story');
  if (story && !reduce && !saveData && 'IntersectionObserver' in window) {
    const pre = new IntersectionObserver(es => { if (es[0].isIntersecting) { load(sv[0]); pre.disconnect(); } }, { rootMargin: '600px 0px' });
    pre.observe(story);
  }

  /* Дыхательная пауза: вдох 4 — пауза 4 — выдох 6 */
  const bc = $('#breathCircle'), bw = $('#breathWord'), bn = $('#breathCount'), bb = $('#breathBtn');
  let bTimer = null;
  const phases = [['вдох', 'inhale', 4], ['пауза', 'hold', 4], ['выдох', 'exhale', 6]];
  const stopBreath = (msg) => {
    clearTimeout(bTimer); bTimer = null;
    bc.className = 'breath__circle'; bw.textContent = msg || 'готовы?'; bn.textContent = '';
    bb.textContent = msg ? 'Ещё раз' : 'Начать дыхание';
  };
  bb.addEventListener('click', () => {
    if (bTimer) return stopBreath();
    bb.textContent = 'Остановить';
    let cycle = 0, ph = 0, left = 0;
    const tick = () => {
      if (left === 0) {
        if (ph === phases.length) { ph = 0; cycle++; }
        if (cycle === 4) return stopBreath('хорошо');
        const [w, cls, d] = phases[ph++];
        bc.className = 'breath__circle ' + cls; bw.textContent = w; left = d;
      }
      bn.textContent = left--;
      bTimer = setTimeout(tick, 1000);
    };
    tick();
    goal('breath');
  });

  /* Звук пространства */
  const snd = $('#sound'), au = $('#ambient');
  let fadeT;
  const fade = (to, done) => {
    clearInterval(fadeT);
    fadeT = setInterval(() => {
      const v = au.volume + (to > au.volume ? .04 : -.06);
      if ((to > au.volume && v >= to) || (to <= au.volume && v <= to)) { au.volume = to; clearInterval(fadeT); done && done(); }
      else au.volume = Math.min(1, Math.max(0, v));
    }, 80);
  };
  snd.addEventListener('click', () => {
    const on = snd.getAttribute('aria-pressed') !== 'true';
    snd.setAttribute('aria-pressed', on);
    snd.setAttribute('aria-label', on ? 'Выключить звук пространства' : 'Включить звук пространства');
    if (on) { au.volume = 0; const p = au.play(); if (p) p.catch(() => {}); fade(.55); goal('sound'); }
    else fade(0, () => au.pause());
  });

  /* Запись: YCLIENTS, а пока ссылок нет — окно с записью по телефону */
  const sheet = $('#sheet');
  const opts = $('.sheet__opts', sheet), soon = $('.sheet__soon', sheet), title = $('#sheet-title');
  let lastFocus;
  const openSheet = (mode) => {
    lastFocus = document.activeElement;
    const isSoon = mode === 'soon';
    opts.hidden = isSoon; soon.hidden = !isSoon;
    title.textContent = isSoon ? 'Запишем вас по телефону' : 'Куда записываемся?';
    sheet.hidden = false; document.body.style.overflow = 'hidden';
    $('.sheet__x', sheet).focus();
  };
  const closeSheet = () => { sheet.hidden = true; document.body.style.overflow = ''; lastFocus && lastFocus.focus(); };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-book]');
    if (!a) return;
    goal('book_' + (a.dataset.book || 'menu'));
    const href = a.getAttribute('href');
    if (href && href !== '#book') return; // настоящая ссылка YCLIENTS
    e.preventDefault();
    openSheet(a.dataset.book ? 'soon' : 'menu');
  });
  $$('[data-close]', sheet).forEach(b => b.addEventListener('click', closeSheet));
  document.addEventListener('click', e => { if (e.target.closest('[data-goal="phone"]')) goal('phone'); });

  /* Галерея: перетаскивание мышью и лайтбокс */
  const gal = $('#gallery'), lb = $('#lb'), lbImg = $('img', lb);
  if (gal) {
    let down = false, sx = 0, sl = 0, moved = 0;
    gal.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = gal.scrollLeft; });
    addEventListener('pointermove', e => {
      if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) gal.classList.add('is-drag'); gal.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { down = false; gal.classList.remove('is-drag'); });
    gal.addEventListener('click', e => {
      const f = e.target.closest('.g'); if (!f || moved > 5) return;
      const img = $('img', f); lbImg.src = img.dataset.full; lbImg.alt = img.alt;
      lastFocus = f; lb.hidden = false; $('.lb__x', lb).focus();
    });
    gal.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') gal.scrollBy({ left: 400, behavior: 'smooth' });
      if (e.key === 'ArrowLeft') gal.scrollBy({ left: -400, behavior: 'smooth' });
    });
  }
  const closeLb = () => { lb.hidden = true; lbImg.src = ''; };
  lb.addEventListener('click', closeLb);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) closeSheet();
    if (!lb.hidden) closeLb();
    if (hdr.classList.contains('is-open')) burger.click();
  });

  /* Сертификат наклоняется за курсором */
  const card = $('#giftCard');
  if (card && !reduce) {
    const wrap = card.parentElement;
    wrap.addEventListener('pointermove', e => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
      card.style.setProperty('--shine', `${x * 60}%`);
    });
    wrap.addEventListener('pointerleave', () => { card.style.transform = ''; card.style.setProperty('--shine', '-30%'); });
  }

  /* Cookie */
  const ck = $('#cookie');
  if (ck && !store.get('ox-cookie')) {
    setTimeout(() => { ck.hidden = false; }, 2500);
    $('#cookieOk').addEventListener('click', () => { ck.hidden = true; store.set('ox-cookie', '1'); });
  }

  addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
})();
