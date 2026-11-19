/*!
 * WUI - grid/grid.js
 * 편집 가능한 데이터 그리드
 *  - 상단(헤더) 고정, 좌/우 열 고정, 가상 스크롤
 *  - 정렬, 검색/열 필터, 데이터 적재(AJAX), 행 추가/삭제
 *  - 셀 타입: text, textarea, number, date, time, datetime, select, radio,
 *             checkbox, slider, badge, custom
 *  - 입력값 검증(rule 기반), 변경 감지, CSV 내보내기
 *
 * const grid = WUI.createGrid('#grid', { columns, data, height: 420 });
 */
import {
  h, $, $$, on, uid, debounce, raf, cancelRaf, clamp, normalizeOptions, validateValue,
  parseNumber, cmp, isFn, isPlainObject, clone, download, toCSV, escapeHtml, formatDate,
  storage, formatNumber, nowTimeStr,
} from '../core/util.js';
import { Emitter } from '../core/emitter.js';
import { ajax } from '../core/ajax.js';

/* ------------------------------ 상수/유틸 ------------------------------ */
const TYPE_WIDTH = {
  text: 140, textarea: 200, number: 110, date: 132, time: 100, datetime: 170,
  select: 132, radio: 180, checkbox: 76, slider: 160, badge: 110, custom: 150,
};

const DEFAULT_OPTIONS = {
  id: null,
  title: '',
  description: '',
  columns: [],
  data: [],
  rowHeight: null,
  headerHeight: null,
  height: 420,
  maxHeight: 560,
  minHeight: 160,
  virtual: true,
  overscan: 6,
  selectable: true,
  checkboxColumn: true,
  indexColumn: true,
  statusColumn: false,
  stickyHeader: true,
  zebra: true,
  resizable: true,
  sortable: true,
  multiSort: true,
  search: true,
  filterRow: false,
  toolbar: true,
  footer: true,
  showCount: true,
  emptyText: '데이터가 없습니다.',
  rowClass: null,
  persistWidths: false,
  autoLoad: false,
  dataUrl: null,
  tree: false,
  treeColumn: null,
  childrenKey: 'children',
  defaultExpandLevel: 0,
  indent: 18,
  onChange: null,
  onSave: null,
  onRowAdd: null,
  onSelect: null,
  onSort: null,
  onExpand: null,
};

const ALIGN_RIGHT = new Set(['number', 'slider']);
const ALIGN_CENTER = new Set(['checkbox', 'date', 'time', 'datetime', '__index', '__select', '__status']);

let ridSeq = 0;

function cssEsc(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\\]]/g, '\\$&');
}

function cleanRow(row) {
  const out = {};
  for (const key of Object.keys(row)) out[key] = row[key];
  return out;
}

function toInputDateTime(value) {
  if (!value) return '';
  const s = String(value).replace(' ', 'T');
  return s.length > 16 ? s.slice(0, 16) : s;
}

function displayValue(col, value, row) {
  if (col.format) return col.format(value, row, col);
  if (value === null || value === undefined || value === '') return '';
  switch (col.type) {
    case 'checkbox':
      return value ? '예' : '아니오';
    case 'number':
      return formatNumber(value, col.decimals || 0);
    case 'slider':
      return `${value}${col.unit || ''}`;
    case 'date':
      return String(value).slice(0, 10);
    case 'time':
      return String(value).slice(0, 5);
    case 'datetime':
      return toInputDateTime(value).replace('T', ' ');
    case 'select':
    case 'radio': {
      const opt = normalizeOptions(col.options, row).find((o) => String(o.value) === String(value));
      return opt ? opt.label : String(value);
    }
    case 'badge': {
      const opt = normalizeOptions(col.options, row).find((o) => String(o.value) === String(value));
      return opt ? opt.label : String(value);
    }
    default:
      return String(value);
  }
}

function sortType(col) {
  if (!col) return 'text';
  if (col.type === 'datetime') return 'date';
  if (ALIGN_RIGHT.has(col.type)) return 'number';
  if (col.type === 'checkbox') return 'boolean';
  return 'text';
}

function coerceOption(col, raw, row) {
  const options = normalizeOptions(col.options, row);
  const found = options.find((o) => String(o.value) === String(raw));
  return found ? found.value : raw;
}

/* ------------------------------- 팩토리 ------------------------------- */
export function createGrid(mount, options = {}) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error('[wui:grid] 마운트 대상이 없습니다.');
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const id = opts.id || uid('wui-grid');
  const emitter = new Emitter();

  const state = {
    data: [],
    rowMap: new Map(),
    columns: [],
    sort: [],
    query: '',
    filters: {},
    selection: new Set(),
    anchorRid: null,
    errors: new Map(),   // rid -> { key: message }
    view: [],
    viewStart: -1,
    viewEnd: -1,
    snapshot: new Map(),
    hasChanges: false,
    roots: [],
    expanded: new Set(),
    treeMeta: new Map(),
  };

  let rowHeight = opts.rowHeight || 36;
  let headerHeight = opts.headerHeight || 38;
  let filterRowHeight = opts.filterRow ? 32 : 0;
  let totalWidth = 0;
  let scrollRaf = null;
  let destroyed = false;
  let statusTimer = null;
  let treeMode = !!(opts.tree || opts.treeColumn);
  let treeColKey = opts.treeColumn || null;
  const childrenKey = opts.childrenKey || 'children';

  function cleanRow(row) {
    const out = {};
    for (const key of Object.keys(row)) {
      if (treeMode && key === childrenKey) continue;
      out[key] = row[key];
    }
    return out;
  }

  function nodeMeta(rid) { return state.treeMeta.get(rid) || null; }
  function nodeLevel(rid) { const m = nodeMeta(rid); return m ? m.level : 0; }
  function nodeHasChildren(row) {
    if (!treeMode || !row) return false;
    const ch = row[childrenKey];
    return Array.isArray(ch) && ch.length > 0;
  }
  function isExpanded(rid) { return state.expanded.has(rid); }

  function ingestTreeNode(source = {}, parentRid = null, level = 0, outFlat) {
    const raw = isPlainObject(source) ? { ...source } : { value: source };
    const childSrc = Array.isArray(raw[childrenKey]) ? raw[childrenKey] : [];
    const row = { ...raw };
    ridSeq += 1;
    Object.defineProperty(row, '_rid', { value: `r${ridSeq}`, enumerable: false, configurable: true, writable: true });
    for (const col of userColumns()) {
      if (row[col.key] === undefined) row[col.key] = defaultFor(col);
    }
    const children = childSrc.map((c) => ingestTreeNode(c, row._rid, level + 1, outFlat));
    row[childrenKey] = children;
    state.treeMeta.set(row._rid, { level, parentRid });
    state.rowMap.set(row._rid, row);
    outFlat.push(row);
    return row;
  }

  function applyDefaultExpand() {
    state.expanded = new Set();
    const lvl = opts.defaultExpandLevel;
    if (lvl === 0 || lvl === '0' || lvl === false || lvl === null || lvl === undefined) return;
    for (const row of state.data) {
      if (!nodeHasChildren(row)) continue;
      const level = nodeLevel(row._rid);
      if (lvl === -1 || lvl === '-1' || level < Number(lvl)) state.expanded.add(row._rid);
    }
  }

  /* ------------------------------ 마크업 ------------------------------ */
  const rootEl = h('div.wui-grid', { 'data-wui-grid': id, role: 'grid', 'aria-label': opts.title || '데이터 그리드' });
  const topEl = h('div.wui-grid-top');
  const viewportEl = h('div.wui-grid-viewport', { tabindex: '0' });
  const canvasEl = h('div.wui-grid-canvas');
  const headerEl = h('div.wui-grid-header', { role: 'rowgroup' });
  const rowsEl = h('div.wui-grid-rows', { role: 'rowgroup' });
  const footerEl = h('div.wui-grid-footer');
  const loadingEl = h('div.wui-grid-loading', { hidden: true }, h('div.wui-spinner'), h('span', {}, '불러오는 중…'));
  let statusEl = null;
  let errorBtn = null;
  let countsEl = null;

  append(canvasEl, [headerEl, rowsEl]);
  viewportEl.appendChild(canvasEl);
  append(rootEl, [topEl, viewportEl, footerEl, loadingEl]);
  if (target.tagName === 'TEXTAREA' || target.tagName === 'DIV') {
    target.innerHTML = '';
    target.appendChild(rootEl);
  } else {
    target.appendChild(rootEl);
  }

  function append(parent, nodes) {
    for (const node of nodes.flat()) if (node) parent.appendChild(node);
  }

  function measureCssVar(name, fallback) {
    try {
      const v = getComputedStyle(rootEl).getPropertyValue(name).trim();
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) { return fallback; }
  }

  function refreshMetrics() {
    rowHeight = opts.rowHeight || measureCssVar('--wui-row-h', 36);
    headerHeight = opts.headerHeight || measureCssVar('--wui-header-h', 38);
    filterRowHeight = opts.filterRow ? 32 : 0;
    updateGeometry();
    buildHeader();
    renderRows(true);
  }

  /* ---------------------------- 컬럼 정규화 ---------------------------- */
  function normalizeColumn(col, index) {
    const type = col.type || 'text';
    const width = Number(col.width) || TYPE_WIDTH[type] || 140;
    const out = {
      ...col,
      index,
      key: col.key || `col${index}`,
      title: col.title !== undefined ? col.title : (col.key || `열 ${index + 1}`),
      type,
      width,
      minWidth: Number(col.minWidth) || Math.min(70, width),
      align: col.align || (ALIGN_RIGHT.has(type) ? 'right' : ALIGN_CENTER.has(type) ? 'center' : 'left'),
      editable: col.editable !== undefined ? col.editable !== false && type !== '__index' && type !== '__select'
        : !['__index', '__select'].includes(type),
      sortable: col.sortable !== false,
      filterable: col.filterable !== false,
      frozen: col.frozen === 'left' || col.frozen === 'right' ? col.frozen : null,
      rules: [...(col.rules ? (Array.isArray(col.rules) ? col.rules : [col.rules]) : [])],
      _left: null,
      _right: null,
      _edgeLeft: false,
      _edgeRight: false,
    };
    if (col.required) out.rules.push({ type: 'required', message: col.requiredMessage || `${out.title}은(는) 필수입니다.` });
    return out;
  }

  function buildDisplayColumns(rawColumns) {
    const pseudo = [];
    if (opts.selectable && opts.checkboxColumn) {
      pseudo.push(normalizeColumn({ key: '__select', title: '', width: 40, type: '__select', frozen: 'left', sortable: false }, -2));
    }
    if (opts.indexColumn) {
      pseudo.push(normalizeColumn({ key: '__index', title: 'No.', width: 56, type: '__index', frozen: 'left', sortable: false }, -1));
    }
    if (opts.statusColumn) {
      pseudo.push(normalizeColumn({ key: '__status', title: '상태', width: 54, type: '__status', frozen: 'left', sortable: false, editable: false, filterable: false }, -3));
    }
    const users = rawColumns.map((c, i) => normalizeColumn(c, i));
    const left = users.filter((c) => c.frozen === 'left');
    const middle = users.filter((c) => !c.frozen);
    const right = users.filter((c) => c.frozen === 'right');
    return [...pseudo, ...left, ...middle, ...right];
  }

  function applySavedWidths(columns) {
    if (!opts.persistWidths) return;
    const saved = storage.get(`wui.grid.${id}.widths`, {});
    for (const col of columns) if (saved[col.key]) col.width = Number(saved[col.key]) || col.width;
  }

  function rebuildOffsets() {
    let left = 0;
    totalWidth = 0;
    for (const col of state.columns) {
      if (col.frozen === 'left') { col._left = left; left += col.width; }
      else col._left = null;
      col._edgeLeft = false;
      col._edgeRight = false;
      totalWidth += col.width;
    }
    let right = 0;
    for (let i = state.columns.length - 1; i >= 0; i -= 1) {
      const col = state.columns[i];
      if (col.frozen === 'right') { col._right = right; right += col.width; }
      else col._right = null;
    }
    const leftFrozen = state.columns.filter((c) => c.frozen === 'left');
    const rightFrozen = state.columns.filter((c) => c.frozen === 'right');
    if (leftFrozen.length) leftFrozen[leftFrozen.length - 1]._edgeLeft = true;
    if (rightFrozen.length) rightFrozen[0]._edgeRight = true;
    // 사용자 컬럼이 없을 때 대비
    if (!state.columns.length) totalWidth = 0;
  }

  function colByKey(key) {
    return state.columns.find((c) => c.key === key) || null;
  }

  function userColumns() {
    return state.columns.filter((c) => c.type !== '__index' && c.type !== '__select' && c.type !== '__status');
  }

  /* ------------------------------ 뷰 계산 ------------------------------ */
  function rebuildView() {
    if (treeMode) {
      rebuildTreeView();
      return;
    }
    const q = state.query.trim().toLowerCase();
    const filters = Object.entries(state.filters).filter(([, v]) => String(v || '').trim() !== '');
    let rows = state.data;

    if (q || filters.length) {
      rows = rows.filter((row) => {
        for (const col of userColumns()) {
          if (!col.filterable) continue;
          const text = String(displayValue(col, row[col.key], row)).toLowerCase();
          if (q && text.includes(q)) return true;
        }
        if (!q && !filters.length) return true;
        if (filters.length) {
          for (const [key, value] of filters) {
            const col = colByKey(key);
            if (!col) continue;
            const text = String(displayValue(col, row[key], row)).toLowerCase();
            if (!text.includes(String(value).toLowerCase())) return false;
          }
          return true;
        }
        return false;
      });
    }

    if (state.sort.length) {
      const indexed = rows.map((row, i) => ({ row, i }));
      indexed.sort((a, b) => {
        for (const s of state.sort) {
          const col = colByKey(s.key);
          const av = col && col.sortValue ? col.sortValue(a.row[s.key], a.row) : a.row[s.key];
          const bv = col && col.sortValue ? col.sortValue(b.row[s.key], b.row) : b.row[s.key];
          const r = cmp(av, bv, sortType(col));
          if (r) return s.dir === 'desc' ? -r : r;
        }
        return a.i - b.i;
      });
      rows = indexed.map((x) => x.row);
    }
    state.view = rows;
  }

  function rebuildTreeView() {
    const q = state.query.trim().toLowerCase();
    const filterEntries = Object.entries(state.filters).filter(([, v]) => String(v || '').trim() !== '');
    const hasFilter = q || filterEntries.length;

    function directMatch(row) {
      let qOk = !q;
      if (q) {
        qOk = false;
        for (const col of userColumns()) {
          if (!col.filterable) continue;
          const text = String(displayValue(col, row[col.key], row)).toLowerCase();
          if (text.includes(q)) { qOk = true; break; }
        }
      }
      if (!qOk) return false;
      for (const [key, value] of filterEntries) {
        const col = colByKey(key);
        if (!col) continue;
        const text = String(displayValue(col, row[key], row)).toLowerCase();
        if (!text.includes(String(value).toLowerCase())) return false;
      }
      return true;
    }

    let keep = null;
    if (hasFilter) {
      keep = new Set();
      const mark = (nodes) => {
        let any = false;
        for (const node of nodes) {
          const children = node[childrenKey] || [];
          const childAny = mark(children);
          const self = directMatch(node);
          if (self || childAny) { keep.add(node._rid); any = true; }
        }
        return any;
      };
      mark(state.roots);
    }

    if (state.sort.length) {
      const sortNodes = (nodes) => {
        const indexed = nodes.map((row, i) => ({ row, i }));
        indexed.sort((a, b) => {
          for (const s of state.sort) {
            const col = colByKey(s.key);
            const av = col && col.sortValue ? col.sortValue(a.row[s.key], a.row) : a.row[s.key];
            const bv = col && col.sortValue ? col.sortValue(b.row[s.key], b.row) : b.row[s.key];
            const r = cmp(av, bv, sortType(col));
            if (r) return s.dir === 'desc' ? -r : r;
          }
          return a.i - b.i;
        });
        nodes.splice(0, nodes.length, ...indexed.map((x) => x.row));
        for (const n of nodes) {
          const ch = n[childrenKey];
          if (ch && ch.length) sortNodes(ch);
        }
      };
      sortNodes(state.roots);
    }

    const out = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (keep && !keep.has(node._rid)) continue;
        out.push(node);
        const children = node[childrenKey] || [];
        if (!children.length) continue;
        const open = hasFilter ? children.some((c) => keep.has(c._rid)) : state.expanded.has(node._rid);
        if (open) walk(children);
      }
    };
    walk(state.roots);
    state.view = out;
  }

  /* ------------------------------ 셀 렌더 ------------------------------ */
  function getError(rid, key) {
    const rowErrors = state.errors.get(rid);
    return rowErrors ? rowErrors[key] : null;
  }

  function setFieldError(rid, key, message) {
    let rowErrors = state.errors.get(rid);
    if (!rowErrors) { rowErrors = {}; state.errors.set(rid, rowErrors); }
    if (message) rowErrors[key] = message;
    else {
      delete rowErrors[key];
      if (!Object.keys(rowErrors).length) state.errors.delete(rid);
    }
  }

  function markCellError(rid, key, message) {
    const cell = rowsEl.querySelector(`.wui-grid-cell[data-rid="${cssEsc(rid)}"][data-key="${cssEsc(key)}"]`);
    if (!cell) return;
    cell.classList.toggle('is-invalid', Boolean(message));
    if (message) cell.title = message;
    else cell.removeAttribute('title');
  }

  function countErrors() {
    let n = 0;
    for (const rowErrors of state.errors.values()) n += Object.keys(rowErrors).length;
    return n;
  }

  function inputEl(col, row, value, extra = {}) {
    const attrs = {
      class: 'wui-grid-input',
      'data-input': '',
      'data-key': col.key,
      autocomplete: 'off',
      ...extra,
    };
    const input = h('input', attrs);
    input.value = value === null || value === undefined ? '' : String(value);
    return input;
  }

  function buildEditor(col, row) {
    const value = row[col.key];
    switch (col.type) {
      case 'number':
        return inputEl(col, row, value, { inputmode: 'decimal', placeholder: col.placeholder || '', style: { textAlign: 'right' } });
      case 'textarea':
        return h('textarea.wui-grid-input.wui-grid-textarea', {
          'data-input': '', 'data-key': col.key, rows: 1,
          placeholder: col.placeholder || '',
        }, value ?? '');
      case 'select': {
        const sel = h('select.wui-grid-select', { 'data-input': '', 'data-key': col.key });
        const options = normalizeOptions(col.options, row);
        if (col.placeholder || col.emptyLabel) sel.appendChild(h('option', { value: '' }, col.placeholder || col.emptyLabel));
        for (const opt of options) {
          sel.appendChild(h('option', { value: String(opt.value), disabled: opt.disabled }, opt.label));
        }
        sel.value = value === null || value === undefined ? '' : String(value);
        return sel;
      }
      case 'date':
        return inputEl(col, row, String(value ?? '').slice(0, 10), { type: 'date' });
      case 'time':
        return inputEl(col, row, String(value ?? '').slice(0, 5), { type: 'time' });
      case 'datetime':
        return inputEl(col, row, toInputDateTime(value), { type: 'datetime-local' });
      case 'checkbox': {
        return h('label.wui-grid-checkwrap', {},
          h('input.wui-grid-check', { type: 'checkbox', 'data-input': '', 'data-key': col.key, checked: Boolean(value) }));
      }
      case 'radio': {
        const wrap = h('div.wui-grid-radios', { 'data-input': '', 'data-key': col.key, role: 'radiogroup' });
        const name = `${id}-${row._rid}-${col.key}`;
        for (const opt of normalizeOptions(col.options, row)) {
          wrap.appendChild(h('label.wui-grid-radio', { title: opt.label },
            h('input', {
              type: 'radio', name, value: String(opt.value),
              checked: String(value) === String(opt.value), disabled: opt.disabled,
            }),
            h('span', {}, opt.label)));
        }
        return wrap;
      }
      case 'slider': {
        const min = col.min ?? 0;
        const max = col.max ?? 100;
        const step = col.step ?? 1;
        const out = h('output.wui-grid-slider-out', {}, value ?? min);
        const range = h('input.wui-grid-slider', {
          type: 'range', min, max, step, 'data-input': '', 'data-key': col.key,
          value: value ?? min,
        });
        range.addEventListener('input', () => { out.textContent = `${range.value}${col.unit || ''}`; });
        return h('div.wui-grid-sliderwrap', {}, range, out);
      }
      case 'custom': {
        const wrap = h('div.wui-grid-custom', { 'data-custom': '' });
        const ctx = {
          value,
          row,
          column: col,
          cell: null,
          grid: api,
          commit: (next, o = {}) => commitValue(row._rid, col.key, next, { silent: o.silent }),
          setError: (msg) => {
            setFieldError(row._rid, col.key, msg);
            markCellError(row._rid, col.key, msg);
            updateFooter();
          },
        };
        const out = col.render ? col.render(ctx) : '';
        if (out instanceof Node) wrap.appendChild(out);
        else wrap.innerHTML = out == null ? '' : String(out);
        wrap._ctx = ctx;
        return wrap;
      }
      default:
        return inputEl(col, row, value, { placeholder: col.placeholder || '' });
    }
  }

  function buildCellContent(col, row) {
    const value = row[col.key];
    if (col.type === '__index') {
      const idx = state.view.indexOf(row);
      return h('span.wui-grid-index', {}, String(idx >= 0 ? idx + 1 : ''));
    }
    if (col.type === '__select') {
      return h('input.wui-grid-rowcheck', {
        type: 'checkbox', 'data-role': 'row-select',
        checked: state.selection.has(row._rid),
        'aria-label': '행 선택',
      });
    }
    if (col.type === '__status') {
      const status = rowStatus(row._rid);
      const label = rowStatusLabel(status);
      return h('span.wui-grid-statusmark', {
        class: status ? `is-${status}` : '',
        title: label || '변경 없음',
        'aria-label': label || '변경 없음',
      }, label || '');
    }
    if (treeMode && col.key === treeColKey) {
      const level = nodeLevel(row._rid);
      const hasCh = nodeHasChildren(row);
      const expanded = isExpanded(row._rid);
      const toggle = hasCh
        ? h('button.wui-grid-tree-toggle', {
            type: 'button',
            'data-tree-toggle': row._rid,
            class: expanded ? 'is-expanded' : '',
            'aria-label': expanded ? '접기' : '펼치기',
            title: expanded ? '접기' : '펼치기',
          })
        : h('span.wui-grid-tree-spacer', { 'aria-hidden': 'true' });
      let inner;
      if (!col.editable) {
        const text = displayValue(col, value, row);
        if (col.type === 'badge') inner = h('span.wui-badge.wui-badge-muted', { title: text }, text || '-');
        else inner = h('span.wui-grid-text', { title: text }, text || '');
      } else {
        inner = buildEditor(col, row);
      }
      const wrap = h('div.wui-grid-treecell', { style: { paddingLeft: `${level * (Number(opts.indent) || 18)}px` } }, toggle, inner);
      if (col.type === 'custom' && inner && inner._ctx) wrap._custom = inner;
      return wrap;
    }
    if (!col.editable) {
      const text = displayValue(col, value, row);
      if (col.type === 'badge') {
        return h('span.wui-badge.wui-badge-muted', { title: text }, text || '-');
      }
      return h('span.wui-grid-text', { title: text }, text || '');
    }
    return buildEditor(col, row);
  }

  function buildCell(col, row) {
    const cell = h('div.wui-grid-cell', {
      'data-rid': row._rid,
      'data-key': col.key,
      class: [
        `is-align-${col.align}`,
        `is-type-${col.type}`,
        col.frozen === 'left' ? 'is-frozen is-frozen-left' : '',
        col.frozen === 'right' ? 'is-frozen is-frozen-right' : '',
        col._edgeLeft ? 'is-edge-left' : '',
        col._edgeRight ? 'is-edge-right' : '',
      ].filter(Boolean).join(' '),
      role: 'gridcell',
      style: { width: `${col.width}px` },
    });
    if (col.frozen === 'left') cell.style.left = `${col._left}px`;
    if (col.frozen === 'right') cell.style.right = `${col._right}px`;
    const err = getError(row._rid, col.key);
    if (err) { cell.classList.add('is-invalid'); cell.title = err; }
    const content = buildCellContent(col, row);
    cell.appendChild(content);
    if (col.type === 'custom') {
      const ctxEl = (content && content._custom) ? content._custom : content;
      if (ctxEl && ctxEl._ctx) ctxEl._ctx.cell = cell;
    }
    return cell;
  }

  function buildRow(row, index) {
    const classes = ['wui-grid-row'];
    if (opts.zebra && index % 2 === 1) classes.push('is-odd');
    if (state.selection.has(row._rid)) classes.push('is-selected');
    const status = rowStatus(row._rid);
    if (status === 'modified') classes.push('is-modified');
    if (status === 'new') classes.push('is-new');
    if (isFn(opts.rowClass)) {
      const extra = opts.rowClass(row, index);
      if (extra) classes.push(extra);
    }
    const rowEl = h('div', {
      class: classes.join(' '), 'data-rid': row._rid, 'data-status': status || 'clean', role: 'row',
      style: { top: `${index * rowHeight}px`, height: `${rowHeight}px`, width: `${totalWidth}px` },
    });
    for (const col of state.columns) rowEl.appendChild(buildCell(col, row));
    return rowEl;
  }

  /* ------------------------------ 헤더 ------------------------------ */
  function buildHeader() {
    headerEl.innerHTML = '';
    const totalH = headerHeight + filterRowHeight;
    headerEl.style.height = `${totalH}px`;
    headerEl.classList.toggle('is-sticky', Boolean(opts.stickyHeader));
    const hrow = h('div.wui-grid-hrow', { style: { width: `${totalWidth}px`, height: `${totalH}px` } });

    for (const col of state.columns) {
      const isPseudo = col.type === '__index' || col.type === '__select';
      const sortEntry = state.sort.find((s) => s.key === col.key);
      const titleWrap = h('div.wui-grid-htitle', { style: { height: `${headerHeight}px` } });
      if (col.type === '__select') {
        const allVisible = state.view.length > 0 && state.view.every((r) => state.selection.has(r._rid));
        const someVisible = state.view.some((r) => state.selection.has(r._rid));
        const cb = h('input.wui-grid-headcheck', { type: 'checkbox', 'data-role': 'select-all', 'aria-label': '전체 선택' });
        cb.checked = allVisible;
        cb.indeterminate = !allVisible && someVisible;
        titleWrap.appendChild(cb);
      } else {
        const headerContent = col.headerRender ? col.headerRender({ column: col, grid: api, sort: sortEntry || null }) : null;
        if (headerContent instanceof Node) titleWrap.appendChild(headerContent);
        else if (typeof headerContent === 'string') titleWrap.innerHTML = headerContent;
        else {
          titleWrap.appendChild(h('span.wui-grid-htext', { title: col.title }, col.title));
          if (col.unit) titleWrap.appendChild(h('span.wui-grid-hunit', {}, `(${col.unit})`));
        }
        if (sortEntry) {
          titleWrap.appendChild(h('span.wui-grid-sort', { title: sortEntry.dir === 'asc' ? '오름차순' : '내림차순' },
            `${sortEntry.dir === 'asc' ? '▲' : '▼'}${state.sort.length > 1 ? state.sort.indexOf(sortEntry) + 1 : ''}`));
        } else if (col.sortable) {
          titleWrap.appendChild(h('span.wui-grid-sort.is-idle', {}, '⇅'));
        }
      }

      if (!isPseudo) {
        const menuBtn = h('button.wui-grid-colmenu', {
          type: 'button', title: '열 메뉴', 'data-col-menu': col.key, 'aria-label': `${col.title} 열 메뉴`,
        }, '⋮');
        titleWrap.appendChild(menuBtn);
      }

      const cellEl = h('div.wui-grid-hcell', {
        'data-key': col.key, role: 'columnheader',
        class: [
          `is-align-${col.align}`,
          col.frozen === 'left' ? 'is-frozen is-frozen-left' : '',
          col.frozen === 'right' ? 'is-frozen is-frozen-right' : '',
          col._edgeLeft ? 'is-edge-left' : '',
          col._edgeRight ? 'is-edge-right' : '',
          isPseudo ? 'is-pseudo' : '',
          col.sortable && !isPseudo ? 'is-sortable' : '',
        ].filter(Boolean).join(' '),
        style: { width: `${col.width}px` },
      });
      if (col.frozen === 'left') cellEl.style.left = `${col._left}px`;
      if (col.frozen === 'right') cellEl.style.right = `${col._right}px`;
      cellEl.appendChild(titleWrap);

      if (filterRowHeight) {
        const filter = h('div.wui-grid-hfilter', { style: { height: `${filterRowHeight}px` } });
        if (!isPseudo && col.filterable) {
          const input = h('input.wui-grid-filter', {
            type: 'text', placeholder: '필터', 'data-filter-key': col.key,
            value: state.filters[col.key] || '',
          });
          filter.appendChild(input);
        }
        cellEl.appendChild(filter);
      }

      if (opts.resizable && !isPseudo) {
        cellEl.appendChild(h('div.wui-grid-resizer', { 'data-resize': col.key, title: '너비 조절' }));
      }
      hrow.appendChild(cellEl);
    }
    headerEl.appendChild(hrow);
  }

  /* ------------------------------ 바디 렌더 ------------------------------ */
  function computeRange() {
    const total = state.view.length;
    if (!opts.virtual) return [0, total];
    const viewH = viewportEl.clientHeight || 300;
    const scrollTop = viewportEl.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - opts.overscan);
    const end = Math.min(total, Math.ceil((scrollTop + viewH) / rowHeight) + opts.overscan);
    return [start, end];
  }

  function renderRows(force = false) {
    if (destroyed) return;
    if (!state.view.length) {
      rowsEl.innerHTML = '';
      state.viewStart = 0;
      state.viewEnd = 0;
      renderEmpty();
      return;
    }
    removeEmpty();
    const [start, end] = computeRange();
    if (!force && start === state.viewStart && end === state.viewEnd) return;
    state.viewStart = start;
    state.viewEnd = end;
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) frag.appendChild(buildRow(state.view[i], i));
    rowsEl.innerHTML = '';
    rowsEl.appendChild(frag);
  }

  let emptyEl = null;
  function renderEmpty() {
    if (emptyEl) return;
    emptyEl = h('div.wui-grid-empty',
      h('div.wui-empty-icon', {}, '▦'),
      h('div.wui-empty-title', {}, opts.emptyText),
      h('div.wui-small', {}, state.query || Object.keys(state.filters).length ? '검색 조건을 변경해 보세요.' : '행 추가 버튼으로 데이터를 입력할 수 있습니다.'));
    viewportEl.appendChild(emptyEl);
  }
  function removeEmpty() {
    if (emptyEl) { emptyEl.remove(); emptyEl = null; }
  }

  function updateGeometry() {
    const totalH = headerHeight + filterRowHeight;
    const bodyH = state.view.length * rowHeight;
    canvasEl.style.width = `${totalWidth}px`;
    canvasEl.style.height = `${totalH + bodyH}px`;
    headerEl.style.width = `${totalWidth}px`;
    rowsEl.style.top = `${totalH}px`;
    rowsEl.style.width = `${totalWidth}px`;
    rowsEl.style.height = `${bodyH}px`;

    if (opts.height === 'auto') {
      const desired = totalH + Math.min(bodyH, opts.maxHeight) + 1;
      viewportEl.style.height = `${Math.max(opts.minHeight, Math.min(opts.maxHeight + totalH, desired))}px`;
    } else if (typeof opts.height === 'number') {
      viewportEl.style.height = `${opts.height}px`;
    } else {
      viewportEl.style.height = opts.height;
    }
    updateFooter();
  }

  function rerender() {
    rebuildView();
    updateGeometry();
    renderRows(true);
    updateHeaderChecks();
    updateFooter();
  }

  /* ------------------------------ 값 커밋 ------------------------------ */
  function readCellValue(cell, col, row) {
    if (col.type === 'radio') {
      const checked = cell.querySelector('input[type="radio"]:checked');
      return checked ? coerceOption(col, checked.value, row) : '';
    }
    const input = cell.querySelector('[data-input]');
    if (!input) return row[col.key];
    switch (col.type) {
      case 'checkbox': return input.checked;
      case 'slider': return input.value === '' ? null : Number(input.value);
      case 'number': return input.value === '' ? null : parseNumber(input.value);
      case 'select': return coerceOption(col, input.value, row);
      case 'date':
      case 'time':
      case 'datetime': return input.value;
      default: return input.value;
    }
  }

  function commitValue(rid, key, value, { silent = false, validate = true } = {}) {
    const row = state.rowMap.get(rid);
    const col = colByKey(key);
    if (!row || !col) return;
    const oldValue = row[key];
    row[key] = value;
    if (oldValue !== value) {
      recomputeHasChanges();
      if (validate) validateCell(row, col, value);
      if (!silent) {
        const changed = rowStatus(rid) !== '';
        const payload = { rid, row: cleanRow(row), key, value, oldValue, index: state.data.indexOf(row), changed, status: rowStatus(rid) };
        emitter.emit('change', payload);
        if (isFn(opts.onChange)) opts.onChange(payload);
      }
      updateFooter();
      if (opts.statusColumn) renderRows(true);
    }
  }

  function validateCell(row, col, value) {
    if (!col.rules || !col.rules.length) return true;
    const msg = validateValue(value, col.rules, { label: col.title, row });
    setFieldError(row._rid, col.key, msg);
    markCellError(row._rid, col.key, msg);
    updateFooter();
    return !msg;
  }

  /* ------------------------------ 선택 ------------------------------ */
  function updateSelectionUI() {
    $$('.wui-grid-row', rowsEl).forEach((rowEl) => {
      rowEl.classList.toggle('is-selected', state.selection.has(rowEl.dataset.rid));
      const cb = rowEl.querySelector('[data-role="row-select"]');
      if (cb) cb.checked = state.selection.has(rowEl.dataset.rid);
    });
    updateHeaderChecks();
  }

  function updateHeaderChecks() {
    const head = headerEl.querySelector('[data-role="select-all"]');
    if (!head) return;
    const visible = state.view;
    const selected = visible.filter((r) => state.selection.has(r._rid)).length;
    head.checked = visible.length > 0 && selected === visible.length;
    head.indeterminate = selected > 0 && selected < visible.length;
  }

  function emitSelection() {
    const rows = state.view.filter((r) => state.selection.has(r._rid)).map(cleanRow);
    emitter.emit('select', { rows, count: state.selection.size });
    if (isFn(opts.onSelect)) opts.onSelect({ rows, count: state.selection.size });
    updateFooter();
  }

  function selectRow(row, { toggle = false, range = false } = {}) {
    if (!row) return;
    if (range && state.anchorRid) {
      const anchorIdx = state.view.findIndex((r) => r._rid === state.anchorRid);
      const idx = state.view.findIndex((r) => r._rid === row._rid);
      if (anchorIdx >= 0 && idx >= 0) {
        const [a, b] = anchorIdx < idx ? [anchorIdx, idx] : [idx, anchorIdx];
        if (!toggle) state.selection.clear();
        for (let i = a; i <= b; i += 1) state.selection.add(state.view[i]._rid);
        updateSelectionUI();
        emitSelection();
        return;
      }
    }
    if (toggle) {
      if (state.selection.has(row._rid)) state.selection.delete(row._rid);
      else state.selection.add(row._rid);
      state.anchorRid = row._rid;
    } else {
      state.selection.clear();
      state.selection.add(row._rid);
      state.anchorRid = row._rid;
    }
    updateSelectionUI();
    emitSelection();
  }

  /* ------------------------------ 정렬/필터 ------------------------------ */
  function setSort(key, dir, { additive = false } = {}) {
    if (!key) return state.sort;
    const existing = state.sort.find((s) => s.key === key);
    if (!dir) {
      state.sort = state.sort.filter((s) => s.key !== key);
    } else if (existing) {
      existing.dir = dir;
    } else {
      if (!additive) state.sort = [];
      state.sort.push({ key, dir });
    }
    buildHeader();
    rerender();
    emitter.emit('sort', state.sort.slice());
    if (isFn(opts.onSort)) opts.onSort(state.sort.slice());
    return state.sort.slice();
  }

  function toggleSort(key, additive = false) {
    const current = state.sort.find((s) => s.key === key);
    if (!current) setSort(key, 'asc', { additive });
    else if (current.dir === 'asc') setSort(key, 'desc', { additive: true });
    else setSort(key, null);
  }

  function clearSort() {
    state.sort = [];
    buildHeader();
    rerender();
    emitter.emit('sort', []);
  }

  function setFilter(key, value) {
    if (value === '' || value === null || value === undefined) delete state.filters[key];
    else state.filters[key] = value;
    viewportEl.scrollTop = 0;
    rerender();
  }

  function setQuery(value) {
    state.query = value || '';
    viewportEl.scrollTop = 0;
    rerender();
  }

  /* ------------------------------ 높이/너비 갱신 ------------------------------ */
  function updateWidths() {
    rebuildOffsets();
    headerEl.style.width = `${totalWidth}px`;
    const hrow = headerEl.querySelector('.wui-grid-hrow');
    if (hrow) hrow.style.width = `${totalWidth}px`;
    rowsEl.style.width = `${totalWidth}px`;
    canvasEl.style.width = `${totalWidth}px`;
    $$('.wui-grid-hcell, .wui-grid-cell', rootEl).forEach((cell) => {
      const col = colByKey(cell.dataset.key);
      if (!col) return;
      cell.style.width = `${col.width}px`;
      if (col.frozen === 'left') cell.style.left = `${col._left}px`;
      if (col.frozen === 'right') cell.style.right = `${col._right}px`;
    });
    $$('.wui-grid-row', rowsEl).forEach((rowEl) => { rowEl.style.width = `${totalWidth}px`; });
    updateGeometry();
  }

  function persistWidths() {
    if (!opts.persistWidths) return;
    const map = {};
    for (const col of userColumns()) map[col.key] = col.width;
    storage.set(`wui.grid.${id}.widths`, map);
  }

  /* ------------------------------ 툴바/푸터 ------------------------------ */
  function setStatus(message, tone = '') {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.style.color = tone === 'error' ? 'var(--wui-danger)' : tone === 'ok' ? 'var(--wui-success)' : '';
    if (statusTimer) clearTimeout(statusTimer);
    if (message) {
      statusTimer = setTimeout(() => {
        if (statusEl.textContent === message) statusEl.textContent = '';
      }, 3000);
    }
  }

  function updateFooter() {
    if (!footerEl) return;
    const total = state.data.length;
    const visible = state.view.length;
    const selected = state.selection.size;
    if (countsEl) {
      countsEl.textContent = `${opts.showCount ? `총 ${total.toLocaleString()}건 · ` : ''}표시 ${visible.toLocaleString()}건${selected ? ` · 선택 ${selected}건` : ''}`;
    }
    if (errorBtn) {
      const n = countErrors();
      errorBtn.textContent = `오류 ${n}건`;
      errorBtn.classList.toggle('is-danger', n > 0);
      errorBtn.disabled = !n;
    }
    emitter.emit('footer', { total, visible, selected, errors: countErrors(), changes: state.hasChanges });
  }

  function setLoading(flag) {
    loadingEl.hidden = !flag;
    viewportEl.style.opacity = flag ? '.4' : '';
  }

  let filterToggleBtn = null;

  function updateFilterToggleBtn() {
    if (!filterToggleBtn) return;
    const on = !!opts.filterRow;
    filterToggleBtn.classList.toggle('is-active', on);
    filterToggleBtn.setAttribute('aria-pressed', String(on));
  }

  function setFilterRowEnabled(enabled, { clear = true } = {}) {
    const on = Boolean(enabled);
    if (!!opts.filterRow === on) {
      updateFilterToggleBtn();
      return on;
    }
    opts.filterRow = on;
    if (!on && clear) state.filters = {};
    refreshMetrics();
    rerender();
    updateFilterToggleBtn();
    emitter.emit('filterrow', { enabled: on });
    return on;
  }

  function buildToolbar() {
    topEl.innerHTML = '';
    filterToggleBtn = null;
    const hasTitle = opts.title || opts.description;
    topEl.classList.toggle('is-empty', !opts.toolbar && !hasTitle && !opts.search);
    if (!opts.toolbar && !opts.search && !hasTitle) { topEl.hidden = true; return; }

    const titleBox = h('div.wui-grid-titlebox');
    if (opts.title) titleBox.appendChild(h('div.wui-grid-title', {}, opts.title));
    if (opts.description) titleBox.appendChild(h('div.wui-grid-desc', {}, opts.description));
    topEl.appendChild(titleBox);
    topEl.appendChild(h('span.wui-toolbar-spacer'));

    if (opts.search) {
      const search = h('input.wui-input.wui-input-sm.wui-grid-search', {
        type: 'search', placeholder: '검색…', 'aria-label': '검색',
      });
      search.value = state.query;
      const run = debounce(() => setQuery(search.value), 180);
      search.addEventListener('input', run);
      topEl.appendChild(search);
    }

    if (opts.toolbar) {
      const addBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: '행 추가' }, '+ 행 추가');
      addBtn.addEventListener('click', () => api.addRow());
      const delBtn = h('button.wui-btn.wui-btn-sm.wui-btn-danger', { type: 'button', title: '선택한 행 삭제' }, '선택 삭제');
      delBtn.addEventListener('click', () => {
        if (!state.selection.size) { setStatus('삭제할 행을 선택하세요.', 'error'); return; }
        api.removeRows(Array.from(state.selection));
      });
      const validBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: '입력값 검증' }, '검증');
      validBtn.addEventListener('click', () => {
        const errors = api.validate();
        if (errors.length) {
          setStatus(`${errors.length}건의 오류가 있습니다.`, 'error');
          api.focusCell(errors[0].rid, errors[0].key);
        } else setStatus('모든 입력값이 올바릅니다.', 'ok');
      });
      const saveBtn = h('button.wui-btn.wui-btn-sm.wui-btn-primary', { type: 'button', title: '검증 후 저장' }, '저장');
      saveBtn.addEventListener('click', () => api.save());
      const csvBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: 'CSV 내보내기' }, 'CSV');
      csvBtn.addEventListener('click', () => api.downloadCSV());

      filterToggleBtn = h('button.wui-btn.wui-btn-sm', {
        type: 'button',
        title: '열 필터 행 표시/숨김',
        'aria-pressed': String(!!opts.filterRow),
        class: opts.filterRow ? 'is-active' : '',
      }, '필터');
      filterToggleBtn.addEventListener('click', () => setFilterRowEnabled(!opts.filterRow));

      append(topEl, [addBtn, delBtn, validBtn, saveBtn, csvBtn, filterToggleBtn]);

      if (opts.dataUrl) {
        const reloadBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: '데이터 다시 불러오기' }, '새로고침');
        reloadBtn.addEventListener('click', () => api.load(opts.dataUrl));
        topEl.appendChild(reloadBtn);
      }
    }
  }

  function buildFooter() {
    footerEl.innerHTML = '';
    if (!opts.footer) { footerEl.hidden = true; return; }
    countsEl = h('span.wui-grid-counts');
    errorBtn = h('button.wui-grid-errorbtn', { type: 'button', title: '첫 오류로 이동' }, '오류 0건');
    errorBtn.addEventListener('click', () => {
      const first = findFirstError();
      if (first) api.focusCell(first.rid, first.key);
    });
    statusEl = h('span.wui-grid-status');
    append(footerEl, [countsEl, errorBtn, h('span.wui-toolbar-spacer'), statusEl]);
  }

  function findFirstError() {
    for (const row of state.data) {
      const errs = state.errors.get(row._rid);
      if (errs) {
        const key = Object.keys(errs)[0];
        if (key) return { rid: row._rid, key, message: errs[key] };
      }
    }
    return null;
  }

  /* ------------------------------ 이벤트 ------------------------------ */
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = raf(() => { scrollRaf = null; renderRows(); });
  };

  viewportEl.addEventListener('scroll', onScroll, { passive: true });

  headerEl.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-col-menu]');
    if (menuBtn) {
      e.preventDefault();
      const col = colByKey(menuBtn.dataset.colMenu);
      if (col) openColumnMenu(col, menuBtn);
      return;
    }
    if (e.target.closest('.wui-grid-resizer')) return;
    if (e.target.closest('[data-role="select-all"]')) return;
    if (e.target.closest('.wui-grid-hfilter') || e.target.closest('[data-filter-key]')) return;
    const cell = e.target.closest('.wui-grid-hcell');
    if (!cell) return;
    const col = colByKey(cell.dataset.key);
    if (!col || !col.sortable || col.type === '__index' || col.type === '__select') return;
    if (!opts.sortable) return;
    toggleSort(col.key, e.shiftKey && opts.multiSort);
  });

  const selectAllHandler = (e) => {
    if (!e.target.matches('[data-role="select-all"]')) return;
    if (e.target.checked) state.view.forEach((r) => state.selection.add(r._rid));
    else state.view.forEach((r) => state.selection.delete(r._rid));
    updateSelectionUI();
    emitSelection();
  };
  headerEl.addEventListener('change', selectAllHandler);

  // 헤더 필터
  headerEl.addEventListener('input', debounce((e) => {
    const input = e.target.closest('[data-filter-key]');
    if (!input) return;
    state.filters[input.dataset.filterKey] = input.value;
    if (!input.value) delete state.filters[input.dataset.filterKey];
    viewportEl.scrollTop = 0;
    rerender();
  }, 220));

  // 셀 입력
  rowsEl.addEventListener('input', (e) => {
    const input = e.target;
    const cell = input.closest('.wui-grid-cell');
    if (!cell) return;
    const col = colByKey(cell.dataset.key);
    const row = state.rowMap.get(cell.dataset.rid);
    if (!col || !row) return;
    if (col.type === 'custom') return;
    if (col.type === 'radio') {
      commitValue(row._rid, col.key, coerceOption(col, input.value, row));
      return;
    }
    const value = readCellValue(cell, col, row);
    // 타이핑 중에는 모델만 갱신 (재렌더 없음)
    row[col.key] = value;
    recomputeHasChanges();
    emitter.emit('edit', { rid: row._rid, row: cleanRow(row), key: col.key, value, status: rowStatus(row._rid) });
    updateFooter();
  });

  rowsEl.addEventListener('change', (e) => {
    const target = e.target;
    if (target.matches('[data-role="row-select"]')) {
      const row = state.rowMap.get(target.closest('.wui-grid-row')?.dataset.rid);
      if (row) selectRow(row, { toggle: true });
      return;
    }
    const cell = target.closest('.wui-grid-cell');
    if (!cell) return;
    const col = colByKey(cell.dataset.key);
    const row = state.rowMap.get(cell.dataset.rid);
    if (!col || !row) return;
    if (col.type === 'custom') return;
    const value = readCellValue(cell, col, row);
    commitValue(row._rid, col.key, value);
  });

  rowsEl.addEventListener('blur', (e) => {
    const cell = e.target.closest && e.target.closest('.wui-grid-cell');
    if (!cell) return;
    const col = colByKey(cell.dataset.key);
    const row = state.rowMap.get(cell.dataset.rid);
    if (!col || !row || col.type === 'custom') return;
    if (col.type === 'radio') return;
    const value = readCellValue(cell, col, row);
    commitValue(row._rid, col.key, value);
  }, true);

  rowsEl.addEventListener('keydown', (e) => {
    const input = e.target;
    if (!input.matches('[data-input]')) return;
    const cell = input.closest('.wui-grid-cell');
    if (!cell) return;
    const col = colByKey(cell.dataset.key);
    const row = state.rowMap.get(cell.dataset.rid);
    if (!col || !row) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (col.type !== 'custom') {
        const value = readCellValue(cell, col, row);
        commitValue(row._rid, col.key, value);
      }
      input.blur();
      const index = state.view.indexOf(row);
      const next = state.view[index + 1];
      if (next) api.focusCell(next._rid, col.key);
    }
    if (e.key === 'Escape') input.blur();
  });

  rowsEl.addEventListener('click', (e) => {
    const rowEl = e.target.closest('.wui-grid-row');
    if (!rowEl) return;
    const treeToggle = e.target.closest('[data-tree-toggle]');
    if (treeToggle) {
      e.preventDefault();
      e.stopPropagation();
      api.toggleExpand(treeToggle.dataset.treeToggle);
      return;
    }
    const interactive = e.target.closest('input,select,textarea,button,label,a');
    if (interactive) {
      if (!interactive.matches('[data-role="row-select"]') && !interactive.closest('.wui-grid-custom')) {
        const row = state.rowMap.get(rowEl.dataset.rid);
        if (row && !state.selection.has(row._rid)) selectRow(row);
      }
      return;
    }
    const row = state.rowMap.get(rowEl.dataset.rid);
    if (!row) return;
    selectRow(row, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
    const cell = e.target.closest('.wui-grid-cell');
    if (cell) {
      const input = cell.querySelector('[data-input]');
      if (input && input.focus) input.focus();
    }
  });

  // 열 너비 조절
  headerEl.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.wui-grid-resizer');
    if (!handle) return;
    e.preventDefault();
    const col = colByKey(handle.dataset.resize);
    if (!col) return;
    const startX = e.clientX;
    const startW = col.width;
    let rafId = null;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (ev) => {
      const nextW = Math.max(col.minWidth || 56, Math.round(startW + ev.clientX - startX));
      if (rafId) cancelRaf(rafId);
      rafId = raf(() => { col.width = nextW; updateWidths(); });
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafId) cancelRaf(rafId);
      persistWidths();
      emitter.emit('resize', { key: col.key, width: col.width });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });

  viewportEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      state.selection.clear();
      updateSelectionUI();
      emitSelection();
    }
  });

  /* ------------------------------ 열 메뉴 ------------------------------ */
  let menuEl = null;
  let menuOff = null;
  function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    if (menuOff) { menuOff(); menuOff = null; }
  }

  function openColumnMenu(col, anchor) {
    closeMenu();
    menuEl = h('div.wui-grid-menu', { role: 'menu' });
    const item = (label, active, fn, disabled = false) => {
      const b = h('button.wui-grid-menuitem', { type: 'button', role: 'menuitem', disabled }, active ? '✓ ' + label : label);
      b.addEventListener('click', () => { closeMenu(); fn(); });
      menuEl.appendChild(b);
    };
    item('왼쪽 고정', col.frozen === 'left', () => api.setFrozen(col.key, 'left'));
    item('오른쪽 고정', col.frozen === 'right', () => api.setFrozen(col.key, 'right'));
    item('고정 해제', !col.frozen, () => api.setFrozen(col.key, null), !col.frozen);
    menuEl.appendChild(h('div.wui-grid-menusep'));
    item('오름차순 정렬', false, () => setSort(col.key, 'asc'));
    item('내림차순 정렬', false, () => setSort(col.key, 'desc'));
    item('정렬 해제', false, () => clearSort(), !state.sort.length);
    menuEl.appendChild(h('div.wui-grid-menusep'));
    item('너비 초기화', false, () => {
      col.width = Number(col.originalWidth) || TYPE_WIDTH[col.type] || 140;
      updateWidths();
      persistWidths();
    });
    rootEl.appendChild(menuEl);
    const rootRect = rootEl.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    const maxLeft = rootRect.width - menuEl.offsetWidth - 6;
    menuEl.style.left = `${clamp(rect.left - rootRect.left, 4, Math.max(4, maxLeft))}px`;
    menuEl.style.top = `${rect.bottom - rootRect.top + 4}px`;

    const onDocDown = (ev) => { if (!menuEl || !menuEl.contains(ev.target)) closeMenu(); };
    setTimeout(() => document.addEventListener('mousedown', onDocDown), 0);
    menuOff = () => document.removeEventListener('mousedown', onDocDown);
  }

  /* ------------------------------ 공개 API ------------------------------ */
  let api = null;

  function normalizeRow(source = {}) {
    const row = isPlainObject(source) ? { ...source } : { value: source };
    ridSeq += 1;
    Object.defineProperty(row, '_rid', {
      value: `r${ridSeq}`, enumerable: false, configurable: true, writable: true,
    });
    for (const col of userColumns()) {
      if (row[col.key] === undefined) row[col.key] = defaultFor(col);
    }
    return row;
  }

  function defaultFor(col) {
    if (col.default !== undefined) return isFn(col.default) ? col.default() : clone(col.default);
    if (col.type === 'checkbox') return false;
    if (col.type === 'number' || col.type === 'slider') return null;
    return '';
  }

  function snapshotRow(row) {
    state.snapshot.set(row._rid, JSON.stringify(cleanRow(row)));
  }

  function rebuildRowMap() {
    state.rowMap = new Map(state.data.map((r) => [r._rid, r]));
  }

  function recomputeHasChanges() {
    state.hasChanges = state.data.some((r) => JSON.stringify(cleanRow(r)) !== state.snapshot.get(r._rid));
  }

  function rowStatus(rid) {
    const row = state.rowMap.get(rid);
    if (!row) return '';
    const base = state.snapshot.get(rid);
    if (base === undefined) return 'new';
    return base === JSON.stringify(cleanRow(row)) ? '' : 'modified';
  }

  function rowStatusLabel(status) {
    if (status === 'new') return '추가';
    if (status === 'modified') return '수정';
    return '';
  }

  function cleanTreeNode(node) {
    const out = cleanRow(node);
    if (treeMode && nodeHasChildren(node)) {
      out[childrenKey] = (node[childrenKey] || []).map(cleanTreeNode);
    } else if (treeMode) {
      // keep no children key for leaves
    }
    return out;
  }

  function setData(rows = []) {
    const list = Array.isArray(rows) ? rows : (rows.rows || rows.data || rows.items || []);
    state.selection.clear();
    state.errors.clear();
    state.snapshot = new Map();
    state.hasChanges = false;
    state.anchorRid = null;
    viewportEl.scrollTop = 0;

    if (treeMode) {
      state.treeMeta = new Map();
      state.rowMap = new Map();
      state.roots = [];
      const flat = [];
      state.roots = list.map((r) => ingestTreeNode(r, null, 0, flat));
      state.data = flat;
      applyDefaultExpand();
    } else {
      state.data = list.map((r) => normalizeRow(r));
      rebuildRowMap();
    }
    state.data.forEach(snapshotRow);
    rerender();
    emitter.emit('data', { rows: api.getData(), count: state.data.length });
    return state.data.length;
  }

  function addRow(data = {}, { focus = true, markNew = true, parentRid = null } = {}) {
    if (treeMode) {
      const flat = [];
      let targetParentRid = parentRid;
      let level = 0;
      let listRef = state.roots;
      let at = state.roots.length;
      if (!targetParentRid) {
        const selectedRows = state.data.filter((r) => state.selection.has(r._rid));
        if (selectedRows.length) {
          const sel = selectedRows[selectedRows.length - 1];
          const meta = nodeMeta(sel._rid);
          targetParentRid = meta ? meta.parentRid : null;
          level = meta ? meta.level : 0;
          if (targetParentRid) {
            const parent = state.rowMap.get(targetParentRid);
            listRef = parent ? parent[childrenKey] : state.roots;
          } else {
            listRef = state.roots;
          }
          at = listRef.indexOf(sel) + 1;
          if (at < 0) at = listRef.length;
        }
      } else {
        const parent = state.rowMap.get(targetParentRid);
        if (parent) {
          listRef = parent[childrenKey] || (parent[childrenKey] = []);
          level = nodeLevel(targetParentRid) + 1;
          at = listRef.length;
          state.expanded.add(targetParentRid);
        } else {
          targetParentRid = null;
          listRef = state.roots;
          level = 0;
          at = state.roots.length;
        }
      }
      const row = ingestTreeNode(data, targetParentRid, level, flat);
      listRef.splice(at, 0, row);
      // insert flat nodes into state.data (after last descendant of previous sibling or at end)
      state.data.push(...flat);
      if (!markNew) flat.forEach(snapshotRow);
      recomputeHasChanges();
      state.selection.clear();
      state.selection.add(row._rid);
      state.anchorRid = row._rid;
      rerender();
      const firstCol = userColumns().find((c) => c.editable);
      if (focus && firstCol) {
        setTimeout(() => api.focusCell(row._rid, firstCol.key), 20);
      }
      emitter.emit('rowadd', { row: cleanRow(row), index: at, status: rowStatus(row._rid) });
      if (isFn(opts.onRowAdd)) opts.onRowAdd(cleanRow(row));
      return row;
    }

    const row = normalizeRow(data);
    const selectedRows = state.data.filter((r) => state.selection.has(r._rid));
    const at = selectedRows.length ? state.data.indexOf(selectedRows[selectedRows.length - 1]) + 1 : state.data.length;
    state.data.splice(at, 0, row);
    state.rowMap.set(row._rid, row);
    if (!markNew) snapshotRow(row);
    recomputeHasChanges();
    state.selection.clear();
    state.selection.add(row._rid);
    state.anchorRid = row._rid;
    rerender();
    const index = state.view.findIndex((r) => r._rid === row._rid);
    const firstCol = userColumns().find((c) => c.editable);
    if (focus && firstCol) {
      setTimeout(() => {
        scrollToIndex(Math.max(0, index - 2));
        api.focusCell(row._rid, firstCol.key);
      }, 20);
    }
    emitter.emit('rowadd', { row: cleanRow(row), index: at, status: rowStatus(row._rid) });
    if (isFn(opts.onRowAdd)) opts.onRowAdd(cleanRow(row));
    return row;
  }

  function removeRows(rids = []) {
    const set = new Set(rids);
    if (!set.size) return 0;
    const before = state.data.length;

    if (treeMode) {
      const toRemove = new Set(set);
      // include descendants
      const collect = (nodes) => {
        for (const n of nodes) {
          if (toRemove.has(n._rid)) {
            const addDesc = (x) => {
              toRemove.add(x._rid);
              (x[childrenKey] || []).forEach(addDesc);
            };
            (n[childrenKey] || []).forEach(addDesc);
          } else {
            collect(n[childrenKey] || []);
          }
        }
      };
      collect(state.roots);
      const prune = (nodes) => nodes.filter((n) => {
        if (toRemove.has(n._rid)) return false;
        if (n[childrenKey] && n[childrenKey].length) n[childrenKey] = prune(n[childrenKey]);
        return true;
      });
      state.roots = prune(state.roots);
      state.data = state.data.filter((r) => !toRemove.has(r._rid));
      for (const rid of toRemove) {
        state.selection.delete(rid);
        state.errors.delete(rid);
        state.snapshot.delete(rid);
        state.rowMap.delete(rid);
        state.treeMeta.delete(rid);
        state.expanded.delete(rid);
      }
    } else {
      state.data = state.data.filter((r) => !set.has(r._rid));
      for (const rid of set) {
        state.selection.delete(rid);
        state.errors.delete(rid);
        state.snapshot.delete(rid);
        state.rowMap.delete(rid);
      }
    }
    recomputeHasChanges();
    rerender();
    const removed = before - state.data.length;
    emitter.emit('rowremove', { rids: Array.from(set), removed });
    emitSelection();
    return removed;
  }

  function validate() {
    const errors = [];
    state.errors.clear();
    for (const row of state.data) {
      for (const col of userColumns()) {
        if (!col.rules || !col.rules.length) continue;
        const msg = validateValue(row[col.key], col.rules, { label: col.title, row });
        if (msg) {
          setFieldError(row._rid, col.key, msg);
          errors.push({ rid: row._rid, key: col.key, message: msg, row: cleanRow(row) });
        }
      }
    }
    renderRows(true);
    updateFooter();
    emitter.emit('validate', errors);
    return errors;
  }

  function save() {
    const errors = validate();
    if (errors.length) {
      setStatus(`${errors.length}건의 오류를 먼저 수정하세요.`, 'error');
      const first = findFirstError();
      if (first) api.focusCell(first.rid, first.key);
      return null;
    }
    const data = api.getData();
    state.data.forEach(snapshotRow);
    state.hasChanges = false;
    updateFooter();
    setStatus(`저장되었습니다. (${nowTimeStr()})`, 'ok');
    emitter.emit('save', data);
    if (isFn(opts.onSave)) opts.onSave(data);
    return data;
  }

  function getData() {
    if (treeMode) return state.roots.map(cleanTreeNode);
    return state.data.map(cleanRow);
  }

  function getChanges() {
    const changes = [];
    for (const row of state.data) {
      const before = state.snapshot.get(row._rid);
      const after = JSON.stringify(cleanRow(row));
      if (before !== after) {
        const type = before === undefined ? 'added' : 'modified';
        changes.push({ row: cleanRow(row), original: before ? JSON.parse(before) : null, rid: row._rid, type, status: rowStatus(row._rid) });
      }
    }
    return changes;
  }

  function getSelected() {
    return state.view.filter((r) => state.selection.has(r._rid)).map(cleanRow);
  }

  function getVisible() {
    return state.view.map(cleanRow);
  }

  function scrollToIndex(index) {
    viewportEl.scrollTop = Math.max(0, index * rowHeight);
    renderRows();
  }

  function focusCell(rid, key) {
    const row = state.rowMap.get(rid);
    if (!row) return;
    let index = state.view.indexOf(row);
    if (index < 0) {
      state.query = '';
      state.filters = {};
      const search = topEl.querySelector('.wui-grid-search');
      if (search) search.value = '';
      const filterInputs = headerEl.querySelectorAll('[data-filter-key]');
      filterInputs.forEach((i) => { i.value = ''; });
      if (treeMode) {
        let cur = nodeMeta(rid);
        while (cur && cur.parentRid) {
          state.expanded.add(cur.parentRid);
          cur = nodeMeta(cur.parentRid);
        }
      }
      rebuildView();
      index = state.view.indexOf(row);
    }
    const viewH = viewportEl.clientHeight;
    if (index >= 0) {
      const top = index * rowHeight;
      const current = viewportEl.scrollTop;
      if (top < current || top > current + viewH - rowHeight - (headerHeight + filterRowHeight)) {
        viewportEl.scrollTop = Math.max(0, top - viewH / 2);
      }
    }
    renderRows(true);
    setTimeout(() => {
      const cell = rowsEl.querySelector(`.wui-grid-cell[data-rid="${cssEsc(rid)}"][data-key="${cssEsc(key)}"]`);
      if (!cell) return;
      const input = cell.querySelector('[data-input]');
      if (input) { input.focus(); if (input.select) try { input.select(); } catch (_) { /* noop */ } }
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 20);
  }

  function expandRow(rid, emit = true) {
    if (!treeMode) return false;
    const row = state.rowMap.get(rid);
    if (!row || !nodeHasChildren(row) || state.expanded.has(rid)) return false;
    state.expanded.add(rid);
    rerender();
    if (emit) emitter.emit('expand', { rid, expanded: true, row: cleanRow(row) });
    if (isFn(opts.onExpand)) opts.onExpand({ rid, expanded: true, row: cleanRow(row) });
    return true;
  }

  function collapseRow(rid, emit = true) {
    if (!treeMode) return false;
    const row = state.rowMap.get(rid);
    if (!row || !nodeHasChildren(row) || !state.expanded.has(rid)) return false;
    state.expanded.delete(rid);
    rerender();
    if (emit) emitter.emit('expand', { rid, expanded: false, row: cleanRow(row) });
    if (isFn(opts.onExpand)) opts.onExpand({ rid, expanded: false, row: cleanRow(row) });
    return true;
  }

  function toggleExpandRow(rid) {
    if (!treeMode) return false;
    return state.expanded.has(rid) ? collapseRow(rid) : expandRow(rid);
  }

  function expandAllRows() {
    if (!treeMode) return;
    for (const row of state.data) if (nodeHasChildren(row)) state.expanded.add(row._rid);
    rerender();
  }

  function collapseAllRows() {
    if (!treeMode) return;
    state.expanded.clear();
    rerender();
  }

  function setCellValue(rid, key, value, options = {}) {
    commitValue(rid, key, value, { silent: true, ...options });
    renderRows(true);
  }

  function setColumns(columns) {
    const prevFrozen = new Map(state.columns.map((c) => [c.key, c.frozen]));
    state.columns = buildDisplayColumns(columns);
    if (treeMode && !treeColKey) {
      const first = userColumns()[0];
      treeColKey = first ? first.key : null;
    }
    state.columns.forEach((col) => {
      col.originalWidth = col.width;
      if (prevFrozen.has(col.key) && prevFrozen.get(col.key)) col.frozen = prevFrozen.get(col.key);
    });
    applySavedWidths(state.columns);
    rebuildOffsets();
    buildHeader();
    rerender();
    emitter.emit('columns', api.getColumns());
  }

  function getColumns() {
    return userColumns().map((c) => ({ ...c }));
  }

  function setFrozen(key, side) {
    const col = colByKey(key);
    if (!col || col.type === '__index' || col.type === '__select') return;
    col.frozen = side === 'left' || side === 'right' ? side : null;
    // 좌/우 고정 순서 유지
    const users = userColumns();
    const pseudo = state.columns.filter((c) => c.type === '__index' || c.type === '__select');
    const left = users.filter((c) => c.frozen === 'left');
    const middle = users.filter((c) => !c.frozen);
    const right = users.filter((c) => c.frozen === 'right');
    state.columns = [...pseudo, ...left, ...middle, ...right];
    rebuildOffsets();
    buildHeader();
    rerender();
    emitter.emit('columns', api.getColumns());
    setStatus(side ? `${col.title} 열을 ${side === 'left' ? '왼쪽' : '오른쪽'}에 고정했습니다.` : `${col.title} 열 고정을 해제했습니다.`, 'ok');
  }

  function setRowHeight(px) {
    if (!px) return;
    rowHeight = Number(px) || rowHeight;
    updateGeometry();
    renderRows(true);
  }

  function setHeight(value) {
    opts.height = value;
    updateGeometry();
    renderRows(true);
  }

  async function load(url, loadOptions = {}) {
    if (Array.isArray(url)) return setData(url);
    setLoading(true);
    try {
      const response = await ajax.request(url, loadOptions);
      const rows = Array.isArray(response) ? response
        : (response && (response.rows || response.data || response.items)) || [];
      if (response && response.columns && !opts.columns.length) setColumns(response.columns);
      setData(rows);
      setStatus(`${rows.length.toLocaleString()}건을 불러왔습니다.`, 'ok');
      emitter.emit('load', { url, count: rows.length });
      return rows;
    } catch (err) {
      setStatus(`데이터 로드 실패: ${err.message}`, 'error');
      emitter.emit('loaderror', { url, error: err });
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV(filename = 'grid.csv') {
    const cols = userColumns().map((c) => ({ ...c, key: c.key }));
    download(filename, '\ufeff' + toCSV(cols, api.getData()), 'text/csv;charset=utf-8');
  }

  function destroy() {
    destroyed = true;
    if (scrollRaf) cancelRaf(scrollRaf);
    if (statusTimer) clearTimeout(statusTimer);
    closeMenu();
    emitter.destroy();
    rootEl.remove();
  }

  api = {
    el: rootEl,
    id,
    viewport: viewportEl,
    setData, getData, addRow, removeRows, load,
    setColumns, getColumns, setFrozen,
    setSort, clearSort, setFilter, setQuery,
    setFilterRow(enabled) { return setFilterRowEnabled(enabled); },
    toggleFilterRow() { return setFilterRowEnabled(!opts.filterRow); },
    validate, save, getChanges, getSelected, getVisible,
    focusCell, setCellValue, scrollToIndex,
    setRowHeight, setHeight, refreshMetrics,
    downloadCSV, updateWidths,
    getRowStatus(rid) { return rowStatus(rid); },
    expand(rid) { return expandRow(rid); },
    collapse(rid) { return collapseRow(rid); },
    toggleExpand(rid) { return toggleExpandRow(rid); },
    expandAll() { return expandAllRows(); },
    collapseAll() { return collapseAllRows(); },
    isExpanded(rid) { return isExpanded(rid); },
    selectAll() {
      state.view.forEach((r) => state.selection.add(r._rid));
      updateSelectionUI();
      emitSelection();
    },
    clearSelection() {
      state.selection.clear();
      updateSelectionUI();
      emitSelection();
    },
    selectRow(rid) {
      const row = state.rowMap.get(rid);
      if (row) selectRow(row);
    },
    setLoading,
    setStatus,
    on: (type, fn) => emitter.on(type, fn),
    off: (type, fn) => emitter.off(type, fn),
    destroy,
    get rowHeight() { return rowHeight; },
    get hasChanges() { return state.hasChanges; },
    get errorCount() { return countErrors(); },
    get filterRow() { return !!opts.filterRow; },
    get tree() { return !!treeMode; },
  };

  /* ------------------------------ 초기화 ------------------------------ */
  refreshMetrics();
  buildToolbar();
  buildFooter();
  setColumns(opts.columns || []);
  setData(opts.data || []);
  if (opts.autoLoad && opts.dataUrl) load(opts.dataUrl);

  emitter.emit('ready', api);
  return api;
}

export const grid = { create: createGrid };
export default createGrid;
