/* Applica subito tema e zoom salvati, per evitare lampi di colore al caricamento */
try {
  var t = localStorage.getItem('fdi-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  var z = parseInt(localStorage.getItem('fdi-zoom'), 10) || 100;
  document.documentElement.style.setProperty('--z', z / 100);
} catch (e) {}


/* =====================================================================
   CATALOGO DELLE LEZIONI (Day)
   Per aggiungere un nuovo giorno:
   1. duplica appunti/_template-day.html e rinominalo (es. day-04.html);
   2. aggiungi qui sotto una nuova voce con n, title, file e (facoltativa)
      date nel formato 'aaaa-mm-gg'. Senza date, la data non viene mostrata.
   Pallini, menu e navigatore si aggiornano da soli.
   Il titolo (e l'etichetta "Day N") è generato da JavaScript: nei file
   degli appunti NON va ripetuto.
   ===================================================================== */
var days = [
  {
    n: 1,
    title: 'Rappresentazione dell\u2019informazione e sistemi di numerazione',
    file: 'appunti/day-01.html',
    date: '2026-09-22'
  },
  {
    n: 2,
    title: 'Elaborazione dell\u2019informazione',
    file: 'appunti/day-02.html',
    date: '2026-09-29'
  },
  {
    n: 3,
    title: 'Dall\u2019assembler al C: variabili, condizioni, cicli e array',
    file: 'appunti/day-03.html',
    date: '2026-10-06'
  }
];
days.sort(function (a, b) { return a.n - b.n; });


/* =====================================================================
   CATALOGO DELLE ESERCITAZIONI
   Stessa procedura dei Day: duplica appunti/_template-day.html, rinominalo
   (es. esercitazione-1.html) e aggiungi qui una voce (date facoltativa).
   L'etichetta "Esercitazione N" sopra il titolo è generata da JavaScript.
   ===================================================================== */
var esercitazioni = [
  {
    n: 1,
    title: 'Rappresentazione dell\u2019informazione',
    file: 'appunti/esercitazione-1.html',
    date: '2026-09-24' /* date: 'aaaa-mm-gg'  (facoltativa) */
  },
  {
    n: 2,
    title: 'Conversioni, IEEE 754 e programmi in assembler',
    file: 'appunti/esercitazione-2.html',
    date: '2026-10-08' /* date: 'aaaa-mm-gg'  (facoltativa) */
  }
];
esercitazioni.sort(function (a, b) { return a.n - b.n; });


/* =====================================================================
   SEZIONI
   name   = nome mostrato nel menu della barra in alto
   label  = parola sopra il titolo ("Day 3", "Esercitazione 2")
   prefix = prefisso dell'hash URL (#day-3, #es-2)
   list   = catalogo corrispondente
   key    = chiave localStorage dell'ultimo elemento letto
   ===================================================================== */
var cats = {
  lezioni:       { name: 'Lezioni',       label: 'Day',           prefix: 'day', list: days,          key: 'a1-day' },
  esercitazioni: { name: 'Esercitazioni', label: 'Esercitazione', prefix: 'es',  list: esercitazioni, key: 'a1-es'  }
};
var modeOrder = ['lezioni', 'esercitazioni'];


document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var main = $('content'), menu = $('dayMenu'), dotsBtn = $('dotsBtn');
  var modeBtn = $('modeBtn'), modeMenu = $('modeMenu');
  var prevBtn = $('prevBtn'), nextBtn = $('nextBtn');
  var aaBtn = $('aaBtn'), settings = $('settings');
  var dock = $('dock'), tocBtn = $('tocBtn'), tocPanel = $('tocPanel');
  var mode = 'lezioni';
  var cur = 0;
  var requestId = 0;   /* per ignorare risposte fetch "vecchie" se cambio appunto velocemente */
  var cache = {};      /* file già scaricati: evita di riscaricarli */

  function items() { return cats[mode].list; }

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(main, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false
      });
    }
  }

  /* ---------- Data: "Mon 05/10/2026" ---------- */
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(str, short) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    if (!m) return '';
    var dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return WD[dt.getDay()] + ', ' + m[3] + '/' + m[2] + (short ? '' : '/' + m[1]);
  }

  /* ---------- Indice della pagina ---------- */
  var tocHeads = [], tocItems = [];
  function buildToc() {
    tocPanel.innerHTML = '';
    tocHeads = []; tocItems = [];
    var hs = main.querySelectorAll('h2, h3'), i = 0;
    var t = document.createElement('div');
    t.className = 'toc-t'; t.textContent = 'Indice';
    tocPanel.appendChild(t);
    Array.prototype.forEach.call(hs, function (h) {
      if (!h.id) h.id = 'sec-' + (++i);
      var b = document.createElement('button');
      b.className = 'toc-i' + (h.tagName === 'H3' ? ' sub' : '');

      b.innerHTML = h.innerHTML;
      var plain = h.cloneNode(true);
      Array.prototype.forEach.call(plain.querySelectorAll('.katex-mathml'), function (n) { n.remove(); });
      b.title = plain.textContent;
      
      tocHeads.push(h); tocItems.push(b);
      b.addEventListener('click', function () {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeAll();
      });
      tocPanel.appendChild(b);
    });
    tocBtn.hidden = !hs.length;
    layoutToc();
    updateSpy();
  }
  /* evidenzia nell'indice la sezione che stai leggendo */
  var spyOn = -1;
  function updateSpy() {
    var k = -1;
    for (var i = 0; i < tocHeads.length; i++) {
      if (tocHeads[i].getBoundingClientRect().top <= 100) k = i; else break;
    }
    if (k === spyOn) return;
    spyOn = k;
    tocItems.forEach(function (b, i) { b.classList.toggle('on', i === k); });
    if (k >= 0 && !tocPanel.hidden) {
      var it = tocItems[k];
      tocPanel.scrollTop = it.offsetTop - tocPanel.clientHeight / 2 + it.offsetHeight / 2;
    }
  }
  var spyTick = false;
  window.addEventListener('scroll', function () {
    if (!tocPanel.hidden) closeToc();   /* scorri = non ti serve più l'indice */
    if (!spyTick) { spyTick = true; requestAnimationFrame(function () { spyTick = false; updateSpy(); }); }
  }, { passive: true });
  /* Se ai lati del testo c'è abbastanza spazio (PC/tablet) il pulsante sta a sinistra,
     con margini proporzionali allo spazio libero; altrimenti si affianca alla barra in basso. */
  function layoutToc() {
    var gap = main.getBoundingClientRect().left;
    var side = gap >= 220;
    document.body.classList.toggle('side', side);
    if (side) {
      if (tocBtn.parentNode !== document.body) document.body.appendChild(tocBtn);
      var x = Math.round(gap * 0.08);
      tocBtn.style.left = x + 'px';
      tocPanel.style.left = x + 'px';
      tocPanel.style.width = Math.min(300, Math.round(gap * 0.84)) + 'px';
    } else {
      if (tocBtn.parentNode !== dock) dock.appendChild(tocBtn);
      tocBtn.style.left = ''; tocPanel.style.left = ''; tocPanel.style.width = '';
    }
  }
  var tocCloseT;
  function hideTocNow() {
    clearTimeout(tocCloseT);
    tocPanel.classList.remove('closing');
    tocPanel.hidden = true;
    tocBtn.setAttribute('aria-expanded', 'false');
  }
  function closeToc() {   /* chiusura con fade + il triangolo torna indietro */
    if (tocPanel.hidden || tocPanel.classList.contains('closing')) return;
    tocBtn.setAttribute('aria-expanded', 'false');
    tocPanel.classList.add('closing');
    tocCloseT = setTimeout(hideTocNow, 220);
  }
  function openToc() {
    clearTimeout(tocCloseT);
    tocPanel.classList.remove('closing');
    tocPanel.hidden = false;
    tocBtn.setAttribute('aria-expanded', 'true');
    spyOn = -2; updateSpy();
    tocPanel.style.animation = 'none';   /* l'animazione parte dal centro del cerchio */
    var f = tocBtn.getBoundingClientRect(), p = tocPanel.getBoundingClientRect();
    tocPanel.style.transformOrigin = (f.left + f.width / 2 - p.left) + 'px ' + (f.top + f.height / 2 - p.top) + 'px';
    tocPanel.style.animation = '';
  }
  tocBtn.addEventListener('click', function () {
    var wasOpen = !tocPanel.hidden && !tocPanel.classList.contains('closing');
    closeAll();
    if (!wasOpen) openToc();
  });
  window.addEventListener('resize', layoutToc);

  /* ---------- Hash URL: #day-N (lezioni), #es-N (esercitazioni) ---------- */
  function parseHash() {
    var m = /^#(day|es)-(\d+)$/.exec(location.hash);
    if (!m) return null;
    var md = null;
    modeOrder.forEach(function (k) { if (cats[k].prefix === m[1]) md = k; });
    if (!md) return null;
    var n = parseInt(m[2], 10), idx = -1;
    cats[md].list.forEach(function (d, k) { if (d.n === n) idx = k; });
    if (idx === -1) return null;
    return { mode: md, idx: idx };
  }
  function syncHash(d, push) {
    var h = '#' + cats[mode].prefix + '-' + d.n;
    if (location.hash === h) return;
    try {
      if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
    } catch (e) {
      location.hash = h;
    }
  }
  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  /* Indice dell'ultimo appunto letto in una sezione (o 0) */
  function startIndex(md) {
    var saved = load(cats[md].key);
    var want = parseInt(saved, 10), idx = 0;
    cats[md].list.forEach(function (d, k) { if (d.n === want) idx = k; });
    return idx;
  }

  /* ---------- Caricamento del file di una giornata ---------- */
  function fetchDay(d) {
    if (cache[d.file] !== undefined) return Promise.resolve(cache[d.file]);
    return fetch(d.file).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      cache[d.file] = html;
      return html;
    });
  }

  function showLoading() {
    var p = document.createElement('p');
    p.className = 'eyebrow';
    p.setAttribute('role', 'status');
    p.textContent = 'Caricamento degli appunti…';
    main.appendChild(p);
  }

  function showError(d) {
    var box = document.createElement('div');
    box.className = 'box warn';
    var bt = document.createElement('div');
    bt.className = 'bt';
    bt.textContent = 'Impossibile caricare gli appunti';
    var p1 = document.createElement('p');
    p1.appendChild(document.createTextNode('Non sono riuscito a caricare il file '));
    var f = document.createElement('strong');
    f.textContent = d.file;
    p1.appendChild(f);
    p1.appendChild(document.createTextNode('. Controlla che esista e che il percorso nel catalogo sia corretto, poi riprova.'));
    var p2 = document.createElement('p');
    p2.textContent = 'Se hai aperto index.html con doppio click (file://), il browser blocca il caricamento: usa GitHub Pages oppure un server locale come Live Server.';
    box.appendChild(bt); box.appendChild(p1); box.appendChild(p2);
    main.appendChild(box);
  }

  /* Sezione senza appunti */
  function showEmpty(animate) {
    cur = 0;
    ++requestId;   /* annulla eventuali fetch ancora in corso */
    main.innerHTML = '';
    var ey = document.createElement('p');
    ey.className = 'eyebrow';
    ey.textContent = cats[mode].name;
    var h = document.createElement('h1');
    h.textContent = 'Nessun appunto per ora';
    var p = document.createElement('p');
    p.textContent = 'Questa sezione non contiene ancora nessun appunto. Quando ne aggiungerai uno al catalogo, comparirà qui.';
    main.appendChild(ey); main.appendChild(h); main.appendChild(p);
    buildToc();
    main.removeAttribute('aria-busy');

    if (animate) { main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }
    window.scrollTo(0, 0);
    clearHash();
    updateNav();
  }

  function show(i, animate, pushHash) {
    var list = items();
    if (!list.length) { showEmpty(animate); return; }

    cur = Math.max(0, Math.min(list.length - 1, i));
    var d = list[cur];
    var myRequest = ++requestId;

    /* titolo subito visibile, poi stato di caricamento */
    main.innerHTML = '<p class="eyebrow"></p><h1></h1>';
    var ey = main.querySelector('.eyebrow');
    var lab = document.createElement('span');
    lab.textContent = cats[mode].label + ' ' + d.n;
    ey.appendChild(lab);
    var ds = fmtDate(d.date);
    if (ds) {
      var dd = document.createElement('span');
      dd.className = 'edate'; dd.textContent = ds;
      ey.appendChild(dd);
    }
    hideTocNow();
    main.querySelector('h1').textContent = d.title;
    main.setAttribute('aria-busy', 'true');
    showLoading();

    if (animate) { main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }
    window.scrollTo(0, 0);
    store(cats[mode].key, d.n);
    syncHash(d, pushHash);
    updateNav();

    fetchDay(d).then(function (html) {
      if (myRequest !== requestId) return;   /* nel frattempo ho cambiato appunto */
      var status = main.querySelector('[role="status"]');
      if (status) status.remove();
      main.insertAdjacentHTML('beforeend', html);
      main.removeAttribute('aria-busy');
      renderMath();
      buildToc();
    }).catch(function (err) {
      if (myRequest !== requestId) return;
      var status = main.querySelector('[role="status"]');
      if (status) status.remove();
      main.removeAttribute('aria-busy');
      showError(d);
      if (window.console) console.error('Errore nel caricamento di ' + d.file + ':', err);
    });
  }

  function go(delta) {
    if (!items().length) return;
    show(cur + delta, true, true);
  }

  function updateNav() {
    var list = items();
    var empty = list.length === 0;
    var label = cats[mode].label;

    dotsBtn.innerHTML = '';
    if (empty) {
      /* navigatore disabilitato: un solo pallino spento */
      var sp0 = document.createElement('span');
      sp0.className = 'dot';
      dotsBtn.appendChild(sp0);
      dotsBtn.setAttribute('aria-label', 'Nessun appunto disponibile in ' + cats[mode].name);
      setOpen(menu, dotsBtn, false);
    } else {
      list.forEach(function (d, k) {
        var sp = document.createElement('span');
        sp.className = 'dot' + (k === cur ? ' on' : '');
        dotsBtn.appendChild(sp);
      });
      dotsBtn.setAttribute('aria-label', 'Scegli ' + (mode === 'lezioni' ? 'il ' : 'l\u2019') + label + ', ora ' + label + ' ' + list[cur].n);
    }
    dotsBtn.disabled = empty;
    prevBtn.disabled = empty || cur === 0;
    nextBtn.disabled = empty || cur === list.length - 1;
    prevBtn.setAttribute('aria-label', label + ' precedente');
    nextBtn.setAttribute('aria-label', label + ' successivo');

    Array.prototype.forEach.call(menu.children, function (btn, k) {
      btn.classList.toggle('cur', k === cur);
      btn.querySelector('.mk').textContent = k === cur ? '●' : '○';
      if (k === cur) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
    });
  }

  function buildMenu() {
    menu.innerHTML = '';
    items().forEach(function (d, k) {
      var b = document.createElement('button');
      b.className = 'day-item';
      b.setAttribute('role', 'menuitem');
      b.innerHTML = '<span class="mk">○</span><span class="tt"></span><span class="dd"></span>';
      b.querySelector('.tt').textContent = d.n + '. ' + d.title;
      b.querySelector('.dd').textContent = fmtDate(d.date, true);
      b.addEventListener('click', function () { closeAll(); show(k, true, true); });
      menu.appendChild(b);
    });
  }

  function buildModeMenu() {
    modeMenu.innerHTML = '';
    modeOrder.forEach(function (key) {
      var on = key === mode;
      var b = document.createElement('button');
      b.className = 'day-item' + (on ? ' cur' : '');
      b.setAttribute('role', 'menuitem');
      if (on) b.setAttribute('aria-current', 'true');
      b.innerHTML = '<span class="mk"></span><span></span>';
      b.firstChild.textContent = on ? '●' : '○';
      b.lastChild.textContent = cats[key].name;
      b.addEventListener('click', function () {
        closeAll();
        if (key !== mode) switchMode(key, true);
      });
      modeMenu.appendChild(b);
    });
  }

  /* Cambia sezione: se idx non è indicato, riparte dall'ultimo appunto letto */
  function switchMode(md, push, idx) {
    mode = md;
    store('a1-mode', md);
    buildModeMenu();
    buildMenu();
    show(idx === undefined ? startIndex(md) : idx, true, push);
  }

  function setOpen(panel, btn, open) { panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function closeAll() { setOpen(menu, dotsBtn, false); setOpen(settings, aaBtn, false); setOpen(modeMenu, modeBtn, false); closeToc(); }

  modeBtn.addEventListener('click', function () { var open = modeMenu.hidden; closeAll(); setOpen(modeMenu, modeBtn, open); });
  dotsBtn.addEventListener('click', function () { var open = menu.hidden; closeAll(); setOpen(menu, dotsBtn, open); });
  aaBtn.addEventListener('click', function () { var open = settings.hidden; closeAll(); setOpen(settings, aaBtn, open); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.day-menu, .dots, .settings, .aa, .mode-menu, .brand-btn, .toc, .toc-fab')) closeAll(); });
  prevBtn.addEventListener('click', function () { go(-1); });
  nextBtn.addEventListener('click', function () { go(1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
    else if (e.key === 'ArrowLeft' && !e.metaKey && !e.altKey) go(-1);
    else if (e.key === 'ArrowRight' && !e.metaKey && !e.altKey) go(1);
  });

  /* Back/forward del browser o modifica manuale dell'hash */
  window.addEventListener('hashchange', function () {
    var h = parseHash();
    if (!h) return;
    if (h.mode !== mode) switchMode(h.mode, false, h.idx);
    else if (h.idx !== cur) show(h.idx, true, false);
  });

  /* ---------- Navigatore che si rimpicciolisce scorrendo ---------- */
  var lastScrollY = window.scrollY, navShrinkTicking = false;
  function updateNavShrink() {
    var y = window.scrollY;
    var goingDown = y > lastScrollY;
    var pastThreshold = y > 40;
    var sh = goingDown && pastThreshold;
    dock.classList.toggle('shrink', sh);
    tocBtn.classList.toggle('shrink', sh);
    lastScrollY = y;
    navShrinkTicking = false;
  }
  window.addEventListener('scroll', function () {
    if (!navShrinkTicking) { navShrinkTicking = true; requestAnimationFrame(updateNavShrink); }
  }, { passive: true });

  /* ---------- Dimensione del testo ---------- */
  var ZMIN = 60, ZMAX = 220, ZSTEP = 10;
  var zoom = parseInt(load('fdi-zoom'), 10) || 100;
  function applyZoom() {
    zoom = Math.max(ZMIN, Math.min(ZMAX, zoom));
    root.style.setProperty('--z', zoom / 100);
    $('zVal').textContent = zoom + '%';
    $('zMinus').disabled = zoom <= ZMIN;
    $('zPlus').disabled = zoom >= ZMAX;
    $('zReset').disabled = zoom === 100;
    layoutToc();
    store('fdi-zoom', zoom);
  }
  $('zMinus').addEventListener('click', function () { zoom -= ZSTEP; applyZoom(); });
  $('zReset').addEventListener('click', function () { zoom = 100; applyZoom(); });
  $('zPlus').addEventListener('click', function () { zoom += ZSTEP; applyZoom(); });

  /* ---------- Tema ---------- */
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-btn]'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.themeBtn === t ? 'true' : 'false');
    });
    store('fdi-theme', t);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-btn]'), function (b) {
    b.addEventListener('click', function () { applyTheme(b.dataset.themeBtn); });
  });

  /* ---------- Avvio: hash URL > ultimo appunto salvato > primo ---------- */
  applyZoom();
  applyTheme(root.getAttribute('data-theme') || 'light');

  var h0 = parseHash();
  var startIdx;
  if (h0) {
    mode = h0.mode;
    startIdx = h0.idx;
  } else {
    var savedMode = load('a1-mode');
    mode = cats[savedMode] ? savedMode : 'lezioni';
    startIdx = startIndex(mode);
  }
  buildModeMenu();
  buildMenu();
  show(startIdx, false, false);
  if (!window.renderMathInElement) window.addEventListener('load', function () { renderMath(); buildToc(); });
});
