/* Green Life — «живые» названия глав.
   Слово рисуется на canvas: буквы Oswald, выложенные из растения темы (листья берёзы, хвоя туи,
   лепестки роз, брусчатка, деревянные доски с гирляндой…). Каждый элемент появляется по отдельности,
   цветы раскрываются, ветки качаются, лампочки загораются. API: PlantWord.mount(el, opts). */
(function () {
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  // Холсты названий считает процессор, а не видеокарта: на встроенной видеокарте тысячи мелких листьев занимали её на 100 мс
  // за рисунок, и вместе с ними вставала вся страница (Chrome, Intel UHD: 28 → 56 к/с на названии «Хвойные»).
  const CTX = { willReadFrequently: true };
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
  const imgCache = {};
  const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  }));

  /* ---------------- примитивы рисования (локальные координаты, лист «смотрит» вдоль +x) ---------------- */

  function leaf(g, len, wid, c1, c2, vein) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.9, len, 0);
    g.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.3, wid, 0, 0);
    g.fillStyle = c1;
    g.fill();
    if (c2) {
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(len * 0.3, wid, len * 0.75, wid * 0.9, len, 0);
      g.closePath();
      g.fillStyle = c2;
      g.fill();
    }
    if (vein) {
      g.beginPath();
      g.moveTo(len * 0.05, 0);
      g.lineTo(len * 0.85, 0);
      g.strokeStyle = vein;
      g.lineWidth = Math.max(0.6, wid * 0.12);
      g.stroke();
    }
  }

  // Лист берёзы: треугольно-яйцевидный с зубчиками.
  function birchLeaf(g, len, c1, c2) {
    const w = len * 0.42;
    g.beginPath();
    g.moveTo(0, 0);
    const n = 6;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = len * t;
      const y = -w * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.15);
      g.lineTo(x - len * 0.04, y * 0.86);
      g.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const x = len * t;
      const y = w * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.15);
      g.lineTo(x, y);
      if (i > 0) g.lineTo(x - len * 0.04, y * 0.86);
    }
    g.closePath();
    g.fillStyle = c1;
    g.fill();
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.9, 0);
    g.strokeStyle = c2;
    g.lineWidth = Math.max(0.5, len * 0.04);
    g.stroke();
  }

  function petal(g, len, wid, cIn, cOut) {
    const gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, cIn);
    gr.addColorStop(1, cOut);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.2, -wid * 1.1, len * 1.05, -wid * 0.9, len, 0);
    g.bezierCurveTo(len * 1.05, wid * 0.9, len * 0.2, wid * 1.1, 0, 0);
    g.fillStyle = gr;
    g.fill();
  }

  function flower(g, r, n, cPetal, cCenter, k, petalW = 0.55) {
    const open = easeBack(clamp01(k));
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((i / n) * TAU + (1 - open) * 0.6);
      g.scale(open, open);
      leaf(g, r, r * petalW * 0.5, cPetal, null, null);
      g.restore();
    }
    if (cCenter) {
      g.beginPath();
      g.arc(0, 0, r * 0.28 * Math.min(1, open * 1.2), 0, TAU);
      g.fillStyle = cCenter;
      g.fill();
    }
  }

  function daisy(g, r, k) {
    const open = easeBack(clamp01(k));
    g.save();
    g.scale(open, open);
    for (let i = 0; i < 12; i++) {
      g.save();
      g.rotate((i / 12) * TAU);
      leaf(g, r, r * 0.17, i % 2 ? '#ffffff' : '#f6f2ea', null, null);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.3, 0, TAU);
    g.fillStyle = '#f2c14e';
    g.fill();
    g.beginPath();
    g.arc(-r * 0.06, -r * 0.08, r * 0.12, 0, TAU);
    g.fillStyle = 'rgba(255,240,190,.8)';
    g.fill();
    g.restore();
  }

  function clover(g, r, k, rand) {
    const open = easeBack(clamp01(k));
    g.save();
    g.scale(open, open);
    for (let i = 0; i < 14; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.75;
      g.beginPath();
      g.ellipse(Math.cos(a) * d, Math.sin(a) * d - r * 0.1, r * 0.22, r * 0.32, a, 0, TAU);
      g.fillStyle = i % 3 ? '#e8a6bf' : '#f6d3e0';
      g.fill();
    }
    g.restore();
  }

  function rose(g, r, k, pal) {
    // три кольца лепестков: внутреннее раскрывается первым, внешнее — последним
    const rings = [
      { n: 5, rr: 0.42, a0: 0.3, s: 0 },
      { n: 6, rr: 0.7, a0: 0.0, s: 0.25 },
      { n: 7, rr: 1.0, a0: 0.45, s: 0.5 },
    ];
    for (let ri = rings.length - 1; ri >= 0; ri--) {
      const ring = rings[ri];
      const kk = easeBack(clamp01((k - ring.s) / 0.5));
      if (kk <= 0) continue;
      for (let i = 0; i < ring.n; i++) {
        g.save();
        g.rotate(ring.a0 + (i / ring.n) * TAU + (1 - kk) * 0.8);
        g.scale(kk, kk);
        petal(g, r * ring.rr, r * ring.rr * 0.42, pal[(ri + 1) % pal.length], pal[ri % pal.length]);
        g.restore();
      }
    }
    // сердцевина-спираль
    const kc = clamp01(k * 2);
    g.beginPath();
    g.arc(0, 0, r * 0.18 * kc, 0, TAU);
    g.fillStyle = pal[3] || pal[0];
    g.fill();
    g.beginPath();
    g.arc(r * 0.03, -r * 0.02, r * 0.1 * kc, Math.PI * 0.2, Math.PI * 1.7);
    g.strokeStyle = 'rgba(60,10,20,.35)';
    g.lineWidth = Math.max(0.6, r * 0.04);
    g.stroke();
  }

  function tulipCup(g, h, col, k) {
    const open = clamp01(k);
    const w = h * 0.42;
    const side = (dir) => {
      g.save();
      g.rotate(dir * (0.08 + open * 0.28));
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(dir * w * 0.9, -h * 0.1, dir * w * 0.95, -h * 0.75, dir * w * 0.35, -h);
      g.quadraticCurveTo(dir * w * 0.15, -h * 0.55, 0, 0);
      g.fillStyle = col[1];
      g.fill();
      g.restore();
    };
    side(-1);
    side(1);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-w * 0.75, -h * 0.15, -w * 0.55, -h * 0.85, 0, -h * 1.02);
    g.bezierCurveTo(w * 0.55, -h * 0.85, w * 0.75, -h * 0.15, 0, 0);
    g.fillStyle = col[0];
    g.fill();
    g.beginPath();
    g.moveTo(-w * 0.12, -h * 0.2);
    g.quadraticCurveTo(-w * 0.2, -h * 0.65, 0, -h * 0.9);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = Math.max(0.8, w * 0.08);
    g.stroke();
  }

  function blade(g, x, y, len, lean, wid, col) {
    g.beginPath();
    g.moveTo(x - wid, y);
    g.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    g.quadraticCurveTo(x + lean * 0.3 + wid * 0.3, y - len * 0.55, x + wid, y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  }

  function thujaSpray(g, len, cMain, cLight) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len, 0);
    g.strokeStyle = cMain;
    g.lineWidth = Math.max(0.8, len * 0.05);
    g.stroke();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = 0.12 + (i / n) * 0.85;
      const s = (1 - t * 0.7) * len * 0.42;
      for (const dir of [-1, 1]) {
        g.save();
        g.translate(len * t, 0);
        g.rotate(dir * 0.95);
        g.beginPath();
        g.moveTo(0, 0);
        for (let j = 0; j < 4; j++) {
          const xx = (s / 4) * (j + 1);
          g.quadraticCurveTo(xx - s / 8, -s * 0.16, xx, 0);
        }
        for (let j = 4; j > 0; j--) {
          const xx = (s / 4) * (j - 1);
          g.quadraticCurveTo(xx + s / 8, s * 0.16, xx, 0);
        }
        g.fillStyle = (i + (dir > 0 ? 1 : 0)) % 2 ? cMain : cLight;
        g.fill();
        g.restore();
      }
    }
  }

  function ivyLeaf(g, r, c1, c2) {
    g.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      const lobe = i % 5 === 0 ? 1 : 0.82;
      const x = Math.cos(a) * r * lobe, y = Math.sin(a) * r * lobe;
      if (i === 0) g.moveTo(x, y);
      else {
        const am = a - TAU / 10;
        g.quadraticCurveTo(Math.cos(am) * r * 0.45, Math.sin(am) * r * 0.45, x, y);
      }
    }
    g.closePath();
    g.fillStyle = c1;
    g.fill();
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    }
    g.strokeStyle = c2;
    g.lineWidth = Math.max(0.5, r * 0.08);
    g.stroke();
  }

  function apple(g, r, k) {
    const s = easeBack(clamp01(k), 2.2);
    g.save();
    g.scale(s, s);
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    gr.addColorStop(0, '#f3a37a');
    gr.addColorStop(0.45, '#d9493a');
    gr.addColorStop(1, '#9e2b25');
    g.beginPath();
    g.moveTo(0, -r * 0.75);
    g.bezierCurveTo(r * 0.9, -r * 1.1, r * 1.2, r * 0.3, r * 0.4, r * 0.95);
    g.quadraticCurveTo(0, r * 1.05, -r * 0.4, r * 0.95);
    g.bezierCurveTo(-r * 1.2, r * 0.3, -r * 0.9, -r * 1.1, 0, -r * 0.75);
    g.fillStyle = gr;
    g.fill();
    g.beginPath();
    g.moveTo(0, -r * 0.7);
    g.quadraticCurveTo(r * 0.05, -r * 1.1, r * 0.18, -r * 1.25);
    g.strokeStyle = '#5b3a24';
    g.lineWidth = Math.max(1, r * 0.1);
    g.stroke();
    g.save();
    g.translate(r * 0.12, -r * 1.05);
    g.rotate(-0.5);
    leaf(g, r * 0.8, r * 0.28, '#6f9a62', '#4c7a4f', 'rgba(255,255,255,.35)');
    g.restore();
    g.restore();
  }

  function bulb(g, r, on, flick) {
    // цоколь
    g.fillStyle = '#5c534f';
    g.fillRect(-r * 0.32, -r * 0.55, r * 0.64, r * 0.45);
    // колба
    const lit = on * flick;
    g.beginPath();
    g.ellipse(0, r * 0.45, r * 0.55, r * 0.75, 0, 0, TAU);
    if (lit > 0.02) {
      const gr = g.createRadialGradient(0, r * 0.45, r * 0.05, 0, r * 0.45, r * 0.8);
      gr.addColorStop(0, `rgba(255,248,225,${0.6 + lit * 0.4})`);
      gr.addColorStop(0.5, `rgba(255,214,150,${0.45 + lit * 0.5})`);
      gr.addColorStop(1, `rgba(255,170,90,${0.25 + lit * 0.4})`);
      g.fillStyle = gr;
    } else g.fillStyle = 'rgba(215,205,190,.32)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)';
    g.lineWidth = Math.max(0.6, r * 0.06);
    g.stroke();
  }

  function glow(g, x, y, R, a) {
    if (a <= 0.01) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, `rgba(255,214,150,${0.55 * a})`);
    gr.addColorStop(0.35, `rgba(255,184,107,${0.22 * a})`);
    gr.addColorStop(1, 'rgba(255,184,107,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, R, 0, TAU);
    g.fill();
  }

  // Процедурная текстура дерева для букв «Подсветки».
  function woodCanvas(rand) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d', CTX);
    const rows = 4, ph = 256 / rows;
    const tones = ['#8d5d37', '#7a4d2d', '#986640', '#6e4528'];
    for (let r = 0; r < rows; r++) {
      g.fillStyle = tones[r % tones.length];
      g.fillRect(0, r * ph, 512, ph);
      for (let i = 0; i < 16; i++) {
        g.strokeStyle = `rgba(45,24,10,${0.1 + rand() * 0.2})`;
        g.lineWidth = 0.6 + rand() * 1.4;
        g.beginPath();
        const y0 = r * ph + 3 + rand() * (ph - 6), amp = 1 + rand() * 3, f = 0.01 + rand() * 0.02, ph0 = rand() * 6;
        g.moveTo(0, y0);
        for (let x = 0; x <= 512; x += 12) g.lineTo(x, y0 + Math.sin(x * f + ph0) * amp);
        g.stroke();
      }
      const kx = rand() * 480 + 16, ky = r * ph + ph * (0.3 + rand() * 0.4);
      g.beginPath();
      g.ellipse(kx, ky, 7 + rand() * 6, 3 + rand() * 2, 0, 0, TAU);
      g.fillStyle = 'rgba(50,26,12,.45)';
      g.fill();
      g.fillStyle = 'rgba(255,225,180,.14)';
      g.fillRect(0, r * ph, 512, 2);
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.fillRect(0, (r + 1) * ph - 2, 512, 2);
    }
    return c;
  }

  /* ---------------- анализ формы букв ---------------- */

  function analyse(word, font, W, H, x0, baseY) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(W);
    c.height = Math.ceil(H);
    const g = c.getContext('2d', CTX);
    g.font = font;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#000';
    g.fillText(word, x0, baseY);
    const w = c.width, h = c.height;
    const data = g.getImageData(0, 0, w, h).data;
    const inside = (x, y) => {
      const xi = x | 0, yi = y | 0;
      return xi >= 0 && yi >= 0 && xi < w && yi < h && data[(yi * w + xi) * 4 + 3] > 127;
    };
    const top = new Float32Array(w).fill(-1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (data[(y * w + x) * 4 + 3] > 127) { top[x] = y; break; }
      }
    }
    // буквы: x-границы по ширине префиксов
    const boxes = [];
    let acc = 0;
    const chars = [...word];
    chars.forEach((ch, i) => {
      const wPrefix = g.measureText(chars.slice(0, i + 1).join('')).width;
      boxes.push({ ch, x: x0 + acc, w: wPrefix - acc });
      acc = wPrefix;
    });
    boxes.forEach((b) => {
      let minY = Infinity, minX = b.x + b.w / 2;
      for (let x = Math.floor(b.x); x < b.x + b.w; x++) if (top[x] >= 0 && top[x] < minY) { minY = top[x]; minX = x; }
      b.top = minY === Infinity ? baseY : minY;
      b.topX = minX;
    });
    return { inside, top, boxes, w, h };
  }

  function interiorPoints(A, step, rand, jitter = 0.38) {
    const pts = [];
    const rowH = step * 0.86;
    let row = 0;
    for (let y = rowH / 2; y < A.h; y += rowH, row++) {
      for (let x = (row % 2 ? step / 2 : 0) + step / 2; x < A.w; x += step) {
        const px = x + (rand() - 0.5) * step * jitter * 2, py = y + (rand() - 0.5) * step * jitter * 2;
        if (A.inside(px, py)) pts.push({ x: px, y: py });
      }
    }
    return pts;
  }

  function edgePoints(A, step, rand) {
    const pts = [];
    const d = step * 0.55;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    for (let y = 0; y < A.h; y += step * 0.7) {
      for (let x = 0; x < A.w; x += step * 0.7) {
        const px = x + (rand() - 0.5) * step * 0.4, py = y + (rand() - 0.5) * step * 0.4;
        if (!A.inside(px, py)) continue;
        let nx = 0, ny = 0, out = 0;
        dirs.forEach(([dx, dy]) => { if (!A.inside(px + dx * d, py + dy * d)) { nx += dx; ny += dy; out++; } });
        if (!out) continue;
        const l = Math.hypot(nx, ny) || 1;
        pts.push({ x: px, y: py, nx: nx / l, ny: ny / l });
      }
    }
    return pts;
  }

  // Точки верхнего контура (для травы, ростков, гирлянды).
  function topPoints(A, step) {
    const pts = [];
    for (let x = 0; x < A.w; x += step) {
      const y = A.top[x | 0];
      if (y >= 0) pts.push({ x, y });
    }
    return pts;
  }

  /* ---------------- темы ---------------- */
  // Каждая тема: base(g, ctx) — заливка букв; build(ctx) — {pieces, decor, intro, idle}.
  // piece: {t0, d, draw(g, k)}; decor: {t0, d, draw(g, k, t)} — рисуется каждый кадр (может качаться).

  const GREENS = ['#2f5d3a', '#4c7a4f', '#6f9a62', '#8db36b', '#9dbf8a'];

  const themes = {
    meadow: { // титул «Green Life»: виден сразу, потом прорастает пушистая трава и распускаются полевые цветы
      tex: 'img/tex-izgorod.webp', outline: 'rgba(31,61,41,.4)', shadow: 'rgba(31,61,41,.35)', padTop: 0.36, padBottom: 0.2,
      revealDur: 0, instant: true,
      build(C) {
        const { A, fs, rand } = C;
        const decor = [];
        const cues = [{ at: 0.1, type: 'wind', dur: 4.5 }, { at: 0.5, type: 'rustle', dur: 2.8, tone: 3200, vol: 0.045 }];
        // пушистая трава: задний тёмный и передний светлый слой, часть травинок с метёлками; качается волной ветра
        const grass = [];
        const addBlade = (x, y, layer) => grass.push({
          x, y, layer, len: fs * (layer ? 0.045 + rand() * 0.085 : 0.07 + rand() * 0.11), w: fs * (0.0035 + rand() * 0.006),
          col: layer ? pick(['#6f9a62', '#8db36b', '#9dbf8a', '#b5cf8f'], rand) : pick(['#2f5d3a', '#3d6b3c', '#4c7a4f'], rand),
          ph: rand() * TAU, seed: rand() < 0.12, t0: 0.5 + (x / A.w) * 1.8 + rand() * 0.4,
        });
        topPoints(A, Math.max(1.5, fs * 0.014)).forEach((p) => {
          addBlade(p.x, p.y + fs * 0.028, 0);
          if (rand() < 0.85) addBlade(p.x + (rand() - 0.5) * fs * 0.012, p.y + fs * 0.034, 1);
        });
        const gy = C.baseY + fs * 0.035;
        for (let x = C.x0 - fs * 0.08; x < C.x0 + C.tw + fs * 0.08; x += fs * 0.011) { addBlade(x, gy, 0); addBlade(x + fs * 0.005, gy + fs * 0.012, 1); }
        decor.push({ t0: 0, d: 0.01, draw(g, k, t) {
          for (let L = 0; L < 2; L++) {
            for (const b of grass) {
              if (b.layer !== L) continue;
              const kk = clamp01((t - b.t0) / 1.5);
              if (kk <= 0) continue;
              const len = b.len * easeOut(kk);
              const lean = (Math.sin(t * 1.25 - b.x * 0.011) * 0.65 + Math.sin(t * 2.4 + b.ph) * 0.35) * len * 0.24 + (b.ph - Math.PI) * len * 0.05;
              blade(g, b.x, b.y, len, lean, b.w, b.col);
              if (b.seed && kk > 0.85) { // пушистая метёлка
                const tx = b.x + lean, ty = b.y - len;
                g.fillStyle = 'rgba(220,228,176,.85)';
                for (let s = 0; s < 5; s++) { g.beginPath(); g.ellipse(tx + (s - 2) * fs * 0.004, ty - s * fs * 0.006, fs * 0.006, fs * 0.012, (s - 2) * 0.3, 0, TAU); g.fill(); }
              }
            }
          }
        } });
        // полевые цветы распускаются по одному, медленно
        const notes = [784, 880, 988, 1175, 1319];
        const spots = interiorPoints(A, fs * 0.2, rand, 0.45).filter((p) => p.y < C.baseY - fs * 0.15);
        const n = Math.min(spots.length, Math.round(C.tw / (fs * 0.15)));
        spots.sort(() => rand() - 0.5).slice(0, n).forEach((p, i) => {
          const kind = i % 4, r = fs * (0.058 + rand() * 0.035), ph = rand() * TAU, t0 = 2.6 + i * 0.24 + rand() * 0.2;
          if (i < 12) cues.push({ at: t0 + 0.35, type: 'chime', note: notes[i % notes.length], vol: 0.022 });
          decor.push({ t0, d: 1.7, draw(g, k, t) {
            g.save();
            g.translate(p.x, p.y + Math.sin(t * 1.2 + ph) * fs * 0.004);
            g.rotate(Math.sin(t * 0.9 + ph) * 0.06);
            if (kind === 0) daisy(g, r, k);
            else if (kind === 1) clover(g, r, k, rng(i + 3));
            else if (kind === 2) flower(g, r * 0.85, 5, '#f6d36a', '#e0a22e', k, 0.8);
            else flower(g, r * 0.7, 5, '#a9c4ef', '#f6e08a', k, 0.85);
            g.restore();
          } });
        });
        return { pieces: [], decor, cues, intro: 2.6 + n * 0.24 + 2, idle: true };
      },
    },

    roses: { // буквы — бархатные и читаемые, крупные розы распускаются из-за букв
      fill: ['#7d1f2e', '#a8283c'], outline: 'rgba(80,12,28,.55)', shadow: 'rgba(90,15,30,.3)', padX: 0.42, padTop: 0.46, padBottom: 0.22, revealDur: 0.9, masked: true,
      build(C) {
        const { A, fs, rand } = C;
        const velvet = ['#7d1f2e', '#8e1b2f', '#9b2335', '#a8283c', '#b2324a'];
        const pieces = interiorPoints(A, fs * 0.05, rand).map((p) => {
          const a = rand() * TAU, len = fs * (0.045 + rand() * 0.035), c1 = pick(velvet, rand), c2 = pick(velvet, rand);
          return { t0: 0.1 + (1 - p.y / A.h) * 0.7 + rand() * 0.3, d: 0.5, draw(g, k) { const s = easeBack(k); g.save(); g.translate(p.x, p.y); g.rotate(a); g.scale(s, s); petal(g, len, len * 0.5, c1, c2); g.restore(); } };
        });
        // места, откуда розы выглядывают: края слова, просветы между буквами сверху, низ
        const bx = A.boxes.filter((b) => b.ch.trim());
        const spots = [{ x: C.x0 - fs * 0.1, y: C.baseY - fs * 0.36, r: 0.27 }, { x: C.x0 + C.tw + fs * 0.08, y: C.baseY - fs * 0.5, r: 0.25 }];
        for (let i = 0; i < bx.length - 1; i += 2) spots.push({ x: bx[i].x + bx[i].w, y: Math.min(bx[i].top, bx[i + 1].top) + fs * 0.03, r: 0.2 });
        spots.push({ x: C.x0 + C.tw * 0.58, y: C.baseY + fs * 0.03, r: 0.16 });
        const sets = [['#f37c6a', '#ffcaa3', '#fbe1cf', '#e8664f'], ['#e07a8a', '#f2a7a3', '#fbd9d6', '#c9566a'], ['#f2c4c8', '#fbe4e4', '#fff3f0', '#e3a1aa']];
        const decor = [];
        const cues = [{ at: 0.2, type: 'rustle', dur: 1.6, tone: 2300, vol: 0.06 }];
        const notes = [523, 587, 659, 784, 880, 988];
        spots.forEach((sp, i) => {
          const r = fs * sp.r * (0.92 + rand() * 0.16), rp = sets[i % sets.length], ph = rand() * TAU, t0 = 1.0 + i * 0.34;
          const lv = [0, 1, 2].map(() => ({ a: rand() * TAU, len: r * (1.1 + rand() * 0.4) }));
          cues.push({ at: t0 + 0.45, type: 'bloom', note: notes[i % notes.length], vol: 0.04 });
          decor.push({ behind: true, t0, d: 2.1, draw(g, k, t) {
            g.save(); g.translate(sp.x, sp.y); g.rotate(Math.sin(t * 0.7 + ph) * 0.04);
            const lk = easeBack(clamp01(k * 1.5));
            lv.forEach((l) => { g.save(); g.rotate(l.a); g.scale(lk, lk); leaf(g, l.len, l.len * 0.36, '#4c7a4f', '#2f5d3a', 'rgba(255,255,255,.3)'); g.restore(); });
            rose(g, r, k, rp); g.restore();
          } });
        });
        for (let i = 0; i < 3; i++) { // пара лепестков медленно опадает
          const x0 = C.x0 + rand() * C.tw, len = fs * 0.06, col = pick(['#f2a7a3', '#ffcaa3', '#e07a8a'], rand), sp = 7 + rand() * 4, off = rand() * sp;
          decor.push({ t0: 3.4, d: 0.5, draw(g, k, t) {
            const q = ((t + off) % sp) / sp, y = C.padTopPx * 0.6 + q * (A.h + fs * 0.2), x = x0 + Math.sin(q * 6 + i) * fs * 0.12;
            g.save(); g.globalAlpha = k * Math.sin(q * Math.PI) * 0.9; g.translate(x, y); g.rotate(q * 7 + i); petal(g, len, len * 0.5, col, '#fbe1cf'); g.restore();
          } });
        }
        return { pieces, decor, cues, intro: 1.0 + spots.length * 0.34 + 2.3, idle: true };
      },
    },

    lilac: { // буквы из цветков сирени; крупные кисти выглядывают из-за букв — в начале, в конце и посередине
      fill: ['#5f4589', '#8a6cb8'], outline: 'rgba(60,40,90,.45)', shadow: 'rgba(60,40,90,.28)', padX: 0.46, padTop: 0.62, padBottom: 0.16, revealDur: 0.8,
      build(C) {
        const { A, fs, rand } = C;
        const lil = ['#6c4f98', '#7a5aa6', '#9b7fc4', '#b9a3dc', '#d8c8ee', '#e6dcf3'];
        const hyd = ['#f3d6d8', '#fbeee6', '#e8b8bf'];
        const pieces = interiorPoints(A, fs * 0.05, rand).map((p) => {
          const r = fs * (0.022 + rand() * 0.018), col = rand() < 0.16 ? pick(hyd, rand) : pick(lil, rand), rot = rand() * TAU, cc = rand() < 0.5 ? '#f6e7a8' : '#ffffff';
          return { t0: 0.1 + (1 - p.y / A.h) * 1.0 + rand() * 0.6, d: 0.7, draw(g, k) { g.save(); g.translate(p.x, p.y); g.rotate(rot); flower(g, r, 4, col, cc, k, 1.1); g.restore(); } };
        });
        const bx = A.boxes.filter((b) => b.ch.trim());
        const mid = bx[Math.floor(bx.length / 2)];
        const pans = [
          { x: C.x0 - fs * 0.05, y: C.baseY + fs * 0.06, h: 1.0, lean: -0.34 },
          { x: C.x0 + C.tw + fs * 0.04, y: C.baseY + fs * 0.06, h: 1.04, lean: 0.32 },
          { x: mid.x + mid.w * 0.5, y: mid.top + fs * 0.3, h: 0.72, lean: 0.05 },
        ];
        const decor = [];
        const cues = [{ at: 0.2, type: 'rustle', dur: 1.8, tone: 3400, vol: 0.05 }];
        pans.forEach((pn, i) => {
          const h = fs * pn.h * 1.12, w = h * 0.58, ph = rand() * TAU, t0 = 1.1 + i * 0.45;
          const fl = [];
          for (let j = 0; j < 130; j++) {
            const ty = 0.18 + rand() * 0.82, half = (1 - ty) * w * 0.5 + w * 0.06;
            fl.push({ x: (rand() * 2 - 1) * half, y: -ty * h, r: fs * (0.026 + rand() * 0.016), c: rand() < 0.12 ? pick(hyd, rand) : pick(lil, rand), at: (ty - 0.18) / 0.82 });
          }
          fl.sort((a, b2) => a.at - b2.at);
          cues.push({ at: t0 + 0.5, type: 'bloom', note: [784, 988, 880][i], vol: 0.032 });
          decor.push({ behind: true, t0, d: 2.3, draw(g, k, t) {
            g.save(); g.translate(pn.x, pn.y); g.rotate(pn.lean + Math.sin(t * 0.8 + ph) * 0.035);
            const sk = easeOut(clamp01(k * 2));
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -h * 0.25 * sk); g.strokeStyle = '#5b4a3d'; g.lineWidth = Math.max(1, fs * 0.01); g.stroke();
            const lk = easeBack(clamp01(k * 1.8));
            [-0.75, Math.PI + 0.75].forEach((a) => { g.save(); g.translate(0, -h * 0.12); g.rotate(a); g.scale(lk, lk); leaf(g, fs * 0.2, fs * 0.11, '#4c7a4f', '#2f5d3a', 'rgba(255,255,255,.3)'); g.restore(); });
            fl.forEach((f) => { const kk = clamp01((k - f.at * 0.55) / 0.45); if (kk > 0) { g.save(); g.translate(f.x, f.y); flower(g, f.r, 4, f.c, '#f6e7a8', kk, 1.1); g.restore(); } });
            g.restore();
          } });
        });
        return { pieces, decor, cues, intro: 1.1 + 3 * 0.45 + 2.5, idle: true };
      },
    },

    conifers: {
      tex: 'img/tex-tuya.webp', outline: 'rgba(20,50,25,.5)', shadow: 'rgba(20,50,25,.35)', padTop: 0.3, padBottom: 0.1, revealDur: 1.6,
      build(C) {
        const { A, fs, rand } = C;
        const decor = [];
        edgePoints(A, fs * 0.075, rand).forEach((p) => {
          if (p.ny > 0.2 || rand() > 0.5) return; // веточки торчат вверх и в стороны
          const a = Math.atan2(p.ny, p.nx) + (rand() - 0.5) * 0.6, len = fs * (0.07 + rand() * 0.06), c1 = pick(['#2f5d3a', '#3d6b3c', '#4c7a4f'], rand), c2 = pick(['#6f9a62', '#8db36b', '#5f8f4f'], rand), ph = rand() * TAU;
          decor.push({ t0: 0.8 + (1 - p.y / A.h) * 0.8 + rand() * 0.5, d: 0.8, draw(g, k, t) {
            const s = easeBack(k); g.save(); g.translate(p.x, p.y); g.rotate(a + Math.sin(t * 0.7 + ph) * 0.03); g.scale(s, s); thujaSpray(g, len, c1, c2); g.restore();
          } });
        });
        return { pieces: [], decor, intro: 3.2, idle: true };
      },
    },

    trees: {
      fill: ['#5e8f47', '#8db36b'], outline: 'rgba(40,70,35,.45)', shadow: 'rgba(40,70,35,.28)', padTop: 0.55, padBottom: 0.12, revealDur: 0.8,
      build(C) {
        const { A, fs, rand } = C;
        const pal = ['#5e8f47', '#6f9a62', '#8db36b', '#a8c97f', '#b9d18a', '#c9d97a'];
        const pieces = interiorPoints(A, fs * 0.058, rand).map((p) => {
          const len = fs * (0.055 + rand() * 0.035), a = rand() * TAU, c1 = rand() < 0.07 ? '#d6cd62' : pick(pal, rand);
          return { t0: 0.1 + (1 - p.y / A.h) * 1.1 + rand() * 0.5, d: 0.6, draw(g, k) { const s = easeBack(k); g.save(); g.translate(p.x, p.y); g.rotate(a); g.scale(s, s); birchLeaf(g, len, c1, 'rgba(40,70,35,.45)'); g.restore(); } };
        });
        // сверху — берёзовая ветка, с неё плакучими прядями свисают веточки поверх букв и качаются
        const decor = [];
        const bx0 = C.x0 - fs * 0.25, bx1 = C.x0 + C.tw + fs * 0.15, by = fs * 0.06;
        const branchY = (x) => by + Math.sin(((x - bx0) / (bx1 - bx0)) * Math.PI) * fs * 0.07 + ((x - bx0) / (bx1 - bx0)) * fs * 0.04;
        decor.push({ t0: 0.2, d: 1.2, draw(g, k) {
          const xe = bx0 + (bx1 - bx0) * easeOut(k);
          g.beginPath();
          for (let x = bx0; x <= xe; x += 6) { const y = branchY(x); x === bx0 ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.strokeStyle = '#4e4036'; g.lineWidth = Math.max(1.5, fs * 0.022); g.lineCap = 'round'; g.stroke();
          // белая береста с чёрными штрихами
          g.strokeStyle = 'rgba(242,239,233,.85)'; g.lineWidth = Math.max(1, fs * 0.012); g.stroke();
          for (let x = bx0 + fs * 0.1; x < xe; x += fs * 0.13) { const y = branchY(x); g.beginPath(); g.moveTo(x - fs * 0.012, y - fs * 0.006); g.lineTo(x + fs * 0.012, y + fs * 0.004); g.strokeStyle = '#2b2726'; g.lineWidth = Math.max(1, fs * 0.006); g.stroke(); }
        } });
        const nT = Math.max(5, Math.round(C.tw / (fs * 0.36)));
        for (let i = 0; i < nT; i++) {
          const ax = C.x0 + (i + 0.2 + rand() * 0.6) * (C.tw / nT), ay = branchY(ax), L = fs * (0.75 + rand() * 0.55), out = (rand() - 0.5) * fs * 0.22, ph = rand() * TAU;
          const pts = [];
          for (let j = 0; j <= 28; j++) { const t = j / 28; pts.push({ x: out * Math.sin(t * Math.PI * 0.9), y: L * Math.pow(t, 1.15) }); }
          const lv = [];
          for (let j = 2; j <= 28; j++) if (rand() < 0.8) lv.push({ j, side: j % 2 ? 1 : -1, len: fs * (0.055 + rand() * 0.035), c: rand() < 0.08 ? '#d6cd62' : pick(pal, rand) });
          const cat = rand() < 0.6;
          decor.push({ t0: 0.9 + i * 0.1, d: 1.7, draw(g, k, t) {
            g.save(); g.translate(ax, ay); g.rotate(Math.sin(t * 0.7 + ph) * 0.06 + Math.sin(t * 1.8 + ph) * 0.014);
            const n = Math.max(1, Math.round(28 * easeOut(k)));
            g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let j = 1; j <= n; j++) g.lineTo(pts[j].x, pts[j].y);
            g.strokeStyle = '#5b4a3d'; g.lineWidth = Math.max(0.9, fs * 0.006); g.lineCap = 'round'; g.stroke();
            lv.forEach((l) => { if (l.j > n) return; const p = pts[l.j]; g.save(); g.translate(p.x, p.y); g.rotate(Math.PI / 2 + l.side * 0.85 + Math.sin(t * 1.3 + l.j) * 0.1); const sc = clamp01((n - l.j) / 3); g.scale(sc, sc); birchLeaf(g, l.len, l.c, 'rgba(40,70,35,.45)'); g.restore(); });
            if (cat && n >= 28) { const p = pts[28]; g.fillStyle = '#a8975e'; g.beginPath(); g.ellipse(p.x, p.y + fs * 0.05, fs * 0.014, fs * 0.06, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(80,60,30,.35)'; for (let q = 0; q < 5; q++) { g.fillRect(p.x - fs * 0.012, p.y + fs * (0.01 + q * 0.02), fs * 0.024, fs * 0.004); } }
            g.restore();
          } });
        }
        return { pieces, decor, intro: 3.6, idle: true };
      },
    },

    orchard: {
      fill: ['#3f6e43', '#6f9a62'], outline: 'rgba(30,60,35,.45)', shadow: 'rgba(30,60,35,.28)', padTop: 0.34, padBottom: 0.14, revealDur: 0.8,
      build(C) {
        const { A, fs, rand } = C;
        const greens = ['#4c7a4f', '#6f9a62', '#8db36b', '#5e8f47'];
        const pieces = [];
        interiorPoints(A, fs * 0.06, rand).forEach((p) => {
          const blossom = rand() < 0.3, a = rand() * TAU;
          if (blossom) {
            const r = fs * (0.03 + rand() * 0.02), col = rand() < 0.5 ? '#fcf0ef' : '#f2c4c8';
            pieces.push({ t0: 1.3 + rand() * 1.2, d: 0.9, draw(g, k) { g.save(); g.translate(p.x, p.y); g.rotate(a); flower(g, r, 5, col, '#e6b04a', k, 0.95); g.restore(); } });
          } else {
            const len = fs * (0.06 + rand() * 0.04), c1 = pick(greens, rand), c2 = pick(greens, rand);
            pieces.push({ t0: 0.1 + (1 - p.y / A.h) * 1 + rand() * 0.4, d: 0.6, draw(g, k) { const s = easeBack(k); g.save(); g.translate(p.x, p.y); g.rotate(a); g.scale(s, s); leaf(g, len, len * 0.36, c1, c2, 'rgba(255,255,255,.3)'); g.restore(); } });
          }
        });
        const decor = [];
        A.boxes.filter((b) => b.ch.trim()).forEach((b, i) => {
          const x = b.x + b.w * (0.3 + rand() * 0.4), y = b.top + fs * (0.12 + rand() * 0.3), r = fs * (0.065 + rand() * 0.02), ph = rand() * TAU;
          decor.push({ t0: 2.4 + i * 0.3, d: 0.9, draw(g, k, t) { g.save(); g.translate(x, y); g.rotate(Math.sin(t * 0.9 + ph) * 0.05); apple(g, r, k); g.restore(); } });
        });
        for (let i = 0; i < 3; i++) {
          const x0 = C.x0 + rand() * C.tw, len = fs * 0.04, sp = 8 + rand() * 4, off = rand() * sp;
          decor.push({ t0: 3.4, d: 0.5, draw(g, k, t) {
            const q = ((t + off) % sp) / sp, y = q * (A.h + fs * 0.2), x = x0 + Math.sin(q * 5 + i) * fs * 0.14;
            g.save(); g.globalAlpha = k * Math.sin(q * Math.PI) * 0.9; g.translate(x, y); g.rotate(q * 6 + i); leaf(g, len, len * 0.55, '#fcf0ef', null, null); g.restore();
          } });
        }
        return { pieces, decor, intro: 4, idle: true };
      },
    },

    tulips: { // на буквах — редкие лепесточки, в начале и в конце распускаются огромные тюльпаны-кувшины
      fill: ['#3f7a4c', '#6fa76a'], outline: 'rgba(30,70,40,.5)', shadow: 'rgba(40,80,45,.28)', padX: 0.62, padTop: 0.86, padBottom: 0.2, revealDur: 0.8,
      build(C) {
        const { A, fs, rand } = C;
        const cups = [['#f37c6a', '#d95f52'], ['#d2473f', '#a8322c'], ['#f2c14e', '#d9a23a'], ['#f1b6c1', '#e08a9c'], ['#fff1e6', '#f1c9b8']];
        const pieces = interiorPoints(A, fs * 0.17, rand).filter(() => rand() < 0.5).map((p) => {
          const c = pick(cups, rand), len = fs * (0.03 + rand() * 0.016), a = rand() * TAU;
          return { t0: 1.0 + rand() * 1.4, d: 0.5, draw(g, k) { const s = easeBack(k); g.save(); g.translate(p.x, p.y); g.rotate(a); g.scale(s, s); petal(g, len, len * 0.5, c[0], c[1]); g.restore(); } };
        });
        const groups = [
          { x: C.x0 - fs * 0.24, dir: -1, big: true }, { x: C.x0 - fs * 0.46, dir: -1 },
          { x: C.x0 + C.tw + fs * 0.22, dir: 1, big: true }, { x: C.x0 + C.tw + fs * 0.45, dir: 1 },
        ];
        const decor = [];
        const cues = [{ at: 0.2, type: 'rustle', dur: 1.4, tone: 2600, vol: 0.05 }];
        groups.forEach((gp, i) => {
          const L = fs * (gp.big ? 1.08 : 0.8), ch = fs * (gp.big ? 0.56 : 0.4), c = cups[[0, 3, 1, 2][i]], lean = gp.dir * (0.06 + rand() * 0.07), ph = rand() * TAU, t0 = 1.0 + i * 0.36, by = C.baseY + fs * 0.14;
          cues.push({ at: t0 + 1.0, type: 'bloom', note: [440, 523, 494, 587][i], vol: 0.04 });
          decor.push({ behind: true, t0, d: 2.3, draw(g, k, t) {
            g.save(); g.translate(gp.x, by); g.rotate(lean + Math.sin(t * 0.8 + ph) * 0.035);
            const sk = easeOut(clamp01(k * 1.5));
            g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(gp.dir * fs * 0.02, -L * 0.5 * sk, 0, -L * sk);
            g.strokeStyle = '#5f8f5a'; g.lineWidth = Math.max(1.5, fs * 0.018); g.lineCap = 'round'; g.stroke();
            const lk = easeBack(clamp01(k * 1.8 - 0.1));
            g.save(); g.rotate(-1.15); g.scale(lk, lk); leaf(g, L * 0.62, fs * 0.06, '#6f9a7a', '#4f7a5f', 'rgba(255,255,255,.25)'); g.restore();
            g.save(); g.rotate(Math.PI + 1.15); g.scale(lk * 0.85, lk * 0.85); leaf(g, L * 0.5, fs * 0.05, '#7fae89', '#5f8f6a', 'rgba(255,255,255,.25)'); g.restore();
            if (k > 0.4) { g.save(); g.translate(0, -L * sk); const ck = clamp01((k - 0.4) / 0.6); const s = easeBack(ck); g.scale(s, s); tulipCup(g, ch, c, ck); g.restore(); }
            g.restore();
          } });
        });
        return { pieces, decor, cues, intro: 1.0 + 4 * 0.36 + 2.5, idle: true };
      },
    },

    lawn: { // буквы чистые, светлые; под словом раскатывается рулон идеально подстриженного газона
      fill: ['#ece5d6', '#fffdf8'], outline: 'rgba(31,61,41,.5)', shadow: 'rgba(15,40,20,.6)', padX: 0.36, padTop: 0.42, padBottom: 0.36, revealDur: 0.7, revealDelay: 1.45,
      build(C) {
        const { A, fs, rand } = C;
        const px0 = C.x0 - fs * 0.28, px1 = C.x0 + C.tw + fs * 0.28, py0 = C.padTopPx * 0.5, py1 = C.baseY + fs * 0.26;
        const pw = px1 - px0, ph = py1 - py0, rr = fs * 0.14;
        // газон рисуется один раз в отдельный слой
        const turf = document.createElement('canvas');
        turf.width = Math.ceil(pw * C.dpr); turf.height = Math.ceil(ph * C.dpr);
        const tg = turf.getContext('2d', CTX);
        tg.scale(C.dpr, C.dpr);
        tg.beginPath(); tg.roundRect(0, 0, pw, ph, rr); tg.clip();
        tg.fillStyle = '#5c8c4c'; tg.fillRect(0, 0, pw, ph);
        const sw = fs * 0.32; // полосы от газонокосилки
        for (let x = -ph; x < pw + ph; x += sw * 2) {
          tg.beginPath(); tg.moveTo(x, 0); tg.lineTo(x + sw, 0); tg.lineTo(x + sw - ph * 0.35, ph); tg.lineTo(x - ph * 0.35, ph); tg.closePath();
          tg.fillStyle = 'rgba(196,226,146,.2)'; tg.fill();
        }
        const r2 = rng(99);
        for (let i = 0; i < (pw * ph) / 14; i++) { tg.fillStyle = r2() < 0.5 ? 'rgba(25,60,25,.2)' : 'rgba(215,238,165,.17)'; tg.fillRect(r2() * pw, r2() * ph, 1, 2 + r2() * 2.5); }
        const sh = tg.createLinearGradient(0, 0, 0, ph); sh.addColorStop(0, 'rgba(255,255,255,.1)'); sh.addColorStop(1, 'rgba(0,0,0,.2)');
        tg.fillStyle = sh; tg.fillRect(0, 0, pw, ph);
        const decor = [];
        decor.push({ behind: true, t0: 0.1, d: 1.4, draw(g, k) {
          const e = easeOut(k), rx = px0 + pw * e;
          g.save(); g.fillStyle = 'rgba(40,60,30,.16)'; g.beginPath(); g.roundRect(px0 + fs * 0.02, py0 + fs * 0.05, Math.max(1, rx - px0), ph, rr); g.fill(); g.restore();
          g.save(); g.beginPath(); g.rect(px0, py0 - fs * 0.05, rx - px0, ph + fs * 0.1); g.clip(); g.drawImage(turf, px0, py0, pw, ph); g.restore();
          if (k < 1) { // рулон дёрна катится вправо
            const rw = fs * 0.14 * (1 - e * 0.45);
            const gr = g.createLinearGradient(rx - rw / 2, 0, rx + rw / 2, 0);
            gr.addColorStop(0, '#3d6b3c'); gr.addColorStop(0.45, '#9dbf8a'); gr.addColorStop(1, '#2f5d3a');
            g.fillStyle = gr; g.beginPath(); g.roundRect(rx - rw / 2, py0 - fs * 0.03, rw, ph + fs * 0.06, rw / 2); g.fill();
            g.strokeStyle = 'rgba(90,62,35,.45)'; g.lineWidth = Math.max(1, fs * 0.006);
            g.beginPath(); g.moveTo(rx + rw * 0.15, py0 + fs * 0.02); g.lineTo(rx + rw * 0.15, py0 + ph - fs * 0.02); g.stroke();
          }
        } });
        const edge = []; // ровная подстриженная кромка
        for (let x = px0 + rr; x < px1 - rr; x += fs * 0.011) edge.push({ x, h: fs * (0.022 + rand() * 0.01), ph: rand() * TAU, c: pick(['#4c7a4f', '#6f9a62', '#8db36b'], rand) });
        decor.push({ behind: true, t0: 1.45, d: 0.6, draw(g, k, t) { for (const b of edge) blade(g, b.x, py0 + fs * 0.014, b.h * k, Math.sin(t * 1.6 - b.x * 0.02 + b.ph * 0.2) * fs * 0.006, fs * 0.004, b.c); } });
        const dew = [];
        for (let i = 0; i < 10; i++) dew.push({ x: px0 + fs * 0.1 + rand() * (pw - fs * 0.2), y: py0 + ph * (0.15 + rand() * 0.75), ph: rand() * TAU });
        decor.push({ behind: true, t0: 2.4, d: 0.5, draw(g, k, t) {
          for (const d of dew) { const a = k * Math.max(0, Math.sin(t * 1.6 + d.ph)); if (a < 0.05) continue; g.fillStyle = `rgba(255,255,255,${0.8 * a})`; g.beginPath(); g.arc(d.x, d.y, fs * 0.008, 0, TAU); g.fill(); }
        } });
        return { pieces: [], decor, cues: [{ at: 0.1, type: 'unroll', dur: 1.4 }, { at: 1.5, type: 'rustle', dur: 1.2, tone: 2800, vol: 0.045 }, { at: 2.2, type: 'chime', note: 1047, vol: 0.02 }], intro: 2.7, idle: true };
      },
    },

    stone: { // «проект»: чертёж букв карандашом → буквы наполняются природным камнем → дорожка, самшит, фонари
      fill: ['#a39583', '#e4dccd'], outline: 'rgba(70,60,50,.5)', shadow: 'rgba(40,36,34,.22)', padX: 0.44, padTop: 0.34, padBottom: 0.44, revealDur: 1.0, revealDelay: 1.4, grain: true,
      build(C) {
        const { A, fs, rand } = C;
        const decor = [];
        const capY = C.baseY - fs * 0.72;
        decor.push({ t0: 0, d: 1.2, draw(g, k, t) { // направляющие чертежа
          const fade = 1 - clamp01((t - 3.4) / 1.0) * 0.85;
          g.save(); g.globalAlpha = 0.55 * fade; g.strokeStyle = '#7a8c78'; g.lineWidth = 1; g.setLineDash([fs * 0.03, fs * 0.025]);
          const xa = C.x0 - fs * 0.22, xb = xa + (C.tw + fs * 0.44) * easeOut(k);
          [C.baseY, capY].forEach((y) => { g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke(); });
          g.setLineDash([]);
          if (k > 0.6) [C.x0, C.x0 + C.tw].forEach((x) => { g.beginPath(); g.moveTo(x, capY - fs * 0.08); g.lineTo(x, C.baseY + fs * 0.08); g.stroke(); });
          g.restore();
        } });
        decor.push({ t0: 0.2, d: 1.8, draw(g, k, t) { // контур букв рисуется карандашом и остаётся тонкой гранью
          g.save(); g.font = C.font; g.textBaseline = 'alphabetic';
          const L = fs * 14; g.setLineDash([L, L]); g.lineDashOffset = L * (1 - easeOut(k));
          g.strokeStyle = `rgba(68,63,62,${0.8 - clamp01((t - 2.6) / 1) * 0.5})`; g.lineWidth = Math.max(1, fs * 0.01);
          g.strokeText(C.word, C.x0, C.baseY); g.restore();
        } });
        const pebbles = [];
        for (let x = C.x0 - fs * 0.32; x < C.x0 + C.tw + fs * 0.32; x += fs * 0.034) pebbles.push({ x: x + (rand() - 0.5) * fs * 0.02, y: C.baseY + fs * (0.12 + rand() * 0.06), rx: fs * (0.014 + rand() * 0.01), ry: fs * (0.009 + rand() * 0.006), c: pick(['#cfc6b8', '#bdb2a2', '#ddd5c8', '#a89d8d'], rand) });
        decor.push({ t0: 2.0, d: 1.4, draw(g, k) {
          const xe = C.x0 - fs * 0.32 + (C.tw + fs * 0.64) * easeOut(k);
          for (const p of pebbles) { if (p.x > xe) continue; g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); g.fill(); }
        } });
        [{ x: C.x0 - fs * 0.22, r: 0.2 }, { x: C.x0 - fs * 0.05, r: 0.11 }, { x: C.x0 + C.tw + fs * 0.22, r: 0.2 }, { x: C.x0 + C.tw + fs * 0.05, r: 0.11 }].forEach((b, i) => {
          const r = fs * b.r, y = C.baseY + fs * 0.12 - r;
          decor.push({ t0: 2.6 + i * 0.15, d: 0.8, draw(g, k) {
            const s = easeBack(k, 2); g.save(); g.translate(b.x, y); g.scale(s, s);
            const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
            gr.addColorStop(0, '#8db36b'); gr.addColorStop(0.6, '#4c7a4f'); gr.addColorStop(1, '#2f5d3a');
            g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,.12)';
            for (let q = 0; q < 14; q++) { const a = q * 2.4, d = r * 0.75 * Math.sqrt((q + 1) / 14); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.12, 0, TAU); g.fill(); }
            g.restore();
          } });
        });
        [C.x0 - fs * 0.38, C.x0 + C.tw + fs * 0.38].forEach((x, i) => { // садовые фонари
          const h = fs * 0.8, y0 = C.baseY + fs * 0.12;
          decor.push({ t0: 3.0 + i * 0.2, d: 0.6, draw(g, k, t) {
            const s = easeOut(k); g.save(); g.translate(x, y0);
            g.fillStyle = '#3b3533'; g.fillRect(-fs * 0.008, -h * s, fs * 0.016, h * s);
            if (k > 0.6) {
              const on = clamp01((t - (3.5 + i * 0.2)) / 0.3), fl = 0.85 + 0.15 * Math.sin(t * 2.2 + i);
              g.save(); g.globalCompositeOperation = 'lighter'; glow(g, 0, -h, fs * 0.22, on * fl * 0.9); g.restore();
              g.fillStyle = '#3b3533'; g.fillRect(-fs * 0.03, -h - fs * 0.075, fs * 0.06, fs * 0.014);
              g.fillStyle = on > 0.1 ? `rgba(255,220,160,${0.5 + 0.5 * on})` : '#d8d0c4'; g.fillRect(-fs * 0.022, -h - fs * 0.062, fs * 0.044, fs * 0.052);
            }
            g.restore();
          } });
        });
        return { pieces: [], decor, cues: [{ at: 0.2, type: 'draw', dur: 1.8 }, { at: 2.0, type: 'gravel', dur: 1.3 }, { at: 2.6, type: 'tap' }, { at: 2.75, type: 'tap' }, { at: 2.9, type: 'tap' }, { at: 3.05, type: 'tap' }, { at: 3.5, type: 'chime', note: 784, vol: 0.04 }, { at: 3.7, type: 'chime', note: 988, vol: 0.035 }], intro: 4.5, idle: true };
      },
    },

    light: { // деревянные буквы, на них висит гирлянда — лампочки загораются по очереди
      wood: true, outline: 'rgba(30,18,10,.7)', shadow: 'rgba(0,0,0,.45)', padTop: 0.42, padBottom: 0.14, revealDur: 0.9, dark: true,
      build(C) {
        const { A, fs, rand } = C;
        // опорные точки провода — верхушки букв
        const anchors = A.boxes.filter((b) => b.ch.trim()).map((b) => ({ x: b.topX, y: b.top - fs * 0.06 }));
        if (anchors.length) {
          anchors.unshift({ x: anchors[0].x - fs * 0.25, y: anchors[0].y - fs * 0.05 });
          anchors.push({ x: anchors[anchors.length - 1].x + fs * 0.25, y: anchors[anchors.length - 1].y - fs * 0.05 });
        }
        const path = [];
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i], b = anchors[i + 1], sag = fs * 0.14;
          for (let j = 0; j < 16; j++) {
            const t = j / 16;
            path.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag });
          }
        }
        if (anchors.length) path.push(anchors[anchors.length - 1]);
        // лампочки вдоль провода по длине
        const bulbs = [];
        let acc = 0, next = fs * 0.12;
        for (let i = 1; i < path.length; i++) {
          acc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
          if (acc >= next) { bulbs.push({ x: path[i].x, y: path[i].y, ph: rand() * TAU, i: bulbs.length }); next += fs * 0.24; }
        }
        const r = fs * 0.064;
        const onAt = (b) => 2.0 + b.i * 0.11;
        const decor = [{
          t0: 0.9, d: 0.9, draw(g, k, t) {
            const n = Math.max(1, Math.round((path.length - 1) * easeOut(k)));
            g.beginPath(); g.moveTo(path[0].x, path[0].y); for (let j = 1; j <= n; j++) g.lineTo(path[j].x, path[j].y);
            g.strokeStyle = '#2f3a30'; g.lineWidth = Math.max(1, fs * 0.01); g.stroke();
            // свет на буквах и вокруг
            g.save(); g.globalCompositeOperation = 'lighter';
            bulbs.forEach((b) => { const on = clamp01((t - onAt(b)) / 0.18); if (on > 0) glow(g, b.x, b.y + r * 0.9, fs * 0.3, on * 0.62 * (0.8 + 0.2 * Math.sin(t * 2.3 + b.ph))); });
            g.restore();
            bulbs.forEach((b) => {
              if (b.x > path[n].x + 1) return;
              const on = clamp01((t - onAt(b)) / 0.18), flash = on > 0 && on < 1 ? 1.25 : 1;
              const fl = 0.82 + 0.18 * Math.sin(t * 2.3 + b.ph) + (Math.sin(t * 13 + b.ph * 3) > 0.97 ? -0.25 : 0);
              g.save(); g.translate(b.x, b.y); bulb(g, r, on, fl * flash); g.restore();
            });
          },
        }];
        return { pieces: [], decor, intro: 2.0 + bulbs.length * 0.11 + 0.6, idle: true, warm: { at: 2.0, d: bulbs.length * 0.11 + 0.4 } };
      },
    },
  };

  /* ---------------- монтирование ---------------- */

  // Рисунок на холсте считает видеокарта, и на слабой она не успевает за прокруткой: страница начинает дёргаться.
  // Пока страница едет, рисуем реже. Рост идёт по часам, поэтому ничего не теряется и не замедляется.
  let lastScroll = -1e4;
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  const SCROLL_GAP = 45;

  // Кегль и высота названия по ширине блока.
  function fit(word, theme, W, maxPx) {
    const font = '700 100px Oswald';
    const meas = document.createElement('canvas').getContext('2d', CTX);
    meas.font = font;
    const m100 = meas.measureText(word);
    const padX = theme.padX || 0;
    const fs = Math.min(maxPx, (W * 0.97 * 100) / (m100.width + 2 * padX * 100));
    const f = `700 ${fs.toFixed(1)}px Oswald`;
    meas.font = f;
    const m = meas.measureText(word);
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
    const padTopPx = fs * theme.padTop, padBottomPx = fs * theme.padBottom;
    const baseY = padTopPx + asc;
    return { fs, f, padX, padTopPx, baseY, tw: m.width, H: Math.ceil(baseY + desc + padBottomPx) };
  }

  // Только высота, без рисунка: место на странице занято сразу, и она не меняет высоту, когда название готовится на подходе.
  async function reserve(el, opts = {}) {
    const theme = themes[opts.theme || el.dataset.theme];
    const word = opts.word || el.dataset.word;
    if (!theme || !word) return;
    try { await document.fonts.load('700 100px Oswald', word); } catch (e) { /* шрифт подставится системный */ }
    const W = el.clientWidth;
    if (!W) return;
    el.style.setProperty('--pw-h', `${fit(word, theme, W, opts.maxPx || 220).H}px`);
    el.classList.add('pw-sized');
  }

  function mount(el, opts = {}) {
    const themeName = opts.theme || el.dataset.theme;
    const word = opts.word || el.dataset.word;
    const theme = themes[themeName];
    if (!theme || !word) return null;
    const align = opts.align || el.dataset.align || 'left';
    const maxPx = opts.maxPx || parseFloat(el.dataset.max) || 220;
    const seed = [...word].reduce((s, ch) => s + ch.charCodeAt(0) * 7, 13);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'pw-canvas';
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d', CTX);
    let C = null, built = null, staticLayer = null, maskLayer = null;
    let state = 'idle'; // idle → playing → done
    let t0 = 0, raf = 0, visible = false, lastDraw = 0, img = null, wood = null, held = false, parked = false;

    async function setup() {
      const font = `700 100px Oswald`;
      try { await document.fonts.load(font, word); } catch (e) { /* шрифт подставится системный */ }
      if (theme.tex) img = await loadImg(theme.tex);
      const W = el.clientWidth;
      if (!W) return false;
      const { fs, f, padX, padTopPx, baseY, tw, H } = fit(word, theme, W, maxPx);
      const x0 = align === 'center' ? (W - tw) / 2 : Math.max(fs * 0.02, padX * fs);
      const dpr = DPR();
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const prevH = el.style.getPropertyValue('--pw-h');
      el.style.setProperty('--pw-h', `${H}px`);
      if (prevH !== `${H}px`) el.dispatchEvent(new CustomEvent('pw:layout', { bubbles: true }));
      // Название главы готовится посреди прокрутки: разбор букв, рисунок и слои — в разные кадры. Титул виден сразу, он без пауз.
      const breathe = () => (opts.still && !C ? new Promise((r) => { setTimeout(r, 16); }) : null);
      const A = analyse(word, f, W, H, x0, baseY);
      await breathe();
      const next = { A, fs, font: f, word, W, H, x0, baseY, tw, dpr, padTopPx, rand: rng(seed) };
      built = theme.build(next);
      if (opts.still) built.idle = false; // название главы замирает после появления
      // порядок окончания роста: так готовые куски можно запекать подряд (drawPieces), слой под растущими не меняется
      if (!theme.masked) built.pieces.sort((a, b) => (a.t0 + a.d) - (b.t0 + b.d));
      // с этой секунды буквы и куски больше не меняются — их запекаем, и в кадре остаётся только то, что ещё растёт
      built.bakeAt = Math.max((theme.revealDelay || 0) + (theme.revealDur || 0), ...built.pieces.map((p) => p.t0 + p.d));
      await breathe();
      C = next;
      staticLayer = null;
      freshPieces();
      // буквы: заливка + обводка + тень — один раз в отдельный слой
      const base = document.createElement('canvas');
      base.width = canvas.width;
      base.height = canvas.height;
      const b = base.getContext('2d', CTX);
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.font = f;
      b.textBaseline = 'alphabetic';
      if (theme.tex && img) {
        const p = b.createPattern(img, 'repeat');
        const s = Math.max(tw / img.width, (fs * 1.1) / img.height);
        p.setTransform(new DOMMatrix().translateSelf(x0, padTopPx).scaleSelf(s, s));
        b.fillStyle = p;
      } else if (theme.wood) {
        wood = wood || woodCanvas(rng(seed + 5));
        const p = b.createPattern(wood, 'repeat');
        const s = (fs * 0.9) / wood.height;
        p.setTransform(new DOMMatrix().translateSelf(x0, padTopPx).scaleSelf(s, s));
        b.fillStyle = p;
      } else {
        // у тем с текстурой своей заливки нет: если картинка не загрузилась, буквы — лесным градиентом, а не ошибка
        const fill = theme.fill || ['#1f3d29', '#3f7a35'];
        const gr = b.createLinearGradient(0, padTopPx, 0, baseY);
        gr.addColorStop(0, fill[1]);
        gr.addColorStop(1, fill[0]);
        b.fillStyle = gr;
      }
      b.shadowColor = theme.shadow;
      b.shadowBlur = fs * 0.06;
      b.shadowOffsetY = fs * 0.03;
      b.fillText(word, x0, baseY);
      b.shadowColor = 'transparent';
      b.lineWidth = Math.max(1, fs * 0.012);
      b.strokeStyle = theme.outline;
      b.strokeText(word, x0, baseY);
      if (theme.grain) { // фактура природного камня: мелкое зерно
        const n = document.createElement('canvas');
        n.width = n.height = 96;
        const ng = n.getContext('2d', CTX);
        const nr = rng(seed + 9);
        for (let i = 0; i < 900; i++) { ng.fillStyle = nr() < 0.5 ? `rgba(60,50,40,${0.05 + nr() * 0.12})` : `rgba(255,250,240,${0.05 + nr() * 0.14})`; ng.fillRect(nr() * 96, nr() * 96, 1 + nr() * 1.6, 1 + nr() * 1.6); }
        b.save(); b.globalCompositeOperation = 'source-atop'; b.fillStyle = b.createPattern(n, 'repeat'); b.fillRect(0, 0, W, H); b.restore();
      }
      if (theme.wood) { // фаска: светлый блик по верху букв
        b.save();
        b.globalCompositeOperation = 'source-atop';
        const hl = b.createLinearGradient(0, padTopPx, 0, baseY);
        hl.addColorStop(0, 'rgba(255,220,170,.22)');
        hl.addColorStop(0.3, 'rgba(255,220,170,0)');
        hl.addColorStop(1, 'rgba(0,0,0,.25)');
        b.fillStyle = hl;
        b.fillRect(0, 0, W, H);
        b.restore();
      }
      C.base = base;
      if (theme.masked) {
        maskLayer = document.createElement('canvas');
        maskLayer.width = canvas.width;
        maskLayer.height = canvas.height;
      }
      return true;
    }

    // Сотни листьев в каждом кадре — главная цена появления названия. Выросшие складываем в слой и больше не перерисовываем.
    let doneLayer = null, doneCtx = null, doneN = 0;
    function freshPieces() { doneLayer = doneCtx = null; doneN = 0; }

    function drawPieces(g, t, all) {
      if (!theme.masked) {
        const list = built.pieces;
        if (all) { list.forEach((p) => p.draw(g, 1)); return; }
        while (doneN < list.length && t >= list[doneN].t0 + list[doneN].d) {
          if (!doneLayer) {
            doneLayer = document.createElement('canvas');
            doneLayer.width = canvas.width;
            doneLayer.height = canvas.height;
            doneCtx = doneLayer.getContext('2d', CTX);
            doneCtx.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
          }
          list[doneN++].draw(doneCtx, 1);
        }
        if (doneN) {
          g.save();
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.drawImage(doneLayer, 0, 0);
          g.restore();
        }
        for (let i = doneN; i < list.length; i++) {
          const p = list[i], k = clamp01((t - p.t0) / p.d);
          if (k > 0) p.draw(g, k);
        }
        return;
      }
      // брусчатка: укладываем камни на отдельный слой и обрезаем по форме букв
      const m = maskLayer.getContext('2d', CTX);
      m.setTransform(1, 0, 0, 1, 0, 0);
      m.clearRect(0, 0, maskLayer.width, maskLayer.height);
      m.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
      built.pieces.forEach((p) => { const k = all ? 1 : clamp01((t - p.t0) / p.d); if (k > 0) p.draw(m, k); });
      m.globalCompositeOperation = 'destination-in';
      m.setTransform(1, 0, 0, 1, 0, 0);
      m.drawImage(C.base, 0, 0);
      m.globalCompositeOperation = 'source-over';
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(maskLayer, 0, 0);
      g.restore();
    }

    function drawBase(g, t) {
      const r = theme.revealDur ? clamp01((t - (theme.revealDelay || 0)) / theme.revealDur) : 1;
      if (r <= 0) return;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (r < 1) {
        // буквы «вырастают» снизу вверх
        const e = easeOut(r);
        const h = canvas.height * e;
        g.beginPath();
        g.rect(0, canvas.height - h, canvas.width, h);
        g.clip();
        g.globalAlpha = Math.min(1, r * 1.6);
      }
      g.drawImage(C.base, 0, 0);
      g.restore();
    }

    function render(now) {
      const t = (now - t0) / 1000;
      const g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
      built.decor.forEach((d) => { if (!d.behind) return; const k = clamp01((t - d.t0) / d.d); if (k > 0) d.draw(g, k, t); });
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (staticLayer) g.drawImage(staticLayer, 0, 0);
      else {
        drawBase(g, t);
        g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
        drawPieces(g, t, false);
        if (t >= built.bakeAt) bake();
      }
      g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
      if (built.warm) { // тёплый отсвет на деревянных буквах, когда зажглись лампочки
        const w = clamp01((t - built.warm.at) / built.warm.d);
        if (w > 0) {
          g.save();
          g.globalCompositeOperation = 'source-atop';
          g.globalAlpha = 0.16 * w;
          g.fillStyle = '#ffb86b';
          g.fillRect(0, 0, C.W, C.H);
          g.restore();
        }
      }
      built.decor.forEach((d) => { if (d.behind) return; const k = clamp01((t - d.t0) / d.d); if (k > 0) d.draw(g, k, t); });
    }

    function bake() {
      staticLayer = document.createElement('canvas');
      staticLayer.width = canvas.width;
      staticLayer.height = canvas.height;
      const s = staticLayer.getContext('2d', CTX);
      s.drawImage(C.base, 0, 0);
      s.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
      drawPieces(s, 1e6, true);
      freshPieces();
    }

    function loop(now) {
      raf = 0;
      if (!C || !C.base || held) return; // слово «спит» далеко от экрана или придержано
      // Название ушло с экрана, не дорастив: не рисуем в пустоту. Рост идёт по часам, при возвращении оно уже дальше или готово.
      if (!visible) { parked = true; return; }
      const t = (now - t0) / 1000;
      const introDone = t > built.intro;
      // после интро — не чаще 30 кадров в секунду и только когда слово на экране; пока страница едет, ещё реже
      const gap = now - lastScroll < 140 ? SCROLL_GAP : introDone ? 32 : 0;
      if (now - lastDraw < gap) { schedule(); return; }
      lastDraw = now;
      render(now);
      if (!introDone || (built.idle && visible && !reduce)) schedule();
      else state = 'done';
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(loop); };

    function finalFrame() {
      // без анимации: сразу итоговый кадр (t далеко за концом интро, качание в нулевой фазе)
      t0 = performance.now() - (built.intro + 60) * 1000;
      bake();
      render(performance.now());
      state = 'done';
    }

    const ready = setup().then((ok) => {
      if (!ok) return false;
      el.classList.add('pw-ready');
      if (reduce) finalFrame();
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (theme.instant) ctx.drawImage(C.base, 0, 0); // титул виден сразу, цветение начнётся с play()
      }
      return true;
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting;
        if (visible && parked) { parked = false; schedule(); }
        if (visible && state === 'done' && built && built.idle && !reduce) { state = 'playing'; schedule(); }
      });
    }, { rootMargin: '80px 0px' });
    io.observe(el);

    // Далеко от экрана холсты освобождаются (на компьютере это ~20 МБ на слово), высота блока сохраняется.
    let asleep = false;
    const sleep = () => {
      if (asleep || !C) return;
      asleep = true;
      cancelAnimationFrame(raf); raf = 0;
      canvas.width = 0; canvas.height = 0;
      staticLayer = null; maskLayer = null; C.base = null;
      freshPieces();
    };
    const wake = async () => {
      if (!asleep) return;
      asleep = false;
      const wasPlayed = state !== 'idle';
      await setup();
      if (wasPlayed || reduce) finalFrame();
      if (wasPlayed && visible && built.idle && !reduce) { state = 'playing'; schedule(); }
    };
    const far = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? wake() : sleep())), { rootMargin: '1400px 0px' });
    ready.then(() => far.observe(el));

    let rz = 0, lastW = el.clientWidth;
    const onResize = () => {
      clearTimeout(rz);
      rz = setTimeout(async () => {
        if (Math.abs(el.clientWidth - lastW) < 2 || asleep) return;
        lastW = el.clientWidth;
        const wasPlayed = state !== 'idle';
        await setup();
        if (wasPlayed || reduce) finalFrame(); else ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (visible && built.idle && !reduce && wasPlayed) { state = 'playing'; schedule(); }
      }, 200);
    };
    addEventListener('resize', onResize);

    return {
      el,
      ready,
      get C() { return C; },
      play() {
        return ready.then(async (ok) => {
          if (!ok || reduce) return;
          if (asleep) await wake();
          if (state !== 'idle') return;
          state = 'playing';
          staticLayer = null;
          freshPieces();
          t0 = performance.now();
          if (window.GLSound) GLSound.cue(themeName, built);
          schedule();
        });
      },
      replay() {
        return ready.then(async (ok) => {
          if (!ok || reduce) return;
          if (asleep) await wake();
          state = 'playing';
          staticLayer = null;
          freshPieces();
          t0 = performance.now();
          if (window.GLSound) GLSound.cue(themeName, built);
          schedule();
        });
      },
      finish() { return ready.then((ok) => { if (ok) finalFrame(); }); },
      // придержать рисование: титул, пока он увеличивается при прокрутке
      hold(v) { if (held === v) return; held = v; if (!v && state === 'playing') schedule(); },
      // для проверки: нарисовать кадр на секунде t и остановиться
      renderAt(t) { return ready.then((ok) => { if (!ok) return; cancelAnimationFrame(raf); raf = 0; staticLayer = null; freshPieces(); t0 = performance.now() - t * 1000; render(performance.now()); state = 'done'; }); },
      destroy() { io.disconnect(); far.disconnect(); removeEventListener('resize', onResize); cancelAnimationFrame(raf); canvas.remove(); },
    };
  }

  window.PlantWord = { mount, reserve, themes };
})();
