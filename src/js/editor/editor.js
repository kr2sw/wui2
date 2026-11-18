/*!
 * WUI - editor/editor.js
 * contenteditable 기반 리치 텍스트 에디터 (서식 / 표 / 이미지 첨부)
 *
 * const editor = WUI.createEditor('#editor', { value, height, onChange });
 * editor.getHTML(); editor.setHTML('<p>...</p>'); editor.insertImage(src);
 */
import {
  h, on, uid, escapeHtml, debounce, readFileAsDataURL, storage, isFn, nowTimeStr, clone, append,
} from '../core/util.js';
import { Emitter } from '../core/emitter.js';

/* ------------------------------- 아이콘 ------------------------------- */
const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>',
  strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/>',
  alignLeft: '<path d="M17 10H3M21 6H3M21 14H3M17 18H3"/>',
  alignCenter: '<path d="M18 10H6M21 6H3M21 14H3M18 18H6"/>',
  alignRight: '<path d="M21 10H7M21 6H3M21 14H3M21 18H7"/>',
  alignJustify: '<path d="M21 10H3M21 6H3M21 14H3M21 18H3"/>',
  ul: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01" stroke-width="3"/>',
  ol: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  outdent: '<path d="M3 8h18M3 16h18M9 12l-4 0M7 10l-2 2 2 2"/>',
  indent: '<path d="M3 8h18M3 16h18M3 12h4M7 10l2 2-2 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  unlink: '<path d="M18.8 5.2a5 5 0 0 0-7 0L10 7M6 17l-1.8 1.8a5 5 0 0 0 7 7"/><path d="M3 3l18 18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  hr: '<path d="M3 12h18"/><path d="M6 7h12M6 17h12" opacity=".35"/>',
  quote: '<path d="M7 7h4v5H6V9a2 2 0 0 1 1-2zM16 7h4v5h-5V9a2 2 0 0 1 1-2z" fill="currentColor" stroke="none"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  eraser: '<path d="m7 21-4-4 9-9 4 4-9 9z"/><path d="M14 4l6 6M9 21h12"/>',
  source: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/>',
  fullscreen: '<path d="M3 9V4h5M21 9V4h-5M3 15v5h5M21 15v5h-5"/>',
  exitFullscreen: '<path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
  rowAdd: '<rect x="3" y="4" width="18" height="7" rx="1"/><path d="M12 14v7M8.5 17.5h7"/>',
  rowDel: '<rect x="3" y="4" width="18" height="7" rx="1"/><path d="M8.5 17.5h7"/>',
  colAdd: '<rect x="3" y="3" width="7" height="18" rx="1"/><path d="M16 12h6M19 9v6"/>',
  colDel: '<rect x="3" y="3" width="7" height="18" rx="1"/><path d="M16 12h6"/>',
  tableDel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 9 6 6M15 9l-6 6"/>',
  sup: '<path d="M4 20 12 6l8 14"/><path d="M15 4h4v4"/>',
  sub: '<path d="M4 16 12 4l8 12"/><path d="M15 18h4v4"/>',
};
function icon(name) {
  const path = ICONS[name];
  if (!path) return `<span>${escapeHtml(name)}</span>`;
  return SVG_OPEN + path + '</svg>';
}

/* ------------------------------ HTML 정화 ------------------------------ */
const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'MARK',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'A', 'IMG', 'FIGURE', 'FIGCAPTION',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'COLGROUP', 'COL',
  'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'SUB', 'SUP', 'FONT', 'SMALL', 'BIG',
]);
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);
const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan',
  'align', 'style', 'class', 'type', 'start', 'value', 'datetime', 'scope', 'face', 'size', 'color',
  'aria-label', 'role', 'loading', 'referrerpolicy', 'id',
]);

export function sanitizeHtml(html) {
  if (!html) return '';
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html);
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) { nodes.push(node); node = walker.nextNode(); }

  for (const el of nodes) {
    if (DROP_TAGS.has(el.tagName)) { el.remove(); continue; }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // 허용되지 않는 컨테이너는 자식만 남긴다.
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
      }
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') { el.removeAttribute(attr.name); continue; }
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*(javascript|vbscript|data:text\/html)/i.test(value)) {
        el.removeAttribute(attr.name); continue;
      }
      if (name === 'style' && /expression|javascript:|url\s*\(/i.test(value)) { el.removeAttribute(attr.name); continue; }
      if (!ALLOWED_ATTRS.has(name) && !name.startsWith('data-')) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'IMG' && !el.getAttribute('src')) el.remove();
    if (el.tagName === 'A') {
      el.setAttribute('rel', 'noopener noreferrer');
      if (!el.getAttribute('target')) el.setAttribute('target', '_blank');
    }
  }
  return tpl.innerHTML;
}

/* ------------------------------ 기본 옵션 ------------------------------ */
const DEFAULTS = {
  value: '',
  placeholder: '내용을 입력하세요.\n표·이미지·서식을 사용할 수 있습니다.',
  height: 320,
  minHeight: 180,
  toolbar: 'full',           // 'full' | 'basic' | false
  stickyToolbar: true,
  readOnly: false,
  autofocus: false,
  autosave: false,
  autosaveKey: null,
  autosaveDelay: 700,
  image: {
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024,
    uploader: null,          // async (file) => url
  },
  table: { maxRows: 20, maxCols: 10, defaultRows: 3, defaultCols: 3 },
  sanitize: true,
  showStatus: true,
  onChange: null,
  onSave: null,
  onImage: null,
};

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32];
const BLOCK_OPTIONS = [
  ['p', '본문'], ['h1', '제목 1'], ['h2', '제목 2'], ['h3', '제목 3'], ['h4', '제목 4'],
  ['blockquote', '인용'], ['pre', '코드 블록'],
];

const TABLE_TOOLS = [
  ['rowAdd', '행 추가', 'row-add'], ['rowDel', '행 삭제', 'row-del'],
  ['colAdd', '열 추가', 'col-add'], ['colDel', '열 삭제', 'col-del'],
  ['tableDel', '표 삭제', 'table-del'],
];

/* ------------------------------- 팩토리 ------------------------------- */
export function createEditor(mount, options = {}) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error('[wui:editor] 마운트 대상이 없습니다.');
  const opts = { ...DEFAULTS, ...options, image: { ...DEFAULTS.image, ...(options.image || {}) }, table: { ...DEFAULTS.table, ...(options.table || {}) } };
  const emitter = new Emitter();
  const id = uid('wui-editor');
  const autosaveKey = opts.autosaveKey || `wui.editor.${id}`;

  let readOnly = Boolean(opts.readOnly);
  let sourceMode = false;
  let savedRange = null;
  let selectedImg = null;
  let destroyed = false;
  let dirty = false;

  /* --- 마크업 --- */
  const rootEl = h('div.wui-editor', {
    'data-wui-editor': id,
    class: [opts.stickyToolbar ? 'is-sticky' : '', readOnly ? 'is-readonly' : '', opts.className || ''].filter(Boolean).join(' '),
  });
  const toolbarEl = h('div.wui-editor-toolbar', { role: 'toolbar', 'aria-label': '편집 도구' });
  const bodyEl = h('div.wui-editor-body', { style: { position: 'relative', display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });
  const areaEl = h('div.wui-editor-area', {
    contenteditable: readOnly ? 'false' : 'true',
    role: 'textbox',
    'aria-multiline': 'true',
    spellcheck: 'false',
    'data-placeholder': opts.placeholder,
    style: { minHeight: `${opts.minHeight}px`, height: typeof opts.height === 'number' ? `${opts.height}px` : opts.height },
  });
  const sourceEl = h('textarea.wui-editor-source', { spellcheck: 'false', 'aria-label': 'HTML 소스' });
  const dropEl = h('div.wui-editor-drop', {}, '이미지를 놓으면 첨부됩니다');
  const imgbarEl = h('div.wui-editor-imgbar', { hidden: true });
  const statusEl = opts.showStatus ? h('div.wui-editor-status') : null;
  const statusCountEl = h('span', {}, '0자');
  const statusMsgEl = h('span.wui-grow', {}, '');
  const statusSavedEl = h('span', {}, '');
  if (statusEl) append(statusEl, [statusCountEl, statusMsgEl, statusSavedEl]);

  append(bodyEl, [areaEl, sourceEl, dropEl, imgbarEl]);
  append(rootEl, [toolbarEl, bodyEl, statusEl]);

  // textarea 로 마운트된 경우: 숨기고 폼 연동을 유지
  let hiddenInput = null;
  if (target.tagName === 'TEXTAREA') {
    hiddenInput = target;
    hiddenInput.style.display = 'none';
    hiddenInput.parentNode.insertBefore(rootEl, hiddenInput.nextSibling);
    if (opts.value === '' && hiddenInput.value) opts.value = hiddenInput.value;
  } else {
    target.innerHTML = '';
    target.appendChild(rootEl);
  }

  /* --- 자동 저장 복원 --- */
  if (!opts.value && opts.autosave) {
    const saved = storage.get(autosaveKey, null);
    if (saved) opts.value = saved;
  }

  /* --- 초기값 --- */
  setHTML(opts.value || '', { silent: true });
  syncEmpty();
  updateCount();

  if (readOnly) toolbarEl.style.pointerEvents = 'none';

  /* ------------------------------ 툴바 ------------------------------ */
  function btn({ icon: iconName, title, cmd, action, wide, text, attr }) {
    const className = ['wui-editor-btn', wide ? 'is-wide' : ''].filter(Boolean).join(' ');
    const b = h('button', {
      type: 'button', class: className, title, 'aria-label': title, ...(attr || {}),
    });
    b.innerHTML = (iconName ? icon(iconName) : '') + (text ? `<span>${escapeHtml(text)}</span>` : '');
    b.addEventListener('mousedown', (e) => e.preventDefault()); // 선택 영역 유지
    b.addEventListener('click', (e) => {
      e.preventDefault();
      if (action) action(b);
      else if (cmd) exec(cmd);
    });
    return b;
  }

  const stateButtons = [];
  function group(...nodes) { return h('div.wui-editor-group', {}, nodes); }

  const blockSelect = h('select.wui-editor-select', { title: '문단 스타일', 'aria-label': '문단 스타일' },
    BLOCK_OPTIONS.map(([value, label]) => h('option', { value }, label)));
  blockSelect.addEventListener('change', () => {
    exec('formatBlock', `<${blockSelect.value}>`);
    blockSelect.blur();
  });

  const fontSelect = h('select.wui-editor-select', { title: '글자 크기', 'aria-label': '글자 크기', style: { width: '76px' } },
    [h('option', { value: '' }, '크기'), ...FONT_SIZES.map((px) => h('option', { value: px }, `${px}px`))]);
  fontSelect.addEventListener('change', () => {
    if (fontSelect.value) setFontSize(Number(fontSelect.value));
    fontSelect.value = '';
    fontSelect.blur();
  });

  function colorControl(kind, iconName, title, initial) {
    const input = h('input', { type: 'color', value: initial, 'aria-label': title });
    const wrap = h('label.wui-editor-color', { title, class: kind === 'backColor' ? 'is-highlight' : '' },
      h('span.wui-editor-color-bar', { style: { '--swatch': initial } }),
      input);
    const inner = h('span', { style: { position: 'relative', zIndex: 1, display: 'inline-flex' } });
    inner.innerHTML = icon(iconName);
    wrap.insertBefore(inner, wrap.firstChild);
    input.addEventListener('input', () => {
      wrap.style.setProperty('--swatch', input.value);
      exec(kind, input.value);
    });
    return wrap;
  }

  const tableToolsEl = h('div.wui-editor-group', { hidden: true, 'data-wui-table-tools': '' });
  for (const [ic, title, action] of TABLE_TOOLS) {
    tableToolsEl.appendChild(btn({ icon: ic, title, action: () => tableAction(action) }));
  }

  function buildToolbar() {
    toolbarEl.innerHTML = '';
    if (opts.toolbar === false) { toolbarEl.style.display = 'none'; return; }

    const undoBtn = btn({ icon: 'undo', title: '실행 취소 (Ctrl+Z)', cmd: 'undo' });
    const redoBtn = btn({ icon: 'redo', title: '다시 실행 (Ctrl+Shift+Z)', cmd: 'redo' });

    const boldBtn = btn({ icon: 'bold', title: '굵게 (Ctrl+B)', cmd: 'bold' });
    const italicBtn = btn({ icon: 'italic', title: '기울임 (Ctrl+I)', cmd: 'italic' });
    const underlineBtn = btn({ icon: 'underline', title: '밑줄 (Ctrl+U)', cmd: 'underline' });
    const strikeBtn = btn({ icon: 'strike', title: '취소선', cmd: 'strikeThrough' });
    [['bold', boldBtn], ['italic', italicBtn], ['underline', underlineBtn], ['strikeThrough', strikeBtn]]
      .forEach(([cmd, b]) => { b.dataset.stateCmd = cmd; stateButtons.push(b); });

    const sourceBtn = btn({
      icon: 'source', title: 'HTML 소스 보기', action: () => setSourceMode(!sourceMode),
    });
    sourceBtn.dataset.role = 'source';
    const fullBtn = btn({ icon: 'fullscreen', title: '전체 화면 (Esc)', action: () => toggleFullscreen() });
    fullBtn.dataset.role = 'fullscreen';

    append(toolbarEl, [
      group(undoBtn, redoBtn),
      group(blockSelect),
      group(fontSelect),
      group(boldBtn, italicBtn, underlineBtn, strikeBtn),
      group(
        colorControl('foreColor', 'bold', '글자 색', '#101828'),
        colorControl('backColor', 'bold', '형광펜', '#fff176'),
      ),
      group(
        btn({ icon: 'alignLeft', title: '왼쪽 정렬', cmd: 'justifyLeft', attr: { 'data-state-cmd': 'justifyLeft' } }),
        btn({ icon: 'alignCenter', title: '가운데 정렬', cmd: 'justifyCenter', attr: { 'data-state-cmd': 'justifyCenter' } }),
        btn({ icon: 'alignRight', title: '오른쪽 정렬', cmd: 'justifyRight', attr: { 'data-state-cmd': 'justifyRight' } }),
        btn({ icon: 'alignJustify', title: '양쪽 정렬', cmd: 'justifyFull', attr: { 'data-state-cmd': 'justifyFull' } }),
      ),
      group(
        btn({ icon: 'ul', title: '글머리 기호', cmd: 'insertUnorderedList', attr: { 'data-state-cmd': 'insertUnorderedList' } }),
        btn({ icon: 'ol', title: '번호 목록', cmd: 'insertOrderedList', attr: { 'data-state-cmd': 'insertOrderedList' } }),
        btn({ icon: 'outdent', title: '내어쓰기', cmd: 'outdent' }),
        btn({ icon: 'indent', title: '들여쓰기', cmd: 'indent' }),
      ),
      group(
        btn({ icon: 'link', title: '링크 (Ctrl+K)', action: openLinkDialog }),
        btn({ icon: 'image', title: '이미지 첨부', action: () => fileInput.click() }),
        btn({ icon: 'table', title: '표 삽입', action: openTableDialog }),
        btn({ icon: 'hr', title: '구분선', cmd: 'insertHorizontalRule' }),
      ),
      group(
        btn({ icon: 'quote', title: '인용', action: () => exec('formatBlock', '<blockquote>') }),
        btn({ icon: 'code', title: '코드 블록', action: () => exec('formatBlock', '<pre>') }),
        btn({ icon: 'eraser', title: '서식 지우기', action: () => { exec('removeFormat'); exec('formatBlock', '<p>'); } }),
      ),
      opts.toolbar === 'full' ? group(sourceBtn, fullBtn) : group(fullBtn),
      tableToolsEl,
    ]);
  }

  const fileInput = h('input', {
    type: 'file', accept: opts.image.accept, multiple: true, hidden: true,
    on: {
      change: async () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = '';
        for (const file of files) await insertImageFile(file);
      },
    },
  });
  rootEl.appendChild(fileInput);
  buildToolbar();

  /* ------------------------------ 상태 ------------------------------ */
  function setStatus(message, tone = '') {
    if (!statusMsgEl) return;
    statusMsgEl.textContent = message || '';
    statusMsgEl.style.color = tone === 'error' ? 'var(--wui-danger)' : tone === 'ok' ? 'var(--wui-success)' : '';
  }

  function updateCount() {
    if (!statusCountEl) return;
    const text = areaEl.textContent || '';
    const chars = text.replace(/\s/g, '').length;
    statusCountEl.textContent = `${chars.toLocaleString()}자`;
  }

  function syncEmpty() {
    const empty = !areaEl.textContent.trim() && !areaEl.querySelector('img,table,hr');
    areaEl.dataset.empty = empty ? 'true' : 'false';
  }

  function syncHiddenInput() {
    if (hiddenInput) hiddenInput.value = getHTML();
  }

  function markDirty() {
    dirty = true;
    syncEmpty();
    updateCount();
    syncHiddenInput();
    scheduleChange();
    scheduleAutosave();
  }

  const emitChange = debounce(() => {
    if (destroyed) return;
    const data = getData();
    emitter.emit('change', data);
    if (isFn(opts.onChange)) opts.onChange(data);
  }, 200);

  function scheduleChange() { emitChange(); }

  const scheduleAutosave = debounce(() => {
    if (!opts.autosave) return;
    const html = getHTML({ raw: true });
    storage.set(autosaveKey, html);
    if (statusSavedEl) {
      statusSavedEl.textContent = `자동 저장 ${nowTimeStr()}`;
      statusSavedEl.classList.add('is-saved');
    }
  }, opts.autosaveDelay);

  /* ------------------------------ 선택 영역 ------------------------------ */
  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (areaEl.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
  }

  function restoreSelection() {
    if (!savedRange) return;
    if (!areaEl.contains(savedRange.commonAncestorContainer)) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function focusArea() {
    if (readOnly) return;
    try { areaEl.focus({ preventScroll: true }); } catch (_) { areaEl.focus(); }
  }

  function exec(command, value = null) {
    if (readOnly || sourceMode) return;
    focusArea();
    restoreSelection();
    try { document.execCommand('styleWithCSS', false, true); } catch (_) { /* noop */ }
    try { document.execCommand(command, false, value); } catch (err) { console.warn('[wui:editor]', command, err); }
    markDirty();
    syncToolbarState();
  }

  function setFontSize(px) {
    if (!px) return;
    exec('fontSize', '7');
    areaEl.querySelectorAll('font[size="7"]').forEach((node) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.innerHTML = node.innerHTML;
      node.replaceWith(span);
    });
    areaEl.querySelectorAll('span[style]').forEach((span) => {
      if (/font-size:\s*(xxx-large|-webkit-xxx-large)/i.test(span.getAttribute('style') || '')) {
        span.style.fontSize = `${px}px`;
      }
    });
  }

  function getSelectedText() {
    const sel = window.getSelection();
    return sel ? sel.toString() : '';
  }

  function syncToolbarState() {
    if (readOnly || sourceMode) return;
    if (!areaEl.contains(document.activeElement) && !savedRange) return;
    for (const b of stateButtons) {
      const cmd = b.dataset.stateCmd;
      if (!cmd) continue;
      let active = false;
      try { active = document.queryCommandState(cmd); } catch (_) { /* noop */ }
      b.classList.toggle('is-active', Boolean(active));
    }
    try {
      const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      const normalized = block === 'div' || block === 'normal' || !block ? 'p' : block;
      if (BLOCK_OPTIONS.some(([v]) => v === normalized)) blockSelect.value = normalized;
    } catch (_) { /* noop */ }

    const inTable = Boolean(getCell());
    tableToolsEl.hidden = !inTable;
  }

  function getCell() {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const cell = node && node.closest ? node.closest('td,th') : null;
    return cell && areaEl.contains(cell) ? cell : null;
  }

  /* ------------------------------ 표 ------------------------------ */
  function buildTable(rows, cols, header) {
    const safeRows = Math.max(1, Math.min(opts.table.maxRows, Number(rows) || 1));
    const safeCols = Math.max(1, Math.min(opts.table.maxCols, Number(cols) || 1));
    let html = '<table class="wui-editor-table"><tbody>';
    for (let r = 0; r < safeRows; r += 1) {
      html += '<tr>';
      for (let c = 0; c < safeCols; c += 1) {
        const tag = header && r === 0 ? 'th' : 'td';
        html += `<${tag}><br></${tag}>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    return html;
  }

  function insertTable(rows = opts.table.defaultRows, cols = opts.table.defaultCols, header = true) {
    exec('insertHTML', buildTable(rows, cols, header));
    setStatus(`${rows} × ${cols} 표를 삽입했습니다.`, 'ok');
    return true;
  }

  function tableAction(action) {
    const cell = getCell();
    if (!cell) return;
    const row = cell.parentElement;
    const table = cell.closest('table');
    if (!table) return;
    switch (action) {
      case 'row-add': {
        const newRow = document.createElement('tr');
        for (let i = 0; i < row.children.length; i += 1) {
          const tag = row.children[i].tagName === 'TH' ? 'th' : 'td';
          const c = document.createElement(tag);
          c.innerHTML = '<br>';
          newRow.appendChild(c);
        }
        row.after(newRow);
        break;
      }
      case 'row-del':
        if (table.rows.length > 1) row.remove();
        else table.remove();
        break;
      case 'col-add': {
        const index = cell.cellIndex;
        Array.from(table.rows).forEach((tr) => {
          const ref = tr.children[index];
          const tag = ref && ref.tagName === 'TH' ? 'th' : 'td';
          const c = document.createElement(tag);
          c.innerHTML = '<br>';
          if (ref && ref.nextSibling) tr.insertBefore(c, ref.nextSibling);
          else tr.appendChild(c);
        });
        break;
      }
      case 'col-del': {
        const index = cell.cellIndex;
        if ((table.rows[0]?.children.length || 0) <= 1) { table.remove(); break; }
        Array.from(table.rows).forEach((tr) => tr.children[index] && tr.children[index].remove());
        break;
      }
      case 'table-del':
        table.remove();
        break;
      default:
        break;
    }
    markDirty();
    syncToolbarState();
  }

  /* ------------------------------ 다이얼로그 ------------------------------ */
  function dialog({ title, fields = [], submitText = '확인' }) {
    return new Promise((resolve) => {
      const mask = h('div.wui-dialog-mask');
      const box = h('div.wui-dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
      const body = h('div.wui-dialog-body');
      const inputs = {};
      for (const field of fields) {
        const input = field.type === 'checkbox'
          ? h('input', { type: 'checkbox', checked: Boolean(field.value) })
          : h('input.wui-input', {
            type: field.type || 'text', value: field.value ?? '',
            placeholder: field.placeholder || '', min: field.min, max: field.max,
            inputmode: field.type === 'number' ? 'numeric' : undefined,
          });
        inputs[field.name] = { input, field };
        body.appendChild(h('label.wui-dialog-row', {},
          h('span', {}, field.label || field.name),
          input));
      }
      const cancelBtn = h('button.wui-btn', { type: 'button' }, '취소');
      const okBtn = h('button.wui-btn.wui-btn-primary', { type: 'button' }, submitText);
      append(box, [
        h('div.wui-dialog-head', {}, title),
        body,
        h('div.wui-dialog-foot', {}, cancelBtn, okBtn),
      ]);
      mask.appendChild(box);
      rootEl.appendChild(mask);

      const close = (value) => {
        mask.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(value);
      };
      const submit = () => {
        const out = {};
        for (const [name, { input, field }] of Object.entries(inputs)) {
          out[name] = field.type === 'checkbox' ? input.checked
            : field.type === 'number' ? Number(input.value)
              : input.value.trim();
        }
        close(out);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
      };
      cancelBtn.addEventListener('click', () => close(null));
      okBtn.addEventListener('click', submit);
      mask.addEventListener('mousedown', (e) => { if (e.target === mask) close(null); });
      document.addEventListener('keydown', onKey, true);

      const first = Object.values(inputs)[0];
      if (first) setTimeout(() => { first.input.focus(); first.input.select?.(); }, 30);
    });
  }

  async function openLinkDialog() {
    const selected = getSelectedText();
    const values = await dialog({
      title: selected ? '링크 편집' : '링크 삽입',
      submitText: '적용',
      fields: [
        { name: 'url', label: 'URL', value: 'https://', placeholder: 'https://example.com' },
        { name: 'text', label: '표시 텍스트', value: selected, placeholder: selected ? '' : '링크 텍스트' },
        { name: 'blank', label: '새 창에서 열기', type: 'checkbox', value: true },
      ],
    });
    if (!values) return;
    const label = values.text || values.url;
    if (!label) return;
    const target = values.blank ? ' target="_blank" rel="noopener noreferrer"' : '';
    exec('insertHTML', `<a href="${escapeHtml(values.url)}"${target}>${escapeHtml(label)}</a>`);
  }

  async function openTableDialog() {
    const values = await dialog({
      title: '표 삽입',
      submitText: '삽입',
      fields: [
        { name: 'rows', label: `행 (1~${opts.table.maxRows})`, type: 'number', value: opts.table.defaultRows, min: 1, max: opts.table.maxRows },
        { name: 'cols', label: `열 (1~${opts.table.maxCols})`, type: 'number', value: opts.table.defaultCols, min: 1, max: opts.table.maxCols },
        { name: 'header', label: '첫 행을 머리글로 사용', type: 'checkbox', value: true },
      ],
    });
    if (!values) return;
    insertTable(values.rows, values.cols, values.header);
  }

  /* ------------------------------ 이미지 ------------------------------ */
  async function insertImageFile(file) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) {
      setStatus('이미지 파일만 첨부할 수 있습니다.', 'error');
      return null;
    }
    if (opts.image.maxSize && file.size > opts.image.maxSize) {
      setStatus(`이미지가 너무 큽니다. (최대 ${Math.round(opts.image.maxSize / 1024 / 1024)}MB)`, 'error');
      return null;
    }
    setStatus('이미지 처리 중…');
    try {
      let src;
      if (isFn(opts.image.uploader)) src = await opts.image.uploader(file);
      else src = await readFileAsDataURL(file);
      insertImage(src, { alt: file.name });
      emitter.emit('image', { file, src });
      if (isFn(opts.onImage)) opts.onImage({ file, src });
      setStatus('이미지를 첨부했습니다.', 'ok');
      return src;
    } catch (err) {
      setStatus(`이미지 첨부 실패: ${err.message}`, 'error');
      return null;
    }
  }

  function insertImage(src, { alt = '', width = null } = {}) {
    if (!src) return;
    const style = width ? ` style="width:${Number(width)}px"` : '';
    exec('insertHTML', `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="wui-editor-img"${style}><p><br></p>`);
  }

  function selectImage(img) {
    if (selectedImg) selectedImg.classList.remove('is-selected');
    selectedImg = img;
    if (!img) { imgbarEl.hidden = true; return; }
    img.classList.add('is-selected');
    imgbarEl.innerHTML = '';
    const addBtn = (label, fn) => {
      const b = h('button', { type: 'button' }, label);
      b.addEventListener('click', fn);
      imgbarEl.appendChild(b);
    };
    [25, 50, 75, 100].forEach((pct) => addBtn(`${pct}%`, () => {
      img.style.width = `${pct}%`;
      img.style.height = 'auto';
      markDirty();
      positionImgbar();
    }));
    imgbarEl.appendChild(h('span.sep'));
    const del = h('button', { type: 'button' }, '삭제');
    del.addEventListener('click', () => {
      img.remove();
      selectedImg = null;
      imgbarEl.hidden = true;
      markDirty();
    });
    imgbarEl.appendChild(del);
    imgbarEl.hidden = false;
    positionImgbar(img);
  }

  function positionImgbar(img = selectedImg) {
    if (!img || imgbarEl.hidden) return;
    const rootRect = rootEl.getBoundingClientRect();
    const rect = img.getBoundingClientRect();
    const top = rect.top - rootRect.top - (imgbarEl.offsetHeight + 6);
    imgbarEl.style.left = `${Math.max(4, rect.left - rootRect.left)}px`;
    imgbarEl.style.top = `${Math.max(4, top)}px`;
  }

  /* ------------------------------ 모드 ------------------------------ */
  function setSourceMode(next) {
    const enable = Boolean(next);
    if (enable === sourceMode) return;
    sourceMode = enable;
    rootEl.classList.toggle('is-source', enable);
    const sourceBtn = toolbarEl.querySelector('[data-role="source"]');
    if (sourceBtn) sourceBtn.classList.toggle('is-active', enable);
    if (enable) {
      sourceEl.value = getHTML({ raw: true });
      sourceEl.focus();
      setStatus('HTML 소스 모드 — 저장하거나 소스 버튼을 다시 누르면 반영됩니다.');
    } else {
      setHTML(sourceEl.value, { silent: false });
      focusArea();
      setStatus('소스 편집 내용을 반영했습니다.', 'ok');
    }
  }

  function toggleFullscreen(force) {
    const next = force === undefined ? !rootEl.classList.contains('is-fullscreen') : Boolean(force);
    rootEl.classList.toggle('is-fullscreen', next);
    document.body.classList.toggle('wui-editor-lock', next);
    const b = toolbarEl.querySelector('[data-role="fullscreen"]');
    if (b) {
      b.innerHTML = icon(next ? 'exitFullscreen' : 'fullscreen');
      b.title = next ? '전체 화면 종료 (Esc)' : '전체 화면 (Esc)';
    }
    if (!next) focusArea();
  }

  /* ------------------------------ 이벤트 ------------------------------ */
  const onSelectionChange = () => {
    if (sourceMode) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    if (node && areaEl.contains(node)) {
      saveSelection();
      syncToolbarState();
    }
  };
  document.addEventListener('selectionchange', onSelectionChange);

  areaEl.addEventListener('input', () => { markDirty(); });
  areaEl.addEventListener('focus', () => emitter.emit('focus'));
  areaEl.addEventListener('blur', () => { setTimeout(() => { if (!selectedImg) imgbarEl.hidden = true; }, 120); emitter.emit('blur'); });
  areaEl.addEventListener('scroll', () => positionImgbar());
  areaEl.addEventListener('click', (e) => {
    const img = e.target.closest ? e.target.closest('img') : null;
    if (img && areaEl.contains(img)) { e.preventDefault(); selectImage(img); }
    else if (selectedImg) { selectedImg.classList.remove('is-selected'); selectedImg = null; imgbarEl.hidden = true; }
    syncToolbarState();
  });
  areaEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && getCell()) {
      e.preventDefault();
      const cell = getCell();
      const cells = Array.from(areaEl.querySelectorAll('td,th'));
      const idx = cells.indexOf(cell);
      const next = e.shiftKey ? cells[idx - 1] : cells[idx + 1];
      if (next) {
        next.focus();
        placeCaretAtEnd(next);
      } else if (!e.shiftKey) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        cell.closest('table').after(p);
        placeCaretAtEnd(p);
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); openLinkDialog();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); save();
    }
    if (e.key === 'Escape') {
      if (rootEl.classList.contains('is-fullscreen')) toggleFullscreen(false);
    }
  });

  function placeCaretAtEnd(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
  }

  // 붙여넣기: 이미지 / HTML 정화
  areaEl.addEventListener('paste', async (e) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;
    const files = Array.from(clipboard.files || []).filter((f) => f.type.startsWith('image/'));
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');
    if (files.length) {
      e.preventDefault();
      saveSelection();
      for (const file of files) await insertImageFile(file);
      return;
    }
    if (html) {
      e.preventDefault();
      const clean = opts.sanitize ? sanitizeHtml(html) : html;
      exec('insertHTML', clean);
      return;
    }
    if (text) {
      e.preventDefault();
      exec('insertHTML', escapeHtml(text).replace(/\n/g, '<br>'));
    }
  });

  // 드래그 앤 드롭
  let dragDepth = 0;
  areaEl.addEventListener('dragenter', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      dragDepth += 1;
      rootEl.classList.add('is-dragover');
    }
  });
  areaEl.addEventListener('dragover', (e) => { e.preventDefault(); });
  areaEl.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) rootEl.classList.remove('is-dragover');
  });
  areaEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    rootEl.classList.remove('is-dragover');
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    // 드롭 위치에 삽입
    const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (range && areaEl.contains(range.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      savedRange = range.cloneRange();
    }
    for (const file of files) await insertImageFile(file);
  });

  // 소스 모드 단축키 / 동기화
  sourceEl.addEventListener('input', () => { dirty = true; });
  sourceEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = sourceEl.selectionStart;
      sourceEl.setRangeText('  ', start, sourceEl.selectionEnd, 'end');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  /* ------------------------------ 공개 API ------------------------------ */
  function getHTML({ raw = false } = {}) {
    const html = sourceMode ? sourceEl.value : areaEl.innerHTML;
    return raw || !opts.sanitize ? html : sanitizeHtml(html);
  }

  function setHTML(html, { silent = true } = {}) {
    const clean = opts.sanitize ? sanitizeHtml(html || '') : (html || '');
    areaEl.innerHTML = clean;
    if (sourceMode) sourceEl.value = clean;
    syncEmpty();
    updateCount();
    syncHiddenInput();
    if (!silent) {
      dirty = true;
      scheduleChange();
      scheduleAutosave();
    }
  }

  function getText() {
    return sourceMode ? sourceEl.value.replace(/<[^>]+>/g, '') : (areaEl.innerText || areaEl.textContent || '');
  }

  function setText(text) {
    setHTML(escapeHtml(text || '').replace(/\n/g, '<br>'), { silent: false });
  }

  function getData() {
    const html = getHTML();
    const text = getText();
    return {
      html,
      text,
      empty: !text.trim() && !/<img|<table|<hr/i.test(html),
      chars: text.replace(/\s/g, '').length,
    };
  }

  function save() {
    const data = getData();
    if (opts.autosave) storage.set(autosaveKey, data.html);
    if (statusSavedEl) {
      statusSavedEl.textContent = `저장됨 ${nowTimeStr()}`;
      statusSavedEl.classList.add('is-saved');
    }
    dirty = false;
    emitter.emit('save', data);
    if (isFn(opts.onSave)) opts.onSave(data);
    return data;
  }

  function clear() {
    setHTML('', { silent: false });
    setStatus('');
    emitter.emit('clear');
  }

  function setReadOnly(flag) {
    readOnly = Boolean(flag);
    areaEl.setAttribute('contenteditable', readOnly ? 'false' : 'true');
    rootEl.classList.toggle('is-readonly', readOnly);
    toolbarEl.style.pointerEvents = readOnly ? 'none' : '';
    emitter.emit('readonly', readOnly);
  }

  function insertHTML(html) {
    exec('insertHTML', opts.sanitize ? sanitizeHtml(html) : html);
  }

  function insertText(text) {
    exec('insertText', text);
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener('selectionchange', onSelectionChange);
    document.body.classList.remove('wui-editor-lock');
    emitChange.cancel();
    scheduleAutosave.cancel();
    emitter.destroy();
    rootEl.remove();
    if (hiddenInput) hiddenInput.style.display = '';
    else target.innerHTML = '';
  }

  const api = {
    el: rootEl,
    toolbar: toolbarEl,
    area: areaEl,
    id,
    getHTML, setHTML, getText, setText, getData,
    getValue: getHTML, setValue: setHTML,
    focus: focusArea,
    exec, insertHTML, insertText, insertImage, insertTable,
    insertImageFile,
    setFontSize,
    save, clear, setReadOnly, setSourceMode, toggleFullscreen,
    isDirty: () => dirty,
    getSelectedText,
    on: (type, fn) => emitter.on(type, fn),
    off: (type, fn) => emitter.off(type, fn),
    destroy,
  };
  emitter.emit('ready', api);
  if (opts.autofocus) setTimeout(() => api.focus(), 50);
  return api;
}

export const editor = { create: createEditor, sanitizeHtml };
export default createEditor;
