/* Green Life — сценарий страницы: плавный скролл, рост растений, появление текста «из зелени». */
(() => {
  const root = document.documentElement;
  // Метка версии из адреса самого скрипта (main.js?v=…): декорации js/deco/*.js берём с той же меткой, иначе после обновления
  // браузер мог бы взять их из кэша (Pages держит файлы 10 минут) и смешать старые рисунки с новым сценарием.
  const assetV = ((document.currentScript && /[?&]v=([A-Za-z0-9_-]+)/.exec(document.currentScript.src)) || [])[1] || '';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // основное указание — палец: телефоны, планшеты, iPhone. Прокрутка там родная, ролики без перемотки кадрами.
  const coarse = matchMedia('(pointer: coarse)').matches;
  // .98 — как в CSS: при дробной ширине окна 900,5 px считается узким экраном, а не «ни тем, ни другим»
  const isNarrow = () => matchMedia('(max-width: 900.98px)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const hasAnim = !!(window.gsap && window.ScrollTrigger && window.SplitText && window.DrawSVGPlugin);
  let lenis = null;
  window.GLMain = true; // запасной таймер в <head> смотрит на это: скрипт доехал и постерами занимается сам
  root.classList.add('js'); // таймер снимает .js, только если скрипта ещё нет; доехавшему скрипту кнопки и меню нужны всегда

  /* ================= то, что работает и без анимаций ================= */

  const hdr = $('[data-hdr]');
  const hdrH = () => hdr.offsetHeight;
  const nav = $('#nav');
  const burger = $('.burger');
  const setNav = (open) => {
    // Esc приходит и при закрытом меню: включать Lenis можно, только если закрываем именно его, иначе страница поедет под окном «Смотреть всё»
    if (nav.classList.contains('is-open') === open) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  // Куда скроллить: у закреплённых блоков (титул, лента услуг) место берём из их ScrollTrigger,
  // иначе после прохождения пина getBoundingClientRect указывает в конец закрепления.
  const targetY = (el) => {
    if (el.id === 'top') return 0;
    if (hasAnim) {
      const st = ScrollTrigger.getAll().find((s) => s.pin === el);
      if (st) return st.start + 2;
    }
    return el.getBoundingClientRect().top + scrollY - hdrH() + 2;
  };
  // Конец плавной прокрутки браузера — 150 мс без движения (длительность у браузеров своя, событие scrollend есть не везде).
  // Первому движению даём 600 мс: на слабом телефоне прокрутка начинается не сразу. Палец или колесо её прерывают — тогда доводка не нужна.
  let stillOff = null;
  const whenStill = (fn) => {
    if (stillOff) stillOff();
    const t0 = performance.now();
    let y = scrollY, moved = t0, began = false, raf = 0;
    const off = stillOff = () => {
      cancelAnimationFrame(raf);
      stillOff = null;
      removeEventListener('touchstart', off);
      removeEventListener('wheel', off);
    };
    const tick = (now) => {
      if (scrollY !== y) { y = scrollY; moved = now; began = true; }
      if (now - moved < (began ? 150 : 600)) { raf = requestAnimationFrame(tick); return; }
      off();
      fn();
    };
    addEventListener('touchstart', off, { passive: true });
    addEventListener('wheel', off, { passive: true });
    raf = requestAnimationFrame(tick);
  };
  // Ещё 2,5 с после доводки сверяем место: на перегруженной машине название главы над разделом может достроиться позже
  // и сдвинуть раздел (промах до 500 px). Колесо, палец, клавиша или щелчок посетителя сверку снимают.
  let guardOff = null;
  const guard = (el) => {
    if (guardOff) guardOff();
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (performance.now() - t0 > 2500) { off(); return; }
      if (lenis && lenis.isScrolling) return;
      const y2 = targetY(el);
      if (Math.abs(y2 - scrollY) > 4) { if (lenis) lenis.scrollTo(y2, { duration: 0.4, force: true }); else window.scrollTo({ top: y2 }); }
    }, 250);
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const off = guardOff = () => { clearInterval(iv); guardOff = null; evs.forEach((t) => removeEventListener(t, off)); };
    evs.forEach((t) => addEventListener(t, off, { passive: true }));
  };
  // По пути готовятся названия глав и чуть меняют высоту страницы — в конце прокрутки доводим до точки.
  // Мгновенный scrollTo посреди плавной прокрутки браузер прибавляет к ней (промах до 1300 px), поэтому без Lenis ждём полной остановки.
  const scrollToEl = (el, immediate = false) => {
    if (guardOff) guardOff();
    const y = targetY(el);
    const settle = () => {
      const y2 = targetY(el);
      if (Math.abs(y2 - scrollY) > 4) { if (lenis) lenis.scrollTo(y2, { duration: 0.5, force: true }); else window.scrollTo({ top: y2 }); }
      guard(el);
    };
    if (lenis) lenis.scrollTo(y, { duration: 1.5, immediate, force: true, onComplete: settle });
    else {
      window.scrollTo({ top: y, behavior: reduce || immediate ? 'auto' : 'smooth' });
      if (immediate) setTimeout(settle, 50); else whenStill(settle);
    }
  };
  // мгновенный переход в точку, с учётом выросшей высоты страницы
  const jumpTo = (y) => {
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); }
    else window.scrollTo(0, y);
  };
  const focusEl = (el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && document.getElementById(decodeURIComponent(id.slice(1)));
    if (!el) return;
    e.preventDefault();
    const fromMenu = !!a.closest('#sections');
    if (fromMenu) closeSections(false);
    setNav(false);
    // Вопрос из «Частых вопросов» (ссылка из сносок к прайсу) — сразу с раскрытым ответом и уже проявленный:
    // пока он ждёт появления, он сдвинут вниз, и место прокрутки посчиталось бы со сдвигом.
    const qa = el.tagName === 'DETAILS';
    if (qa) { el.open = true; if (window.gsap) gsap.set(el, { opacity: 1, y: 0, overwrite: true }); }
    decoAim(el);
    scrollToEl(el);
    if (qa) el.querySelector('summary').focus({ preventScroll: true }); else focusEl(el);
    history.replaceState(null, '', id);
    if (fromMenu) setTimeout(() => window.dispatchEvent(new CustomEvent('gl:arrive', { detail: el.id })), 1300);
  });

  // Сезонные предложения исчезают после своей даты и без пересборки (время Новосибирска, UTC+7).
  const todayNsk = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  $$('[data-until]').forEach((el) => { if (el.getAttribute('data-until') < todayNsk) el.remove(); });

  // Приветствие Алёны у кнопки WhatsApp: только тому, кто уже листает каталог (25+ секунд на странице и дошёл до первой главы — «Роз»),
  // и не там, где и так есть кнопки связи (прайс, контакты, подвал). Закрыли или оно само скрылось — неделю не показываем.
  // Текст и кнопки сцены оно не закрывает: ждёт, пока страница остановится со свободным углом экрана, а если при прокрутке заехал текст,
  // прячется и досиживает остаток своих 14 секунд на следующей остановке.
  function waWidget() {
    const w = $('[data-wa-widget]');
    if (!w) return;
    const bubble = $('.wa-bubble', w);
    const KEY = 'gl-wa-until';
    let snoozed = false;
    try { snoozed = Date.now() < Number(localStorage.getItem(KEY) || 0); } catch (e) { /* приватный режим */ }
    let done = false, hideT = 0, left = 14000, openAt = 0;
    const close = () => {
      clearTimeout(hideT);
      if (bubble.hidden) return;
      bubble.hidden = true;
      done = true;
      try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)); } catch (e) { /* ничего */ }
    };
    $('.wa-close', w).addEventListener('click', close);
    // та же граница, что в CSS (.wa-widget скрыт до 700 px включительно: внизу экрана своя панель связи)
    if (snoozed || matchMedia('(max-width: 700.98px)').matches || !('IntersectionObserver' in window)) return;
    const busy = new Set();
    const first = $('#rozy');
    let timeOk = false, deepOk = false;
    // Что лежит под приветствием: ролик и фон закрывать можно, текст, кнопки и схемы нет. Смотрим сеткой точек; скрытое на миг показываем, чтобы узнать его размер (кадр не рисуется).
    const solid = (e) => !w.contains(e) && (e.closest('a, button, summary, svg') || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const cornerBusy = () => {
      const off = bubble.hidden;
      bubble.hidden = false;
      const r = bubble.getBoundingClientRect();
      bubble.hidden = off;
      for (let i = 0; i <= 6; i++) {
        for (let j = 0; j <= 6; j++) {
          if (document.elementsFromPoint(r.left + r.width * i / 6, r.top + r.height * j / 6).some(solid)) return true;
        }
      }
      return false;
    };
    const tryShow = () => {
      if (done || !bubble.hidden || !timeOk || !deepOk || busy.size || cornerBusy()) return;
      bubble.hidden = false;
      openAt = performance.now();
      if (hasAnim && !reduce) gsap.fromTo(bubble, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', overwrite: true });
      hideT = setTimeout(close, left);
    };
    const pause = () => {
      left -= performance.now() - openAt;
      if (left < 1500) { close(); return; } // почти досидело: мелькать ради остатка незачем
      clearTimeout(hideT);
      bubble.hidden = true;
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? busy.add(e.target) : busy.delete(e.target)));
      if (busy.size && !bubble.hidden) { clearTimeout(hideT); bubble.hidden = true; done = true; } // ушли в контакты — просто прячем
      else tryShow();
    });
    ['#prays', '#kontakty', '.footer'].forEach((s) => { const el = $(s); if (el) io.observe(el); });
    let lookT = 0, stopT = 0;
    const look = () => { if (bubble.hidden) tryShow(); else if (cornerBusy()) pause(); };
    const onScroll = () => {
      if (done) { removeEventListener('scroll', onScroll); return; }
      if (!deepOk && (!first || first.getBoundingClientRect().top < innerHeight * 0.4)) deepOk = true;
      // на ходу только прячем, и не чаще шести раз в секунду; появляется на остановке, иначе мигало бы при каждом абзаце
      // 800 мс — лента услуг и сцены с плавным догоном (scrub) доезжают ещё 0,6 с после остановки страницы
      if (!bubble.hidden && !lookT) lookT = setTimeout(() => { lookT = 0; if (!bubble.hidden) look(); }, 150);
      clearTimeout(stopT);
      stopT = setTimeout(look, 800);
    };
    addEventListener('scroll', onScroll, { passive: true });
    setTimeout(() => { timeOk = true; tryShow(); }, 25000);
  }

  // Кнопки связи зовут написать, но не мигают: раз в 6–9 с одна кнопка блока по очереди (WhatsApp → MAX → Авито, ярлыки Авито
  // сменяют друг друга) «кивает» значком, от него расходится бледное кольцо (CSS .is-nudge). У каждого блока (контакты,
  // круглые кнопки на компьютере, нижняя панель телефона) свой случайный ритм — не в такт друг другу. Кнопки нет на экране
  // или вкладка скрыта — пауза; без анимаций (reduce) — спокойно стоят; при gl-lite — вдвое реже, кольцо гасит CSS.
  function nudges() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const vis = new Set();
    const groups = $$('[data-nudges]').map((el) => ({
      kinds: ['wa', 'max', 'avito'].map((k) => $$(`[data-nudge="${k}"]`, el)).filter((a) => a.length),
      k: 0, n: [0, 0, 0], t: 0,
    })).filter((g) => g.kinds.length);
    if (!groups.length) return;
    const live = (g) => !document.hidden && g.kinds.some((a) => a.some((e) => vis.has(e)));
    const stop = (g) => { clearTimeout(g.t); g.t = 0; };
    const plan = (g, first) => {
      stop(g);
      if (!live(g)) return;
      // первый раз — через 1,5–5 с после появления блока, дальше каждые 6–9 с
      const ms = (first ? 1500 + Math.random() * 3500 : 6000 + Math.random() * 3000) * (root.classList.contains('gl-lite') ? 2 : 1);
      g.t = setTimeout(() => fire(g), ms);
    };
    const fire = (g) => {
      g.t = 0;
      for (let i = 0; i < g.kinds.length; i++) {
        const j = (g.k + i) % g.kinds.length, list = g.kinds[j], el = list[g.n[j] % list.length];
        if (!vis.has(el)) continue; // эта кнопка за краем экрана — очередь следующей
        g.k = j + 1;
        g.n[j]++;
        el.classList.remove('is-nudge');
        void el.offsetWidth; // перезапуск CSS-анимации, если класс ещё не снят
        el.classList.add('is-nudge');
        setTimeout(() => el.classList.remove('is-nudge'), 1200);
        break;
      }
      plan(g);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)));
      groups.forEach((g) => (g.t ? live(g) || stop(g) : plan(g, true)));
    });
    groups.forEach((g) => g.kinds.flat().forEach((e) => io.observe(e)));
    document.addEventListener('visibilitychange', () => groups.forEach((g) => (document.hidden ? stop(g) : g.t || plan(g, true))));
  }

  // Подложка шапки — по обычному событию прокрутки: работает и без анимаций, и после пересчёта ScrollTrigger.
  const syncHdr = () => hdr.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', syncHdr, { passive: true });
  addEventListener('load', syncHdr);
  syncHdr();

  // Меню «Смотреть всё»: разделы с тематическими кнопками.
  const sections = $('#sections');
  let lastFocus = null, hideT = 0;
  function openSections(from) {
    if (!sections) return;
    clearTimeout(hideT); // открыли снова, пока окно гасло: прятать его уже не нужно
    // вернуть фокус надо на кнопку, по которой нажали: Safari не фокусирует кнопку щелчком, и activeElement там — body
    lastFocus = from && from.nodeType === 1 ? from : document.activeElement;
    sections.hidden = false;
    root.classList.add('menu-open');
    if (lenis) lenis.stop();
    requestAnimationFrame(() => sections.classList.add('is-open'));
    $('.sections-close', sections).focus({ preventScroll: true });
    if (hasAnim && !reduce) gsap.fromTo($$('.sec-btn', sections), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.04, delay: 0.1, clearProps: 'transform,opacity' });
  }
  function closeSections(restoreFocus = true) {
    if (!sections || sections.hidden) return;
    sections.classList.remove('is-open');
    root.classList.remove('menu-open');
    if (lenis) lenis.start();
    clearTimeout(hideT);
    hideT = setTimeout(() => { sections.hidden = true; }, 380);
    if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $$('[data-open-sections]').forEach((b) => b.addEventListener('click', () => openSections(b)));
  if (sections) {
    sections.addEventListener('click', (e) => { if (e.target === sections || e.target.closest('.sections-close')) closeSections(); });
    // Клавиши слушаем на документе: щелчок по панели мог увести фокус с кнопок, а Esc и Tab должны работать всё равно
    document.addEventListener('keydown', (e) => {
      if (sections.hidden || !root.classList.contains('menu-open')) return;
      if (e.key === 'Escape') closeSections();
      if (e.key !== 'Tab') return;
      const f = $$('a[href], button', sections);
      const first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === first || !f.includes(cur))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (cur === last || !f.includes(cur))) { e.preventDefault(); first.focus(); }
    });
  }

  // Звуки природы: включаются по кнопке (браузеры не дают звуку стартовать сам).
  const sndBtn = $('[data-sound]');
  if (sndBtn && window.GLSound) {
    const sync = () => sndBtn.setAttribute('aria-pressed', String(GLSound.enabled));
    sync();
    sndBtn.addEventListener('click', async () => {
      await GLSound.toggle();
      sync();
      if (GLSound.enabled) { GLSound.play('chime', { note: 1047, vol: 0.03 }); window.dispatchEvent(new CustomEvent('gl:replay-visible')); }
    });
  } else if (sndBtn) sndBtn.hidden = true;

  waWidget();
  nudges();

  /* ---------- постеры роликов ---------- */
  // В разметке постера нет: все 35 картинок грузились бы сразу при открытии страницы. Его ставим, когда сцена подошла на ~1,5 экрана.
  // Пока не решено, что показывать (clipMode пуст), наблюдатель только отмечает, какие сцены рядом. Видео занят blooms().
  const phone = matchMedia('(max-width: 700.98px)').matches;
  // Часть телефонных браузеров (Mi Браузер, Huawei, Oppo/Realme, Vivo, UC, QQ, Quark, Baidu) подменяет <video> своим плеером
  // поверх страницы — с кнопками и бегунком, z-index не помогает. Там ролик живёт вне документа, а кадры рисуются на холсте
  // на его месте. ?canvas=1 включает холст в любом браузере (для проверки), ?canvas=0 выключает. На iPhone и iPad те же
  // приложения (UC, QQ, Baidu) работают на WebKit и ролик не подменяют — там холст сам не включается.
  const canvasQ = new URLSearchParams(location.search).get('canvas');
  const ua = navigator.userAgent;
  const canvasMode = (canvasQ === '1' || (canvasQ !== '0' && !/iPhone|iPad|iPod|Macintosh/.test(ua)
    && /MiuiBrowser|XiaoMi\/|HuaweiBrowser|HeyTapBrowser|VivoBrowser|OppoBrowser|UCBrowser|UCWEB|MQQBrowser|QQBrowser|Quark|baiduboxapp/.test(ua)))
    && !!document.createElement('canvas').getContext;
  const D = window.GLDiag || null; // панель ?diag=1 (js/diag.js); без неё null и ничего не считается
  // Холст на месте ролика. На нём всегда последнее, что было: кадр ролика, пока тот загружен, иначе постер. Холст не очищаем —
  // поэтому ни мигания, ни чёрных кадров. Кадрирование — как object-fit: cover с фокусом из CSS (object-position у .bloom),
  // плотность — не выше 1,5 точки на CSS-пиксель и не выше самого источника. Рисуем только сцены на экране.
  const fitIO = canvasMode && 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((e) => e.target.glFit && e.target.glFit(e.contentRect))) : null;
  // Умеет ли движок рисовать ролик вне документа: проверяем один раз, на первом кадре (WebKit для Windows даёт прозрачный кадр).
  // Не умеет: холст включён вручную (?canvas=1) — возвращаем обычные <video>; включён сам (браузер с подменой) — постеры с последним кадром.
  let canPaint = 0;
  const paintable = (v) => {
    try {
      const t = document.createElement('canvas');
      t.width = t.height = 1;
      const g = t.getContext('2d');
      g.drawImage(v, v.videoWidth / 2, v.videoHeight / 2, 1, 1, 0, 0, 1, 1);
      return g.getImageData(0, 0, 1, 1).data[3] > 0;
    } catch (e) { return true; } // проверить нельзя — считаем, что рисует
  };
  const noCanvas = () => { if (canvasQ === '1') clips.forEach((c) => c.unscreen()); else if (stopClips) stopClips(); };
  function screen(c) {
    const { v } = c;
    const cv = document.createElement('canvas');
    cv.className = v.className;
    cv.setAttribute('aria-hidden', 'true');
    v.replaceWith(cv);
    const g = cv.getContext('2d');
    let w = 0, h = 0, fx = 0.5, fy = 0.5, img = null, url = '', shown = null, off = false;
    const draw = (s) => {
      if (off) return;
      if (s === v && !canPaint && (canPaint = paintable(v) ? 1 : -1) < 0) { noCanvas(); return; }
      const nw = s.videoWidth || s.naturalWidth, nh = s.videoHeight || s.naturalHeight;
      if (!nw || !nh || !w || !h) return;
      const k = Math.max(w / nw, h / nh); // CSS-пикселей на точку источника
      const d = Math.min(1.5, devicePixelRatio || 1, 1 / k);
      const W = Math.round(w * d), H = Math.round(h * d);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } // смена размера стирает холст — рисуем тут же, в том же кадре
      g.drawImage(s, (nw - w / k) * fx, (nh - h / k) * fy, w / k, h / k, 0, 0, W, H);
      shown = s;
    };
    const live = () => c.on && shown === v; // ролик загружен и уже дал кадр: постер его не перекрывает
    const frame = () => { if (c.on && v.readyState >= 2 && c.seen !== false) draw(v); };
    c.paint = (u) => {
      if (u !== url) {
        url = u;
        const im = (img = new Image());
        im.decoding = 'async';
        im.onload = () => { if (img === im && !live()) draw(im); };
        im.src = u;
      } else if (img && img.naturalWidth && !live()) draw(img);
    };
    cv.glFit = (r) => {
      w = r ? r.width : cv.clientWidth;
      h = r ? r.height : cv.clientHeight;
      const p = getComputedStyle(cv).objectPosition.match(/-?[\d.]+(?=%)/g);
      if (p) { fx = p[0] / 100; fy = (p[1] === undefined ? 50 : p[1]) / 100; }
      if (live() && v.readyState >= 2) draw(v); else if (img && img.naturalWidth) draw(img);
    };
    if (fitIO) fitIO.observe(cv);
    else { requestAnimationFrame(() => cv.glFit()); addEventListener('resize', () => cv.glFit()); }
    c.redraw = () => { if (live()) frame(); };
    c.unscreen = () => {
      off = true;
      if (fitIO) fitIO.unobserve(cv);
      cv.replaceWith(v);
      c.paint = c.redraw = null;
      if (url) v.setAttribute('poster', url);
      if (v.readyState >= 1 && v.paused) v.currentTime = v.currentTime; // вернувшийся на паузе ролик иначе чёрный до следующей перемотки
    };
    // кадры: requestVideoFrameCallback, где он есть, иначе каждый кадр страницы, пока ролик играет; перемотка — по seeked
    let looping = false;
    const loop = () => {
      if (off || looping || v.paused || v.ended) return;
      looping = true;
      const next = () => { looping = false; frame(); loop(); };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(next); else requestAnimationFrame(next);
    };
    v.addEventListener('playing', loop);
    ['seeked', 'pause', 'ended'].forEach((t) => v.addEventListener(t, frame));
  }
  const clips = $$('video.bloom').map((v) => {
    // на телефоне — вертикальный срез вокруг сюжета: легче, и кадр уже подобран под экран
    const m = phone && v.dataset.srcM;
    if (m) v.classList.add('is-m');
    const c = { v, box: v.closest('.scene'), src: m || v.dataset.src, start: m ? v.dataset.startM : v.dataset.start, end: m ? v.dataset.endM : v.dataset.end, near: false };
    if (canvasMode) screen(c);
    if (D) { v.addEventListener('loadeddata', () => { c.got = true; }); v.addEventListener('playing', () => { c.played = true; }); }
    return c;
  });
  const pose = (c, url) => { if (c.paint) c.paint(url); else if (c.v.getAttribute('poster') !== url) c.v.setAttribute('poster', url); };
  let clipMode = ''; // 'still' — только постеры, 'live' — ролики
  let stopClips = null; // blooms(): выключить все ролики, оставив постеры с последним кадром
  let lowerClips = null; // blooms(): scroll-ролики → once (слабое устройство с пальцем)
  if (D) Object.assign(D, { clips, canvas: () => (canPaint < 0 ? `холст не рисует (${canvasQ === '1' ? 'вернули видео' : 'постеры'})` : canvasMode), mode: () => clipMode });
  const clipOf = new Map(clips.map((c) => [c.box, c]));
  const clipIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    const c = clipOf.get(e.target);
    c.near = e.isIntersecting;
    c.above = e.boundingClientRect.bottom < 0;
    // При быстрой прокрутке сцены пролетают раньше, чем начнётся скачивание: постер и ролик ждут подтверждения.
    clearTimeout(c.nearT);
    c.nearT = setTimeout(() => {
      if (clipMode === 'live') c.update();
      else if (clipMode === 'still' && c.near) pose(c, c.end);
    }, c.near ? 120 : 0);
  }), { rootMargin: '150% 0px' }) : null;
  if (clipIO) clips.forEach((c) => clipIO.observe(c.box));
  // Только постеры с последним кадром: «уменьшить движение», сеть 2G, нет H.264, любой сбой.
  function stillClips() {
    clipMode = 'still';
    clips.forEach((c) => { if (c.near || !clipIO) pose(c, c.end); });
  }

  if (!hasAnim) { root.classList.remove('fx'); stillClips(); return; }

  /* ================= анимации ================= */

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
  // Название главы подготовилось и сменило высоту — пересчитываем позиции триггеров.
  let pwT = 0;
  document.addEventListener('pw:layout', () => { if (!root.classList.contains('gl-ready')) return; clearTimeout(pwT); pwT = setTimeout(() => ScrollTrigger.refresh(), 250); }); // до готовности страницы пересчёт и так будет в конце запуска
  const NS = 'http://www.w3.org/2000/svg';
  // Цвета макета: лиственный (буквы «прорастают» из него) и лесной (итоговый цвет текста).
  const GREEN = '#568914';
  const FOREST = '#0f2e0c';
  // Единая кривая всех появлений: мягкий выход без перелёта; сдвиг — не больше 24 px.
  const IN = { duration: 0.9, ease: 'power3.out' };
  const LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21C3 11 10 4 21 3c-1 11-8 18-18 18Z" fill="currentColor"/><path d="M3.6 20.4 14.5 9.5" stroke="rgba(252,249,249,.75)" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>';

  // Детерминированный «случай», чтобы листья не прыгали при каждом ресайзе.
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const leafPath = (L) => `M0 0C${L * 0.28} ${-L * 0.34} ${L * 0.72} ${-L * 0.32} ${L} 0C${L * 0.72} ${L * 0.3} ${L * 0.28} ${L * 0.32} 0 0Z`;

  // Бесконечные твины группы ставятся на паузу, пока её секция за экраном.
  const loops = (trigger) => {
    const list = [];
    let active = true;
    ScrollTrigger.create({ trigger, start: 'top bottom', end: 'bottom top', onToggle: (s) => { active = s.isActive; list.forEach((t) => t.paused(!active)); } });
    return {
      add: (t) => { list.push(t); if (!active) t.paused(true); return t; },
      clear: () => { list.forEach((t) => t.kill()); list.length = 0; },
    };
  };

  // Одноразовое «элемент показался» на IntersectionObserver — дешевле, чем отдельный ScrollTrigger на каждый элемент.
  // Если элемент уже проскочили (прыжок вниз), колбэк тоже вызывается — с past = true.
  const viewers = {};
  const onView = (el, cb, margin = '0px 0px -12% 0px') => {
    if (!el) return;
    let v = viewers[margin];
    if (!v) {
      const map = new Map();
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        const past = !e.isIntersecting && e.boundingClientRect.bottom < 0;
        if (!e.isIntersecting && !past) return;
        io.unobserve(e.target);
        const list = map.get(e.target) || [];
        map.delete(e.target);
        list.forEach((f) => f(past));
      }), { rootMargin: margin });
      v = viewers[margin] = { io, map };
    }
    v.map.set(el, [...(v.map.get(el) || []), cb]);
    v.io.observe(el);
  };

  /* ---------- плавный скролл ---------- */
  // Колесо и тачпад ведёт Lenis с одной и той же плавностью. На устройствах с пальцем его нет: его обработчики касаний
  // не пассивные и заставляли бы браузер ждать скрипт перед каждой прокруткой.
  gsap.ticker.lagSmoothing(0);
  if (!reduce && window.Lenis && !coarse) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    // Первым в кадре: прокрутка до записи стилей, иначе браузер пересчитывает их внутри scrollTo.
    gsap.ticker.add((t) => lenis.raf(t * 1000), false, true);
  }

  /* ---------- шапка и прогресс-лоза ---------- */
  function headerTriggers() {
    ScrollTrigger.addEventListener('refresh', syncHdr);
    // Тёмные разделы (прайс, «Подсветка», контакты, подвал) идут подряд: держим набор активных,
    // чтобы порядок срабатывания на стыке двух тёмных разделов не мигал шапкой.
    // Раздел гаснет на 1 px позже: ровно на границе конец одного и начало другого не активны оба — шапка светлела на кадр.
    const darkOn = new Set();
    const syncDark = () => { const on = darkOn.size > 0; hdr.classList.toggle('is-dark', on); root.classList.toggle('on-dark', on); };
    $$('[data-dark], .footer').forEach((sec) => {
      ScrollTrigger.create({ trigger: sec, start: () => `top ${hdrH()}`, end: () => `bottom ${hdrH() - 1}`, onToggle: (s) => { if (s.isActive) darkOn.add(sec); else darkOn.delete(sec); syncDark(); } });
    });
    // Пункт меню горит, пока его раздел на середине экрана; «Саженцы» — на всех главах с растениями, от «Роз» до «Газона».
    [['rozy', 'gazon'], ['uslugi'], ['svet'], ['prays'], ['kontakty']].forEach(([id, last = id]) => {
      const sec = document.getElementById(id), end = document.getElementById(last);
      const link = $(`.nav a[href="#${id}"]`);
      if (sec && end && link) ScrollTrigger.create({ trigger: sec, endTrigger: end, start: 'top 50%', end: 'bottom 50%', toggleClass: { targets: link, className: 'is-active' } });
    });
    const vineFill = $('.hv-fill');
    if (!vineFill) return;
    gsap.fromTo(vineFill, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });
    const nodesBox = $('.hv-nodes');
    const chs = $$('.chapter');
    const nodes = chs.map(() => {
      const n = document.createElement('span');
      n.className = 'hv-node';
      n.innerHTML = LEAF;
      nodesBox.appendChild(n);
      return n;
    });
    ScrollTrigger.addEventListener('refresh', () => {
      const max = ScrollTrigger.maxScroll(window) || 1;
      chs.forEach((ch, i) => { nodes[i].style.left = `${Math.min(99, ((ch.getBoundingClientRect().top + scrollY) / max) * 100)}%`; });
    });
    chs.forEach((ch, i) => ScrollTrigger.create({ trigger: ch, start: 'top 60%', onEnter: () => nodes[i].classList.add('is-on'), onLeaveBack: () => nodes[i].classList.remove('is-on') }));
  }

  /* ---------- титул: «Green Life» из газона, медленно расцветает ---------- */
  const title = $('.hero-title');
  // Слово одной строкой; на узком телефоне стоймя (portrait) — две строки «Green» и «Life», вдвое крупнее.
  // Смонтирован только тот вариант, который виден; второй монтируется, когда окно перевернули.
  const heroEls = { one: $('.hero-word--one', title), two: $$('.hero-word--two', title) };
  const stackMQ = matchMedia('(max-width: 700.98px) and (orientation: portrait)');
  let heroWords = []; // смонтированные слова текущего варианта
  let heroStacked = null; // какой вариант смонтирован последним
  let introTl = null;
  let heroLoops = null;

  // Кегль слова задаёт CSS (--fs у .hero-title в main.css: по ширине блока, не выше доли высоты окна; на телефоне стоймя — общий для двух строк,
  // боком — с запасом под нижнюю панель). Запасной текст и холст получают один размер, поэтому слово не прыгает, когда холст готов.
  // Здесь читаем кегль, который браузер уже посчитал у запасного текста; по ширине холст ограничит его сам (fit в plantword.js, те же числа).
  const cssFs = (el) => {
    const t = $('.pw-text', el);
    const px = t ? parseFloat(getComputedStyle(t).fontSize) : 0;
    // браузер без min() в CSS (кегль не посчитан): по высоте окна, по ширине холст ограничит сам
    return px > 40 ? px : Math.min(innerHeight * (innerHeight < 500 ? 0.34 : 0.4), 460);
  };
  function heroMount() {
    if (!window.PlantWord) return [];
    const stacked = stackMQ.matches;
    heroStacked = stacked;
    const els = stacked ? heroEls.two : [heroEls.one];
    // кегль следует за окном при каждой перестройке слова (поворот, смена размера окна)
    els.forEach((el) => { if (el._pw === undefined) el._pw = PlantWord.mount(el, { maxPx: () => cssFs(el), align: 'center' }); });
    heroWords = els.map((el) => el._pw).filter(Boolean);
    return heroWords;
  }

  function heroIntro() {
    // Титул виден сразу (тема instant), трава и цветы прорастают с play(). «Опоздавшей» загрузки у него нет:
    // буквы на холсте те же, что и запасной текст, — прыжка при готовности не видно.
    heroMount().forEach((w) => w.play());
    // Повернули телефон (или изменили окно) — монтируем слово другого варианта, если он ещё не готов; поворот всегда даёт resize
    let hrz = 0;
    addEventListener('resize', () => {
      clearTimeout(hrz);
      hrz = setTimeout(() => { if (stackMQ.matches !== heroStacked) heroMount().forEach((w) => w.play()); }, 250);
    });
    const tl = gsap.timeline({ delay: 0.1 });
    introTl = tl;
    // Текст первого экрана не прячем (opacity) — он виден сразу, анимация только «оживляет» его.
    const subSplit = new SplitText($('.hero-sub-in'), { type: 'words,chars', aria: 'none', reduceWhiteSpace: false });
    tl.fromTo(subSplit.chars, { color: GREEN, y: 6 },
      { color: FOREST, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.014, clearProps: 'color,transform' }, 0.8);
    tl.from('.hero-sub-q', { y: 10, duration: 0.9, ease: 'power2.out' }, 1.5);
    // росток-подсказка внизу
    const cue = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 3 });
    cue.fromTo('.sc-stem', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power1.inOut' })
      .fromTo('.sc-l', { scale: 0, svgOrigin: '20 40' }, { scale: 1, duration: 0.7, ease: 'power2.out' }, 0.45)
      .fromTo('.sc-r', { scale: 0, svgOrigin: '20 32' }, { scale: 1, duration: 0.7, ease: 'power2.out' }, 0.6)
      .fromTo('.sc-bud', { scale: 0, svgOrigin: '20 22' }, { scale: 1, duration: 0.7, ease: 'power2.out' }, 0.85)
      .to('.scroll-cue svg', { opacity: 0, duration: 0.4 }, 2.2)
      .set('.scroll-cue svg', { opacity: 1 });
    heroLoops.add(cue);
  }

  function heroFloat() {
    const hero = $('.hero');
    const rand = rng(31);
    for (let i = 0; i < (isNarrow() ? 5 : 10); i++) {
      const s = document.createElement('span');
      s.className = 'hero-float';
      s.innerHTML = LEAF;
      s.setAttribute('aria-hidden', 'true');
      const left = i % 2 ? 4 + rand() * 22 : 74 + rand() * 22;
      gsap.set(s, { left: `${left}%`, top: `${12 + rand() * 72}%`, scale: 0.5 + rand() * 0.8, rotation: rand() * 360, color: rand() > 0.5 ? '#568914' : '#8bbf33' });
      hero.appendChild(s);
      heroLoops.add(gsap.to(s, { x: `+=${(rand() - 0.5) * 120}`, y: `+=${(rand() - 0.5) * 90}`, rotation: `+=${(rand() - 0.5) * 140}`, duration: 7 + rand() * 6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    }
  }

  // Прокрутка первого экрана: титул закреплён на короткий отрезок и плавно растворяется (без увеличения и без картинок поверх),
  // акварельный фон мягко отъезжает; дальше вступление поднимается на тот же светлый фон.
  function heroScroll() {
    // отступы под закрепление в CSS привязаны к .fx и к этому классу (см. .intro в main.css): .fx может сняться, закрепление останется
    root.classList.add('hero-pin');
    const tl = gsap.timeline({
      // pinSpacer — обёртка уже есть в HTML: титул не переносится в новый блок, и браузер не перерисовывает первый экран заново.
      scrollTrigger: {
        trigger: '.hero', start: 'top top', end: '+=45%', pin: true, pinSpacer: '.hero-spacer', scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (s) => {
          // Посетитель начал листать, пока шло интро, — доводим интро до конца, чтобы значения не смешались.
          // В самом верху progress не ровно 0 (ScrollTrigger сдвигает старт на −0,001), поэтому порог — с запасом:
          // с порогом «> 0» слово считалось «листаемым» с первого кадра, его рост стоял, а интро проматывалось в конец.
          if (s.progress > 0.01 && introTl && introTl.progress() < 1) introTl.progress(1);
          // Титул растаял — в пустоту его не рисуем.
          const gone = s.progress > 0.97;
          heroWords.forEach((w) => w.hold(gone));
        },
      },
    });
    tl.fromTo('.scroll-cue', { opacity: 1 }, { opacity: 0, duration: 0.15, immediateRender: false }, 0)
      .fromTo('.hero-float', { opacity: 0.7 }, { opacity: 0, duration: 0.5, immediateRender: false }, 0.1)
      .fromTo('.hero-sub', { opacity: 1, y: 0 }, { opacity: 0, y: -16, duration: 0.5, ease: 'power1.in', immediateRender: false }, 0.12)
      .fromTo(title, { opacity: 1, y: 0, scale: 1 }, { opacity: 0, y: -28, scale: 1.05, duration: 0.7, ease: 'power1.inOut', immediateRender: false }, 0.2)
      .fromTo('.hero-bg-img', { scale: 1, opacity: 0.96 }, { scale: 1.12, opacity: 0.5, duration: 1, ease: 'none', immediateRender: false }, 0);
  }

  /* ---------- текст «из зелени» ---------- */
  // Делим текст на буквы, только когда шрифты не догружаются: иначе SplitText меряет буквы по запасному шрифту
  // и пишет в консоль «SplitText called before fonts loaded» (по ходу прокрутки догружаются курсив Cormorant, Oswald 600 и др.).
  const whenFonts = (fn) => {
    if (!document.fonts || document.fonts.status !== 'loading') { fn(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    document.fonts.ready.then(go, go);
    setTimeout(go, 1500); // не ждём дольше полутора секунд
  };
  // Заголовок разбивается на буквы, только когда до него остаётся ~полэкрана: на загрузке страница не тратит время на 40 заголовков.
  function leafTitle(el) {
    onView(el, () => whenFonts(() => leafTitlePrepare(el)), '400px 0px 400px 0px');
  }

  // Заголовок проявляется по словам: мягкий подъём без вращений и размытия, чтобы читался сразу и не спорил с роликами.
  function leafTitlePrepare(el) {
    // Заголовок уже на экране (прыжок по меню, поздний шрифт): оставляем как есть, иначе он мигнул бы.
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight * 0.88 && box.bottom > 0) return;
    // reduceWhiteSpace: false — иначе SplitText превращает неразрывные пробелы (build.mjs → nbsp) в обычные,
    // и предлоги снова повисают в конце строки («…растения под / ваш участок»)
    const words = new SplitText(el, { type: 'words', wordsClass: 'wd', reduceWhiteSpace: false }).words;
    if (!words.length) return;
    gsap.set(words, { opacity: 0, y: '.3em' });
    onView(el, (past) => {
      if (past) { gsap.set(words, { clearProps: 'opacity,transform' }); return; }
      gsap.to(words, { opacity: 1, y: 0, ...IN, stagger: Math.min(0.07, 0.5 / words.length), clearProps: 'opacity,transform' });
    });
  }

  // Заставка во вступлении: строки выходят по очереди, как титры в кино — широкая разрядка и прозрачность, потом плотно встают на место.
  function introBig() {
    const lines = [...document.querySelectorAll('.ib-line')];
    if (!lines.length) return;
    gsap.fromTo(lines, { opacity: 0, letterSpacing: '0.22em', y: 28 }, { opacity: 1, letterSpacing: '0.01em', y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.22, clearProps: 'letterSpacing,transform',
      scrollTrigger: { trigger: '.intro-big', start: 'top 85%', once: true } });
  }

  function reveals() {
    // Всё, что вошло в экран за один раз, появляется пакетом. Уже проскоченное (прыжок End, ползунок, поиск)
    // показываем сразу, без очереди.
    const io = new IntersectionObserver((entries) => {
      const now = [], past = [];
      entries.forEach((e) => {
        if (e.isIntersecting) now.push(e.target);
        else if (e.boundingClientRect.bottom < 0) past.push(e.target);
        else return;
        io.unobserve(e.target);
      });
      if (past.length) gsap.set(past, { opacity: 1, y: 0, overwrite: true });
      if (now.length) gsap.to(now, { opacity: 1, y: 0, ...IN, stagger: Math.min(0.09, 0.6 / now.length), overwrite: true });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('[data-reveal]').forEach((el) => io.observe(el));
    window.GLReveal = true; // запасной таймер в <head> больше не снимает .fx: текст проявит этот наблюдатель, даже если запуск ещё идёт
  }

  function manifest() {
    // Без анимаций текст и цифры сразу в итоговом виде.
    if (reduce) return;
    $$('[data-scrub-words]').forEach((el) => {
      const split = new SplitText(el, { type: 'words', wordsClass: 'w', aria: 'none', reduceWhiteSpace: false });
      gsap.fromTo(split.words, { color: GREEN }, {
        color: FOREST, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true },
      });
    });
    $$('[data-count]').forEach((el) => {
      const to = +el.dataset.count, suffix = el.dataset.suffix || '';
      const o = { v: 0 };
      el.textContent = `0${suffix}`;
      onView(el, (past) => {
        if (past || reduce) { el.textContent = `${to}${suffix}`; return; }
        gsap.to(o, { v: to, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}`; } });
      });
    });
  }

  /* ---------- главы и товары ---------- */
  function chapters() {
    if (reduce) return;
    $$('.chapter').forEach((ch) => {
      const num = $('.ch-num', ch);
      if (num) gsap.fromTo(num, { yPercent: 35, opacity: 0 }, { yPercent: -25, opacity: 1, ease: 'none', scrollTrigger: { trigger: $('.ch-intro', ch), start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('.product .chips').forEach((list) => {
      const chips = $$('li', list);
      if (!chips.length) return;
      const ctl = gsap.timeline({ paused: true }).from(chips, { y: 12, opacity: 0, duration: 0.8, ease: 'power2.out', stagger: 0.02 });
      onView(list, (past) => (past ? ctl.progress(1) : ctl.play()));
    });
  }

  /* ---------- сцены-галерея ---------- */
  // Широкий экран: сначала ролик целиком на весь экран. Со старта чтения он отъезжает к дальнему краю, а со стороны текста проявляется белая вуаль.
  // Анимируем только transform и opacity. На узком экране и при «уменьшить движение» — обычная вёрстка из CSS.
  function scenes() {
    if (reduce) return;
    gsap.matchMedia().add('(min-width: 901px)', () => {
      $$('.scene:not(.scene--tall)').forEach((s) => {
        gsap.timeline({ scrollTrigger: { trigger: s, start: 'top top', end: () => `+=${innerHeight * 0.32}`, scrub: 0.5, invalidateOnRefresh: true } })
          .fromTo($('.sc-veil', s), { opacity: 0 }, { opacity: 1, ease: 'power1.out', duration: 1 }, 0)
          .fromTo($('.sc-media', s), { scale: 1 }, { scale: 0.76, ease: 'power1.inOut', duration: 1 }, 0);
      });
    });
  }

  /* ---------- ролики ---------- */
  // Режимы: "scroll" — ролик идёт вместе с прокруткой и обратно при прокрутке назад; "once" — проигрывается один раз,
  // когда сцена на виду, вне экрана на паузе, застывает на последнем кадре. Смесь режимов одна на компьютере, планшете и телефоне;
  // на пальце scroll-ролик берётся в память целиком (whole), а на слабом устройстве с пальцем сторож кадров переводит его в once.
  // Память: одновременно качаются не больше двух роликов, ближние первыми; проскоченное не докачивается,
  // отыгравший once вне экрана и всё, что дальше трёх экранов, снимают src — браузер освобождает декодер и буфер.
  function blooms() {
    if (!clips.length || clipMode) return;
    const conn = navigator.connection;
    // «Экономия трафика» (saveData, Турбо) ролики не выключает: телефонные файлы маленькие и качаются по одному. Только 2G — постеры.
    const weakNet = conn && /2g$/.test(conn.effectiveType || '');
    const h264 = clips[0].v.canPlayType('video/mp4; codecs="avc1.640028"') !== '';
    if (reduce || weakNet || !h264) { stillClips(); return; }

    const slots = new Set(), queue = new Set();
    // сколько пикселей до экрана; 0 — сцена уже на экране
    const gap = (c) => { const r = c.box.getBoundingClientRect(); return r.top > innerHeight ? r.top - innerHeight : r.bottom < 0 ? -r.bottom : 0; };
    const poster = (c) => (c.dead || c.done || (c.st && c.st.t > 0.5) ? c.end : c.start);
    const free = (c) => { clearTimeout(c.guard); if (slots.delete(c)) pump(); };
    const begin = (c) => {
      slots.add(c);
      c.guard = setTimeout(() => free(c), 9000); // медленный файл не держит очередь
      c.on = true;
      c.v.preload = 'auto';
      if (coarse && c.mode === 'scroll' && !c.net) { whole(c); return; }
      c.v.src = c.src;
      c.play(); // браузер сам дождётся данных; iOS без этого вызова вообще не начинает загрузку
    };
    // Scroll-ролик на пальце: файл целиком в память, перемотка — из неё. iOS без play() файл по сети не грузит, а play()
    // пустил бы ролик сам по себе; перемотка по сети на телефоне ещё и ждёт каждый недокачанный кусок. Телефонный файл — около 1 МБ.
    const whole = (c) => {
      const gen = c.gen, ac = window.AbortController ? new AbortController() : null;
      c.abort = ac;
      fetch(c.src, ac ? { signal: ac.signal } : undefined)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
        .then((b) => {
          if (gen !== c.gen || c.dead) return;
          c.abort = null;
          c.blob = URL.createObjectURL(b.type ? b : b.slice(0, b.size, 'video/mp4')); // без типа iOS ролик из памяти не играет
          c.v.src = c.blob;
          free(c); // сеть свободна — очередь берёт следующий файл
          // iOS может не читать даже заголовок ролика до первого play(): не готов за 1,5 с — будим (c.warm, сразу пауза)
          setTimeout(() => { if (gen === c.gen && !c.ready && c.v.readyState < 1) c.warm(); }, 1500);
        })
        .catch((e) => { if (gen === c.gen && !(e && e.name === 'AbortError')) fail(c); });
    };
    function pump() {
      while (slots.size < 2 && queue.size) {
        const c = [...queue].reduce((a, b) => (gap(b) < gap(a) ? b : a));
        queue.delete(c);
        begin(c);
      }
    }
    const want = (c) => {
      if (c.dead || c.done || c.on) return;
      queue.add(c);
      // очередь занята тем, что ещё за экраном, а эта сцена уже на виду — уступаем ей место
      if (c.vis && slots.size >= 2) { const far = [...slots].find((x) => !x.vis); if (far) { unload(far); queue.add(far); } }
      pump();
    };
    const unload = (c) => {
      queue.delete(c);
      free(c);
      c.gen++; // отменяет ещё не пришедшие ответы (play, fetch)
      if (c.abort) { c.abort.abort(); c.abort = null; } // недокачанный файл бросаем, как браузер бросает снятый src
      c.ready = false;
      if (c.on) {
        c.on = false;
        pose(c, poster(c));
        c.v.pause();
        c.v.removeAttribute('src');
        c.v.preload = 'none';
        c.v.load();
      }
      if (c.blob) { URL.revokeObjectURL(c.blob); c.blob = null; }
    };
    // 404, нет кодека, сбой загрузки — выключаем ролик, остаётся постер с последним кадром
    const fail = (c) => {
      if (c.dead) return;
      c.dead = true;
      if (D) D.failed = (D.failed || 0) + 1;
      unload(c);
      if (c.near) pose(c, c.end);
    };
    // Браузер не даёт запускать ролики сам (запрет автозапуска, экономия заряда): once-ролик идёт перемоткой (walk), а play()
    // повторяется после первого действия посетителя — касания, щелчка, клавиши. Один слушатель на все ожидающие; прокрутка пальцем
    // действием не считается, поэтому отказ снова ставит ролик в ожидание. Scroll-ролики перематываются и без play().
    const waiting = new Set();
    const listen = (on) => ['pointerup', 'touchend', 'click', 'keydown'].forEach((t) => (on ? addEventListener(t, retry, { capture: true, passive: true }) : removeEventListener(t, retry, true)));
    function retry() {
      const list = [...waiting];
      waiting.clear();
      listen(false);
      list.forEach((c) => (c.mode === 'scroll' ? c.warm() : c.play()));
    }
    const blocked = (c, e) => {
      if (!e || e.name !== 'NotAllowedError' || c.dead) return;
      if (D) D.refused = (D.refused || 0) + 1;
      if (c.mode === 'once') walk(c);
      if (!waiting.size) listen(true);
      waiting.add(c);
    };
    // Отказ play() у once-ролика (iPhone в энергосбережении, Яндекс с экономией): касания ждать не нужно — ролик идёт
    // перемоткой с той же скоростью 1,25×, не чаще 24 раз в секунду и только после конца прошлой перемотки (seeked),
    // и застывает на последнем кадре, как обычный once. Удался play() после касания — дальше играет сам с того же места.
    // Сцена ушла с экрана — ход стоит (вернулась — снова play(), снова отказ, ход дальше); выгрузка ход обрывает.
    // На холсте кадр рисуется по seeked (screen). Данные — тот же файл по сети, что и для play(): лишнего трафика нет.
    const walk = (c) => {
      if (c.walking) return;
      c.walking = true;
      if (D) D.walked = (D.walked || 0) + 1;
      const { v } = c, gen = c.gen;
      let last = 0;
      const tick = (now) => {
        if (gen !== c.gen || c.dead || c.done || !c.vis || !v.paused) { c.walking = false; return; }
        // время считаем с первого кадра: пока нет даже заголовка ролика, начало не проскакиваем
        if (v.readyState < 1 || !last) last = now;
        else if (!v.seeking && now - last >= 41) {
          const end = Math.max(0, v.duration - 0.06); // в самый последний кадр не встаём — как у scroll-роликов
          const t = Math.min(end, v.currentTime + Math.min(0.25, (now - last) / 1000) * 1.25);
          last = now;
          v.currentTime = t;
          if (t >= end) { c.done = true; c.walking = false; return; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const byStage = new Map();
    const stageIO = new IntersectionObserver((es) => es.forEach((e) => {
      const c = byStage.get(e.target);
      const was = c.seen;
      c.seen = e.isIntersecting;
      if (c.redraw && c.seen && !was) c.redraw(); // холст рисует только сцены на экране; вернулась на экран — сразу текущий кадр
      if (e.intersectionRatio >= 0.5) { c.vis = true; c.play(); }
      else if (e.intersectionRatio < 0.15) {
        c.vis = false;
        if (c.mode === 'once' && !c.v.paused) c.v.pause();
        if (c.done && !e.isIntersecting) unload(c); // отыгравший ролик вне экрана отдаёт память: дальше виден постер последнего кадра
      }
    }), { threshold: [0, 0.15, 0.5] });
    // Дальше трёх экранов ролик выгружается. Начатый once при возвращении уже не перезапускается, а стоит на последнем кадре.
    const byBox = new Map();
    const farIO = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) return;
      const c = byBox.get(e.target);
      if (c.mode === 'once' && c.begun) c.done = true;
      unload(c);
    }), { rootMargin: '300% 0px' });

    clips.forEach((c) => {
      const { v, box } = c;
      c.mode = v.dataset.bloom;
      c.gen = 0;
      c.play = () => {
        if (c.mode !== 'once' || c.dead || c.done || !c.vis) return;
        if (!c.on) { want(c); return; }
        c.begun = true;
        v.defaultPlaybackRate = 1.25;
        v.playbackRate = 1.25;
        const gen = c.gen;
        Promise.resolve(v.play()).catch((e) => { if (D) D.playErr = e && e.name; if (gen === c.gen) blocked(c, e); });
      };
      // Наблюдатель в начале main.js сообщает, что сцена подошла или отошла.
      c.update = () => {
        // проскочили вниз, не дождавшись (прыжок по меню), — при возвращении уже последний кадр
        if (c.mode === 'once' && !c.begun && !c.done && c.above) { c.done = true; if (c.on) unload(c); }
        if (c.near) { pose(c, poster(c)); want(c); }
        else if (queue.has(c)) queue.delete(c);
        else if (slots.has(c)) unload(c); // уже проскочили: не докачиваем
        else if (coarse && c.mode === 'scroll' && c.on) unload(c); // на пальце scroll-ролик за полтора экрана сразу отдаёт память
      };
      v.addEventListener('error', () => {
        if (!v.getAttribute('src')) return;
        // ролик из памяти движок не открыл (так бывает у WebKit) — один раз пробуем обычную загрузку по сети, дальше только её
        if (c.blob && !c.net) {
          if (D) D.blobErr = (D.blobErr || 0) + 1;
          c.net = true;
          URL.revokeObjectURL(c.blob);
          c.blob = null;
          v.src = c.src;
          if (c.mode === 'scroll') c.warm(); else c.play(); // iOS без play() файл по сети не грузит; scroll — сразу пауза
          return;
        }
        fail(c);
      });
      v.addEventListener('suspend', () => free(c));
      v.addEventListener('ended', () => { if (c.mode === 'once') c.done = true; });
      if (c.mode === 'scroll') scrollClip(c, fail, blocked);
      byStage.set($('.sc-stage', box), c);
      byBox.set(box, c);
      stageIO.observe($('.sc-stage', box)); // сама сцена выше экрана, поэтому смотрим на её ролик
      farIO.observe(box);
    });
    clipMode = 'live';
    stopClips = () => clips.forEach(fail);
    // Слабое устройство с пальцем (сторож кадров, lowerLoad): перемотка кадрами там дороже всего, scroll-ролики дальше идут как once.
    // Почти раскрытый (t > 0,97) застывает на последнем кадре, начатый доигрывает с того места, где стоит.
    lowerClips = () => clips.forEach((c) => {
      if (c.mode !== 'scroll' || c.dead) return;
      if (c.tween) { c.tween.scrollTrigger.kill(); c.tween.kill(); c.tween = null; }
      c.mode = 'once';
      if (c.st.t > 0.97) c.begun = c.done = true;
      else c.play();
    });
    clips.forEach((c) => { if (c.near) c.update(); });
  }

  // Ролик, привязанный к прокрутке. Широкий экран: от подхода сцены до середины чтения, когда сцена стоит на месте. Узкий: пока ролик проходит экран.
  function scrollClip(c, fail, blocked) {
    const { v, box } = c;
    c.st = { t: 0 };
    let queued = false;
    // Перематываем только после конца прошлой перемотки и не чаще частоты самого ролика (24 к/с): каждая перемотка стоит
    // декодирования от ключевого кадра, а чаще глаз всё равно не увидит. В последний кадр не встаём: Chrome уже там считает
    // ролик закончившимся (ended), часть браузеров показывает чёрный кадр; −0,06 с — полтора кадра, на глаз тот же раскрытый цветок.
    const at = () => c.st.t * Math.max(0, v.duration - 0.06);
    let lastSeek = 0;
    const go = () => {
      if (c.dead || !c.ready || v.seeking || c.mode !== 'scroll') return;
      const t = at();
      if (Math.abs(v.currentTime - t) < 0.04) return;
      const now = performance.now();
      if (now - lastSeek < 41) { ask(); return; }
      lastSeek = now;
      v.currentTime = t;
    };
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; go(); }); } };
    v.addEventListener('seeked', ask);
    v.addEventListener('loadedmetadata', () => {
      if (c.mode !== 'scroll') return;
      const gen = c.gen;
      // Сервер без отдачи файла кусками (Range), как python-превью: Chrome тогда не перематывает (seekable = 0…0).
      // Забираем файл целиком и играем из памяти. На GitHub Pages этот путь не нужен.
      if (!(v.seekable.length && v.seekable.end(0) > 0) && !c.blob) {
        fetch(v.currentSrc).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
          .then((b) => { if (gen !== c.gen || c.dead) return; c.blob = URL.createObjectURL(b); v.src = c.blob; })
          .catch(() => { if (gen === c.gen) fail(c); });
        return;
      }
      // Вернулись к выгруженному ролику: сначала встаём на нужное место, чтобы он не мигнул первым кадром.
      if (c.st.t > 0.01) v.currentTime = at();
      // iOS Safari рисует кадры при перемотке только после первого play(). Запрет автозапуска перемотке не мешает:
      // ролик готов и так, а play() повторим после первого касания (c.warm).
      Promise.resolve(v.play()).then(() => { if (gen !== c.gen) return; v.pause(); c.ready = true; ask(); }, (e) => {
        if (D) D.playErr = e && e.name;
        if (gen !== c.gen || !e || e.name !== 'NotAllowedError') return;
        blocked(c, e);
        c.ready = true;
        ask();
      });
    });
    c.warm = () => {
      if (!c.on || c.dead) return;
      const gen = c.gen;
      Promise.resolve(v.play()).then(() => { if (gen === c.gen) v.pause(); }, () => {});
    };
    // пока ролик не готов, постер показывает ближайшее состояние: начало или конец
    c.tween = gsap.to(c.st, {
      t: 1, ease: 'none',
      scrollTrigger: { trigger: box, start: () => (isNarrow() ? 'top 85%' : 'top 75%'), end: () => (isNarrow() ? 'bottom 35%' : `top ${-Math.round(innerHeight * 0.7)}px`), scrub: 0.4, invalidateOnRefresh: true },
      onUpdate: () => { if (c.dead) return; if (c.ready) go(); else if (c.near) pose(c, c.st.t > 0.5 ? c.end : c.start); },
    });
  }

  /* ---------- «живые» названия глав ---------- */
  const words = {};
  let wordsSized = Promise.resolve();
  let sizeWords = () => wordsSized;
  function chapterWords() {
    if (!window.PlantWord) return;
    const maxPx = () => Math.min(210, innerHeight * 0.26);
    const list = $$('.ch-word');
    // Высоту названий считаем сразу, рисунок — потом: иначе страница меняла высоту посреди прокрутки и каждая глава стоила
    // пересчёта всех триггеров (кадр в 200 мс).
    sizeWords = () => Promise.all(list.map((el) => PlantWord.reserve(el, { maxPx: maxPx() })));
    wordsSized = sizeWords();
    list.forEach((el) => {
      const id = el.closest('.chapter').id;
      // холст готовим заранее, когда до главы ещё экран, а «выращиваем» — когда название на виду
      onView(el, () => {
        const ctl = PlantWord.mount(el, { maxPx: maxPx(), still: true });
        if (!ctl) return;
        words[id] = ctl;
        onView(el, () => {
          if (!lite) { ctl.play(); return; }
          // слабое устройство: название появляется готовым
          ctl.finish();
          gsap.fromTo($('canvas', el), { opacity: 0 }, { opacity: 1, ...IN, clearProps: 'opacity' });
        }, '0px 0px -18% 0px');
      }, '700px 0px 700px 0px');
    });
    // пришли в главу из меню — название вырастает заново, на глазах
    window.addEventListener('gl:arrive', (e) => { const w = words[e.detail]; if (w) w.replay(); });
    window.addEventListener('gl:replay-visible', () => {
      if (heroWords.length && title.getBoundingClientRect().bottom > innerHeight * 0.3) { heroWords.forEach((w) => w.replay()); return; }
      const id = Object.keys(words).find((k) => { const r = words[k].el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      if (id) words[id].replay();
    });
  }

  /* ---------- растения по бокам ---------- */
  const deco = { l: $('.deco-l'), r: $('.deco-r'), drift: $('.drift'), current: null, wanted: null, aim: null, cache: {}, loading: {}, prep: {}, queue: [], busy: false, kick: 0, timer: null, alive: 0 };

  // Скрипт растения грузится, только когда посетитель подходит к главе.
  function decoLoad(id) {
    if ((window.GL_DECO || {})[id]) return Promise.resolve();
    if (deco.loading[id]) return deco.loading[id];
    return (deco.loading[id] = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `js/deco/${id}.js${assetV ? `?v=${assetV}` : ''}`;
      s.async = true;
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    }));
  }

  // Рисунок готовим заранее и по частям: посреди прокрутки на подходе к главе, а не одним куском в момент показа.
  // Собираем по одному рисунку за раз, и первым — главы, куда идёт переход по меню, или той, что на экране:
  // после прыжка подготовка запускалась сразу у всех пройденных глав, рисунки собирались наперегонки,
  // и на слабом телефоне растения нужной главы появлялись через 4–8 с.
  function decoPrepare(id) {
    if (!deco.prep[id]) {
      decoLoad(id); // скрипты качаем сразу — сеть сборке не мешает
      deco.prep[id] = new Promise((done) => deco.queue.push({ id, done }));
    }
    // через кадр: главы, пройденные одним прыжком, успевают встать в очередь, и нужная не ждёт остальных
    if (!deco.busy && !deco.kick) deco.kick = requestAnimationFrame(decoNext);
    return deco.prep[id];
  }
  async function decoNext() {
    deco.kick = 0;
    const q = deco.queue;
    if (deco.busy || !q.length) return;
    const job = q.find((j) => j.id === deco.aim) || q.find((j) => j.id === deco.wanted) || q[0];
    q.splice(q.indexOf(job), 1);
    deco.busy = true;
    try { await decoLoad(job.id); await decoBuild(job.id); } catch (e) { console.error(e); }
    deco.busy = false;
    job.done();
    if (q.length) deco.kick = requestAnimationFrame(decoNext);
  }
  // Переход по ссылке внутри страницы: рисунок главы, куда едем, собирается первым, пока страница прокручивается.
  function decoAim(el) {
    const ch = el.closest('.chapter[data-theme]');
    if (!ch) return;
    deco.aim = ch.dataset.theme;
    decoPrepare(deco.aim);
  }

  async function decoBuild(id) {
    const d = (window.GL_DECO || {})[id];
    if (!d || !window.GLGrow) return;
    const mk = (markup, box) => {
      const t = document.createElement('div');
      t.innerHTML = markup.trim();
      const svg = t.querySelector('svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      box.appendChild(svg);
      return svg;
    };
    const L = mk(d.left, deco.l), R = mk(d.right, deco.r);
    gsap.set([L, R], { autoAlpha: 0 });
    const { tl: tlL } = await GLGrow.buildSliced(L), { tl: tlR } = await GLGrow.buildSliced(R);
    const tl = gsap.timeline({ paused: true });
    tl.add(tlL.paused(false), 0).add(tlR.paused(false), 0.2);
    deco.cache[id] = { id, L, R, tl, stop: null, drift: d.drift || [] };
  }

  function decoShow(id) {
    if (deco.current === id) return;
    decoHide();
    const t = deco.cache[id];
    if (!t) return;
    deco.current = id;
    // В тёмной главе у секции свой фон — гирлянды поднимаем над ним.
    root.classList.toggle('deco-front', id === 'light');
    decoClip();
    // Вместе с гирляндами поднимается и слой частиц: лепестки и листья прошлых глав, которые ещё летят
    // (после быстрой прокрутки или перехода по меню), оказались бы поверх текста «Подсветки» — гасим их.
    // То же с растениями прошлой главы, которые ещё сворачиваются: сразу прячем.
    if (id === 'light') {
      driftClear();
      Object.values(deco.cache).forEach((c) => { if (c !== t) gsap.set([c.L, c.R], { autoAlpha: 0 }); });
    }
    gsap.killTweensOf([t.L, t.R]);
    gsap.set([t.L, t.R], { autoAlpha: 1 });
    t.tl.eventCallback('onReverseComplete', null);
    if (reduce) { t.tl.progress(1); return; }
    // Слабое устройство: растения появляются готовыми, без роста и лепестков.
    if (lite) {
      t.tl.pause().progress(1, true);
      gsap.fromTo([t.L, t.R], { autoAlpha: 0 }, { autoAlpha: 1, ...IN });
      return;
    }
    // Покачивание и мерцание — после роста, иначе огоньки гирлянды мерцают раньше своей очереди.
    t.tl.eventCallback('onComplete', () => {
      if (deco.current !== id || t.stop || lite) return;
      // Качаем рисунок целиком CSS-анимацией (её двигает видеокарта), а не каждую веточку внутри SVG.
      deco.l.classList.add('is-alive');
      deco.r.classList.add('is-alive');
      const s1 = GLGrow.idle(t.L, { sway: false }), s2 = GLGrow.idle(t.R, { sway: false });
      t.stop = () => { s1(); s2(); deco.l.classList.remove('is-alive'); deco.r.classList.remove('is-alive'); };
    });
    t.tl.timeScale(1).play();
    driftStart(t);
  }

  function decoHide() {
    const t = deco.current && deco.cache[deco.current];
    deco.current = null;
    driftStop();
    if (!t) return;
    t.tl.eventCallback('onComplete', null);
    if (t.stop) { t.stop(); t.stop = null; }
    if (reduce) { t.tl.pause(0); gsap.set([t.L, t.R], { autoAlpha: 0 }); root.classList.remove('deco-front'); decoClip(); return; }
    if (lite) {
      gsap.to([t.L, t.R], { autoAlpha: 0, duration: 0.5, ease: 'power2.out', onComplete: () => { if (!deco.current) { root.classList.remove('deco-front'); decoClip(); } } });
      return;
    }
    t.tl.timeScale(2.8).reverse();
    t.tl.eventCallback('onReverseComplete', () => {
      gsap.set([t.L, t.R], { autoAlpha: 0 });
      if (!deco.current) { root.classList.remove('deco-front'); decoClip(); }
    });
  }

  // Гирлянды и огоньки «Подсветки» лежат над текстом (deco-front), поэтому обрезаем их по границам главы:
  // на входе и выходе они не ложатся на прайс сверху и на контакты снизу.
  // Блоки гирлянд стоят у нижнего края экрана, слой огоньков (drift) занимает весь экран.
  // Края берём из getBoundingClientRect без округления: высота блока (86vh) бывает дробной,
  // и при округлении над краем главы оставалась строчка гирлянды в 1 px.
  const svet = $('#svet');
  const clipped = { l: '', r: '', drift: '' };
  function decoClip() {
    const on = svet && root.classList.contains('deco-front');
    const r = on && svet.getBoundingClientRect();
    ['l', 'r', 'drift'].forEach((k) => {
      if (!deco[k]) return;
      let v = '';
      if (on) {
        const b = deco[k].getBoundingClientRect();
        const top = Math.max(0, r.top - b.top), bot = Math.max(0, b.bottom - r.bottom);
        v = `inset(${top.toFixed(1)}px -160px ${bot.toFixed(1)}px -160px)`;
      }
      if (v !== clipped[k]) { deco[k].style.clipPath = v; clipped[k] = v; }
    });
  }

  function driftStart(t) {
    if (reduce || lite || !t.drift.length) return;
    // Огоньки «Подсветки» летят над тёмным фоном главы — только в полях по бокам от текста, и только там, где поля есть.
    const light = t.id === 'light';
    if (light && !matchMedia('(min-width: 1101px)').matches) return;
    if (!light && isNarrow()) return; // на телефоне лепестки летели поверх текста
    const max = light ? 5 : 4;
    const spawn = () => {
      if (deco.alive >= max || document.hidden) return;
      deco.alive++;
      const p = document.createElement('span');
      p.className = 'drift-p';
      p.innerHTML = t.drift[Math.floor(Math.random() * t.drift.length)];
      deco.drift.appendChild(p);
      const vw = innerWidth, vh = innerHeight;
      const wrap = light && $('#svet .wrap');
      const band = light && wrap ? Math.max(30, (vw - wrap.offsetWidth) / 2 - 56) : Math.max(70, vw * 0.17);
      const leftSide = Math.random() < 0.5;
      const x0 = leftSide ? Math.random() * band : vw - Math.random() * band - 26;
      const size = 0.7 + Math.random() * 0.8;
      const done = () => { p.remove(); deco.alive--; };
      if (t.id === 'light') {
        gsap.set(p, { x: x0, y: vh * (0.15 + Math.random() * 0.75), scale: 0, opacity: 0 });
        driftFly(p, done)
          .to(p, { scale: size, opacity: 1, duration: 0.6, ease: 'power2.out' })
          .to(p, { y: '-=60', x: `+=${(Math.random() - 0.5) * 40}`, duration: 3, ease: 'sine.inOut' }, 0)
          .to(p, { scale: 0, opacity: 0, duration: 0.8 }, 2.4);
      } else {
        const rise = t.id === 'lawn';
        gsap.set(p, { x: x0, y: rise ? vh + 30 : -40, scale: size, rotation: Math.random() * 360, opacity: 0 });
        driftFly(p, done)
          .to(p, { opacity: 0.6, duration: 1.4 })
          .to(p, { y: rise ? -40 : vh + 40, duration: 8 + Math.random() * 5, ease: 'none' }, 0)
          .to(p, { x: `+=${(leftSide ? 1 : -1) * (40 + Math.random() * 90)}`, rotation: `+=${(Math.random() - 0.5) * 540}`, duration: 8 + Math.random() * 5, ease: 'sine.inOut' }, 0)
          .to(p, { opacity: 0, duration: 1.2 }, 7);
      }
    };
    spawn();
    deco.timer = setInterval(spawn, light ? 800 : 2600);
  }
  function driftStop() { clearInterval(deco.timer); deco.timer = null; }
  // Полёт каждой частицы запоминаем, чтобы его можно было оборвать.
  const driftTl = new WeakMap();
  function driftFly(p, done) {
    const tl = gsap.timeline({ onComplete: done });
    driftTl.set(p, tl);
    return tl;
  }
  // Частицы прошлых глав гаснут за 0,4 с и сразу освобождают место огонькам новой главы.
  function driftClear() {
    $$('.drift-p', deco.drift).forEach((p) => {
      const tl = driftTl.get(p);
      if (!tl) return; // уже гаснет
      driftTl.delete(p);
      tl.kill();
      gsap.to(p, { opacity: 0, duration: 0.4, onComplete: () => { p.remove(); deco.alive--; } });
    });
  }

  function decoTriggers() {
    if (svet) ScrollTrigger.create({ trigger: svet, start: 'top bottom', end: 'bottom top', onUpdate: decoClip, onToggle: decoClip, onRefresh: decoClip });
    // refreshPriority: -1 — границы глав считаем после закреплений: внутри «Благоустройства» закреплена лента услуг,
    // и без этого конец главы выходил на длину закрепления (~1200 px) раньше — растения пропадали посреди главы.
    $$('.chapter[data-theme]').forEach((ch) => {
      const id = ch.dataset.theme;
      ScrollTrigger.create({ trigger: ch, start: 'top 250%', end: 'bottom -150%', once: true, refreshPriority: -1, onEnter: () => decoPrepare(id), onEnterBack: () => decoPrepare(id) });
      ScrollTrigger.create({
        trigger: ch, start: 'top 55%', end: 'bottom 45%', refreshPriority: -1,
        onToggle: (self) => {
          if (self.isActive) {
            deco.wanted = id;
            decoPrepare(id).then(() => { if (deco.wanted === id) decoShow(id); });
          } else if (deco.wanted === id) {
            deco.wanted = null;
            if (deco.current === id) decoHide();
          }
        },
      });
    });
  }

  /* ---------- ночь и огни ---------- */
  function lights() {
    const sec = $('#svet');
    if (!sec) return;
    const night = document.createElement('div');
    night.className = 'night';
    night.setAttribute('aria-hidden', 'true');
    document.body.prepend(night);
    // Сумерки: страница темнеет на подходе к тёмной части (прайс, «Подсветка», контакты, подвал) и дальше остаётся тёмной.
    const dusk = $('main [data-dark]') || sec;
    gsap.fromTo(night, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: dusk, start: 'top 60%', end: 'top 8%', scrub: true } });

    const g = $('.garland', sec);
    if (g) {
      // пульсация — только пока гирлянда на экране, а не всю длинную главу
      const pulses = loops(g);
      let bulbs = [];
      let lit = null;
      const build = () => {
        pulses.clear();
        if (lit) { lit.scrollTrigger && lit.scrollTrigger.kill(); lit.kill(); }
        g.innerHTML = '';
        // Провис небольшой: гирлянда висит над главой и не задевает надстрочник «09 · Глава · Подсветка».
        const W = g.clientWidth || innerWidth, H = 110;
        g.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const defs = svgEl('defs', {}, g);
        const rg = svgEl('radialGradient', { id: 'gl-halo' }, defs);
        svgEl('stop', { offset: '0', 'stop-color': '#ffd59a', 'stop-opacity': '.9' }, rg);
        svgEl('stop', { offset: '.45', 'stop-color': '#ffb86b', 'stop-opacity': '.35' }, rg);
        svgEl('stop', { offset: '1', 'stop-color': '#ffb86b', 'stop-opacity': '0' }, rg);
        const swags = W > 900 ? 3 : 2;
        bulbs = [];
        for (let s = 0; s < swags; s++) {
          const x0 = (W / swags) * s, x1 = x0 + W / swags, sag = 40 + (s % 2) * 14;
          const wire = svgEl('path', { d: `M${x0} 8 Q${(x0 + x1) / 2} ${8 + sag * 2} ${x1} 8`, class: 'gw' }, g);
          const len = wire.getTotalLength();
          const n = Math.round(len / 64);
          for (let i = 1; i < n; i++) {
            const p = wire.getPointAtLength((i / n) * len);
            const b = svgEl('g', { class: 'gbulb' }, g);
            svgEl('circle', { cx: p.x, cy: p.y + 9, r: 22, class: 'gh' }, b);
            svgEl('rect', { x: p.x - 2.5, y: p.y, width: 5, height: 5, rx: 1, fill: '#564e4c' }, b);
            svgEl('ellipse', { cx: p.x, cy: p.y + 10, rx: 4.2, ry: 6, class: 'gb' }, b);
            bulbs.push({ b, x: p.x, y: p.y + 10 });
          }
        }
        lit = gsap.fromTo(bulbs.map((o) => o.b), { opacity: 0.12 }, { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: sec, start: 'top 75%', end: 'top 5%', scrub: true } });
        if (!reduce) bulbs.forEach((o, i) => pulses.add(gsap.to($('.gh', o.b), { scale: 0.78, svgOrigin: `${o.x} ${o.y}`, duration: 0.8 + (i % 5) * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })));
      };
      build();
      let w = innerWidth;
      ScrollTrigger.addEventListener('refreshInit', () => {
        if (Math.abs(innerWidth - w) < 40) return;
        w = innerWidth;
        build();
      });
    }

    if (!reduce) {
      // Огни «включаются»: фото главы разгораются по мере прокрутки. Прозрачностью, а не filter (у рамок чёрный фон): filter при прокрутке дорог в Safari и Firefox.
      $$('[data-lit] img', sec).forEach((im) => {
        gsap.fromTo(im, { opacity: 0.34 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: im.closest('[data-lit]'), start: 'top 92%', end: 'center 58%', scrub: true } });
      });
      // По золотым заголовкам один раз пробегает блик — как свет по гирлянде.
      $$('[data-glow]', sec).forEach((el) => {
        onView(el, (past) => { if (!past) gsap.fromTo(el, { backgroundPosition: '100% 0%, 0% 0%' }, { backgroundPosition: '0% 0%, 0% 0%', duration: 1.9, ease: 'power2.inOut', delay: 0.2 }); });
      });
    }
  }

  /* ---------- услуги, шаги, вопросы ---------- */
  function servicesStrip() {
    const sec = $('.services');
    if (!sec) return;
    const track = $('.services-track', sec);
    const mm = gsap.matchMedia();
    // На низких экранах (телефон боком) ленту не закрепляем: карточки не помещаются по высоте.
    mm.add('(min-width: 901px) and (min-height: 620px)', () => {
      if (reduce) return;
      const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: sec, start: () => `top ${hdrH()}`, end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
      });
    });
    if (!reduce) {
      const stl = gsap.timeline({ paused: true }).from($$('.svc', sec), { y: 24, opacity: 0, ...IN, stagger: 0.08 });
      onView(sec, (past) => (past ? stl.progress(1) : stl.play()), '0px 0px -25% 0px');
    }
  }

  // Лоза через шаги растёт при прокрутке: на широком экране — вправо, на узком — вниз; листки раскрываются по очереди.
  function stepsStem() {
    const line = $('.steps-line');
    if (!line || reduce) return;
    const list = $('.steps-list');
    gsap.matchMedia().add({ wide: '(min-width: 901px)', narrow: '(max-width: 900.98px)' }, (ctx) => {
      const wide = ctx.conditions.wide;
      const prop = wide ? 'scaleX' : 'scaleY';
      gsap.fromTo(line, { [prop]: 0 }, { [prop]: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 80%', end: wide ? 'top 40%' : 'bottom 70%', scrub: true } });
    });
    $$('.step').forEach((s, i) => {
      const d = isNarrow() ? 0 : i * 0.12; // в строке листки раскрываются слева направо
      const st = gsap.timeline({ paused: true })
        .from(s, { y: 24, opacity: 0, ...IN }, d)
        .fromTo($('.step-dot', s), { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out' }, d + 0.15);
      onView(s, (past) => (past ? st.progress(1) : st.play()), '0px 0px -14% 0px');
    });
  }

  function faqRefresh() {
    $$('.faq-item').forEach((d) => d.addEventListener('toggle', () => ScrollTrigger.refresh()));
  }

  /* ---------- сторож частоты кадров ---------- */
  // Считаем только кадры настоящей прокрутки. Если в двух порциях подряд больше половины кадров хуже 20 к/с (дольше 50 мс),
  // один раз и насовсем снижаем нагрузку. Порог по замеру (Chrome 390 с пальцем): процессор ×4 — не срабатывает ни разу,
  // худшие порции 48 и 85 % идут поодиночке; ×6 — срабатывает на второй порции. Прежний порог (60 % кадров дольше 34 мс) на ×4 был на грани.
  // без лепестков, без роста растений по бокам и названий глав. Появление заголовков и текста остаётся как есть, ролики тоже —
  // кроме устройств с пальцем: там scroll-ролики переходят в once (lowerClips). То, что уже идёт, спокойно заканчивается.
  let lite = false;
  function lowerLoad() {
    if (lite) return;
    lite = true;
    root.classList.add('gl-lite');
    if (D) D.liteAt = performance.now();
    driftStop();
    if (coarse && lowerClips) lowerClips();
  }
  function frameGuard() {
    if (reduce) return;
    let lastScroll = -1e4, n = 0, slow = 0, bad = 0;
    addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
    const tick = (time, dt) => {
      if (document.hidden || dt > 400 || performance.now() - lastScroll > 150) return;
      n++;
      if (dt > 50) slow++;
      if (n < 40) return;
      bad = slow > n * 0.5 ? bad + 1 : 0;
      n = slow = 0;
      if (bad >= 2) { gsap.ticker.remove(tick); lowerLoad(); }
    };
    gsap.ticker.add(tick);
  }

  /* ---------- позиция при перезагрузке ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  addEventListener('pagehide', () => {
    try {
      const s = $$('main section[id]').find((x) => x.getBoundingClientRect().bottom > hdrH());
      if (s) sessionStorage.setItem('gl-pos', JSON.stringify({ id: s.id, dy: Math.round(s.getBoundingClientRect().top) }));
    } catch (e) { /* ничего */ }
  });
  function restorePosition() {
    if (lenis) lenis.resize(); // высота страницы только что выросла на длину закреплений
    // Позицию возвращаем только при перезагрузке, а не при новом заходе на сайт. Она важнее хэша: хэш остаётся в адресе
    // после перехода по меню, а посетитель уже дочитал дальше.
    const navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (navEntry && navEntry.type === 'reload') {
      let pos = null;
      try { pos = JSON.parse(sessionStorage.getItem('gl-pos') || 'null'); } catch (e) { /* ничего */ }
      const el = pos && document.getElementById(pos.id);
      if (el) {
        if (el.id !== 'top') jumpTo(el.getBoundingClientRect().top + scrollY - pos.dy);
        return;
      }
    }
    const hashEl = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (hashEl) {
      if (hashEl.tagName === 'DETAILS') { hashEl.open = true; if (window.gsap) gsap.set(hashEl, { opacity: 1, y: 0, overwrite: true }); }
      scrollToEl(hashEl, true);
    }
  }

  /* ---------- место чтения при повороте и изменении окна ---------- */
  // От ширины зависят высоты всех сцен, и прежний scrollY приходится уже на другой товар. Запоминаем блок на линии чтения и долю пути по нему,
  // пока окно не менялось: к событию resize раскладка уже новая. Закреплённый блок меряем по его обёртке: сам он стоит на месте.
  const spots = () => $$('.scene, main section, .footer');
  const spotBox = (el) => el.closest('.pin-spacer, .hero-spacer') || el;
  const readLine = () => innerHeight * 0.4;
  let place = null, placeOff = false;
  const notePlace = () => {
    const line = readLine();
    const el = spots().filter((s) => { const r = spotBox(s).getBoundingClientRect(); return r.top <= line && r.bottom > line; }).pop();
    if (!el) { place = null; return; }
    const r = spotBox(el).getBoundingClientRect();
    place = { el, part: (line - r.top) / r.height };
  };
  const backToPlace = () => {
    if (!place) return;
    const r = spotBox(place.el).getBoundingClientRect();
    jumpTo(r.top + scrollY + place.part * r.height - readLine());
  };
  function keepPlace() {
    let t = 0;
    notePlace();
    addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { if (!placeOff) notePlace(); }, 200); }, { passive: true });
  }

  /* ---------- запуск ---------- */
  // Сбой в любой части не должен оставить фото и текст невидимыми: показываем всё без анимации.
  const bail = (err) => {
    console.error(err);
    root.classList.remove('fx');
    if (!clipMode) stillClips();
    gsap.set('[data-reveal]', { clearProps: 'opacity,transform' });
  };
  // Одна порция подготовки на кадр: первый экран успевает отрисоваться, а вся страница готова за доли секунды.
  // (requestIdleCallback не подходит — пока идут анимации титула, «свободного» времени у браузера почти нет.)
  const nextFrame = (fn) => new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(() => { try { fn(); } catch (e) { bail(e); } resolve(); }, 0));
  });

  let started = false;
  const start = async () => {
    started = true;
    heroLoops = loops('.hero-spacer');
    try {
      if (!reduce) { heroIntro(); heroFloat(); heroScroll(); }
      else heroMount();
    } catch (e) { bail(e); }
    const tasks = [
      () => { if (!reduce) $$('[data-leaf-title]').forEach(leafTitle); introBig(); reveals(); },
      headerTriggers, manifest, chapterWords, chapters, scenes, blooms, decoTriggers, lights, servicesStrip,
      () => { stepsStem(); faqRefresh(); },
    ];
    for (const task of tasks) await nextFrame(task);
    await Promise.race([wordsSized, new Promise((r) => setTimeout(r, 800))]);
    frameGuard();

    // названия сами перестраиваются при ресайзе (plantword.js); после этого пересчитываем триггеры
    let w = innerWidth, rz;
    addEventListener('resize', () => {
      // прячущаяся строка адреса меняет только высоту: место чтения обновляем как обычно
      if (Math.abs(innerWidth - w) >= 2) placeOff = true;
      clearTimeout(rz);
      rz = setTimeout(async () => {
        if (Math.abs(innerWidth - w) >= 2) {
          w = innerWidth;
          if (introTl) introTl.progress(1);
          await sizeWords();
          ScrollTrigger.refresh();
          backToPlace();
        }
        placeOff = false;
      }, 400);
    });

    // Триггеры созданы не в порядке страницы, а закреплённые блоки (титул, услуги) сдвигают всё ниже.
    // Сортируем по положению и пересчитываем, чтобы каждый срабатывал на своём месте.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    restorePosition();
    keepPlace();
    if (D) D.readyAt = performance.now();
    root.classList.add('gl-ready');
  };

  // Шрифты ждём не дольше 1,5 с (названия на холсте сами дожидаются Oswald).
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(start).catch(bail);
})();
