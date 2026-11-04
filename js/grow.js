/* Green Life — «рост» SVG-растений.
   Читает классы g-stem / g-leaf / g-bloom / g-fade / g-sway / g-glow и data-o / data-d / data-a
   (см. research/DECO-CONTRACT.md) и строит из них GSAP-таймлайн. Нужны gsap + DrawSVGPlugin. */
(function () {
  const parseO = (el) => {
    const raw = el.getAttribute('data-o');
    if (!raw) return null;
    const [x, y] = raw.trim().split(/[\s,]+/).map(Number);
    return Number.isFinite(x) && Number.isFinite(y) ? `${x} ${y}` : null;
  };
  const startAt = (el, total) => (parseFloat(el.getAttribute('data-d')) || 0) * total;

  // Список шагов: по одному на элемент рисунка. Рост — плавный, без перелёта и вращений.
  function plan(svg, duration) {
    const tl = gsap.timeline({ paused: true });
    const jobs = [];
    const each = (sel, fn) => svg.querySelectorAll(sel).forEach((el) => jobs.push(() => fn(el)));

    each('.g-stem', (el) => {
      const len = (parseFloat(el.getAttribute('data-t')) || 0.38) * duration;
      tl.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: len, ease: 'power1.inOut' }, startAt(el, duration));
    });

    each('.g-leaf', (el) => {
      const o = parseO(el);
      if (o) gsap.set(el, { svgOrigin: o });
      tl.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'power2.out' }, startAt(el, duration));
    });

    each('.g-bloom', (el) => {
      const o = parseO(el);
      if (o) gsap.set(el, { svgOrigin: o });
      tl.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' }, startAt(el, duration));
    });

    each('.g-fade', (el) => {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, startAt(el, duration));
    });

    each('.g-glow', (el) => {
      tl.fromTo(el, { opacity: 0.12 }, { opacity: 1, duration: 0.22, ease: 'power2.in' }, startAt(el, duration));
    });

    return { tl, jobs };
  }

  function build(svg, { duration = 2.8 } = {}) {
    const { tl, jobs } = plan(svg, duration);
    jobs.forEach((job) => job());
    return tl;
  }

  // То же по частям, не дольше 6 мс за кадр: сотни элементов разом останавливали слабый телефон на 0,7 с прямо посреди прокрутки.
  function buildSliced(svg, { duration = 2.8 } = {}) {
    const { tl, jobs } = plan(svg, duration);
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        // Первый элемент кадра — вне 6 мс: он платит за пересчёт стилей и раскладки страницы, который браузер всё равно
        // сделал бы к отрисовке. На медленном движке этот пересчёт съедал весь срок, и за кадр собирался один элемент.
        if (i < jobs.length) jobs[i++]();
        const end = performance.now() + 6;
        while (i < jobs.length && performance.now() < end) jobs[i++]();
        if (i < jobs.length) requestAnimationFrame(step);
        // Таймлайн — в объекте: у таймлайна GSAP есть then(), и resolve(tl) ждал бы конца анимации, а она на паузе —
        // обещание не выполнялось никогда, и растения по бокам не появлялись ни на одном экране.
        else resolve({ tl });
      };
      step();
    });
  }

  // Вечное покачивание «на ветру» и мерцание огоньков. Возвращает функцию остановки.
  function idle(svg, { sway = true } = {}) {
    const tweens = [];
    if (sway) svg.querySelectorAll('.g-sway').forEach((el, i) => {
      const o = parseO(el);
      const a = parseFloat(el.getAttribute('data-a')) || 2;
      if (o) gsap.set(el, { svgOrigin: o });
      tweens.push(gsap.fromTo(el, { rotation: -a * 0.6 }, {
        rotation: a, duration: 2.8 + (i % 4) * 0.55, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: (i % 5) * 0.3,
      }));
    });
    svg.querySelectorAll('.g-glow').forEach((el, i) => {
      tweens.push(gsap.to(el, {
        opacity: 0.62, duration: 0.9 + (i % 5) * 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: (i % 7) * 0.21,
      }));
    });
    return () => tweens.forEach((t) => t.kill());
  }

  // Контроль качества: элементы, которым нужна точка крепления, но её нет.
  function audit(svg) {
    const missing = [...svg.querySelectorAll('.g-leaf, .g-bloom, .g-sway')].filter((el) => !parseO(el));
    const stemsFilled = [...svg.querySelectorAll('.g-stem')].filter((el) => {
      const f = el.getAttribute('fill');
      return f && f !== 'none';
    });
    return { missingOrigin: missing.length, filledStems: stemsFilled.length };
  }

  window.GLGrow = { build, buildSliced, idle, audit };
})();
