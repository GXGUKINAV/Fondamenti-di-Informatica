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
   2. aggiungi qui sotto una nuova voce con n, title e file.
   Pallini, menu e navigatore si aggiornano da soli.
   Il titolo (e l'etichetta "Day N") è generato da JavaScript: nei file
   degli appunti NON va ripetuto.
   ===================================================================== */
var days = [
  {
    n: 1,
    title: 'Rappresentazione dell\u2019informazione e sistemi di numerazione',
    file: 'appunti/day-01.html'
  }
];
days.sort(function (a, b) { return a.n - b.n; });


/* =====================================================================
   CATALOGO DELLE ESERCITAZIONI
   Stessa procedura dei Day: duplica appunti/_template-day.html, rinominalo
   (es. esercitazione-1.html) e aggiungi qui una voce. L'etichetta
   "Esercitazione N" sopra il titolo è generata da JavaScript.
   ===================================================================== */
var esercitazioni = [
  {
    n: 1,
    title: 'Rappresentazione dell\u2019informazione',
    file: 'appunti/esercitazione-1.html'
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
var catOrder = ['lezioni', 'esercitazioni'];


document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var main = $('content'), menu = $('dayMenu'), dotsBtn = $('dotsBtn');
  var modeBtn = $('modeBtn'), modeMenu = $('modeMenu');
  var prevBtn = $('prevBtn'), nextBtn = $('nextBtn');
  var aaBtn = $('aaBtn'), settings = $('settings');
  var nav = $('navBar');
  var mode = 'lezioni';   /* sezione corrente: 'lezioni' oppure 'esercitazioni' */
  var cur = 0;
  var requestId = 0;   /* per ignorare risposte fetch "vecchie" se cambio Day velocemente */
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

  /* ---------- Hash URL: #day-N (lezioni), #es-N (esercitazioni) ---------- */
  /* Restituisce {mode, idx} oppure null. idx = -1 se manca il numero o non esiste nel catalogo. */
  function parseHash() {
    for (var k = 0; k < catOrder.length; k++) {
      var md = catOrder[k], c = cats[md];
      var m = new RegExp('^#' + c.prefix + '(?:-(\\d+))?$').exec(location.hash);
      if (!m) continue;
      var idx = -1;
      if (m[1] !== undefined) {
        var n = parseInt(m[1], 10);
        c.list.forEach(function (d, j) { if (d.n === n) idx = j; });
      }
      return { mode: md, idx: idx };
    }
    return null;
  }
  function syncHash(n, push) {
    var h = '#' + cats[mode].prefix + (n !== null ? '-' + n : '');
    if (location.hash === h) return;
    try {
      if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
    } catch (e) {
      location.hash = h;
    }
  }

  /* Indice dell'ultimo elemento letto della sezione (0 se non c'è o non esiste più) */
  function startIndex(md) {
    var list = cats[md].list;
    var want = parseInt(load(cats[md].key), 10);
    var idx = 0;
    if (want) list.forEach(function (d, k) { if (d.n === want) idx = k; });
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
  function showEmpty(animate, pushHash) {
    cur = 0;
    ++requestId;   /* annulla eventuali fetch ancora in corso */

    main.innerHTML = '<p class="eyebrow"></p><h1></h1><p></p>';
    main.querySelector('.eyebrow').textContent = cats[mode].name;
    main.querySelector('h1').textContent = 'Nessun appunto per ora';
    main.querySelector('p:last-child').textContent = 'In questa sezione non è ancora stato aggiunto nulla: quando ci saranno degli appunti, li troverai qui.';
    main.removeAttribute('aria-busy');

    if (animate) { main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }
    window.scrollTo(0, 0);
    syncHash(null, pushHash);
    updateNav();
  }

  function show(i, animate, pushHash) {
    var list = items();
    if (!list.length) { showEmpty(animate, pushHash); return; }

    cur = Math.max(0, Math.min(list.length - 1, i));
    var d = list[cur];
    var myRequest = ++requestId;

    /* titolo subito visibile, poi stato di caricamento */
    main.innerHTML = '<p class="eyebrow"></p><h1></h1>';
    main.querySelector('.eyebrow').textContent = cats[mode].label + ' ' + d.n;
    main.querySelector('h1').textContent = d.title;
    main.setAttribute('aria-busy', 'true');
    showLoading();

    if (animate) { main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }
    window.scrollTo(0, 0);
    store(cats[mode].key, d.n);
    syncHash(d.n, pushHash);
    updateNav();

    fetchDay(d).then(function (html) {
      if (myRequest !== requestId) return;   /* nel frattempo ho cambiato Day */
      var status = main.querySelector('[role="status"]');
      if (status) status.remove();
      main.insertAdjacentHTML('beforeend', html);
      main.removeAttribute('aria-busy');
      renderMath();
    }).catch(function (err) {
      if (myRequest !== requestId) return;
      var status = main.querySelector('[role="status"]');
      if (status) status.remove();
      main.removeAttribute('aria-busy');
      showError(d);
      if (window.console) console.error('Errore nel caricamento di ' + d.file + ':', err);
    });
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
      b.innerHTML = '<span class="mk">○</span><span>' + d.n + '. ' + d.title + '</span>';
      b.addEventListener('click', function () { closeAll(); show(k, true, true); });
      menu.appendChild(b);
    });
  }

  /* ---------- Cambio di sezione ---------- */
  function buildModeMenu() {
    modeMenu.innerHTML = '';
    catOrder.forEach(function (md) {
      var b = document.createElement('button');
      b.className = 'day-item' + (md === mode ? ' cur' : '');
      b.setAttribute('role', 'menuitem');
      if (md === mode) b.setAttribute('aria-current', 'true');
      var mk = document.createElement('span');
      mk.className = 'mk';
      mk.textContent = md === mode ? '●' : '○';
      var name = document.createElement('span');
      name.textContent = cats[md].name;
      b.appendChild(mk); b.appendChild(name);
      b.addEventListener('click', function () {
        closeAll();
        if (md !== mode) switchMode(md, true);
      });
      modeMenu.appendChild(b);
    });
  }

  function switchMode(md, push, idx) {
    mode = md;
    store('a1-mode', md);
    buildModeMenu();
    buildMenu();
    show(idx !== undefined && idx !== -1 ? idx : startIndex(md), true, push);
  }

  function setOpen(panel, btn, open) { panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function closeAll() { setOpen(menu, dotsBtn, false); setOpen(settings, aaBtn, false); setOpen(modeMenu, modeBtn, false); }

  dotsBtn.addEventListener('click', function () { var open = menu.hidden; closeAll(); setOpen(menu, dotsBtn, open); });
  aaBtn.addEventListener('click', function () { var open = settings.hidden; closeAll(); setOpen(settings, aaBtn, open); });
  modeBtn.addEventListener('click', function () { var open = modeMenu.hidden; closeAll(); setOpen(modeMenu, modeBtn, open); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.day-menu, .dots, .settings, .aa, .mode-menu, .brand-btn')) closeAll(); });
  prevBtn.addEventListener('click', function () { show(cur - 1, true, true); });
  nextBtn.addEventListener('click', function () { show(cur + 1, true, true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
    else if (!items().length) return;
    else if (e.key === 'ArrowLeft' && !e.metaKey && !e.altKey) show(cur - 1, true, true);
    else if (e.key === 'ArrowRight' && !e.metaKey && !e.altKey) show(cur + 1, true, true);
  });

  /* Back/forward del browser o modifica manuale dell'hash */
  window.addEventListener('hashchange', function () {
    var h = parseHash();
    if (!h) return;
    if (h.mode !== mode) switchMode(h.mode, false, h.idx);
    else if (h.idx !== -1 && h.idx !== cur) show(h.idx, true, false);
  });

  /* ---------- Navigatore che si rimpicciolisce scorrendo ---------- */
  var lastScrollY = window.scrollY, navShrinkTicking = false;
  function updateNavShrink() {
    var y = window.scrollY;
    var goingDown = y > lastScrollY;
    var pastThreshold = y > 40;
    if (goingDown && pastThreshold) nav.classList.add('shrink'); else nav.classList.remove('shrink');
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
    store('fdi-zoom', zoom);
  }
  $('zMinus').addEventListener('click', function () { zoom -= ZSTEP; applyZoom(); });
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

  /* ---------- Avvio: hash URL > ultima sezione salvata > lezioni ---------- */
  applyZoom();
  applyTheme(root.getAttribute('data-theme') || 'light');

  var h0 = parseHash();
  var savedMode = load('a1-mode');
  mode = h0 ? h0.mode : (savedMode && cats.hasOwnProperty(savedMode) ? savedMode : 'lezioni');

  buildModeMenu();
  buildMenu();
  show(h0 && h0.idx !== -1 ? h0.idx : startIndex(mode), false, false);
  if (!window.renderMathInElement) window.addEventListener('load', renderMath);
});
