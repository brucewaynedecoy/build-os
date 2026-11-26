(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('docs-data').textContent);
  var $ = function (s) { return document.querySelector(s); };
  var el = {
    article: $('#article'), nav: $('#nav'), toc: $('#toc'),
    input: $('#search-input'), results: $('#search-results'),
    themeBtn: $('#theme-btn'), menuBtn: $('#menu-btn'), scrim: $('#scrim'), main: $('#main')
  };
  var HEADER = 56;
  var current = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ------------------------------------------------------------ theme */
  var THEME_KEY = 'buildos-guide-theme';
  var THEMES = ['system', 'light', 'dark'];
  var ICON = {
    system: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  };
  var LABEL = { system: 'Theme: follows your system', light: 'Theme: light', dark: 'Theme: dark' };
  function getTheme() {
    try { var t = localStorage.getItem(THEME_KEY); return THEMES.indexOf(t) >= 0 ? t : 'system'; } catch (e) { return 'system'; }
  }
  function applyTheme(t) {
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    el.themeBtn.innerHTML = ICON[t];
    el.themeBtn.title = LABEL[t] + ' (click to change)';
    el.themeBtn.setAttribute('aria-label', LABEL[t] + ', click to change');
  }
  el.themeBtn.addEventListener('click', function () {
    var next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
    applyTheme(next);
  });
  applyTheme(getTheme());

  /* ------------------------------------------------------------ left nav */
  function buildNav() {
    var html = DATA.nav.map(function (g) {
      return '<div class="nav-group">' + (g.title ? '<h3>' + esc(g.title) + '</h3>' : '') +
        g.docs.map(function (s) {
          var d = DATA.docs[s];
          return '<a class="nav-link" href="#/' + s + '" data-slug="' + s + '">' +
            (d.num ? '<span class="num">' + d.num + '</span>' : '') + '<span>' + esc(d.title) + '</span></a>';
        }).join('') + '</div>';
    }).join('');
    html += '<div class="nav-foot">' + esc(DATA.title) + ' &middot; built ' + esc(DATA.built) + '</div>';
    el.nav.innerHTML = html;
  }
  function groupOf(slug) {
    for (var i = 0; i < DATA.nav.length; i++) if (DATA.nav[i].docs.indexOf(slug) >= 0) return DATA.nav[i].title;
    return null;
  }

  /* ------------------------------------------------------------ routing */
  function parseHash() {
    var h = '';
    try { h = decodeURIComponent(location.hash || ''); } catch (e) { h = location.hash || ''; }
    var m = h.match(/^#\/([^\/]+)(?:\/(.*))?$/);
    if (m && DATA.docs[m[1]]) return { slug: m[1], anchor: m[2] || null };
    return { slug: DATA.order[0], anchor: null };
  }
  function pager(d, dir) {
    return '<a class="pager ' + dir + '" href="#/' + d.slug + '"><small>' + (dir === 'prev' ? 'Previous' : 'Next') + '</small><span>' + esc(d.title) + '</span></a>';
  }
  function render(slug) {
    var d = DATA.docs[slug];
    var i = DATA.order.indexOf(slug);
    var prev = i > 0 ? DATA.docs[DATA.order[i - 1]] : null;
    var next = i < DATA.order.length - 1 ? DATA.docs[DATA.order[i + 1]] : null;
    var kicker = groupOf(slug);
    el.article.innerHTML = '<div class="doc">' +
      (kicker ? '<p class="doc-kicker">' + esc(kicker) + '</p>' : '') +
      '<h1>' + esc(d.title) + '</h1>' +
      (d.lede ? '<p class="lede">' + d.lede + '</p>' : '') +
      '<div class="doc-body">' + d.html + '</div>' +
      '<nav class="doc-footer" aria-label="Previous and next">' +
      (prev ? pager(prev, 'prev') : '<span></span>') + (next ? pager(next, 'next') : '') +
      '</nav></div>';
    document.title = d.title + ' · ' + DATA.title;

    var links = el.nav.querySelectorAll('.nav-link');
    for (var k = 0; k < links.length; k++) {
      if (links[k].getAttribute('data-slug') === slug) {
        links[k].setAttribute('aria-current', 'page');
        var r = links[k].getBoundingClientRect(), nr = el.nav.getBoundingClientRect();
        if (r.top < nr.top || r.bottom > nr.bottom) links[k].scrollIntoView({ block: 'center' });
      } else links[k].removeAttribute('aria-current');
    }
    buildToc(d);
    current = slug;
  }
  function buildToc(d) {
    if (!d.toc.length) { el.toc.innerHTML = ''; return; }
    el.toc.innerHTML = '<h4>On this page</h4><ul>' + d.toc.map(function (t) {
      return '<li><a class="l' + t.level + '" href="#/' + d.slug + '/' + t.id + '" data-id="' + t.id + '">' + esc(t.text) + '</a></li>';
    }).join('') + '</ul>';
  }
  function findAnchor(id) {
    var nodes = el.article.querySelectorAll('[id]');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
    return null;
  }
  function route() {
    var r = parseHash();
    if (r.slug !== current) render(r.slug);
    closeNav();
    closeSearch();
    var t = r.anchor ? findAnchor(r.anchor) : null;
    if (t) {
      t.scrollIntoView({ block: 'start' });
      t.classList.remove('target'); void t.offsetWidth; t.classList.add('target');
    } else window.scrollTo(0, 0);
    updateSpy();
  }
  // Re-scroll when the same anchor link is clicked twice (hash does not change).
  el.article.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    var want = a.getAttribute('href'), have = '';
    try { have = decodeURIComponent(location.hash); } catch (err) { have = location.hash; }
    if (want === have) { e.preventDefault(); route(); }
  });

  /* ------------------------------------------------------------ scroll spy */
  function updateSpy() {
    var links = el.toc.querySelectorAll('a[data-id]');
    if (!links.length) return;
    var heads = el.article.querySelectorAll('h2[id], h3[id]');
    var line = HEADER + 40, cur = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) cur = heads[i].id; else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 && heads.length) cur = heads[heads.length - 1].id;
    for (var k = 0; k < links.length; k++) {
      var on = links[k].getAttribute('data-id') === cur;
      links[k].classList.toggle('active', on);
      if (on) {
        var r = links[k].getBoundingClientRect(), tr = el.toc.getBoundingClientRect();
        if (r.top < tr.top || r.bottom > tr.bottom) links[k].scrollIntoView({ block: 'nearest' });
      }
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { updateSpy(); ticking = false; });
  }, { passive: true });

  /* ------------------------------------------------------------ copy buttons */
  el.article.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var code = btn.parentElement.querySelector('code');
    var text = code.textContent.replace(/\n$/, '');
    var done = function () {
      btn.textContent = 'Copied'; btn.classList.add('done');
      setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1500);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  });

  /* ------------------------------------------------------------ mobile nav */
  function openNav() { document.body.classList.add('nav-open'); el.menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeNav() { document.body.classList.remove('nav-open'); el.menuBtn.setAttribute('aria-expanded', 'false'); }
  el.menuBtn.addEventListener('click', function () { document.body.classList.contains('nav-open') ? closeNav() : openNav(); });
  el.scrim.addEventListener('click', closeNav);

  /* ------------------------------------------------------------ search */
  var index = null;
  function buildIndex() {
    index = [];
    var parser = new DOMParser();
    DATA.order.forEach(function (slug) {
      var d = DATA.docs[slug];
      var doc = parser.parseFromString('<div>' + (d.lede ? '<p>' + d.lede + '</p>' : '') + d.html + '</div>', 'text/html');
      var root = doc.body.firstChild;
      var sec = { slug: slug, docTitle: d.title, id: null, heading: d.title, text: '' };
      index.push(sec);
      for (var n = root.firstElementChild; n; n = n.nextElementSibling) {
        if (/^H[23]$/.test(n.tagName)) {
          var label = n.firstElementChild ? n.firstElementChild.textContent : n.textContent;
          sec = { slug: slug, docTitle: d.title, id: n.id, heading: label, text: '' };
          index.push(sec);
        } else sec.text += ' ' + n.textContent;
      }
    });
    index.forEach(function (s) {
      s.text = s.text.replace(/\s+/g, ' ').trim();
      s.lcText = s.text.toLowerCase();
      s.lcHead = s.heading.toLowerCase();
      s.lcDoc = s.docTitle.toLowerCase();
    });
  }
  function countIn(hay, needle) {
    var c = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) >= 0) { c++; i += needle.length; if (c > 20) break; }
    return c;
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return { items: [], terms: terms };
    var out = [];
    index.forEach(function (s) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        var inHead = s.lcHead.indexOf(t) >= 0, inDoc = s.lcDoc.indexOf(t) >= 0, n = countIn(s.lcText, t);
        if (!inHead && !inDoc && !n) return;
        if (inHead) score += 12;
        if (inDoc) score += 4;
        score += Math.min(n, 8);
      }
      if (s.id === null) score += 2;
      out.push({ s: s, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return { items: out.slice(0, 12), terms: terms };
  }
  function highlight(html, terms) {
    var re = new RegExp('(' + terms.map(function (t) { return escRe(esc(t)); }).join('|') + ')', 'ig');
    return html.replace(re, '<mark>$1</mark>');
  }
  function snippet(s, terms) {
    var pos = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = s.lcText.indexOf(terms[i]);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) return esc(s.text.slice(0, 150)) + (s.text.length > 150 ? '…' : '');
    var start = Math.max(0, pos - 60), end = Math.min(s.text.length, pos + 110);
    if (start > 0) { var sp = s.text.lastIndexOf(' ', start); if (sp > 0 && start - sp < 20) start = sp + 1; }
    var str = (start > 0 ? '…' : '') + s.text.slice(start, end) + (end < s.text.length ? '…' : '');
    return highlight(esc(str), terms);
  }
  function renderResults(res) {
    if (!res.items.length) {
      el.results.innerHTML = '<div class="sr-empty">No matches</div>';
    } else {
      el.results.innerHTML = res.items.map(function (r, i) {
        var s = r.s;
        return '<a class="sr' + (i === 0 ? ' active' : '') + '" role="option" href="#/' + s.slug + (s.id ? '/' + s.id : '') + '">' +
          (s.id ? '<div class="sr-doc">' + esc(s.docTitle) + '</div>' : '') +
          '<div class="sr-title">' + highlight(esc(s.heading), res.terms) + '</div>' +
          '<div class="sr-snip">' + snippet(s, res.terms) + '</div></a>';
      }).join('');
    }
    el.results.classList.add('open');
    el.input.setAttribute('aria-expanded', 'true');
  }
  function closeSearch() {
    el.results.classList.remove('open');
    el.input.setAttribute('aria-expanded', 'false');
  }
  var timer = null;
  function runSearch() {
    var q = el.input.value.trim();
    if (q.length < 2) { closeSearch(); return; }
    if (!index) buildIndex();
    renderResults(search(q));
  }
  el.input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 70); });
  el.input.addEventListener('focus', runSearch);
  el.input.addEventListener('keydown', function (e) {
    var items = el.results.querySelectorAll('.sr');
    var active = el.results.querySelector('.sr.active');
    var idx = Array.prototype.indexOf.call(items, active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      idx = e.key === 'ArrowDown' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', i === idx);
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (active) { e.preventDefault(); location.hash = active.getAttribute('href'); route(); el.input.blur(); }
    } else if (e.key === 'Escape') {
      closeSearch(); el.input.blur();
    }
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#search')) closeSearch();
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault(); el.input.focus(); el.input.select();
    }
  });

  /* ------------------------------------------------------------ start */
  buildNav();
  route();
  window.addEventListener('hashchange', route);
})();
