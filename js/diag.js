/* Green Life — панель диагностики (адрес с ?diag=1). Что умеет браузер и что сайт решил показать: снимок экрана
   с телефона заменяет удалённую отладку. Подключается только из <head> (build.mjs → diagScript), без ?diag не грузится. */
(() => {
  const D = window.GLDiag || (window.GLDiag = { err: [], nerr: 0 });
  const root = document.documentElement;
  const mq = (q) => matchMedia(q).matches;
  const yes = (b) => (b ? 'да' : 'нет');
  const ua = navigator.userAgent;

  // браузер и версия коротко: первый узнанный по строке userAgent (порядок важен — почти все пишут о себе «Chrome» и «Safari»)
  const browser = (() => {
    const list = [['YaBrowser', 'Яндекс'], ['MiuiBrowser', 'Mi Браузер'], ['SamsungBrowser', 'Samsung'], ['HuaweiBrowser', 'Huawei'], ['HeyTapBrowser', 'HeyTap'],
      ['VivoBrowser', 'Vivo'], ['UCBrowser', 'UC'], ['MQQBrowser', 'QQ'], ['OPR', 'Opera'], ['EdgA?', 'Edge'], ['Firefox', 'Firefox'], ['FxiOS', 'Firefox'],
      ['CriOS', 'Chrome'], ['Chrome', 'Chrome'], ['Version', 'Safari']];
    for (const [re, name] of list) {
      const m = ua.match(new RegExp(`(?:^|[\\s/;(])${re}/(\\d+(?:\\.\\d+)?)`));
      if (m) return `${name} ${m[1]}`;
    }
    return ua.slice(0, 48);
  })();
  const os = (ua.match(/Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+/) || [''])[0].replace(/_/g, '.');

  // частота кадров только во время прокрутки: кадры, между которыми был scroll не раньше 150 мс назад
  let lastScroll = -1e4, prev = 0, n = 0, sum = 0, fps = '—';
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  const tick = (t) => {
    if (prev && t - lastScroll < 150 && t - prev < 400) { n++; sum += t - prev; }
    prev = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const conn = navigator.connection || {};
  const h264 = (() => { try { return document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') || 'нет'; } catch (e) { return 'ошибка'; } })();
  const libs = [['gsap', 'gsap'], ['ScrollTrigger', 'ST'], ['SplitText', 'Split'], ['DrawSVGPlugin', 'Draw'], ['Lenis', 'Lenis'], ['PlantWord', 'PW'], ['GLGrow', 'Grow']];

  function lines() {
    const cl = D.clips || [];
    const modes = cl.reduce((o, c) => { if (c.mode) o[c.mode] = (o[c.mode] || 0) + 1; return o; }, {});
    const mode = typeof D.mode === 'function' ? D.mode() : '';
    const cvs = typeof D.canvas === 'function' ? D.canvas() : D.canvas; // true, false или строка «холст не рисует (…)»
    const has = ['js', 'fx', 'gl-ready', 'gl-lite'].filter((k) => root.classList.contains(k));
    const ms = (t) => (t ? `${Math.round(t)} мс` : '—');
    return [
      `${browser} · ${os}`,
      `окно ${innerWidth}×${innerHeight} @${+(devicePixelRatio || 1).toFixed(2)}`,
      `reduce: ${yes(mq('(prefers-reduced-motion: reduce)'))} · палец: ${yes(mq('(pointer: coarse)'))} · hover: ${yes(mq('(hover: hover)'))}`,
      `saveData: ${conn.saveData === undefined ? '—' : yes(conn.saveData)} · сеть: ${conn.effectiveType || '—'} · H.264: ${h264}`,
      `ролики: ${cvs === true ? 'холст' : cvs || 'видео'} · ${mode || 'ещё не решено'}${Object.keys(modes).length ? ' · ' + Object.entries(modes).map(([k, v]) => `${k} ${v}`).join(', ') : ''}`,
      `загружено ${cl.filter((c) => c.got).length} (сейчас ${cl.filter((c) => c.on).length}) · играло ${cl.filter((c) => c.played).length} · отказов ${D.refused || 0} · перемоткой ${D.walked || 0} · сбоев ${D.failed || 0}`,
      `ошибка play(): ${D.playErr || '—'}`,
      `gl-ready: ${ms(D.readyAt)}${D.liteAt ? ` · облегчено: ${ms(D.liteAt)}` : ''}`,
      `html: ${has.join(' ') || '—'}`,
      `кадры при прокрутке: ${fps}`,
      `скрипты: ${libs.map(([k, s]) => (window[k] ? s : `✗${s}`)).join(' ')}`,
      ...(D.err.length ? D.err.map((e, i) => `ошибка ${i + 1}: ${e}`) : ['ошибок JS нет']),
      ...(D.nerr > 3 ? [`всего ошибок: ${D.nerr}`] : []),
    ];
  }

  function mount() {
    const box = document.createElement('div');
    box.id = 'gl-diag';
    box.setAttribute('aria-hidden', 'true');
    // стили здесь же: без ?diag в main.css нет ни строчки от панели
    box.style.cssText = 'position:fixed;left:8px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:2147483647;max-width:min(360px, calc(100vw - 88px));'
      + 'padding:8px 10px;border-radius:10px;background:rgba(8,18,8,.8);color:#eef5e6;font:12.5px/1.38 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;'
      + 'font-variant-numeric:tabular-nums;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;box-shadow:0 2px 12px rgba(0,0,0,.25)';
    document.body.appendChild(box);
    // над нижней панелью сайта на телефоне (позвонить, WhatsApp): ищем закреплённые снизу блоки и встаём выше самого высокого
    const lift = () => {
      let top = innerHeight;
      for (const el of document.body.children) {
        if (el === box || getComputedStyle(el).position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.height && r.height < innerHeight / 3 && r.bottom >= innerHeight - 24 && r.width > innerWidth * 0.4) top = Math.min(top, r.top);
      }
      box.style.bottom = top < innerHeight ? `${Math.round(innerHeight - top + 8)}px` : '';
    };
    const paint = () => {
      if (n >= 5) { fps = `${Math.round((1000 * n) / sum)} к/с`; n = sum = 0; }
      box.textContent = lines().join('\n');
      lift();
    };
    paint();
    setInterval(paint, 1000);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
