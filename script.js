/* Applica subito tema e zoom salvati, per evitare lampi di colore al caricamento */
try {
  var t = localStorage.getItem('fdi-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  var z = parseInt(localStorage.getItem('fdi-zoom'), 10) || 100;
  document.documentElement.style.setProperty('--z', z / 100);
} catch (e) {}


/* =====================================================================
   TEMA DEL CODICE
   Tre temi: "default" (stile VS Code, segue chiaro/scuro), "codeblocks" e
   "custom" (colori scelti da te nella finestra del menu aA).
   Il tema si applica con le variabili CSS --c-* (vedi style.css).
   ===================================================================== */
var CODE_KEYS = ['bg', 'fg', 'kw', 'ty', 'ut', 'vd', 'fn', 'st', 'es', 'nu', 'cm', 'pp', 'ma', 'op'];
var CODE_LABELS = {
  bg: 'Sfondo del codice',
  fg: 'Testo e uso delle variabili',
  kw: 'Parole chiave (if, while\u2026)',
  ty: 'Tipi base (int, char, struct\u2026)',
  ut: 'Tipi definiti da te (Data\u2026)',
  vd: 'Dichiarazione variabili',
  fn: 'Funzioni',
  st: 'Stringhe e caratteri',
  es: 'Formati ed escape (%d, \\n)',
  nu: 'Numeri',
  cm: 'Commenti',
  pp: 'Preprocessore (#include)',
  ma: 'Costanti e macro',
  op: 'Operatori e simboli'
};
var CODE_PALETTES = {
  /* VS Code, tema chiaro */
  light:  { bg: '#ffffff', fg: '#1e1e1e', kw: '#af00db', ty: '#0000ff', ut: '#267f99', vd: '#001080', fn: '#795e26', st: '#a31515', es: '#ee0000', nu: '#098658', cm: '#008000', pp: '#af00db', ma: '#0070c1', op: '#1e1e1e', bold: false, italic: false },
  /* VS Code, tema scuro */
  dark:   { bg: '#222429', fg: '#d4d4d4', kw: '#c586c0', ty: '#569cd6', ut: '#4ec9b0', vd: '#9cdcfe', fn: '#dcdcaa', st: '#ce9178', es: '#d7ba7d', nu: '#b5cea8', cm: '#6a9955', pp: '#c586c0', ma: '#4fc1ff', op: '#d4d4d4', bold: false, italic: false },
  /* Code::Blocks: sfondo bianco, parole chiave in grassetto, stringhe rosse, #include verde */
  codeblocks: { bg: '#ffffff', fg: '#000000', kw: '#000000', ty: '#000000', ut: '#000000', vd: '#000000', fn: '#000000', st: '#ff0000', es: '#e60000', nu: '#0000ff', cm: '#8b95c9', pp: '#008000', ma: '#800080', op: '#000000', bold: true, italic: false },
  /* Punto di partenza del tema Custom */
  customDefault: { bg: '#272822', fg: '#f8f8f2', kw: '#f92672', ty: '#66d9ef', ut: '#a1efe4', vd: '#fd971f', fn: '#a6e22e', st: '#e6db74', es: '#ae81ff', nu: '#ae81ff', cm: '#75715e', pp: '#f92672', ma: '#ae81ff', op: '#f8f8f2', bold: false, italic: false }
};
var codeMode = 'default';
var customPal = null;

function cloneP(p) { var o = {}; for (var k in p) o[k] = p[k]; return o; }
function loadCustomPal() {
  var d = cloneP(CODE_PALETTES.customDefault);
  try {
    var o = JSON.parse(localStorage.getItem('fdi-code-custom') || 'null');
    if (o) {
      CODE_KEYS.forEach(function (k) { if (/^#[0-9a-f]{6}$/i.test(o[k])) d[k] = o[k]; });
      d.bold = !!o.bold; d.italic = !!o.italic;
    }
  } catch (e) {}
  return d;
}
function paletteFor(mode) {
  if (mode === 'custom') return customPal;
  if (mode === 'codeblocks') return CODE_PALETTES.codeblocks;
  return document.documentElement.getAttribute('data-theme') === 'dark' ? CODE_PALETTES.dark : CODE_PALETTES.light;
}
function applyCodeVars() {
  var r = document.documentElement, p = paletteFor(codeMode);
  CODE_KEYS.forEach(function (k) { r.style.setProperty('--c-' + k, p[k]); });
  r.style.setProperty('--c-bold', p.bold ? '700' : '400');
  r.style.setProperty('--c-ital', p.italic ? 'italic' : 'normal');
  r.setAttribute('data-code', codeMode);
}
try {
  var cm0 = localStorage.getItem('fdi-code');
  codeMode = (cm0 === 'codeblocks' || cm0 === 'custom') ? cm0 : 'default';
} catch (e) {}
customPal = loadCustomPal();
applyCodeVars();


/* =====================================================================
   EVIDENZIATORE DEL CODICE C
   Colora i blocchi <pre><code> che sembrano C (o pseudo-C). I blocchi di
   assembler, pseudocodice in italiano ecc. restano senza colori.
   - forzare i colori su un blocco:  <code class="hl">
   - escludere un blocco:            <code class="nohl">
   ===================================================================== */
function setOf(s) { var o = {}; s.split(' ').forEach(function (w) { o[w] = true; }); return o; }
var C_KW = setOf('if else while for do switch case default break continue return goto sizeof');
var C_TY = setOf('int char float double void short long signed unsigned bool _Bool size_t typedef struct enum union const static extern volatile register inline FILE');
var C_CONST = setOf('NULL true false EOF stdin stdout stderr');
var C_FMT = /(\\[\s\S]|%[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|L|z)?[diouxXeEfgGcsp%])/;
var C_OPS = '{}()[];,.+-*/%=<>!&|^~?:';

function escH(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function hlC(src, types) {
  var out = [], i = 0, n = src.length, m, w;
  var decl = null, declDepth = 0, depth = 0;
  var prevWord = '', ppDir = '', lineStart = true, lastCh = '';

  function put(cls, s) { out.push(cls ? '<span class="tk-' + cls + '">' + escH(s) + '</span>' : escH(s)); }
  function putStr(s) {
    var parts = s.split(C_FMT);
    for (var k = 0; k < parts.length; k++) if (parts[k]) put(k % 2 ? 'e' : 's', parts[k]);
  }

  while (i < n) {
    var ch = src.charAt(i), nx = src.charAt(i + 1);

    if (ch === '\n') { put('', ch); i++; lineStart = true; ppDir = ''; lastCh = ''; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { put('', ch); i++; continue; }

    /* commenti */
    if (ch === '/' && nx === '*') {
      var e1 = src.indexOf('*/', i + 2); e1 = e1 < 0 ? n : e1 + 2;
      put('c', src.slice(i, e1)); i = e1; lineStart = false; continue;
    }
    if (ch === '/' && nx === '/') {
      var e2 = src.indexOf('\n', i); if (e2 < 0) e2 = n;
      put('c', src.slice(i, e2)); i = e2; continue;
    }

    /* preprocessore */
    if (ch === '#' && lineStart) {
      m = /^#[ \t]*([A-Za-z_]\w*)/.exec(src.slice(i, i + 40));
      if (m) { put('p', m[0]); ppDir = m[1]; i += m[0].length; lineStart = false; prevWord = ''; continue; }
    }
    lineStart = false;
    if (ppDir === 'include' && ch === '<') {
      m = /^<[^>\n]*>/.exec(src.slice(i));
      if (m) { put('s', m[0]); i += m[0].length; continue; }
    }

    /* stringhe e caratteri */
    if (ch === '"') {
      var e3 = i + 1;
      while (e3 < n && src.charAt(e3) !== '"' && src.charAt(e3) !== '\n') { if (src.charAt(e3) === '\\') e3++; e3++; }
      if (src.charAt(e3) === '"') e3++;
      if (e3 > n) e3 = n;
      putStr(src.slice(i, e3)); i = e3; lastCh = '"'; prevWord = ''; continue;
    }
    if (ch === "'") {
      m = /^'(?:\\.|[^'\\\n])+'/.exec(src.slice(i, i + 12));
      if (m) { putStr(m[0]); i += m[0].length; lastCh = "'"; prevWord = ''; continue; }
    }

    /* numeri */
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(nx))) {
      m = /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[fFlLuU]*/.exec(src.slice(i, i + 40));
      put('n', m[0]); i += m[0].length; lastCh = '0'; prevWord = ''; continue;
    }

    /* identificatori */
    if (/[A-Za-z_]/.test(ch)) {
      m = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 80)); w = m[0];
      var after = src.slice(i + w.length, i + w.length + 80);
      var nxt = (/^\s*(\S)/.exec(after) || [])[1];
      var cls = '';
      if (ppDir === 'define') { cls = 'm'; ppDir = 'defined'; }
      else if (C_KW[w]) cls = 'k';
      else if (C_TY[w]) { cls = 't'; decl = 'expect'; declDepth = depth; }
      else if (decl === 'expect' && /^(struct|enum|union)$/.test(prevWord)) cls = 'u';
      else if (types[w]) { cls = 'u'; decl = 'expect'; declDepth = depth; }
      else if (nxt === '(') { cls = 'f'; if (decl === 'expect') decl = null; }
      else if (decl === 'expect') { cls = 'v'; decl = 'after'; }
      else if (C_CONST[w] || /^[A-Z][A-Z0-9_]+$/.test(w)) cls = 'm';
      else if (/^[A-Z][a-z]/.test(w) && lastCh !== '.' && lastCh !== '>' &&
               /^(?:[ \t]+\**[ \t]*|[ \t]*\*+[ \t]*)[A-Za-z_]\w*[ \t]*[;=,\[)]/.test(after)) {
        cls = 'u'; decl = 'expect'; declDepth = depth;
      }
      put(cls, w); i += w.length; prevWord = w; lastCh = w.charAt(w.length - 1); continue;
    }

    /* operatori e punteggiatura (raggruppati) */
    if (C_OPS.indexOf(ch) >= 0) {
      var j = i;
      while (j < n && C_OPS.indexOf(src.charAt(j)) >= 0 &&
             !(src.charAt(j) === '/' && (src.charAt(j + 1) === '*' || src.charAt(j + 1) === '/'))) {
        var c = src.charAt(j);
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); if (decl && depth < declDepth) decl = null; }
        else if (c === ';' || c === '{' || c === '}') decl = null;
        else if (c === '=') { if (decl === 'after') decl = 'init'; }
        else if (c === ',') { if ((decl === 'after' || decl === 'init') && depth === declDepth) decl = 'expect'; }
        j++;
      }
      put('o', src.slice(i, j)); lastCh = src.charAt(j - 1); i = j; prevWord = ''; continue;
    }

    put('', ch); i++; lastCh = ch; prevWord = '';
  }
  return out.join('');
}

function looksLikeC(t) {
  return /\b(?:int|char|float|double|void|if|else|while|for|do|return|struct|typedef|enum|printf|scanf|sizeof|const)\b|#[ \t]*(?:include|define)|\/\*[\s\S]*?\*\/|&&|\|\|/.test(t) ||
         /^[ \t]*[\w.\[\]>-]+[ \t]*[-+*\/]?=[ \t]*[^=;\n]+;[ \t]*$/m.test(t) ||          /* assegnamento:  x = 5; */
         /^[ \t]*[A-Z]\w*[ \t]+\**\w+(?:\[[^\]]*\])?[ \t]*;[ \t]*$/m.test(t);            /* dichiarazione: Data oggi; */
}

/* nomi dei tipi definiti con typedef/struct/enum, per colorarli anche negli altri blocchi */
function collectTypes(texts) {
  var set = {};
  function add(nm) { if (nm && !C_KW[nm] && !C_TY[nm]) set[nm] = true; }
  texts.forEach(function (t) {
    t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    var m;
    var r1 = /typedef\s+[^;{}]*?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/g;
    var r2 = /\}\s*([A-Za-z_]\w*)\s*;/g;
    var r3 = /\b(?:struct|enum|union)\s+([A-Za-z_]\w*)/g;
    while ((m = r1.exec(t))) add(m[1]);
    while ((m = r2.exec(t))) add(m[1]);
    while ((m = r3.exec(t))) add(m[1]);
  });
  return set;
}

function highlightAll(scope) {
  var codes = Array.prototype.filter.call(scope.querySelectorAll('pre > code'), function (c) {
    return !c.hasAttribute('data-hl') && !c.classList.contains('nohl') &&
           (c.classList.contains('hl') || looksLikeC(c.textContent));
  });
  var types = collectTypes(codes.map(function (c) { return c.textContent; }));
  codes.forEach(function (c) {
    c.innerHTML = hlC(c.textContent, types);
    c.setAttribute('data-hl', '1');
  });
}


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
  },
  {
    n: 4,
    title: 'Progettazione degli algoritmi, sintassi C e tipi di dato',
    file: 'appunti/day-04.html',
    date: '2026-10-13'
  },
  {
    n: 5,
    title: 'Array, strutture e puntatori in C',
    file: 'appunti/day-05.html',
    date: '2026-10-20'
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
      highlightAll(main);
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
  document.addEventListener('click', function (e) { if (!e.target.closest('.day-menu, .dots, .settings, .aa, .mode-menu, .brand-btn, .toc, .toc-fab, .cmodal')) closeAll(); });
  prevBtn.addEventListener('click', function () { go(-1); });
  nextBtn.addEventListener('click', function () { go(1); });
  document.addEventListener('keydown', function (e) {
    /* con la finestra dei colori aperta, o scrivendo in un campo, le frecce non cambiano Day */
    if (modalOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
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
    applyCodeVars();   /* il tema Default del codice segue chiaro/scuro */
    updateDots();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-btn]'), function (b) {
    b.addEventListener('click', function () { applyTheme(b.dataset.themeBtn); });
  });

  /* ---------- Tema del codice: impostazioni, finestra Custom, selettore colore ---------- */
  var DEMO = [
    '#include <stdio.h>',
    '#define DIM 5',
    '',
    'typedef struct {',
    '  int giorno, mese;',
    '} Data;',
    '',
    '/* Anteprima: colori in tempo reale */',
    'int main(void)',
    '{',
    '  const int soglia = 10;',
    "  char lettera = 'A';",
    '  Data oggi = {20, 10};',
    '',
    '  // Stampa un messaggio',
    '  printf("Valore: %d\\n", soglia);',
    '  if (oggi.mese >= DIM) {',
    '    scanf("%d", &oggi.giorno);',
    '  }',
    '  return 0;',
    '}'
  ].join('\n');
  var TOKEN_KEY = { k: 'kw', t: 'ty', u: 'ut', v: 'vd', f: 'fn', s: 'st', e: 'es', n: 'nu', c: 'cm', p: 'pp', m: 'ma', o: 'op' };

  var codeBtns = document.querySelectorAll('[data-code-btn]');
  var codeHint = $('codeHint');
  var modal = $('codeModal'), dialog = $('cmDialog'), cmList = $('cmList');
  var cmPre = $('cmPreview'), pop = $('colorPop');
  var cpSV = $('cpSV'), cpHue = $('cpHue'), cpHex = $('cpHex'), cpBin = $('cpBin');
  var cpRgb = pop.querySelectorAll('.cp-n');
  var cp = { key: null, h: 0, s: 0, v: 0 };
  var cmOpener = null, popAt = 0, popClosedAt = 0;

  cmPre.firstElementChild.innerHTML = hlC(DEMO, { Data: true });

  function saveCustom() { store('fdi-code-custom', JSON.stringify(customPal)); }

  /* mini anteprime (sfondo + 4 pallini) nei pulsanti del menu aA */
  function updateDots() {
    ['default', 'codeblocks', 'custom'].forEach(function (k) {
      var el = document.querySelector('[data-dots="' + k + '"]'), p = paletteFor(k);
      if (!el) return;
      if (!el.firstChild) el.innerHTML = '<i></i><i></i><i></i><i></i>';
      el.style.background = p.bg;
      ['kw', 'fn', 'st', 'nu'].forEach(function (c, ix) { el.children[ix].style.background = p[c]; });
    });
  }
  function syncCodeUI() {
    Array.prototype.forEach.call(codeBtns, function (b) {
      b.setAttribute('aria-pressed', b.dataset.codeBtn === codeMode ? 'true' : 'false');
    });
    codeHint.hidden = codeMode !== 'custom';
    updateDots();
  }
  function setCode(md) {
    codeMode = md;
    store('fdi-code', md);
    applyCodeVars();
    syncCodeUI();
  }
  Array.prototype.forEach.call(codeBtns, function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.codeBtn;
      if (k === 'custom' && codeMode === 'custom') openModal(); else setCode(k);
    });
  });

  /* ----- conversioni colore ----- */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  /* ----- righe della finestra ----- */
  function refreshRow(k) {
    var r = cmList.querySelector('[data-k="' + k + '"]');
    if (!r) return;
    r.querySelector('.hx').textContent = customPal[k];
    r.querySelector('.ball').style.background = customPal[k];
    r.setAttribute('aria-label', CODE_LABELS[k] + ': ' + customPal[k]);
  }
  function refreshToggles() {
    Array.prototype.forEach.call(cmList.querySelectorAll('[data-t]'), function (b) {
      b.setAttribute('aria-checked', customPal[b.getAttribute('data-t')] ? 'true' : 'false');
    });
  }
  function buildRows() {
    cmList.innerHTML = '';
    var g = document.createElement('div');
    g.className = 'cm-group';
    CODE_KEYS.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cm-row';
      b.setAttribute('data-k', k); b.setAttribute('aria-haspopup', 'dialog');
      b.innerHTML = '<span class="cm-l"></span><span class="hx"></span><span class="ball"></span>';
      b.firstChild.textContent = CODE_LABELS[k];
      g.appendChild(b);
    });
    [['bold', 'Parole chiave e tipi in grassetto'], ['italic', 'Commenti in corsivo']].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cm-row';
      b.setAttribute('data-t', t[0]); b.setAttribute('role', 'switch');
      b.innerHTML = '<span class="cm-l"></span><span class="sw"></span>';
      b.firstChild.textContent = t[1];
      g.appendChild(b);
    });
    cmList.appendChild(g);
    CODE_KEYS.forEach(function (k) { refreshRow(k); });
    refreshToggles();
  }
  function setCustomColor(k, hex) {
    customPal[k] = hex;
    saveCustom();
    applyCodeVars();
    refreshRow(k);
    updateDots();
  }

  /* ----- selettore colore ----- */
  function cpFromHex(hex) {
    var rgb = hexToRgb(hex), hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    cp.s = hsv[1]; cp.v = hsv[2];
    if (hsv[1] > 0.001 && hsv[2] > 0.001) cp.h = hsv[0];   /* con grigi e nero la tonalità resta com'era */
  }
  function cpCur() {
    var rgb = hsvToRgb(cp.h, cp.s, cp.v);
    return { rgb: rgb, hex: rgbToHex(rgb[0], rgb[1], rgb[2]) };
  }
  function cpRender(skip) {
    var c = cpCur(), kn = cpSV.firstElementChild;
    cpSV.style.backgroundColor = 'hsl(' + cp.h + ',100%,50%)';
    kn.style.left = (cp.s * 100) + '%';
    kn.style.top = ((1 - cp.v) * 100) + '%';
    cpHue.firstElementChild.style.left = (cp.h / 360 * 100) + '%';
    cpHue.setAttribute('aria-valuenow', Math.round(cp.h));
    if (skip !== 'hex') cpHex.value = c.hex;
    if (skip !== 'rgb') for (var i = 0; i < 3; i++) cpRgb[i].value = c.rgb[i];
    cpBin.textContent = c.rgb.map(function (v) { return ('00000000' + v.toString(2)).slice(-8); }).join(' ');
    $('cpDot').style.background = c.hex;
  }
  function cpCommit(skip) {
    setCustomColor(cp.key, cpCur().hex);
    cpRender(skip);
  }
  function bindDrag(el, fn) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      el.focus();
      fn(e);
    });
    el.addEventListener('pointermove', function (e) {
      var cap = false;
      try { cap = el.hasPointerCapture(e.pointerId); } catch (x) {}
      if (cap) fn(e);
    });
  }
  bindDrag(cpSV, function (e) {
    var r = cpSV.getBoundingClientRect();
    cp.s = clamp01((e.clientX - r.left) / r.width);
    cp.v = 1 - clamp01((e.clientY - r.top) / r.height);
    cpCommit();
  });
  bindDrag(cpHue, function (e) {
    var r = cpHue.getBoundingClientRect();
    cp.h = clamp01((e.clientX - r.left) / r.width) * 360;
    cpCommit();
  });
  cpSV.addEventListener('keydown', function (e) {
    var st = e.shiftKey ? 0.1 : 0.01, used = true;
    if (e.key === 'ArrowLeft') cp.s = clamp01(cp.s - st);
    else if (e.key === 'ArrowRight') cp.s = clamp01(cp.s + st);
    else if (e.key === 'ArrowUp') cp.v = clamp01(cp.v + st);
    else if (e.key === 'ArrowDown') cp.v = clamp01(cp.v - st);
    else used = false;
    if (used) { e.preventDefault(); cpCommit(); }
  });
  cpHue.addEventListener('keydown', function (e) {
    var d = e.shiftKey ? 10 : 1, used = true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') cp.h = (cp.h - d + 360) % 360;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') cp.h = (cp.h + d) % 360;
    else used = false;
    if (used) { e.preventDefault(); cpCommit(); }
  });
  cpHex.addEventListener('input', function () {
    var v = cpHex.value.trim();
    if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { cpFromHex(v); cpCommit('hex'); }
  });
  cpHex.addEventListener('blur', function () { cpRender(); });
  Array.prototype.forEach.call(cpRgb, function (inp) {
    inp.addEventListener('input', function () {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 3);
      var vals = Array.prototype.map.call(cpRgb, function (x) { return x.value === '' ? NaN : parseInt(x.value, 10); });
      if (vals.every(function (x) { return x >= 0 && x <= 255; })) {
        cpFromHex(rgbToHex(vals[0], vals[1], vals[2]));
        cpCommit('rgb');
      }
    });
    inp.addEventListener('blur', function () { cpRender(); });
  });

  function placePop(anchor) {
    var r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, M = 12;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(M, r.right - w), vw - w - M);
    var top = r.bottom + 10;
    if (top + h > vh - M) top = r.top - h - 10;
    if (top < M) top = Math.max(M, Math.round((vh - h) / 2));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function clearSel() {
    Array.prototype.forEach.call(cmList.querySelectorAll('.sel'), function (el) { el.classList.remove('sel'); });
  }
  function openPop(k) {
    var row = cmList.querySelector('[data-k="' + k + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
    cp.key = k;
    cpFromHex(customPal[k]);
    $('cpTitle').textContent = CODE_LABELS[k];
    pop.hidden = false;
    popAt = Date.now();
    clearSel();
    if (row) row.classList.add('sel');
    cpRender();
    placePop(row ? row.querySelector('.ball') : cmPre);
  }
  function closePop() {
    if (pop.hidden) return;
    pop.hidden = true;
    cp.key = null;
    popClosedAt = Date.now();
    clearSel();
  }

  /* ----- finestra ----- */
  function modalOpen() { return !modal.hidden; }
  function openModal() {
    cmOpener = document.activeElement;
    buildRows();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    dialog.focus();
  }
  function closeModal() {
    closePop();
    modal.hidden = true;
    document.body.style.overflow = '';
    if (cmOpener && cmOpener.focus) cmOpener.focus();
  }

  cmList.addEventListener('click', function (e) {
    var t = e.target.closest('[data-t]');
    if (t) {
      var key = t.getAttribute('data-t');
      customPal[key] = !customPal[key];
      saveCustom(); applyCodeVars(); refreshToggles(); updateDots();
      return;
    }
    var r = e.target.closest('[data-k]');
    if (!r) return;
    var k = r.getAttribute('data-k');
    if (!pop.hidden && cp.key === k) closePop(); else openPop(k);
  });
  cmList.addEventListener('scroll', function () { if (Date.now() - popAt > 250) closePop(); });

  /* toccando un elemento dell'anteprima si apre il selettore del suo colore */
  cmPre.addEventListener('click', function (e) {
    var key = 'fg', s = e.target.closest('code span');
    if (s) { var m = /tk-(\w)/.exec(s.className); if (m && TOKEN_KEY[m[1]]) key = TOKEN_KEY[m[1]]; }
    else if (e.target === cmPre) key = 'bg';
    if (!pop.hidden && cp.key === key) closePop(); else openPop(key);
  });

  modal.addEventListener('pointerdown', function (e) {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.cm-row[data-k], #cmPreview')) closePop();
  });
  modal.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close') && Date.now() - popClosedAt > 400) closeModal();
  });
  $('cmClose').addEventListener('click', closeModal);
  $('cmDone').addEventListener('click', closeModal);
  $('cmReset').addEventListener('click', function () {
    customPal = cloneP(CODE_PALETTES.customDefault);
    saveCustom(); applyCodeVars(); closePop(); buildRows(); updateDots();
  });
  window.addEventListener('resize', function () { closePop(); });

  document.addEventListener('keydown', function (e) {
    if (!modalOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!pop.hidden) closePop(); else closeModal();
    } else if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(modal.querySelectorAll('button, input, [tabindex="0"]'), function (x) {
        return !x.disabled && !x.closest('[hidden]');
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Avvio: hash URL > ultimo appunto salvato > primo ---------- */
  applyZoom();
  applyTheme(root.getAttribute('data-theme') || 'light');
  syncCodeUI();

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
