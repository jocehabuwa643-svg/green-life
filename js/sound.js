/* Green Life — тихие «звуки природы» для живых названий (Web Audio, без аудиофайлов).
   Браузеры разрешают звук только после действия посетителя, поэтому он включается кнопкой в шапке. */
(function () {
  let ctx = null, master = null, noise = null;
  let enabled = false;
  try { enabled = localStorage.getItem('gl-sound') === '1'; } catch (e) { /* приватный режим */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(comp);
    comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  function env(param, t, attack, peak, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function noiseThrough(t, dur, setup) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const g = ctx.createGain();
    const out = setup(src, g) || src;
    out.connect(g);
    g.connect(master);
    src.start(t, rnd(0, 1.5));
    src.stop(t + dur + 0.1);
    return g;
  }
  function tone(t, freq, dur, vol, type = 'sine') {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    env(g.gain, t, 0.008, vol, dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  const sfx = {
    // шелест листвы: россыпь коротких «зёрен» отфильтрованного шума
    rustle(t, { dur = 1.2, tone: f = 2600, vol = 0.06 } = {}) {
      const n = Math.round(dur * 26);
      for (let i = 0; i < n; i++) {
        const tt = t + Math.random() * dur, len = rnd(0.03, 0.11);
        const g = noiseThrough(tt, len, (src) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rnd(0.6, 1.5); bp.Q.value = 0.9; src.connect(bp); return bp; });
        env(g.gain, tt, 0.006, vol * rnd(0.3, 1), len);
      }
    },
    // мягкий ветер: низкий шум, плавно нарастает и стихает
    wind(t, { dur = 3, vol = 0.045 } = {}) {
      const g = noiseThrough(t, dur, (src) => { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(900, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(420, t + dur); src.connect(lp); return lp; });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
    },
    // хрустальный «динь» распускающегося цветка
    chime(t, { note = 880, vol = 0.03 } = {}) {
      tone(t, note, 1.6, vol);
      tone(t, note * 2.01, 0.9, vol * 0.35);
      tone(t + 0.004, note * 3.02, 0.5, vol * 0.12);
    },
    // распускание: короткое арпеджио + лёгкий шелест лепестков
    bloom(t, { note = 659, vol = 0.04 } = {}) {
      [1, 1.25, 1.5, 2].forEach((m, i) => sfx.chime(t + i * 0.085, { note: note * m, vol: vol * (1 - i * 0.15) }));
      sfx.rustle(t, { dur: 0.6, tone: 3600, vol: vol * 0.8 });
    },
    // листок пролетает мимо
    swish(t, { vol = 0.05 } = {}) {
      const g = noiseThrough(t, 0.6, (src) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(3800, t + 0.45); src.connect(bp); return bp; });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.22);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    },
    // щелчок выключателя
    click(t, { vol = 0.12 } = {}) {
      const g = noiseThrough(t, 0.02, (src) => { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; src.connect(hp); return hp; });
      env(g.gain, t, 0.001, vol, 0.012);
      tone(t, 140, 0.05, vol * 0.6);
    },
    // лампочка загорается: стеклянный «тинь»
    tink(t, { note = 2200, vol = 0.025 } = {}) { tone(t, note, 0.28, vol); tone(t, note * 1.5, 0.16, vol * 0.3); },
    // тёплое гудение гирлянды
    hum(t, { dur = 2.5, vol = 0.012 } = {}) {
      [110, 220].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1); });
    },
    // карандаш по бумаге
    draw(t, { dur = 1.6, vol = 0.03 } = {}) {
      const n = Math.round(dur * 14);
      for (let i = 0; i < n; i++) {
        const tt = t + (i / n) * dur + rnd(0, 0.04), len = rnd(0.05, 0.12);
        const g = noiseThrough(tt, len, (src) => { const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = rnd(3500, 6000); hp.Q.value = 2; src.connect(hp); return hp; });
        env(g.gain, tt, 0.01, vol * rnd(0.5, 1), len);
      }
    },
    // галька насыпается
    gravel(t, { dur = 1.2, vol = 0.05 } = {}) {
      const n = Math.round(dur * 30);
      for (let i = 0; i < n; i++) { const tt = t + Math.random() * dur; tone(tt, rnd(1800, 4200), 0.03, vol * rnd(0.2, 0.6), 'triangle'); }
    },
    // мягкий стук — шар самшита встал на место
    tap(t, { vol = 0.07 } = {}) {
      const o = tone(t, 240, 0.14, vol);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
      const g = noiseThrough(t, 0.03, (src) => { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; src.connect(lp); return lp; });
      env(g.gain, t, 0.002, vol * 0.5, 0.025);
    },
    // рулон газона раскатывается
    unroll(t, { dur = 1.4, vol = 0.06 } = {}) {
      const g = noiseThrough(t, dur, (src) => { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1100, t + dur); src.connect(lp); return lp; });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.2);
      g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      sfx.rustle(t + 0.1, { dur: dur * 0.9, tone: 2200, vol: vol * 0.6 });
    },
    // яблоко «выросло»
    pop(t, { vol = 0.05 } = {}) { const o = tone(t, 560, 0.14, vol); o.frequency.exponentialRampToValueAtTime(300, t + 0.12); },
  };

  // Звуковые сценарии тем без собственных подсказок (у остальных — cues из plantword.js).
  const defaults = {
    conifers: [{ at: 0.6, type: 'rustle', dur: 1.8, tone: 4200, vol: 0.05 }],
    trees: [{ at: 0.2, type: 'wind', dur: 3.5 }, { at: 0.8, type: 'rustle', dur: 2.6, tone: 2400, vol: 0.06 }],
    orchard: [{ at: 0.2, type: 'rustle', dur: 1.6, tone: 2600, vol: 0.05 }, { at: 1.5, type: 'chime', note: 880 }, { at: 1.9, type: 'chime', note: 1047 }, { at: 2.4, type: 'pop' }, { at: 2.7, type: 'pop' }, { at: 3.0, type: 'pop' }],
  };

  function run(c, t0) {
    const f = sfx[c.type];
    if (f) f(t0 + (c.at || 0), c);
  }

  function cue(theme, built) {
    if (!enabled || !ensure() || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.03;
    let list = (built && built.cues) || defaults[theme] || [];
    if (theme === 'light' && built && built.decor) { // щелчок, лампочки по очереди и тёплое гудение
      const n = Math.max(6, Math.round((built.intro - 2.6) / 0.11));
      list = [{ at: 1.95, type: 'click' }, { at: 2.0, type: 'hum', dur: 3 }];
      for (let i = 0; i < Math.min(n, 18); i++) list.push({ at: 2.0 + i * 0.11, type: 'tink', note: 1900 + (i % 5) * 160, vol: 0.018 });
    }
    list.forEach((c) => run(c, t0));
  }

  function play(type, opts) {
    if (!enabled || !ensure() || ctx.state !== 'running') return;
    run({ type, ...(opts || {}) }, ctx.currentTime + 0.02);
  }

  async function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem('gl-sound', on ? '1' : '0'); } catch (e) { /* ничего */ }
    if (on && ensure()) { try { await ctx.resume(); } catch (e) { /* ничего */ } }
    document.documentElement.classList.toggle('sound-on', on);
    window.dispatchEvent(new CustomEvent('gl:sound', { detail: on }));
  }

  // Звук был включён в прошлый раз — оживим его при первом же касании страницы.
  if (enabled) {
    document.documentElement.classList.add('sound-on');
    const wake = () => { if (ensure()) ctx.resume(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
  }

  window.GLSound = {
    get enabled() { return enabled; },
    toggle: () => setEnabled(!enabled),
    cue,
    play,
  };
})();
