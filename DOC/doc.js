/*!
 * WUI 문서 뷰어 - DOC/doc.js
 * window.WUI_DOCS(docs-data.js) 를 읽어 자체 Markdown 렌더러로 표시한다.
 * 외부 라이브러리/CDN 없이 file:// 에서도 동작한다.
 */
(function () {
  'use strict';

  var DATA = window.WUI_DOCS;
  var docList = document.getElementById('docList');
  var article = document.getElementById('docArticle');
  var pager = document.getElementById('docPager');
  var crumb = document.getElementById('docCrumb');
  var searchInput = document.getElementById('docSearch');
  var searchHint = document.getElementById('docSearchHint');
  var scrollEl = document.getElementById('docScroll');
  var themeBtn = document.getElementById('docTheme');
  var rawLink = document.getElementById('docRaw');
  var navToggle = document.getElementById('docMenuBtn');
  var backdrop = document.getElementById('docBackdrop');
  var toastEl = document.getElementById('docToast');

  var THEME_KEY = 'wui.doc.theme';
  var docs = [];
  var currentId = null;
  var toastTimer = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function safeHref(href) {
    var url = String(href || '').trim();
    if (!url) return '';
    if (/^(javascript|vbscript|data):/i.test(url)) return '';
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (url.charAt(0) === '#' || url.charAt(0) === '/' || url.indexOf('./') === 0 || url.indexOf('../') === 0) return url;
    var colon = url.indexOf(':');
    var slash = url.indexOf('/');
    if (colon >= 0 && (slash < 0 || colon < slash)) return '';
    return url;
  }

  /* ------------------------------ Markdown: inline ------------------------------ */
  function inline(text) {
    var codes = [];
    var s = String(text == null ? '' : text);

    // 코드 스팬을 먼저 토큰으로 보호한다.
    s = s.replace(/`([^`\n]+)`/g, function (_, code) {
      codes.push('<code>' + escapeHtml(code) + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });

    s = escapeHtml(s);

    // 이미지
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, function (_, alt, src) {
      var safe = safeHref(src.replace(/&amp;/g, '&'));
      if (!safe) return alt;
      return '<img src="' + escapeAttr(safe) + '" alt="' + escapeAttr(alt) + '" loading="lazy">';
    });

    // 링크
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, function (_, label, href) {
      var safe = safeHref(href.replace(/&amp;/g, '&'));
      if (!safe) return label;
      if (/\.md(?:#.*)?$/i.test(safe)) {
        var parts = safe.split('#');
        var id = parts[0].split('/').pop().replace(/\.md$/i, '');
        var anchor = parts[1] ? '/' + parts[1] : '';
        return '<a href="#' + encodeURIComponent(id) + anchor + '" data-doc-link>' + label + '</a>';
      }
      if (/^https?:\/\//i.test(safe)) {
        return '<a href="' + escapeAttr(safe) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      }
      return '<a href="' + escapeAttr(safe) + '">' + label + '</a>';
    });

    // 자동 링크 &lt;https://...&gt;
    s = s.replace(/(^|[\s(])(?:&lt;)((?:https?:\/\/|mailto:)[^\s&]+)(?:&gt;)/g, function (_, pre, url) {
      return pre + '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });

    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');

    // 코드 스팬 복원
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, index) {
      return codes[Number(index)] || '';
    });
    return s;
  }

  /* ------------------------------ Markdown: block ------------------------------ */
  var LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  var FENCE_RE = /^\s*(```+|~~~+)\s*([\w+-]*)\s*$/;
  var HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

  function isBlank(line) { return !line.trim(); }

  function isFence(line) { return FENCE_RE.test(line); }

  function isTableStart(lines, index) {
    if (index + 1 >= lines.length) return false;
    if (lines[index].indexOf('|') < 0) return false;
    var sep = lines[index + 1];
    if (sep.indexOf('|') < 0) return false;
    var cells = splitRow(sep);
    return cells.length > 0 && cells.every(function (cell) { return /^:?-{3,}:?$/.test(cell.trim()); });
  }

  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    var cells = [];
    var cur = '';
    var tick = false;
    for (var i = 0; i < s.length; i += 1) {
      var ch = s.charAt(i);
      if (ch === '\\' && s.charAt(i + 1) === '|') { cur += '|'; i += 1; continue; }
      if (ch === '`') { tick = !tick; cur += ch; continue; }
      if (ch === '|' && !tick) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function parseTable(lines, start) {
    var headers = splitRow(lines[start]);
    var aligns = splitRow(lines[start + 1]).map(function (cell) {
      var c = cell.trim();
      if (/^:.*:$/.test(c)) return 'center';
      if (/:$/.test(c)) return 'right';
      return '';
    });
    var i = start + 2;
    var rows = [];
    while (i < lines.length) {
      var line = lines[i];
      if (isBlank(line) || line.indexOf('|') < 0 || isFence(line) || HEADING_RE.test(line)) break;
      if (isTableStart(lines, i)) break;
      rows.push(splitRow(line));
      i += 1;
    }
    var html = '<div class="doc-tablewrap"><table><thead><tr>';
    headers.forEach(function (cell, index) {
      var align = aligns[index] ? ' class="is-' + aligns[index] + '"' : '';
      html += '<th' + align + '>' + inline(cell) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      headers.forEach(function (_, index) {
        var align = aligns[index] ? ' class="is-' + aligns[index] + '"' : '';
        html += '<td' + align + '>' + inline(row[index] || '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return { html: html, next: i };
  }

  function parseList(lines, start, baseIndent) {
    var first = lines[start].match(LIST_RE);
    var ordered = /\d/.test(first[2]);
    var tag = ordered ? 'ol' : 'ul';
    var html = '<' + tag + '>';
    var i = start;

    while (i < lines.length) {
      if (isBlank(lines[i])) {
        var probe = i + 1;
        while (probe < lines.length && isBlank(lines[probe])) probe += 1;
        var nextMatch = probe < lines.length ? lines[probe].match(LIST_RE) : null;
        if (nextMatch && nextMatch[1].length >= baseIndent) { i = probe; continue; }
        break;
      }
      var match = lines[i].match(LIST_RE);
      if (!match) break;
      var indent = match[1].length;
      if (indent < baseIndent) break;
      if (indent > baseIndent) {
        var nested = parseList(lines, i, indent);
        html = html.replace(/<\/li>$/, nested.html + '</li>');
        if (nested.next === i) break;
        i = nested.next;
        continue;
      }

      var content = match[3];
      i += 1;

      // 이어지는 들여쓰기 문장은 같은 항목으로 합친다.
      while (i < lines.length) {
        var line = lines[i];
        if (isBlank(line)) break;
        var nextList = line.match(LIST_RE);
        if (nextList || /^\s*(```|~~~|\||>|#{1,6}\s)/.test(line)) break;
        if (/^\s{2,}/.test(line)) { content += ' ' + line.trim(); i += 1; continue; }
        break;
      }

      html += '<li>' + inline(content);
      if (i < lines.length) {
        var sub = lines[i].match(LIST_RE);
        if (sub && sub[1].length > baseIndent) {
          var subList = parseList(lines, i, sub[1].length);
          html += subList.html;
          i = subList.next;
        }
      }
      html += '</li>';
    }
    html += '</' + tag + '>';
    return { html: html, next: i };
  }

  function parseFence(lines, start) {
    var opener = lines[start].match(FENCE_RE);
    var marker = opener[1].charAt(0);
    var lang = opener[2] || 'text';
    var body = [];
    var i = start + 1;
    while (i < lines.length) {
      var line = lines[i];
      var close = line.match(FENCE_RE);
      if (close && close[1].charAt(0) === marker && line.trim().replace(new RegExp('\\' + marker, 'g'), '') === '') break;
      body.push(line);
      i += 1;
    }
    var code = escapeHtml(body.join('\n'));
    var html = '<div class="doc-code"><div class="doc-code-head"><span>' + escapeHtml(lang) +
      '</span><button type="button" class="doc-code-copy" data-copy>복사</button></div>' +
      '<pre><code class="language-' + escapeAttr(lang) + '">' + code + '</code></pre></div>';
    return { html: html, next: Math.min(i + 1, lines.length) };
  }

  function renderMarkdown(markdown, headings) {
    var lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    var html = '';
    var i = 0;
    var headingIndex = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i += 1; continue; }

      if (isFence(line)) {
        var block = parseFence(lines, i);
        html += block.html;
        i = block.next;
        continue;
      }

      var heading = line.match(HEADING_RE);
      if (heading) {
        var level = heading[1].length;
        if (level === 1) { i += 1; continue; }
        var meta = headings[headingIndex] || null;
        headingIndex += 1;
        var id = meta ? meta.id : 'sec-' + headingIndex;
        html += '<h' + level + ' id="' + escapeAttr(id) + '">' +
          '<a class="doc-anchor" href="#' + encodeURIComponent(currentId || '') + '/' + encodeURIComponent(id) +
          '" aria-hidden="true">#</a>' + inline(heading[2]) + '</h' + level + '>';
        i += 1;
        continue;
      }

      if (isTableStart(lines, i)) {
        var table = parseTable(lines, i);
        html += table.html;
        i = table.next;
        continue;
      }

      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        html += '<hr>';
        i += 1;
        continue;
      }

      if (/^\s*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        html += '<blockquote>' + quote.map(function (q) { return '<p>' + inline(q) + '</p>'; }).join('') + '</blockquote>';
        continue;
      }

      if (LIST_RE.test(line)) {
        var list = parseList(lines, i, line.match(LIST_RE)[1].length);
        html += list.html;
        i = list.next;
        continue;
      }

      // 문단
      var para = [];
      while (i < lines.length) {
        var cur = lines[i];
        if (isBlank(cur) || isFence(cur) || HEADING_RE.test(cur) || LIST_RE.test(cur) ||
            /^\s*>/.test(cur) || isTableStart(lines, i) || /^\s*([-*_])\1{2,}\s*$/.test(cur)) break;
        para.push(cur.trim());
        i += 1;
      }
      if (para.length) html += '<p>' + inline(para.join(' ')) + '</p>';
      else i += 1;
    }
    return html;
  }

  /* ------------------------------ 화면 ------------------------------ */
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand('copy');
        area.remove();
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        area.remove();
        reject(err);
      }
    });
  }

  function findDoc(id) {
    for (var i = 0; i < docs.length; i += 1) if (docs[i].id === id) return docs[i];
    return null;
  }

  function parseHash() {
    var raw = String(location.hash || '').replace(/^#/, '');
    try { raw = decodeURIComponent(raw); } catch (err) { /* noop */ }
    var parts = raw.split('/');
    var id = parts.shift() || '';
    return { id: id, anchor: parts.join('/') };
  }

  function setHash(id, anchor, replace) {
    var hash = '#' + encodeURIComponent(id) + (anchor ? '/' + encodeURIComponent(anchor) : '');
    if (location.hash === hash) return;
    if (replace && history.replaceState) {
      try { history.replaceState(null, '', hash); return; } catch (err) { /* file:// 등 */ }
    }
    location.hash = hash;
  }

  function highlight(text, query) {
    var source = String(text || '');
    if (!query) return escapeHtml(source);
    var lower = source.toLowerCase();
    var needle = query.toLowerCase();
    var index = 0;
    var out = '';
    while (index < source.length) {
      var at = lower.indexOf(needle, index);
      if (at < 0) { out += escapeHtml(source.slice(index)); break; }
      out += escapeHtml(source.slice(index, at));
      out += '<mark>' + escapeHtml(source.slice(at, at + query.length)) + '</mark>';
      index = at + query.length;
    }
    return out;
  }

  function renderList(query) {
    var q = String(query || '').trim();
    var lower = q.toLowerCase();
    var filtered = docs.filter(function (doc) {
      if (!lower) return true;
      return (doc.title + '\n' + doc.summary + '\n' + doc.markdown).toLowerCase().indexOf(lower) >= 0;
    });

    docList.innerHTML = '';
    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'doc-nav-empty';
      empty.textContent = '검색 결과가 없습니다.';
      docList.appendChild(empty);
    } else {
      filtered.forEach(function (doc) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'doc-nav-item' + (doc.id === currentId ? ' is-active' : '');
        button.setAttribute('data-doc-id', doc.id);

        var title = document.createElement('span');
        title.className = 'doc-nav-title';
        var order = document.createElement('span');
        order.className = 'doc-nav-order';
        order.textContent = String(doc.order).padStart(2, '0');
        var label = document.createElement('span');
        label.innerHTML = highlight(doc.title, q);
        title.appendChild(order);
        title.appendChild(label);
        button.appendChild(title);

        if (doc.summary) {
          var summary = document.createElement('span');
          summary.className = 'doc-nav-summary';
          summary.innerHTML = highlight(doc.summary, q);
          button.appendChild(summary);
        }
        docList.appendChild(button);
      });
    }

    if (searchHint) {
      searchHint.textContent = q
        ? '"' + q + '" · ' + filtered.length + '개 문서'
        : '문서 ' + docs.length + '개 · 제목/본문 검색';
    }
  }

  function renderToc(doc) {
    var headings = (doc.headings || []).filter(function (h) { return h.level <= 3; });
    if (!headings.length) return '';
    var items = headings.map(function (h) {
      return '<li><a class="' + (h.level === 3 ? 'is-sub' : '') + '" href="#' +
        encodeURIComponent(doc.id) + '/' + encodeURIComponent(h.id) + '">' + escapeHtml(h.text) + '</a></li>';
    }).join('');
    return '<div class="doc-toc"><div class="doc-toc-head">목차</div><ol class="doc-toc-list">' + items + '</ol></div>';
  }

  function renderPager(doc) {
    var index = docs.indexOf(doc);
    var prev = index > 0 ? docs[index - 1] : null;
    var next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : null;
    pager.innerHTML = '';
    [prev, next].forEach(function (item, i) {
      var link = document.createElement('a');
      link.className = 'doc-pager-link' + (i === 1 ? ' is-next' : '') + (item ? '' : ' doc-pager-empty');
      if (item) {
        link.href = '#' + encodeURIComponent(item.id);
        link.innerHTML = '<span class="doc-pager-label">' + (i === 0 ? '← 이전 문서' : '다음 문서 →') +
          '</span><span class="doc-pager-title">' + escapeHtml(item.title) + '</span>';
      }
      pager.appendChild(link);
    });
  }

  function renderDoc(doc, anchor) {
    currentId = doc.id;
    document.title = doc.title + ' · WUI 문서';
    if (crumb) crumb.innerHTML = 'WUI 문서 / <strong>' + escapeHtml(doc.title) + '</strong>';
    if (rawLink) rawLink.href = encodeURI(doc.file);

    var headingCount = (doc.headings || []).length;
    article.innerHTML =
      '<header class="doc-head">' +
        '<div class="doc-eyebrow">WUI Documentation</div>' +
        '<h1 class="doc-title">' + escapeHtml(doc.title) + '</h1>' +
        (doc.summary ? '<p class="doc-summary">' + escapeHtml(doc.summary) + '</p>' : '') +
        '<div class="doc-meta"><span><code>' + escapeHtml(doc.file) + '</code></span>' +
          '<span>섹션 ' + headingCount + '개</span><span>Markdown</span></div>' +
      '</header>' +
      renderToc(doc) +
      '<div class="doc-body">' + renderMarkdown(doc.markdown, doc.headings || []) + '</div>';

    renderPager(doc);
    renderList(searchInput ? searchInput.value : '');
    document.body.classList.remove('is-nav-open');

    requestAnimationFrame(function () {
      var target = anchor ? document.getElementById(anchor) : null;
      if (target) target.scrollIntoView({ block: 'start' });
      else scrollEl.scrollTop = 0;
    });
  }

  function showError(message) {
    article.innerHTML = '<div class="doc-head"><div class="doc-eyebrow">WUI Documentation</div>' +
      '<h1 class="doc-title">문서를 불러오지 못했습니다</h1></div><p>' + escapeHtml(message) + '</p>' +
      '<div class="doc-code"><div class="doc-code-head"><span>bash</span></div>' +
      '<pre><code>npm run build:docs</code></pre></div>';
    if (searchHint) searchHint.textContent = '';
  }

  function route(replace) {
    if (!docs.length) return;
    var parsed = parseHash();
    var doc = findDoc(parsed.id);
    if (!doc) {
      doc = docs[0];
      if (parsed.id) setHash(doc.id, '', true);
    }
    renderDoc(doc, parsed.anchor);
    if (replace) setHash(doc.id, parsed.anchor, true);
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? '☀ <span>라이트</span>' : '☾ <span>다크</span>';
      themeBtn.title = theme === 'dark' ? '라이트 테마로 전환' : '다크 테마로 전환';
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* noop */ }
    }
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (err) { /* noop */ }
    var theme = stored;
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme, false);
  }

  /* ------------------------------ 이벤트 ------------------------------ */
  function bind() {
    docList.addEventListener('click', function (event) {
      var item = event.target.closest('[data-doc-id]');
      if (!item) return;
      location.hash = '#' + encodeURIComponent(item.getAttribute('data-doc-id'));
    });

    if (searchInput) {
      searchInput.addEventListener('input', function () { renderList(searchInput.value); });
      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          var first = docList.querySelector('[data-doc-id]');
          if (first) location.hash = '#' + encodeURIComponent(first.getAttribute('data-doc-id'));
        }
        if (event.key === 'Escape') {
          searchInput.value = '';
          renderList('');
          searchInput.blur();
        }
      });
    }

    article.addEventListener('click', function (event) {
      var button = event.target.closest('[data-copy]');
      if (button) {
        var block = button.closest('.doc-code');
        var code = block ? block.querySelector('code') : null;
        if (!code) return;
        copyText(code.textContent).then(function () {
          button.textContent = '복사됨';
          button.classList.add('is-copied');
          setTimeout(function () {
            button.textContent = '복사';
            button.classList.remove('is-copied');
          }, 1600);
        }).catch(function () {
          showToast('복사하지 못했습니다.');
        });
        return;
      }
      var docLink = event.target.closest('[data-doc-link]');
      if (docLink) {
        event.preventDefault();
        var href = docLink.getAttribute('href') || '';
        if (href.indexOf('#') === 0) location.hash = href;
      }
    });

    window.addEventListener('hashchange', function () { route(false); });

    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
      });
    }

    if (navToggle) {
      navToggle.addEventListener('click', function () { document.body.classList.toggle('is-nav-open'); });
    }
    if (backdrop) {
      backdrop.addEventListener('click', function () { document.body.classList.remove('is-nav-open'); });
    }

    document.addEventListener('keydown', function (event) {
      var tag = (event.target && event.target.tagName) || '';
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (event.target && event.target.isContentEditable);
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (searchInput) searchInput.focus();
      }
      if (event.key === 'Escape') {
        document.body.classList.remove('is-nav-open');
        if (typing && event.target === searchInput && searchInput.value) {
          searchInput.value = '';
          renderList('');
        }
      }
    });
  }

  function init() {
    initTheme();
    if (!DATA || !Array.isArray(DATA.docs) || !DATA.docs.length) {
      showError('DOC/docs-data.js 가 없거나 비어 있습니다. 먼저 문서 데이터를 생성하세요.');
      return;
    }
    docs = DATA.docs.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    bind();
    renderList('');
    route(true);
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
