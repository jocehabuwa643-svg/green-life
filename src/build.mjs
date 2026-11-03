// Сборка index.html (и robots.txt/sitemap.xml, когда известен адрес сайта): node src/build.mjs
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { company, chapters, guarantees, steps, partners, reviews, promos, paths, delivery, faq, priceSheets, priceNotes, light, lawnSteps, lawnVideo } from './catalog.mjs';

// Иконки меню разделов (рисует отдельный файл); если его нет — листок.
let menuIcons = {};
try { ({ menuIcons } = await import('./icons.mjs')); } catch (e) { menuIcons = {}; }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = Date.now().toString(36); // версия файлов — браузеры не возьмут старый кэш после обновления
const SITE = (process.env.SITE_URL || company.siteUrl || '').replace(/\/?$/, (m) => (m ? '/' : ''));
const abs = (p) => (SITE ? new URL(p, SITE.endsWith('/') ? SITE : `${SITE}/`).href : p);
const today = new Date().toISOString().slice(0, 10);

const esc = (s = '') => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Короткие слова привязываем к следующему неразрывным пробелом (цепочки «и в саду» тоже).
const nbspBase = (s = '') => esc(s).replace(/ (—|–)/g, '&nbsp;$1').replace(/(?<=^|\s|;|\u0001)([а-яёa-z]{1,2}) /gi, '$1&nbsp;')
  // числа: «3 000 ₽», «40 см», «10–14 дней» не разрываются переносом строки
  .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u202f').replace(/(\d) (₽|см|м²|м\b|шт\.)/g, '$1&nbsp;$2').replace(/(\d)–(?=\d)/g, '$1–\u2060');
// Трёхбуквенные предлоги и союзы тоже держим со следующим словом: иначе «под» повисает в конце строки («…гирляндами под / ключ»).
// Название в кавычках из двух слов не разрываем: «Блю Эрроу», «Красная крупная».
const nbsp = (s = '') => nbspBase(s).replace(/(?<=^|\s|;|\u0001)(под|над|для|без|при|про|или|что|как) /gi, '$1&nbsp;')
  .replace(/«([^«»\s]+) ([^«»\s]+)»/g, '«$1&nbsp;$2»');
// *слово* в заголовке — лиственный акцент (как «и озеленение» на макете).
const hl = (s = '') => nbsp(String(s).replace(/\*(.+?)\*/g, '\u0001$1\u0002')).replace(/\u0001/g, '<span class="hl">').replace(/\u0002/g, '</span>');
// Метка «(с сайта)» — чтобы в WhatsApp было видно, что заявка пришла с сайта, а не с Авито.
const wa = (text) => `${company.whatsapp}?text=${encodeURIComponent(`${text} (с сайта)`)}`;
const money = (n) => n.toLocaleString('ru-RU').replace(/\s/g, ' '); // узкий неразрывный пробел: «15 000»
const priceNum = (p) => (p ? p.value || p.from : 0);
const priceText = (p) => (!p ? 'по запросу' : p.value ? `${money(p.value)} ₽` : `от ${money(p.from)} ₽`);
const unitFor = { 'шт.': 'шт.', 'м²': 'м²', 'услуга': 'услугу' };

const picture = (im, cls = '', eager = false) => `<img${cls ? ` class="${cls}"` : ''} src="${im.src}" width="${im.w}" height="${im.h}" alt="${esc(im.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
// Ролик (vid в catalog.mjs). В разметке нет ни файла, ни постера: иначе 35 картинок грузились бы сразу при открытии страницы.
// Источник под экран, постер (первый или последний кадр), ленивую загрузку и проигрывание ставит main.js, когда сцена подошла;
// без скрипта виден <noscript>-кадр. Подпись для экранных дикторов — рядом, текстом.
const bloom = (v) => {
  const phone = v.srcM ? ` data-src-m="${v.srcM}" data-start-m="${v.startM}" data-end-m="${v.endM}"` : '';
  return `<video class="bloom" data-bloom="${v.mode}" data-src="${v.src}" data-start="${v.start}" data-end="${v.end}"${phone} muted playsinline preload="none" width="${v.w}" height="${v.h}" aria-hidden="true" disablepictureinpicture disableremoteplayback></video><noscript><img src="${v.end}" width="${v.w}" height="${v.h}" alt="" loading="lazy" decoding="async"></noscript><span class="sr-only">${esc(v.alt)}</span>`;
};
// Сцена-галерея: ролик на весь экран с растворяющимися краями, текст поднимается рядом на белом.
const stage = (v) => `<div class="sc-stage"><figure class="sc-media">${bloom(v)}</figure><div class="sc-veil" aria-hidden="true"></div></div>`;
const sceneAttrs = (v, flip) => `class="scene${flip ? ' is-flip' : ''}${v.h > v.w ? ' scene--tall' : ''}" style="--fx:${v.focus}%"`;

// Новые фотографии (подсветка, газон, туи): размеры и подписи для экранных дикторов.
const PH = {
  'p-dom': [1344, 1132, 'Двухэтажный дом зимней ночью: карнизы, балкон и козырёк в тёплых гирляндах-бахроме, у входа ёлки с огнями'],
  'p-krysha': [348, 232, 'Угол крыши с водостоком и тёплой гирляндой-бахромой вдоль карниза'],
  'p-balkon': [348, 232, 'Угловой балкон, затянутый занавесом из тёплых гирлянд'],
  'p-vhod': [348, 232, 'Входная группа с венком на двери и ёлками в огнях под карнизом с бахромой'],
  'p-klassika': [436, 328, 'Крупный план ствола, обмотанного тёплой гирляндой'],
  'p-holodny': [448, 336, 'Деревья в холодной белой подсветке на ночной дорожке'],
  'p-dekor': [490, 368, 'Дерево в тёплых огнях со светящимися шарами на ветвях'],
  'p-territoriya': [538, 404, 'Пешеходная аллея: ряды деревьев в гирляндах уходят вдаль'],
  'p-tui-c': [675, 900, 'Аллея колоновидных туй вдоль дома, белые гортензии и садовые фонари'],
  'p-shag-1-c': [207, 155, 'Грабли на взрыхлённой почве'],
  'p-shag-2': [376, 282, 'Рука в перчатке рассыпает семена газона по земле'],
  'p-shag-3': [376, 282, 'Дождеватель поливает молодые всходы газона'],
  'p-shag-4': [376, 282, 'Густые свежие всходы газонной травы крупным планом'],
  'p-shag-5': [376, 282, 'Ровный зелёный газон перед домом с балконом'],
};
const photo = (name, cls = '') => {
  const [w, h, alt] = PH[name] || [800, 600, ''];
  return picture({ src: `img/${name}.webp`, w, h, alt }, cls);
};

const leafIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-leaf"/></svg>';
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-wa" viewBox="0 0 32 32"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5 1.9.8 2.7.9 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.3Z"/></symbol><symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15Z" fill="currentColor" opacity=".9"/><path d="M5 19 14 10" stroke="#f4f8ee" stroke-width="1.4" stroke-linecap="round" fill="none"/></symbol><symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3.5l1.6 4-2.2 1.4a11 11 0 0 0 5.7 5.7l1.4-2.2 4 1.6V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/></symbol></svg>`;
const waIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#i-wa"/></svg>';
const phoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-phone"/></svg>';
// Тонкие контурные иконки 24×24 (одна толщина линии на весь сайт).
const icons = {
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8"/>',
  snow: '<path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2"/><path d="m9.4 4.4 2.6 2 2.6-2M9.4 19.6l2.6-2 2.6 2M4.8 10.6l3.1-.3-1.2-3M19.2 13.4l-3.1.3 1.2 3M4.8 13.4l3.1.3-1.2 3M19.2 10.6l-3.1-.3 1.2-3"/>',
  camera: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.4l1.3-2h6.6l1.3 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"/><circle cx="12" cy="13" r="3.6"/>',
  truck: '<path d="M2.8 6.5h10.7v9.8H2.8zM13.5 9.5h4.2l3.5 3.6v3.2h-7.7"/><circle cx="7" cy="17.6" r="1.9"/><circle cx="17.4" cy="17.6" r="1.9"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15Z"/><path d="M5 19 13.5 10.5"/>',
  box: '<path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z"/><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21"/>',
  flower: '<circle cx="12" cy="5.7" r="2.4"/><circle cx="15.3" cy="9" r="2.4"/><circle cx="12" cy="12.3" r="2.4"/><circle cx="8.7" cy="9" r="2.4"/><circle cx="12" cy="9" r=".9"/><path d="M12 14.7V21M12 18.6c1.9-.2 3.4-1.3 4.1-3.1"/>',
  fir: '<path d="M12 3 7.6 9h2.6L6.6 14h3.1L6 19h12l-3.7-5h3.1L13.8 9h2.6L12 3Z"/><path d="M12 19v2.5"/>',
  cypress: '<path d="M12 2.8c-2.6 3.3-3.8 7-3.8 10.6 0 3.2 1.6 5.6 3.8 5.6s3.8-2.4 3.8-5.6c0-3.6-1.2-7.3-3.8-10.6Z"/><path d="M12 19v2.5M12 8.5V16M12 12l-1.9-1.5M12 14.4l1.9-1.5"/>',
  tree: '<path d="M12 21v-7"/><path d="M12 14c-4.2 0-6.5-2.3-6.5-5.3 0-2.6 2-4.6 4.4-4.9A3.7 3.7 0 0 1 12 3c.8 0 1.5.3 2.1.8 2.4.3 4.4 2.3 4.4 4.9 0 3-2.3 5.3-6.5 5.3Z"/><path d="m12 17.2 2.6-2.2M12 15.6l-2.2-1.9"/>',
  sprig: '<path d="M6 20.5c1.2-5.2 4.3-9.4 12-14.5"/><path d="M9.6 15.6C7.1 15.1 5.7 13.3 5.6 10.7c2.6.1 4.5 1.5 4.9 4"/><path d="M13.1 11.5c-.3-2.6.8-4.6 3.2-5.6.8 2.4 0 4.6-2.3 5.8"/><path d="M12.2 13.3c2.3-1.2 4.6-1 6.4.8-1.8 1.7-4.2 2-6.4.6"/>',
  cherry: '<circle cx="7.8" cy="16.6" r="3.2"/><circle cx="16.2" cy="17.4" r="3.2"/><path d="M8.6 13.5C9.6 9.1 11 6 14 3.5M15.6 14.2C15.4 10 14.8 6.6 14 3.5"/><path d="M14 3.5c1.6-.6 4-.4 5.5 1.2-1.7 1.3-3.8 1.2-5.5-1.2Z"/>',
  grass: '<path d="M3 20h18"/><path d="M6 20c0-4-1-7-3-9 2.6.6 4.4 3.2 4.6 6M10 20c0-5.4-1-9.6-2.4-12.6 2.8 1.6 4.4 6 4.4 9.6M13.6 20c.2-5 1.6-9.4 4.2-12-1 3.4-1.4 7-1.2 10M17.6 20c.6-2.8 1.8-5 3.4-6.4"/>',
  bulb: '<path d="M9 17.6h6M9.9 20.6h4.2"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v1.8h5.2v-1.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>',
  house: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5.5h4V20"/>',
  arch: '<path d="M4 20V10a8 8 0 0 1 16 0v10"/><path d="M7.6 20v-9.4a4.4 4.4 0 0 1 8.8 0V20"/><path d="M3 20h18"/>',
  shop: '<path d="M4.5 10.5V20h15v-9.5"/><path d="M3 9.4 4.6 4h14.8L21 9.4a2.6 2.6 0 0 1-5.1.4 2.6 2.6 0 0 1-3.9 1.8 2.6 2.6 0 0 1-3.9-1.8A2.6 2.6 0 0 1 3 9.4Z"/><path d="M9.5 20v-5h5v5"/>',
};
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.leaf}</svg>`;

const logo = (cls = '') => `<a class="logo ${cls}" href="#top" aria-label="Green Life — наверх">
  <svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 33C8 17 18 8 34 6c-1 16-11 27-26 27Z" fill="#8bbf33"/><path d="M8 33C8 17 18 8 34 6c-6 4-17 12-26 27Z" fill="#3c7128"/><path d="M8.5 32.5 26 14" stroke="#f4f8ee" stroke-width="1.6" stroke-linecap="round"/></svg>
  <span class="logo-word">Green <span>Life</span></span></a>`;

// Текст, который анимируется по буквам/словам: видимая копия скрыта от экранных дикторов,
// а для них рядом лежит обычный текст — так и анимация, и доступность.
const splitText = (text, cls, attrs = '') => `<span class="sr-only">${esc(text)}</span><span class="${cls}" aria-hidden="true"${attrs}>${nbsp(text)}</span>`;

const waMain = wa('Здравствуйте! Пришлите, пожалуйста, прайс и условия скидки.');

// ——— разделы ———

const hero = () => `
<div class="hero-spacer">
<section class="hero" id="top" aria-labelledby="hero-h1">
  <div class="hero-bg" aria-hidden="true"><img class="hero-bg-img" src="img/bg-akvarel.webp" srcset="img/bg-akvarel-900.webp 900w, img/bg-akvarel.webp 2000w" sizes="100vw" width="2000" height="1143" alt="" fetchpriority="high" decoding="async"></div>
  <div class="hero-hedge" aria-hidden="true"><div class="hero-hedge-img"><i class="hero-hedge-fade"></i></div></div>
  <div class="hero-inner wrap">
    <p class="eyebrow hero-eyebrow">${nbsp('Питомник растений и ландшафтные работы')}<span class="hero-where"><span aria-hidden="true"> · </span>${nbsp(`${company.city} и область`)}</span></p>
    <div class="hero-title pw" data-theme="meadow" data-word="Green Life" data-align="center" aria-hidden="true"><span class="pw-text">Green Life</span></div>
    <h1 class="hero-sub" id="hero-h1"><span class="sr-only">Green Life — </span>${splitText('Саженцы для Сибири и озеленение участков в Новосибирске', 'hero-sub-in')}</h1>
    <p class="hero-lead">${nbsp('Розы, туи, сирень, яблони и ягодные — с гарантией приживаемости. Газон, плитка и подсветка дома под ключ. Отправляем по всей России, а перед отправкой присылаем фото и видео заказа.')}</p>
    <div class="hero-cta">
      <a class="btn btn-lime" href="${waMain}" target="_blank" rel="noopener">${waIcon}Получить прайс в WhatsApp</a>
      <button class="btn btn-ghost btn-all" type="button" data-open-sections aria-haspopup="dialog" aria-controls="sections">${leafIcon}Смотреть всё</button>
    </div>
    <p class="hero-proof"><a href="tel:${company.phoneHref}">${phoneIcon}${esc(company.phone)}</a></p>
  </div>
  <a class="scroll-cue" href="#rozy">
    <svg viewBox="0 0 40 64" aria-hidden="true"><path class="sc-stem" d="M20 62C20 46 20 34 20 22" /><path class="sc-leaf sc-l" d="M20 40c-8-1-12-6-13-12 7 0 12 4 13 12Z"/><path class="sc-leaf sc-r" d="M20 32c8-1 12-6 13-12-7 0-12 4-13 12Z"/><circle class="sc-bud" cx="20" cy="18" r="4"/></svg>
    <span>Листайте</span>
  </a>
</section>
</div>`;

const promoBlock = () => {
  const list = promos.filter((p) => p.until >= today);
  return `
<section class="promo" id="sezon" aria-label="Сезонные предложения">
  <div class="wrap">
    <div class="promo-grid">
      ${list.map((p) => `<article class="promo-card promo-card--${p.id}" data-until="${p.until}" data-reveal>
        <p class="promo-tag">${esc(p.tag)}</p>
        <h2 class="promo-title">${nbsp(p.title)}</h2>
        <p class="promo-text">${nbsp(p.text)}</p>
        <div class="promo-actions"><a class="btn ${p.id === 'ny' ? 'btn-gold' : 'btn-lime'} btn-sm" href="${wa(p.wa)}" target="_blank" rel="noopener">${waIcon}${esc(p.cta)}</a><a class="promo-more" href="#${p.anchor}">Подробнее</a></div>
      </article>`).join('')}
    </div>
    <ul class="paths" aria-label="Что вам нужно">
      ${paths.map((p) => `<li data-reveal><a class="path" href="${p.href}"><span class="path-title">${nbsp(p.title)}</span><span class="path-text">${nbsp(p.text)}</span><span class="path-arrow" aria-hidden="true">→</span></a></li>`).join('')}
    </ul>
  </div>
</section>`;
};

const manifest = () => `
<section class="manifest" id="manifest">
  <div class="wrap manifest-in">
    <p class="manifest-text">${splitText('Растим саженцы для сибирских зим и сами их сажаем. Подберём растения под ваш участок, уложим газон и дорожки, подсветим дом — и отвечаем за приживаемость.', 'manifest-in', ' data-scrub-words')}</p>
    <p class="hand hand--manifest" aria-hidden="true">Красивый сад —<br>это просто!</p>
    <ul class="stats">
      ${company.stats.map((s) => `<li><span class="stat-num" data-count="${s.value}" data-suffix="${s.suffix}">${s.value}${s.suffix}</span><span class="stat-label">${nbsp(s.label)}</span></li>`).join('')}
    </ul>
  </div>
</section>`;

const catalogIndex = () => `
<section class="index" id="katalog" aria-labelledby="katalog-title">
  <div class="wrap">
    <h2 class="sec-title" id="katalog-title" data-leaf-title>${hl('Каталог саженцев *и услуг*')}</h2>
    <p class="sec-lead">${nbsp('Вся галерея одним списком — нажмите на главу, чтобы вернуться к ней.')}</p>
    <ol class="index-list">
      ${chapters.map((c) => `<li><a class="ix${c.dark ? ' ix--gold' : ''}" href="#${c.id}" data-theme="${c.theme}"><span class="ix-num">${c.num}</span><span class="ix-title">${esc(c.title)}</span><span class="ix-tag">${nbsp(c.tagline)}</span><span class="ix-img" aria-hidden="true">${picture(c.cover)}</span></a></li>`).join('')}
    </ol>
  </div>
</section>`;

const productMedia = (item) => {
  const [main, ...rest] = item.images;
  return `<div class="pr-media pr-media--${Math.min(item.images.length, 4)}">
    <figure class="pr-main frame-arch"><div class="frame-in sway">${picture(main)}</div></figure>
    ${rest.slice(0, 3).map((im, i) => `<figure class="pr-sub pr-sub--${i + 1}"><div class="frame-in">${picture(im)}</div></figure>`).join('')}
  </div>`;
};

// Цена на карточке: разные цены у вариантов — «от» самой низкой; одна цена среди вариантов «по запросу» — с размером;
// у единственной цены — её пометка из каталога (note), например «зависит от размера», как на макете и в прайсе.
// Без цены — своя подпись товара (status/note в каталоге), иначе общая про саженцы.
const priceBlock = (item) => {
  const all = item.prices || [];
  const priced = all.filter((p) => p.price);
  if (priced.length) {
    const min = priced.reduce((a, b) => (priceNum(b.price) < priceNum(a.price) ? b : a));
    const unit = min.unit ? ` за ${esc(unitFor[min.unit] || min.unit)}` : '';
    const differ = new Set(priced.map((p) => priceNum(p.price))).size > 1 || priced.some((p) => p.price.from);
    const value = differ ? `от ${money(priceNum(min.price))} ₽` : priceText(min.price);
    const extra = priced.length === 1 ? min.note || (all.length > 1 ? min.size : '') : '';
    const size = extra ? ` · ${esc(extra)}` : '';
    return `<div class="pr-price"><span class="pp-label">Цена${unit}${size}</span><span class="pp-value">${value}</span></div>`;
  }
  return `<div class="pr-price"><span class="pp-label">${esc(item.status || 'В наличии · бронь на весну')}</span><span class="pp-note">${nbsp(item.note || 'Цену и фото саженцев пришлём в WhatsApp')}</span></div>`;
};

const product = (item, chapter, i) => {
  const msg = `Здравствуйте! Интересует: ${item.nameFull || item.name}. Подскажите, пожалуйста, цену и наличие.`;
  const body = `<div class="pr-body">
      <p class="pr-latin">${esc(item.latin || '')}</p>
      <h3 class="pr-title" id="${item.id}-t" data-leaf-title>${nbsp(item.nameFull || item.name)}</h3>
      <p class="pr-lead" data-reveal>${nbsp(item.lead)}</p>
      ${(item.text || []).map((t) => `<p class="pr-text" data-reveal>${nbsp(t)}</p>`).join('')}
      ${item.details && item.details.length ? `<dl class="pr-details" data-reveal>${item.details.map((d) => `<div><dt>${esc(d.title)}</dt><dd>${nbsp(d.text)}</dd></div>`).join('')}</dl>` : ''}
      ${item.varieties && item.varieties.length ? `<div class="pr-vars" data-reveal><p class="pr-vars-title">Сорта в наличии · ${item.varieties.length}</p><ul class="chips">${item.varieties.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>` : ''}
      ${item.features && item.features.length ? `<ul class="pr-features" data-reveal>${item.features.map((f) => `<li>${leafIcon}<span>${nbsp(f)}</span></li>`).join('')}</ul>` : ''}
      ${item.buy === false ? '' : `<div class="pr-buy" data-reveal>
        ${priceBlock(item)}
        <a class="btn btn-lime" href="${wa(msg)}" target="_blank" rel="noopener">${waIcon}${esc(item.cta || chapter.cta || 'Узнать цену')}</a>
      </div>`}
    </div>`;
  // Текст чередуется по сторонам: у обложки главы он слева, у первого товара справа.
  if (item.video) {
    return `
  <article ${sceneAttrs(item.video, !(i % 2)).replace('class="scene', 'class="product scene')} id="${item.id}" aria-labelledby="${item.id}-t">
    ${stage(item.video)}
    <div class="sc-body"><div class="sc-col">${body}</div></div>
  </article>`;
  }
  return `
  <article class="product${i % 2 ? ' is-flip' : ''}" id="${item.id}" aria-labelledby="${item.id}-t">
    ${productMedia(item)}
    ${body}
  </article>`;
};

// Схемы-чертежи для услуг, у которых нет своих фото: план участка, расчистка и планировка, слои грунта, дренажная траншея.
// Тонкие линии на миллиметровке — как проект, а не картинка из фотобанка. Случайность детерминированная:
// при пересборке камешки и травинки остаются на своих местах.
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const f1 = (n) => Math.round(n * 10) / 10;
const DR = { ink: '#1d4312', mid: '#3c7128', leaf: '#568914', lime: '#8bbf33', pale: '#d4f49e', sand: '#eadfbd', earth: '#5d4a34', clay: '#b7a27c', gravel: '#d2d7c8', water: '#9fcfe6' };
const grassRow = (x0, x1, y, seed) => {
  const r = seeded(seed);
  let d = '';
  for (let x = x0 + 2; x < x1 - 1; x += 3 + r() * 2.2) d += `M${f1(x)} ${y}l${f1((r() - 0.5) * 4)} ${f1(-(4.5 + r() * 6))}`;
  return `<path d="${d}" fill="none" stroke="${DR.leaf}" stroke-width="1.1" stroke-linecap="round"/>`;
};
const stones = (x, y, w, h, n, seed) => {
  const r = seeded(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const rx = 2.3 + r() * 2.8, cx = x + rx + r() * (w - 2 * rx), cy = y + rx + r() * (h - 2 * rx);
    s += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(rx * (0.62 + r() * 0.3))}" transform="rotate(${Math.round(r() * 180)} ${f1(cx)} ${f1(cy)})"/>`;
  }
  return `<g fill="#e7eadf" stroke="#8e9785" stroke-width=".8">${s}</g>`;
};
const leader = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${DR.ink}" stroke-width=".9" fill="none"/><circle cx="${x1}" cy="${y1}" r="1.8" fill="${DR.ink}"/>`;
const soilDefs = (p) => `<pattern id="${p}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" stroke="rgba(42,26,4,.22)" stroke-width="1.2"/></pattern>
  <pattern id="${p}-earth" width="9" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="1" fill="#7b6449"/><circle cx="6.6" cy="6.3" r=".8" fill="#46372a"/></pattern>`;
const drop = (x, y) => `<path transform="translate(${x} ${y})" d="M0-6.5C3-2.6 4.6 0 4.6 2a4.6 4.6 0 0 1-9.2 0c0-2 1.6-4.6 4.6-8.5Z" fill="${DR.water}" stroke="${DR.mid}" stroke-width=".7"/>`;
// пучок сорняков: высокие гнутые стебли, у самых высоких — жёлтые головки; основание прячется под грунтом
const weeds = (x, y, n, seed, spread = 16) => {
  const r = seeded(seed);
  let d = '', heads = '';
  for (let i = 0; i < n; i++) {
    const h = 14 + r() * 18, lean = (r() - 0.5) * spread, bx = x + (r() - 0.5) * 9;
    d += `M${f1(bx)} ${y}q${f1(lean * 0.15)} ${f1(-h * 0.6)} ${f1(lean)} ${f1(-h)}`;
    if (h > 27) heads += `<circle cx="${f1(bx + lean)}" cy="${f1(y - h)}" r="2.3"/>`;
  }
  return `<path d="${d}" fill="none" stroke="${DR.mid}" stroke-width="1.2" stroke-linecap="round"/><g fill="#e4b462" stroke="${DR.mid}" stroke-width=".6">${heads}</g>`;
};
const drawings = {
  // план участка: дом с вальмовой крышей, терраса, дорожка к калитке, газон, деревья и изгородь
  plan: `<svg viewBox="0 0 320 240" aria-hidden="true" focusable="false">
    <path d="M24 12h272M24 8v8M296 8v8" fill="none" stroke="${DR.ink}" stroke-width="1"/>
    <rect x="24" y="24" width="272" height="196" rx="3" fill="none" stroke="${DR.ink}" stroke-width="1.3" stroke-dasharray="5 4"/>
    <path d="M168 38H276V152C244 170 202 172 168 156Z" fill="${DR.pale}" stroke="${DR.leaf}" stroke-width="1.1"/>
    <ellipse cx="222" cy="128" rx="22" ry="11" fill="#fff" stroke="${DR.mid}" stroke-width="1" stroke-dasharray="2 2.4"/>
    <g fill="#e4b462"><circle cx="210" cy="126" r="2"/><circle cx="219" cy="131" r="2"/><circle cx="228" cy="124" r="2"/><circle cx="236" cy="130" r="2"/><circle cx="222" cy="122" r="1.6"/></g>
    <path d="M88 104c0 38 22 58 64 70s70 22 78 46" fill="none" stroke="${DR.ink}" stroke-width="13"/>
    <path d="M88 104c0 38 22 58 64 70s70 22 78 46" fill="none" stroke="#efe6cc" stroke-width="10.4"/>
    <path d="M217 220h26" stroke="#f1f6e9" stroke-width="3"/><path d="M217 215v10M243 215v10" stroke="${DR.ink}" stroke-width="1.4"/>
    <rect x="40" y="38" width="98" height="66" fill="#fff" stroke="${DR.ink}" stroke-width="1.6"/>
    <path d="M40 38 58 71 40 104M138 38 120 71 138 104M58 71h62" fill="none" stroke="${DR.ink}" stroke-width=".9" opacity=".5"/>
    <rect x="138" y="52" width="22" height="38" fill="#fff" stroke="${DR.ink}" stroke-width="1"/>
    <path d="M143.5 52v38M149 52v38M154.5 52v38" stroke="${DR.ink}" stroke-width=".6" opacity=".4"/>
    <g fill="${DR.lime}" fill-opacity=".5" stroke="${DR.mid}" stroke-width="1.1"><circle cx="52" cy="142" r="14"/><circle cx="62" cy="188" r="17"/><circle cx="116" cy="204" r="10"/><circle cx="198" cy="64" r="13"/><circle cx="250" cy="98" r="16"/></g>
    <g fill="${DR.ink}"><circle cx="52" cy="142" r="1.6"/><circle cx="62" cy="188" r="1.6"/><circle cx="116" cy="204" r="1.4"/><circle cx="198" cy="64" r="1.5"/><circle cx="250" cy="98" r="1.6"/></g>
    <g fill="${DR.leaf}" fill-opacity=".55">${Array.from({ length: 14 }, (_, i) => `<circle cx="287" cy="${36 + i * 12.6}" r="5.2"/>`).join('')}</g>
    <text x="160" y="15.5" text-anchor="middle">24 М</text><text x="89" y="75" text-anchor="middle">ДОМ</text><text x="236" y="70" text-anchor="middle">ГАЗОН</text>
  </svg>`,
  // разрез: было неровно — стало ровно; плодородный слой, песок, щебень, грунт
  soil: `<svg viewBox="0 0 320 240" aria-hidden="true" focusable="false">
    <defs>${soilDefs('ds')}<pattern id="ds-sand" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#c4b17e"/><circle cx="4.5" cy="4.2" r=".7" fill="#c4b17e"/></pattern></defs>
    <path d="M18 56c20-15 38 6 60-5s36-15 56-2 36 9 58-5" fill="none" stroke="${DR.mid}" stroke-width="1.3" stroke-dasharray="4 3"/>
    <text x="20" y="38">БЫЛО</text>
    <rect x="18" y="72" width="174" height="32" fill="${DR.earth}"/><rect x="18" y="72" width="174" height="32" fill="url(#ds-earth)"/>
    <rect x="18" y="104" width="174" height="30" fill="${DR.sand}"/><rect x="18" y="104" width="174" height="30" fill="url(#ds-sand)"/>
    <rect x="18" y="134" width="174" height="34" fill="${DR.gravel}"/>${stones(18, 134, 174, 34, 46, 7)}
    <rect x="18" y="168" width="174" height="54" fill="${DR.clay}"/><rect x="18" y="168" width="174" height="54" fill="url(#ds-hatch)"/>
    ${grassRow(18, 192, 72, 11)}
    <rect x="18" y="72" width="174" height="150" fill="none" stroke="${DR.ink}" stroke-width="1.2"/>
    <path d="M18 104h174M18 134h174M18 168h174" stroke="${DR.ink}" stroke-width=".7" opacity=".55"/>
    ${leader(192, 65, 206, 65)}${leader(192, 88, 206, 88)}${leader(192, 119, 206, 119)}${leader(192, 151, 206, 151)}${leader(192, 195, 206, 195)}
    <text x="210" y="69.5">ГАЗОН</text><text x="210" y="89">ПЛОДОРОДНЫЙ</text><text x="210" y="102">СЛОЙ</text><text x="210" y="123.5">ПЕСОК</text><text x="210" y="155.5">ЩЕБЕНЬ</text><text x="210" y="199.5">ГРУНТ</text>
  </svg>`,
  // дренаж: траншея со щебнем в геотекстиле, перфорированная труба, вода уходит из грунта
  drain: `<svg viewBox="0 0 320 240" aria-hidden="true" focusable="false">
    <defs>${soilDefs('dd')}<clipPath id="dd-trench"><path d="M116 86H204L190 214H130Z"/></clipPath>
      <marker id="dd-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8Z" fill="${DR.mid}"/></marker></defs>
    <rect x="0" y="86" width="320" height="154" fill="${DR.clay}"/><rect x="0" y="86" width="320" height="154" fill="url(#dd-hatch)"/>
    <path d="M116 86H204L190 214H130Z" fill="${DR.gravel}"/><g clip-path="url(#dd-trench)">${stones(116, 86, 88, 128, 60, 5)}</g>
    <path d="M116 86H204L190 214H130Z" fill="none" stroke="${DR.mid}" stroke-width="1.5" stroke-dasharray="4 2.6"/>
    <rect x="0" y="70" width="320" height="16" fill="${DR.earth}"/><rect x="0" y="70" width="320" height="16" fill="url(#dd-earth)"/>
    ${grassRow(0, 320, 70, 23)}
    <circle cx="160" cy="192" r="15" fill="#f4f8ee" stroke="${DR.ink}" stroke-width="1.6"/>
    <path d="M146.7 199A15 15 0 0 0 173.3 199Z" fill="${DR.water}"/>
    <circle cx="160" cy="192" r="11.5" fill="none" stroke="${DR.ink}" stroke-width=".8" opacity=".45"/>
    <g fill="${DR.ink}"><circle cx="147" cy="184.5" r="1.3"/><circle cx="153" cy="179.3" r="1.3"/><circle cx="160" cy="177.6" r="1.3"/><circle cx="167" cy="179.3" r="1.3"/><circle cx="173" cy="184.5" r="1.3"/></g>
    ${drop(62, 122)}${drop(40, 162)}${drop(86, 176)}${drop(258, 122)}${drop(280, 162)}${drop(234, 176)}
    <g fill="none" stroke="${DR.mid}" stroke-width="1.2" marker-end="url(#dd-arrow)"><path d="M72 134Q96 140 110 156"/><path d="M96 190Q108 192 120 198"/><path d="M248 134Q224 140 210 156"/><path d="M224 190Q212 192 200 198"/></g>
    ${leader(140, 112, 96, 42)}${leader(201, 112, 230, 42)}${leader(174, 202, 222, 226)}
    <text x="96" y="36" text-anchor="middle">ЩЕБЕНЬ</text><text x="232" y="36" text-anchor="middle">ГЕОТЕКСТИЛЬ</text><text x="226" y="229.5">ТРУБА</text>
  </svg>`,
  // расчистка и планировка: слева бугры, пень с корнями, доска, кирпич, камни и сорняки;
  // справа ровный плодородный слой, колышки со шнуром и уровнем — от шнура до земли везде одинаково
  clean: `<svg viewBox="0 0 320 240" aria-hidden="true" focusable="false">
    <defs>${soilDefs('dc')}<marker id="dc-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8Z" fill="${DR.mid}"/></marker></defs>
    ${weeds(68, 152, 7, 31)}${weeds(112, 158, 8, 37)}${weeds(152, 151, 4, 43, 7)}
    <path d="M0 154C12 146 24 150 36 144S58 136 72 148 98 162 116 152 146 142 160 148V178H0Z" fill="${DR.earth}"/>
    <path d="M0 154C12 146 24 150 36 144S58 136 72 148 98 162 116 152 146 142 160 148V178H0Z" fill="url(#dc-earth)"/>
    <rect x="160" y="146" width="160" height="32" fill="${DR.earth}"/><rect x="160" y="146" width="160" height="32" fill="url(#dc-earth)"/>
    <rect x="0" y="178" width="320" height="62" fill="${DR.clay}"/><rect x="0" y="178" width="320" height="62" fill="url(#dc-hatch)"/>
    <path d="M0 154C12 146 24 150 36 144S58 136 72 148 98 162 116 152 146 142 160 148" fill="none" stroke="${DR.ink}" stroke-width="1.2"/>
    <path d="M160 146H320" stroke="${DR.ink}" stroke-width="1.2"/><path d="M164 144.4H316" stroke="${DR.earth}" stroke-width="1.5" stroke-dasharray=".1 3.2" stroke-linecap="round"/>
    <path d="M0 178H320" stroke="${DR.ink}" stroke-width=".7" opacity=".55"/>
    <path d="M19 152c-4 5-10 9-17 11M41 152c5 4 11 7 18 9M30 156v12" fill="none" stroke="#8a6a48" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M16 156V110h28v46" fill="#b98f62" stroke="${DR.ink}" stroke-width="1.1"/><path d="M23 118v28M36 122v22" stroke="#8a6a48" stroke-width=".8" opacity=".7"/>
    <ellipse cx="30" cy="110" rx="14" ry="4.2" fill="#e2c79a" stroke="${DR.ink}" stroke-width="1.1"/><ellipse cx="30" cy="110" rx="7.5" ry="2.2" fill="none" stroke="#8a6a48" stroke-width=".7"/>
    <g transform="translate(84 146) rotate(12)"><rect x="-19" y="-3.5" width="38" height="7" rx="1" fill="#d9b98a" stroke="${DR.ink}" stroke-width="1"/><path d="M-15-.6h20M-4 1.6h14" stroke="#8a6a48" stroke-width=".7"/></g>
    <rect x="-7.5" y="-4" width="15" height="8" transform="translate(131 145) rotate(-8)" fill="#c4704f" stroke="${DR.ink}" stroke-width="1"/>
    <g fill="#e7eadf" stroke="#8e9785" stroke-width=".8"><ellipse cx="10" cy="151" rx="5" ry="3.2"/><ellipse cx="56" cy="140" rx="4.5" ry="3"/><ellipse cx="146" cy="144" rx="5" ry="3.4"/></g>
    <path d="M184 146V92M296 146V92" stroke="#8a6a48" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M184 100H296" stroke="${DR.ink}" stroke-width=".9"/>
    <rect x="226" y="96" width="28" height="8" rx="4" fill="${DR.pale}" stroke="${DR.ink}" stroke-width="1"/>
    <circle cx="240" cy="100" r="2.2" fill="#fff" stroke="${DR.mid}" stroke-width=".8"/><path d="M236 97v6M244 97v6" stroke="${DR.ink}" stroke-width=".6"/>
    <path d="M198 102v42M194 102h8M194 144h8M282 102v42M278 102h8M278 144h8" stroke="${DR.mid}" stroke-width=".9"/>
    <path d="M160 46V232" stroke="${DR.ink}" stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>
    <path d="M72 34H240" stroke="${DR.mid}" stroke-width="1.2" marker-end="url(#dc-arrow)"/>
    ${leader(30, 108, 30, 72)}${leader(90, 145, 100, 72)}${leader(262, 100, 262, 72)}
    <text x="20" y="38">БЫЛО</text><text x="300" y="38" text-anchor="end">СТАЛО</text>
    <text x="30" y="66" text-anchor="middle">ПНИ</text><text x="100" y="66" text-anchor="middle">МУСОР</text><text x="262" y="66" text-anchor="middle">ПЛАНИРОВКА</text>
  </svg>`,
};

const services = (list, video) => `
  <div id="uslugi" aria-labelledby="uslugi-title">
    <div ${sceneAttrs(video, true).replace('class="scene', 'class="scene scene--cover')}>
      ${stage(video)}
      <div class="sc-body"><div class="sc-col"><h3 class="sec-title sec-title--sm" id="uslugi-title" data-leaf-title>${hl('Озеленение участка *под ключ* в Новосибирске')}</h3></div></div>
    </div>
    <div class="services">
    <div class="services-track">
      ${list.map((s) => {
        const media = s.draw ? `<div class="svc-img svc-draw">${drawings[s.draw]}</div>` : s.img ? `<div class="svc-img">${picture(s.img)}</div>` : '';
        const inner = `${media}<h4>${nbsp(s.title)}</h4><p>${nbsp(s.text)}</p>${s.more ? `<span class="svc-more">${esc(s.more)} <span aria-hidden="true">→</span></span>` : ''}`;
        return s.href ? `<a class="svc svc--link" href="${s.href}">${inner}</a>` : `<article class="svc">${inner}</article>`;
      }).join('')}
      <a class="svc svc--cta" href="${wa('Здравствуйте! Хочу обсудить благоустройство участка.')}" target="_blank" rel="noopener"><span class="svc-arrow" aria-hidden="true">→</span><h4>${nbsp('Вызвать на замер')}</h4><p>${nbsp('Приедем, замерим, предложим решение')}</p></a>
      </div>
    </div>
  </div>`;

// Газон: как проходит посев (макет «Посев газона»).
const lawnBlock = () => {
  const sheet = priceSheets.find((s) => s.id === 'gazon');
  return `
  <div class="lawn" id="posev" aria-labelledby="posev-title">
    <div ${sceneAttrs(lawnVideo, false)}>
      ${stage(lawnVideo)}
      <div class="sc-body"><div class="sc-col lawn-copy">
        <h3 class="sec-title sec-title--sm" id="posev-title" data-leaf-title>${hl('Как проходит *посев*')}</h3>
        <p class="lawn-lead" data-reveal>${nbsp('Всё делаем сами: от расчистки участка до первых всходов. Травосмесь подбираем под солнце, тень и нагрузку — для детской площадки нужна одна, для парадного газона другая.')}</p>
        ${sheet ? `<dl class="lawn-prices" data-reveal>${sheet.rows.map((r) => `<div><dt>${esc(r.name)}</dt><dd class="lp-val">${priceText(r.price)}${r.unit ? `<span> за&nbsp;${esc(r.unit)}</span>` : ''}</dd>${r.note ? `<dd class="lp-note">${nbsp(r.note)}</dd>` : ''}</div>`).join('')}</dl>` : ''}
        <a class="btn btn-lime" data-reveal href="${wa('Здравствуйте! Хочу рассчитать посев газона. Площадь участка: ')}" target="_blank" rel="noopener">${waIcon}Рассчитать газон</a>
      </div></div>
    </div>
    <div class="wrap">
      <ol class="lawn-steps">
        ${lawnSteps.map((s, i) => `<li class="ls" data-reveal><figure class="ls-img">${photo(s.img)}</figure><span class="ls-num">${i + 1}</span><h4>${nbsp(s.title)}</h4><p>${nbsp(s.text)}</p></li>`).join('')}
      </ol>
    </div>
  </div>`;
};

const chapter = (c) => {
  const head = `<p class="ch-kicker"><span class="ch-num">${c.num}</span>Глава · ${esc(c.title)}</p>
      <div class="pw ch-word" data-theme="${c.theme}" data-word="${esc(c.word || c.title)}" aria-hidden="true"><span class="pw-text">${esc(c.word || c.title)}</span></div>`;
  const text = `<h2 class="ch-title" id="${c.id}-title" data-leaf-title>${nbsp(c.h2 || c.title)}</h2>
          <p class="ch-tagline" data-reveal>${nbsp(c.tagline)}</p>`;
  // С роликом главы: название на белом, а обложка — сцена на весь экран. Без ролика (пока Благоустройство) — фото в «пятне» рядом с текстом.
  const intro = c.coverVideo ? `
  <div class="ch-intro ch-intro--word">
    <div class="ch-intro-in wrap">
      ${head}
    </div>
  </div>
  <div ${sceneAttrs(c.coverVideo, false).replace('class="scene', 'class="scene scene--cover')}>
    ${stage(c.coverVideo)}
    <div class="sc-body"><div class="sc-col ch-text">
          ${text}
    </div></div>
  </div>` : `
  <div class="ch-intro">
    <div class="ch-intro-in wrap">
      ${head}
      <div class="ch-row">
        <div class="ch-text">
          ${text}
        </div>
        <div class="ch-cover" aria-hidden="true"><div class="blob">${picture(c.cover)}</div></div>
      </div>
    </div>
  </div>`;
  return `
<section class="chapter" id="${c.id}" data-theme="${c.theme}" aria-labelledby="${c.id}-title">${intro}
  <div class="ch-items${c.items.every((it) => it.video) ? '' : ' wrap'}">
    ${c.items.map((it, i) => product(it, c, i)).join('')}
  </div>
  ${c.id === 'gazon' ? lawnBlock() : ''}
  ${c.services ? services(c.services, c.servicesVideo) : ''}
</section>`;
};

// Глава «Подсветка» — чёрно-золотая кульминация (макеты 1–3).
const forIcons = ['house', 'fir', 'arch', 'shop'];
const lightChapter = (c) => {
  const L = light;
  const calc = wa('Здравствуйте! Хочу получить расчёт подсветки. Объект и район: ');
  const lead = (c.items.find((it) => it.id === 'podsvetka') || {}).lead || '';
  return `
<section class="chapter chapter--gold" id="${c.id}" data-theme="${c.theme}" data-dark aria-labelledby="${c.id}-title">
  <svg class="garland" aria-hidden="true" focusable="false"></svg>
  <div class="ch-intro ch-intro--word">
    <div class="ch-intro-in wrap">
      <p class="ch-kicker"><span class="ch-num">${c.num}</span>Глава · ${esc(c.title)}</p>
      <div class="pw ch-word" data-theme="${c.theme}" data-word="${esc(c.word || c.title)}" aria-hidden="true"><span class="pw-text">${esc(c.word || c.title)}</span></div>
    </div>
  </div>
  <div ${sceneAttrs(c.coverVideo, false).replace('class="scene', 'class="scene scene--cover')}>
    ${stage(c.coverVideo)}
    <div class="sc-body"><div class="sc-col lc-hero-text">
          <h2 class="lc-title" id="${c.id}-title" data-glow>${nbsp(c.h2)}</h2>
          <p class="ch-tagline" data-reveal>${nbsp(c.tagline)}</p>
          <p class="lc-lead" data-reveal>${nbsp(lead)}</p>
          <dl class="lc-facts" data-reveal>
            <div><dt>Замер</dt><dd>${nbsp('в день обращения, бесплатно')}</dd></div>
            <div><dt>Монтаж</dt><dd>${nbsp('часто уже на следующий день')}</dd></div>
            <div><dt>Расчёт</dt><dd>${nbsp('за один рабочий день')}</dd></div>
          </dl>
          <div class="lc-hero-cta" data-reveal><a class="btn btn-gold" href="${calc}" target="_blank" rel="noopener">${waIcon}Получить расчёт</a><a class="lc-phone" href="tel:${company.phoneHref}">${esc(company.phone)}</a></div>
    </div></div>
  </div>

  <div class="lc-block lc-services" id="podsvetka" aria-labelledby="lc-svc-title">
    <div class="wrap">
      <div class="lc-head">
        <h3 class="lc-h3" id="lc-svc-title" data-glow>Световое оформление под&nbsp;ключ</h3>
      </div>
      <ul class="lc-for" aria-label="Для кого">
        ${L.forWhom.map((f, i) => `<li data-reveal>${icon(forIcons[i] || 'bulb')}<span>${nbsp(f)}</span></li>`).join('')}
      </ul>
    </div>
    ${L.services.map((s, i) => `<article ${sceneAttrs(s.video, !(i % 2))} id="${s.id}" aria-labelledby="${s.id}-t">
      ${stage(s.video)}
      <div class="sc-body"><div class="sc-col">
        <div class="lc-svc-body" data-reveal>
          <h4 id="${s.id}-t">${nbsp(s.title)}</h4>
          <ul>${s.points.map((p) => `<li>${nbsp(p)}</li>`).join('')}</ul>
          ${s.more ? `<a class="lc-more" href="${s.more.href}">${esc(s.more.label)} <span aria-hidden="true">↓</span></a>` : ''}
        </div>
        <p class="lc-svc-price" data-reveal>${s.price.from ? `<span class="lc-from">от</span> ${money(s.price.from)}&nbsp;₽` : priceText(s.price)}</p>
        ${i === L.services.length - 1 ? `<p class="lc-note" data-reveal>${nbsp(L.note)}</p>` : ''}
      </div></div>
    </article>`).join('')}
  </div>

  <div class="lc-block lc-colors wrap" data-reveal aria-labelledby="lc-colors-title">
    <div class="lc-colors-copy">
      <h3 class="lc-h4" id="lc-colors-title">Любой цвет гирлянды</h3>
      <p>${nbsp('Тёплый белый — классика для дерева и камня, холодный хорошо смотрится на снегу и современных фасадах. Цветные — для праздника и детских площадок.')}</p>
    </div>
    <ul class="lc-swatches">
      ${L.colors.map((col) => `<li><span class="sw${col.hex ? '' : ' sw--multi'}"${col.hex ? ` style="--c:${col.hex}"` : ''} aria-hidden="true"></span>${esc(col.name)}</li>`).join('')}
    </ul>
  </div>

  <div class="lc-block lc-places wrap" aria-labelledby="lc-places-title">
    <div class="lc-places-copy">
      <p class="eyebrow">Украшение домов гирляндами</p>
      <h3 class="lc-h3" id="lc-places-title" data-glow>Крыши, балконы, входные группы</h3>
      <p data-reveal>${nbsp('Бахрома по карнизу, занавес на перилах, огни на козырьке и ёлках у двери. Берём уличные гирлянды — они не боятся влаги и мороза, а крепления не портят фасад.')}</p>
    </div>
    <ul class="lc-places-list">
      ${L.places.map((p) => `<li data-reveal><figure data-lit>${photo(p.img)}</figure><h4>${nbsp(p.title)}</h4>${p.text ? `<p>${nbsp(p.text)}</p>` : ''}</li>`).join('')}
    </ul>
  </div>

  <div class="lc-block lc-trees" id="ukrashenie-derevev" aria-labelledby="lc-trees-title">
    <div ${sceneAttrs(L.treesVideo, false)}>
      ${stage(L.treesVideo)}
      <div class="sc-body"><div class="sc-col lc-trees-copy">
        <h3 class="lc-h3" id="lc-trees-title" data-glow>Украшение деревьев</h3>
        <p data-reveal>${nbsp('Обматываем стволы и ветви, подсвечиваем кроны снизу. Одно дерево у крыльца, аллея к дому или целая улица у кафе и гостиницы — считаем под задачу.')}</p>
      </div></div>
    </div>
    <ul class="wrap lc-solutions" aria-label="Наши решения">
      ${L.solutions.map((s) => `<li data-reveal><figure data-lit>${photo(s.img)}</figure><h4>${nbsp(s.title)}</h4>${s.text ? `<p>${nbsp(s.text)}</p>` : ''}</li>`).join('')}
    </ul>
  </div>

  <div class="lc-block lc-steps wrap" aria-labelledby="lc-steps-title">
    <h3 class="lc-rule-title" id="lc-steps-title">Как мы работаем</h3>
    <ol class="lc-steps-list">
      ${L.steps.map((s, i) => `<li data-reveal><span class="lc-step-n">${i + 1}</span><h4>${nbsp(s.title)}</h4><p>${nbsp(s.text)}</p></li>`).join('')}
    </ol>
    <div class="lc-cta" data-reveal>
      <p class="lc-promise">${nbsp(L.promise)}</p>
      <a class="btn btn-gold btn-lg" href="${calc}" target="_blank" rel="noopener">${waIcon}Получить расчёт</a>
      <p class="lc-cta-sub">или позвоните: <a href="tel:${company.phoneHref}">${esc(company.phone)}</a></p>
    </div>
  </div>
</section>`;
};

const whyUs = () => `
<section class="why" aria-labelledby="why-title">
  <div class="wrap why-grid">
    <figure class="why-photo" data-reveal>${photo('p-tui-c')}</figure>
    <div class="why-copy">
      <p class="eyebrow">Почему Green Life</p>
      <h2 class="sec-title" id="why-title" data-leaf-title>${hl('Саженцы, которые *приживаются*')}</h2>
      <ul class="why-list">
        ${guarantees.map((g) => `<li class="why-item" data-reveal><span class="why-ico">${icon(g.icon)}</span><h3>${nbsp(g.title)}</h3><p>${nbsp(g.text)}</p></li>`).join('')}
      </ul>
    </div>
  </div>
</section>`;

// Общий порядок работы — одной строкой на лозе (у газона и подсветки свои шаги, здесь без карточек).
const howWeWork = () => `
<section class="steps" aria-labelledby="steps-title">
  <div class="steps-bg" aria-hidden="true">${picture({ src: 'img/bg-ramka.webp', w: 1200, h: 1600, alt: '' })}</div>
  <div class="wrap">
    <p class="eyebrow">Порядок работы</p>
    <h2 class="sec-title sec-title--sm" id="steps-title" data-leaf-title>${hl('От заявки *до цветения*')}</h2>
    <div class="steps-body">
      <span class="steps-line" aria-hidden="true"></span>
      <ol class="steps-list">
        ${steps.map((s) => `<li class="step"><span class="step-dot" aria-hidden="true">${leafIcon}</span><h3>${nbsp(s.title)}</h3><p>${nbsp(s.text)}</p></li>`).join('')}
      </ol>
    </div>
  </div>
</section>`;

const trust = () => `
<section class="trust" aria-labelledby="trust-title">
  <div class="wrap trust-grid">
    <div class="partners">
      <h2 class="sec-title sec-title--sm" id="trust-title" data-leaf-title>${hl('Нам доверяют *в Новосибирске*')}</h2>
      ${partners.map((p) => `<article class="partner" data-reveal><div class="partner-logo">${picture(p.logo)}</div><div><h3>${esc(p.name)}</h3><p>${nbsp(p.text)}</p></div></article>`).join('')}
    </div>
    <div class="reviews">
      <h3 class="sr-only">Отзывы</h3>
      ${reviews.map((r) => `<figure class="review" data-reveal><blockquote>${nbsp(r.text)}</blockquote><figcaption>${esc(r.name)}</figcaption></figure>`).join('')}
    </div>
  </div>
</section>`;

const deliveryBlock = () => `
<section class="delivery" id="dostavka" aria-labelledby="delivery-title">
  <div class="wrap delivery-grid">
    <div>
      <h2 class="sec-title sec-title--sm" id="delivery-title" data-leaf-title>${hl('Доставим по городу, *отправим по России*')}</h2>
      <ul class="delivery-list">
        ${delivery.map((d) => `<li data-reveal><h3>${nbsp(d.title)}</h3><p>${nbsp(d.text)}</p></li>`).join('')}
      </ul>
    </div>
    <div class="faq">
      <h2 class="sec-title sec-title--sm" data-leaf-title>${hl('Частые *вопросы*')}</h2>
      ${faq.map((f) => `<details class="faq-item" data-reveal><summary>${nbsp(f.q)}</summary><p>${nbsp(f.a)}</p></details>`).join('')}
    </div>
  </div>
</section>`;

// Прайс по макетам «Благоустройство и озеленение»: плашки групп, отточия, цены по правому краю.
const sheetIcons = { tsvety: 'flower', hvoynye: 'fir', tuya: 'cypress', listvennye: 'tree', dekor: 'sprig', plodovye: 'cherry', gazon: 'grass', svet: 'bulb' };
// «Смарагд 50–60 см» → сорт + размер (размер — тише, чтобы колонка читалась)
const splitSize = (name) => {
  const m = String(name).match(/^(.*?)\s+((?:от\s)?[\d.,–-]+\s?(?:см|м))$/);
  return m ? `${nbsp(m[1])} <span class="pl-size">${esc(m[2]).replace(/ /g, '&nbsp;')}</span>` : nbsp(name);
};
const sheetRow = (r) => {
  const value = r.price ? `${priceText(r.price)}${r.unit ? `<span class="pl-unit"> / ${esc(r.unit)}</span>` : ''}` : `<span class="pl-ask">${esc(r.note || 'по запросу')}</span>`;
  const note = r.price && r.note ? `<small>${nbsp(r.note)}</small>` : '';
  return `<div class="pl"><dt>${splitSize(r.name)}${note}</dt><dd>${value}</dd></div>`;
};
const sheet = (s) => `
      <article class="sheet sheet--${s.id}${s.dark ? ' sheet--gold' : ''}" aria-labelledby="sh-${s.id}" data-reveal>
        <header class="sheet-head"><span class="sheet-ico">${icon(sheetIcons[s.id] || 'leaf')}</span><h3 id="sh-${s.id}">${nbsp(s.title)}${s.sub ? ` <span class="sheet-sub">${esc(s.sub)}</span>` : ''}</h3></header>
        <dl class="sheet-list">${s.rows.map(sheetRow).join('')}</dl>
        ${s.note ? `<p class="sheet-note">${nbsp(s.note)}</p>` : ''}
      </article>`;

const priceList = () => `
<section class="price" id="prays" data-dark aria-labelledby="price-title">
  <div class="price-bg" aria-hidden="true">${picture({ src: 'img/bg-les.webp', w: 1920, h: 1282, alt: '' })}</div>
  <div class="wrap">
    <div class="price-head">
      <p class="eyebrow">Прайс-лист · ${esc(company.city)} и область</p>
      <h2 class="sec-title" id="price-title" data-leaf-title>${hl('Цены на растения *и работы*')}</h2>
      <p class="sec-lead">${nbsp('Цены за штуку, если не указано иное. Напишите — пришлём фото растений в наличии и посчитаем заказ целиком, со скидкой на объём.')}</p>
    </div>
    <div class="price-grid">
      <div class="price-sheets">
        ${priceSheets.map(sheet).join('')}
      </div>
      <aside class="price-aside" aria-label="Заявка">
        <div class="price-cta">
          <p class="price-cta-t">Оставьте заявку</p>
          <p>${nbsp('Бесплатно проконсультируем, подберём растения под участок и пришлём фото именно ваших саженцев.')}</p>
          <a class="btn btn-lime" href="${waMain}" target="_blank" rel="noopener">${waIcon}Написать в WhatsApp</a>
          <a class="price-phone" href="tel:${company.phoneHref}">${phoneIcon}${esc(company.phone)}</a>
        </div>
      </aside>
    </div>
    <ul class="price-notes">
      ${priceNotes.map((n) => `<li>${nbsp(n)}</li>`).join('')}
    </ul>
  </div>
</section>`;

const contact = () => `
<section class="contact" id="kontakty" data-dark aria-labelledby="contact-title">
  <div class="contact-bg" aria-hidden="true">${picture({ src: 'img/bg-plyushch.webp', w: 1920, h: 1279, alt: '' })}</div>
  <div class="wrap contact-grid">
    <div class="contact-copy">
      <p class="eyebrow">Консультация — бесплатно</p>
      <h2 class="sec-title" id="contact-title" data-leaf-title>${hl('Подберём растения *под ваш участок*')}</h2>
      <p class="hand hand--contact" aria-hidden="true">Делаем пространство лучше!</p>
      <p class="sec-lead">${nbsp('Напишите Алёне — пришлём прайс, фото саженцев в наличии и условия доставки.')}</p>
      <ul class="contact-list">
        <li><a class="btn btn-lime btn-lg" href="${waMain}" target="_blank" rel="noopener">${waIcon}Написать в WhatsApp</a></li>
        <li><a class="contact-phone" href="tel:${company.phoneHref}">${esc(company.phone)}</a></li>
        <li class="contact-avito">${company.avito.map((a) => `<a href="${a.href}" target="_blank" rel="noopener">${esc(a.label)}</a>`).join('')}</li>
      </ul>
    </div>
  </div>
</section>`;

const footer = () => `
<footer class="footer">
  <div class="wrap footer-grid">
    <div>${logo('logo--light')}<p class="footer-tag">${esc(company.tagline)}. ${esc(company.city)} и вся Россия.</p></div>
    <nav class="footer-nav" aria-label="Разделы">${chapters.map((c) => `<a href="#${c.id}">${esc(c.title)}</a>`).join('')}</nav>
    <div class="footer-contacts"><a href="tel:${company.phoneHref}">${esc(company.phone)}</a><a href="${company.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>${company.avito.map((a) => `<a href="${a.href}" target="_blank" rel="noopener">${esc(a.label)}</a>`).join('')}</div>
  </div>
  <div class="wrap footer-legal">
    <p>${nbsp('Живые растения надлежащего качества обмену не подлежат — согласно перечню непродовольственных товаров, утверждённому Правительством РФ (позиция «Животные и растения»). При заказе с доставкой действуют правила дистанционной продажи (ст. 26.1 Закона РФ «О защите прав потребителей»).')}</p>
    <p>© ${new Date().getFullYear()} Green Life · Благоустройство и озеленение</p>
  </div>
</footer>`;

// Меню «Смотреть всё»: разделы сгруппированы так, как о них думает посетитель.
const sectionGroups = [
  { title: 'Цветы', ids: ['rozy', 'kustarniki', 'tyulpany'] },
  { title: 'Деревья', ids: ['hvoynye', 'derevya', 'sad'] },
  { title: 'Газон и участок', ids: ['gazon', 'blagoustroystvo'] },
  { title: 'Освещение', ids: ['svet'] },
];
const sectionsMenu = () => `
<div class="sections" id="sections" role="dialog" aria-modal="true" aria-labelledby="sections-title" hidden>
  <div class="sections-in" tabindex="-1">
    <button class="sections-close" type="button" aria-label="Закрыть меню разделов">×</button>
    <h2 class="sections-title" id="sections-title">Куда отправимся?</h2>
    <div class="sections-groups">
      ${sectionGroups.map((gr) => `<div class="sec-group"><h3>${esc(gr.title)}</h3><ul>${gr.ids.map((id) => chapters.find((c) => c.id === id)).filter(Boolean).map((c) => `<li><a class="sec-btn" href="#${c.id}" data-theme="${c.theme}"><span class="sec-ico" aria-hidden="true">${menuIcons[c.theme] || leafIcon}</span><span class="sec-txt"><span class="sec-label">${esc(c.title)}</span><span class="sec-tag">${nbsp(c.tagline)}</span></span></a></li>`).join('')}</ul></div>`).join('')}
    </div>
  </div>
</div>`;

const widget = () => `
<div class="wa-widget" data-wa-widget>
  <div class="wa-bubble" role="status" hidden>
    <button class="wa-close" type="button" aria-label="Скрыть сообщение">×</button>
    <p class="wa-from">${esc(company.founder)} · основатель Green Life</p>
    <p>Здравствуйте! Я Алёна. Пришлю прайс и фото саженцев в наличии — напишите мне.</p>
  </div>
  <a class="wa-btn" href="${waMain}" target="_blank" rel="noopener" aria-label="Написать в WhatsApp">${waIcon}</a>
</div>
<nav class="mbar" aria-label="Быстрая связь">
  <a href="tel:${company.phoneHref}">${phoneIcon}Позвонить</a>
  <a class="mbar-wa" href="${waMain}" target="_blank" rel="noopener">${waIcon}WhatsApp</a>
</nav>`;

const header = () => `
<header class="hdr" data-hdr>
  <div class="hdr-in">
    ${logo()}
    <nav class="nav" id="nav" aria-label="Основное меню">
      <a href="#rozy">Саженцы</a><a href="#uslugi">Озеленение</a><a href="#svet">Подсветка</a><a href="#prays">Цены</a><a href="#kontakty">Контакты</a>
    </nav>
    <button class="snd-btn" type="button" data-sound aria-pressed="false" aria-label="Звуки природы" title="Звуки природы"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="snd-wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="snd-off" d="m16 9.5 5 5m0-5-5 5"/></svg><span>Звук</span></button>
    <a class="hdr-phone" href="tel:${company.phoneHref}">${esc(company.phone)}</a>
    <a class="btn btn-lime btn-sm hdr-cta" href="${wa('Здравствуйте! Пришлите, пожалуйста, прайс.')}" target="_blank" rel="noopener" aria-label="Написать в WhatsApp">${waIcon}<span>WhatsApp</span></a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="Меню"><span></span><span></span></button>
  </div>
  <div class="hdr-vine" aria-hidden="true"><svg viewBox="0 0 1000 14" preserveAspectRatio="none"><path class="hv-track" d="M0 7 C 125 3, 250 11, 375 7 S 625 3, 750 7 S 875 11, 1000 7"/><path class="hv-fill" d="M0 7 C 125 3, 250 11, 375 7 S 625 3, 750 7 S 875 11, 1000 7"/></svg><div class="hv-nodes"></div></div>
</header>`;

const title = 'Саженцы и озеленение участка в Новосибирске — питомник Green Life';
const description = 'Саженцы туй, роз, сирени, гортензий, яблонь и ягодных для Сибири с гарантией приживаемости. Озеленение участка под ключ, газон, плитка, подсветка дома гирляндами. Новосибирск, отправка по России.';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['GardenStore', 'HomeAndConstructionBusiness'], ...(SITE ? { '@id': `${abs('')}#org`, url: abs('') } : {}),
      name: 'Green Life', alternateName: 'Грин Лайф', description, telephone: company.phoneHref, image: abs('img/og.jpg'),
      currenciesAccepted: 'RUB',
      address: { '@type': 'PostalAddress', addressLocality: company.city, addressRegion: 'Новосибирская область', addressCountry: 'RU' },
      areaServed: [{ '@type': 'City', name: 'Новосибирск' }, { '@type': 'Country', name: 'Россия' }],
      sameAs: company.avito.map((a) => a.href),
      hasOfferCatalog: {
        '@type': 'OfferCatalog', name: 'Каталог саженцев и услуг',
        itemListElement: chapters.map((c) => ({ '@type': 'OfferCatalog', name: c.h2 || c.title, itemListElement: c.items.map((it) => ({ '@type': 'Offer', itemOffered: { '@type': 'Product', name: it.nameFull || it.name } })) })),
      },
    },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ],
};

// Порядок страницы: сразу за титулом — товар (главы 01–08), за ним сервис, партнёры, сезон, оглавление и цифры;
// светлая часть кончается — тёмно-зелёный прайс, чёрно-золотая «Подсветка», контакты.
const lightChapters = chapters.filter((c) => !c.dark);
const darkChapters = chapters.filter((c) => c.dark);

// Запасной таймер. .fx прячет текст до его появления: если за 5 с страница не готова, снимаем .fx, и текст виден без анимации.
// .js — кнопки и меню работают. Его снимаем, только если main.js ещё не доехал (без него кнопки мёртвые); доехав, main.js вернёт его сам.
// Тогда же показываем постеры, но лишь сценам у экрана и в телефонном варианте: 35 картинок разом на слабой сети отбирали бы канал у самого скрипта.
const bootScript = `<script>(function(){var r=document.documentElement,c=r.classList;c.add('js','fx');setTimeout(function(){if(c.contains('gl-ready'))return;c.remove('fx');if(window.GLMain)return;c.remove('js');var m=matchMedia('(max-width:700.98px)').matches,p=function(v){v.setAttribute('poster',m&&v.getAttribute('data-end-m')||v.getAttribute('data-end'))},l=document.querySelectorAll('video[data-end]');if(!window.IntersectionObserver)return l.forEach(p);var o=new IntersectionObserver(function(e){if(window.GLMain)return o.disconnect();e.forEach(function(x){if(x.isIntersecting){o.unobserve(x.target);p(x.target)}})},{rootMargin:'100% 0px'});l.forEach(function(v){o.observe(v)})},5000)})()</script>`;

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#f4f8ee">
${SITE ? `<link rel="canonical" href="${abs('')}">\n<meta property="og:url" content="${abs('')}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="Green Life">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="Green Life — саженцы и озеленение участков в Новосибирске">
<meta property="og:description" content="Сибирские сорта с гарантией приживаемости, газон, плитка и подсветка дома под ключ. Отправка по России.">
<meta property="og:image" content="${abs('img/og.jpg')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/oswald-cyrillic-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/montserrat-cyrillic-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/montserrat-cyrillic-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/main.css?v=${V}">
${bootScript}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
${sprite}
<a class="skip" href="#rozy">К саженцам</a>
${header()}
<div class="deco deco-l" aria-hidden="true"></div>
<div class="deco deco-r" aria-hidden="true"></div>
<div class="drift" aria-hidden="true"></div>
<main>
${hero()}
${lightChapters.map(chapter).join('\n')}
${whyUs()}
${howWeWork()}
${deliveryBlock()}
${trust()}
${promoBlock()}
${catalogIndex()}
${manifest()}
${priceList()}
${darkChapters.map(lightChapter).join('\n')}
${contact()}
</main>
${footer()}
${widget()}
${sectionsMenu()}
<script src="vendor/gsap.min.js" defer></script>
<script src="vendor/ScrollTrigger.min.js" defer></script>
<script src="vendor/SplitText.min.js" defer></script>
<script src="vendor/DrawSVGPlugin.min.js" defer></script>
<script src="vendor/lenis.min.js" defer></script>
<script src="js/grow.js?v=${V}" defer></script>
<script src="js/sound.js?v=${V}" defer></script>
<script src="js/plantword.js?v=${V}" defer></script>
<script src="js/main.js?v=${V}" defer></script>
</body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);

// robots.txt и sitemap.xml имеют смысл только с известным адресом сайта.
if (SITE) {
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nDisallow: /src/\nDisallow: /README.md\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&ysclid&gclid\n\nSitemap: ${abs('sitemap.xml')}\n`);
  writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${abs('')}</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`);
} else {
  for (const f of ['robots.txt', 'sitemap.xml']) if (existsSync(join(root, f))) rmSync(join(root, f));
}

console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB, глав: ${chapters.length}, позиций: ${chapters.reduce((n, c) => n + c.items.length, 0)}, групп прайса: ${priceSheets.length}${SITE ? `, сайт: ${abs('')}` : ', адрес сайта не задан (company.siteUrl)'}`);
