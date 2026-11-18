/*!
 * WUI - tree/tree.js
 * 트리 컨트롤 (체크박스 트라이스테이트, 지연 로딩, 검색/필터, 키보드 탐색)
 *
 * const tree = WUI.createTree('#tree', { data, checkable: true, cascade: true });
 * tree.getChecked(); tree.expandAll(); tree.filter('검색어');
 */
import { h, $$, uid, debounce, escapeHtml, isFn, clone, clamp, raf } from '../core/util.js';
import { Emitter } from '../core/emitter.js';

const DEFAULTS = {
  data: [],
  checkable: true,
  cascade: true,
  multiple: true,
  showIcons: true,
  showLines: true,
  showSearch: true,
  searchPlaceholder: '트리 검색…',
  showActions: true,
  indent: 18,
  defaultExpandLevel: 0,     // 0 = 모두 접힘, -1 = 모두 펼침
  emptyText: '표시할 항목이 없습니다.',
  lazy: null,                // { load: async (node) => children[] }
  renderNode: null,          // ({ node, level, tree }) => Node|string
  onSelect: null,
  onCheck: null,
  onExpand: null,
  onLoad: null,
};

let nodeSeq = 0;

export function createTree(mount, options = {}) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error('[wui:tree] 마운트 대상이 없습니다.');
  const opts = { ...DEFAULTS, ...options };
  const emitter = new Emitter();
  const id = opts.id || uid('wui-tree');

  const state = {
    roots: [],
    byId: new Map(),
    expanded: new Set(),
    selected: new Set(),
    checked: new Set(),
    indeterminate: new Set(),
    loading: new Set(),
    query: '',
    anchorId: null,
  };

  /* ------------------------------ 마크업 ------------------------------ */
  const rootEl = h('div.wui-tree', { 'data-wui-tree': id, class: opts.showLines ? 'has-lines' : '' });
  const topEl = h('div.wui-tree-top');
  const bodyEl = h('div.wui-tree-body', { role: 'tree', tabindex: '0', 'aria-label': opts.ariaLabel || '트리' });
  const footerEl = h('div.wui-tree-footer');
  if (opts.showSearch || opts.showActions) {
    if (opts.showSearch) {
      const search = h('input.wui-input.wui-input-sm.wui-tree-search', { type: 'search', placeholder: opts.searchPlaceholder, 'aria-label': '트리 검색' });
      search.addEventListener('input', debounce(() => filterTree(search.value), 180));
      topEl.appendChild(search);
    }
    if (opts.showActions) {
      const expandBtn = h('button.wui-btn.wui-btn-sm.wui-btn-ghost', { type: 'button', title: '모두 펼치기' }, '펼치기');
      expandBtn.addEventListener('click', () => expandAll());
      const collapseBtn = h('button.wui-btn.wui-btn-sm.wui-btn-ghost', { type: 'button', title: '모두 접기' }, '접기');
      collapseBtn.addEventListener('click', () => collapseAll());
      topEl.appendChild(expandBtn);
      topEl.appendChild(collapseBtn);
    }
    rootEl.appendChild(topEl);
  } else {
    topEl.hidden = true;
  }
  rootEl.appendChild(bodyEl);
  rootEl.appendChild(footerEl);

  if (target.tagName === 'TEXTAREA' || target.tagName === 'DIV' || target.tagName === 'SECTION') {
    target.innerHTML = '';
    target.appendChild(rootEl);
  } else {
    target.appendChild(rootEl);
  }

  /* ------------------------------ 정규화 ------------------------------ */
  function normalizeList(list, parent) {
    const out = [];
    for (const raw of list || []) {
      if (!raw) continue;
      if (typeof raw === 'string') {
        out.push(normalizeNode({ label: raw }, parent));
        continue;
      }
      out.push(normalizeNode(raw, parent));
    }
    return out;
  }

  function normalizeNode(raw, parent) {
    nodeSeq += 1;
    let nodeId = raw.id !== undefined && raw.id !== null ? String(raw.id) : `node-${nodeSeq}`;
    while (state.byId.has(nodeId)) nodeId = `${nodeId}-${nodeSeq}`;
    const node = {
      id: nodeId,
      label: raw.label !== undefined ? String(raw.label) : (raw.text || ''),
      icon: raw.icon !== undefined ? raw.icon : null,
      disabled: Boolean(raw.disabled),
      selectable: raw.selectable !== false,
      checkable: raw.checkable !== false,
      expanded: raw.expanded !== undefined ? Boolean(raw.expanded) : (opts.defaultExpandLevel === -1),
      lazy: Boolean(raw.lazy),
      raw,
      data: raw.data,
      parent,
      level: parent ? parent.level + 1 : 0,
      children: [],
      loaded: !raw.lazy,
    };
    state.byId.set(nodeId, node);
    if (raw.checked || state.checked.has(nodeId)) state.checked.add(nodeId);
    if (node.expanded) state.expanded.add(nodeId);
    if (Array.isArray(raw.children)) {
      node.loaded = true;
      node.children = normalizeList(raw.children, node);
      if (!state.expanded.has(nodeId) && opts.defaultExpandLevel > 0 && node.level < opts.defaultExpandLevel) {
        state.expanded.add(nodeId);
        node.expanded = true;
      }
    } else if (!raw.lazy) {
      node.loaded = true;
    }
    return node;
  }

  function loadData(list) {
    state.byId.clear();
    state.roots = normalizeList(list, null);
    const expanded = new Set();
    const checked = new Set();
    for (const node of state.byId.values()) {
      if (node.expanded) expanded.add(node.id);
      if (node.raw && node.raw.checked) checked.add(node.id);
    }
    state.expanded = expanded;
    state.checked = checked;
    state.indeterminate = new Set();
    state.selected = new Set();
    if (opts.defaultExpandLevel === -1) expandAll({ silent: true, render: false });
    else if (opts.defaultExpandLevel > 0) {
      const walk = (nodes) => nodes.forEach((n) => {
        if (n.level < opts.defaultExpandLevel) state.expanded.add(n.id);
        walk(n.children);
      });
      walk(state.roots);
    }
    refreshChecks();
    render();
  }

  /* ------------------------------ 체크 ------------------------------ */
  function isLeaf(node) { return !node.children.length && (!node.lazy || node.loaded); }
  function hasChildren(node) { return node.children.length > 0 || (node.lazy && !node.loaded); }

  function refreshChecks() {
    state.indeterminate.clear();
    const walk = (node) => {
      if (!node.children.length) return;
      let all = true;
      let any = false;
      for (const child of node.children) {
        walk(child);
        const ind = state.indeterminate.has(child.id);
        const chk = state.checked.has(child.id) && !ind;
        if (chk) any = true;
        else all = false;
        if (ind) { all = false; any = true; }
      }
      if (all) state.checked.add(node.id);
      else state.checked.delete(node.id);
      if (!all && any) state.indeterminate.add(node.id);
      else state.indeterminate.delete(node.id);
    };
    state.roots.forEach(walk);
  }

  function setChecked(node, checked, { cascade = opts.cascade } = {}) {
    if (!node || node.disabled || node.checkable === false) return;
    const apply = (n, value) => {
      if (n.disabled || n.checkable === false) return;
      if (value) state.checked.add(n.id);
      else state.checked.delete(n.id);
      state.indeterminate.delete(n.id);
      if (cascade) n.children.forEach((child) => apply(child, value));
    };
    apply(node, checked);
    if (cascade) {
      let parent = node.parent;
      while (parent) {
        const kids = parent.children.filter((c) => !c.disabled && c.checkable !== false);
        const all = kids.length > 0 && kids.every((c) => state.checked.has(c.id) && !state.indeterminate.has(c.id));
        const some = kids.some((c) => state.checked.has(c.id) || state.indeterminate.has(c.id));
        state.indeterminate.delete(parent.id);
        if (all) state.checked.add(parent.id);
        else state.checked.delete(parent.id);
        if (some && !all) state.indeterminate.add(parent.id);
        parent = parent.parent;
      }
    }
    render();
    const payload = getCheckedNodes();
    emitter.emit('check', { node: cleanNode(node), checked, checkedNodes: payload });
    if (isFn(opts.onCheck)) opts.onCheck(payload, cleanNode(node));
  }

  function getCheckedNodes(includeParents = true) {
    const out = [];
    for (const node of state.byId.values()) {
      if (!state.checked.has(node.id) || state.indeterminate.has(node.id)) continue;
      if (!includeParents && node.children.length) continue;
      out.push(cleanNode(node));
    }
    return out;
  }

  function getChecked(options = {}) {
    if (options.ids) return getCheckedNodes(options.parents !== false).map((n) => n.id);
    return getCheckedNodes(options.parents !== false);
  }

  /* ------------------------------ 선택 ------------------------------ */
  function selectNode(node, { additive = false } = {}) {
    if (!node || node.disabled || node.selectable === false) return;
    if (!additive || !opts.multiple) state.selected.clear();
    if (additive && state.selected.has(node.id)) state.selected.delete(node.id);
    else state.selected.add(node.id);
    state.anchorId = node.id;
    render();
    const selected = getSelectedNodes();
    emitter.emit('select', { node: cleanNode(node), selected });
    if (isFn(opts.onSelect)) opts.onSelect(cleanNode(node), selected);
  }

  function getSelectedNodes() {
    return Array.from(state.selected).map((sid) => state.byId.get(sid)).filter(Boolean).map(cleanNode);
  }

  function getSelected() {
    const list = getSelectedNodes();
    return list.length === 1 ? list[0] : list;
  }

  /* ------------------------------ 렌더 ------------------------------ */
  function nodeVisible(node, matchSet) {
    if (!state.query) return true;
    if (matchSet.has(node.id)) return true;
    return node.children.some((child) => nodeVisible(child, matchSet));
  }

  function collectMatches() {
    const matchSet = new Set();
    if (!state.query) return matchSet;
    const q = state.query.toLowerCase();
    for (const node of state.byId.values()) {
      if (String(node.label).toLowerCase().includes(q)) {
        matchSet.add(node.id);
        let parent = node.parent;
        while (parent) { state.expanded.add(parent.id); parent = parent.parent; }
      }
    }
    return matchSet;
  }

  function labelNode(node) {
    if (!state.query) return document.createTextNode(node.label);
    const q = state.query;
    const text = String(node.label);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return document.createTextNode(text);
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(text.slice(0, idx)));
    frag.appendChild(h('mark.wui-tree-mark', {}, text.slice(idx, idx + q.length)));
    frag.appendChild(document.createTextNode(text.slice(idx + q.length)));
    return frag;
  }

  function renderNode(node, listEl, matchSet) {
    if (!nodeVisible(node, matchSet)) return;
    const expanded = state.expanded.has(node.id);
    const row = h('div.wui-tree-row', {
      'data-id': node.id,
      role: 'treeitem',
      tabindex: '-1',
      class: [
        'wui-tree-row',
        state.selected.has(node.id) ? 'is-selected' : '',
        node.disabled ? 'is-disabled' : '',
        expanded ? 'is-expanded' : '',
      ].filter(Boolean).join(' '),
      'aria-selected': state.selected.has(node.id) ? 'true' : 'false',
      'aria-expanded': hasChildren(node) ? String(expanded) : undefined,
      style: { paddingLeft: `${8 + node.level * opts.indent}px` },
    });

    const toggle = h('button.wui-tree-toggle', {
      type: 'button', tabindex: '-1',
      'aria-label': expanded ? '접기' : '펼치기',
      disabled: !hasChildren(node),
      class: hasChildren(node) ? '' : 'is-empty',
    });
    if (state.loading.has(node.id)) toggle.classList.add('is-loading');
    row.appendChild(toggle);

    if (opts.checkable && node.checkable !== false) {
      const cb = h('input.wui-tree-check', { type: 'checkbox', tabindex: '-1', 'aria-label': `${node.label} 선택` });
      cb.checked = state.checked.has(node.id) && !state.indeterminate.has(node.id);
      cb.indeterminate = state.indeterminate.has(node.id);
      cb.disabled = node.disabled;
      row.appendChild(cb);
    }

    if (opts.showIcons) {
      const icon = node.icon !== null && node.icon !== undefined
        ? node.icon
        : (node.children.length ? '▣' : '•');
      row.appendChild(h('span.wui-tree-icon', { class: node.children.length ? 'is-branch' : 'is-leaf' }, icon));
    }

    if (isFn(opts.renderNode)) {
      const custom = opts.renderNode({
        node: {
          id: node.id, label: node.label, icon: node.icon, disabled: node.disabled,
          level: node.level, data: node.data, checked: state.checked.has(node.id),
          childrenCount: node.children.length,
        },
        level: node.level,
        tree: api,
        raw: node,
      });
      if (custom instanceof Node) row.appendChild(custom);
      else {
        const wrap = h('span.wui-tree-label');
        wrap.innerHTML = String(custom);
        row.appendChild(wrap);
      }
    } else {
      const label = h('span.wui-tree-label', { title: node.label });
      label.appendChild(labelNode(node));
      row.appendChild(label);
      if (node.raw && node.raw.badge) row.appendChild(h('span.wui-badge.wui-badge-muted', {}, String(node.raw.badge)));
    }

    const li = h('li.wui-tree-node', {
      role: 'none', 'data-id': node.id,
      style: { '--tree-depth': node.level },
    });
    li.appendChild(row);

    if (hasChildren(node)) {
      const childList = h('ul.wui-tree-list', { role: 'group' });
      if (expanded) {
        if (state.loading.has(node.id)) {
          childList.appendChild(h('li.wui-tree-loading', {}, h('span.wui-spinner'), '불러오는 중…'));
        } else {
          for (const child of node.children) renderNode(child, childList, matchSet);
        }
      }
      li.appendChild(childList);
    }
    listEl.appendChild(li);
  }

  function render() {
    const scrollTop = bodyEl.scrollTop;
    bodyEl.innerHTML = '';
    const matchSet = collectMatches();
    const list = h('ul.wui-tree-list', { role: 'group' });
    if (!state.roots.length) {
      bodyEl.appendChild(h('div.wui-empty', {},
        h('div.wui-empty-icon', {}, '▤'),
        h('div.wui-empty-title', {}, opts.emptyText)));
    } else {
      for (const node of state.roots) renderNode(node, list, matchSet);
      if (list.children.length) bodyEl.appendChild(list);
      else {
        bodyEl.appendChild(h('div.wui-empty', {},
          h('div.wui-empty-icon', {}, '⌕'),
          h('div.wui-empty-title', {}, '검색 결과가 없습니다.'),
          h('div.wui-small', {}, `"${state.query}" 와 일치하는 항목이 없습니다.`)));
      }
    }
    bodyEl.scrollTop = scrollTop;
    updateFooter(matchSet);
  }

  function updateFooter(matchSet) {
    const total = state.byId.size;
    const checkedCount = getCheckedNodes(false).length;
    const selectedCount = state.selected.size;
    footerEl.innerHTML = '';
    footerEl.appendChild(h('span', {}, `전체 ${total.toLocaleString()}`));
    if (state.query) footerEl.appendChild(h('span.wui-tree-foot-search', {}, `검색 ${matchSet.size}건`));
    if (opts.checkable) footerEl.appendChild(h('span', {}, `체크 ${checkedCount}`));
    footerEl.appendChild(h('span', {}, `선택 ${selectedCount}`));
  }

  /* ------------------------------ 펼침/접힘 ------------------------------ */
  async function toggleNode(nodeId, force) {
    const node = state.byId.get(nodeId);
    if (!node) return;
    const isOpen = state.expanded.has(nodeId);
    const next = force === undefined ? !isOpen : Boolean(force);
    if (next === isOpen) return;
    if (next) {
      if (node.lazy && !node.loaded) {
        if (state.loading.has(nodeId)) return;
        state.loading.add(nodeId);
        state.expanded.add(nodeId);
        render();
        try {
          const children = await (opts.lazy && isFn(opts.lazy.load) ? opts.lazy.load(cleanNode(node)) : []);
          node.children = normalizeList(children || [], node);
          node.loaded = true;
          emitter.emit('load', { node: cleanNode(node), children: node.children.map(cleanNode) });
          if (isFn(opts.onLoad)) opts.onLoad(cleanNode(node), node.children.map(cleanNode));
        } catch (err) {
          state.expanded.delete(nodeId);
          emitter.emit('loaderror', { node: cleanNode(node), error: err });
        } finally {
          state.loading.delete(nodeId);
        }
        refreshChecks();
        render();
        emitter.emit('expand', { node: cleanNode(node), expanded: true });
        if (isFn(opts.onExpand)) opts.onExpand(cleanNode(node), true);
        return;
      }
      state.expanded.add(nodeId);
    } else {
      state.expanded.delete(nodeId);
    }
    render();
    emitter.emit('expand', { node: cleanNode(node), expanded: next });
    if (isFn(opts.onExpand)) opts.onExpand(cleanNode(node), next);
  }

  function expandAll({ silent = false, render: doRender = true } = {}) {
    for (const node of state.byId.values()) if (hasChildren(node)) state.expanded.add(node.id);
    if (doRender) render();
    if (!silent) emitter.emit('expandall');
  }

  function collapseAll() {
    state.expanded.clear();
    render();
    emitter.emit('collapseall');
  }

  function expandTo(nodeId) {
    let node = state.byId.get(nodeId);
    while (node) { if (node.parent) state.expanded.add(node.parent.id); node = node.parent; }
    render();
  }

  function expand(idOrIds, flag = true) {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    ids.forEach((nid) => { if (flag) state.expanded.add(String(nid)); else state.expanded.delete(String(nid)); });
    render();
  }

  /* ------------------------------ 검색 ------------------------------ */
  function filterTree(query) {
    state.query = String(query || '').trim();
    render();
    emitter.emit('filter', { query: state.query });
    return state.query ? Array.from(collectMatches()) : [];
  }

  /* ------------------------------ 이벤트 ------------------------------ */
  bodyEl.addEventListener('click', (e) => {
    const row = e.target.closest('.wui-tree-row');
    if (!row) return;
    const node = state.byId.get(row.dataset.id);
    if (!node) return;
    if (e.target.closest('.wui-tree-toggle')) {
      if (hasChildren(node)) toggleNode(node.id);
      return;
    }
    if (e.target.matches('.wui-tree-check')) {
      setChecked(node, e.target.checked);
      return;
    }
    selectNode(node, { additive: e.ctrlKey || e.metaKey });
  });

  bodyEl.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.wui-tree-row');
    if (!row) return;
    if (e.target.closest('.wui-tree-check, .wui-tree-toggle')) return;
    const node = state.byId.get(row.dataset.id);
    if (node && hasChildren(node)) toggleNode(node.id);
  });

  bodyEl.addEventListener('keydown', (e) => {
    const rows = $$('.wui-tree-row', bodyEl).filter((r) => r.offsetParent !== null);
    if (!rows.length) return;
    let index = rows.findIndex((r) => r.dataset.id === state.anchorId);
    if (index < 0) index = 0;
    const current = rows[index];
    const node = state.byId.get(current.dataset.id);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        index = clamp(index + 1, 0, rows.length - 1);
        focusRow(rows[index]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        index = clamp(index - 1, 0, rows.length - 1);
        focusRow(rows[index]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (node && hasChildren(node) && !state.expanded.has(node.id)) toggleNode(node.id);
        else if (rows[index + 1]) focusRow(rows[index + 1]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (node && state.expanded.has(node.id)) toggleNode(node.id, false);
        else if (node && node.parent) {
          const parentRow = rows.find((r) => r.dataset.id === node.parent.id);
          if (parentRow) focusRow(parentRow);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (node) selectNode(node, { additive: e.ctrlKey || e.metaKey });
        break;
      case ' ': {
        if (!node) break;
        if (e.target.matches('.wui-tree-check')) break; // 네이티브 체크박스 토글에 맡김
        e.preventDefault();
        if (opts.checkable) setChecked(node, !state.checked.has(node.id));
        break;
      }
      case 'Home':
        e.preventDefault();
        focusRow(rows[0]);
        break;
      case 'End':
        e.preventDefault();
        focusRow(rows[rows.length - 1]);
        break;
      default:
        break;
    }
  });

  function focusRow(row) {
    if (!row) return;
    state.anchorId = row.dataset.id;
    rowsSetFocus(row);
    row.scrollIntoView({ block: 'nearest' });
  }

  function rowsSetFocus(row) {
    $$('.wui-tree-row.is-focus', bodyEl).forEach((r) => r.classList.remove('is-focus'));
    row.classList.add('is-focus');
    row.focus({ preventScroll: true });
  }

  bodyEl.addEventListener('focusin', (e) => {
    const row = e.target.closest('.wui-tree-row');
    if (row) { state.anchorId = row.dataset.id; $$('.wui-tree-row.is-focus', bodyEl).forEach((r) => r.classList.remove('is-focus')); row.classList.add('is-focus'); }
  });

  /* ------------------------------ 유틸 ------------------------------ */
  function cleanNode(node) {
    return {
      id: node.id,
      label: node.label,
      icon: node.icon,
      disabled: node.disabled,
      expanded: state.expanded.has(node.id),
      checked: state.checked.has(node.id),
      indeterminate: state.indeterminate.has(node.id),
      level: node.level,
      data: node.data,
      children: node.children.map(cleanNode),
    };
  }

  function getNode(id) {
    const node = state.byId.get(String(id));
    return node ? cleanNode(node) : null;
  }

  function getData() {
    return state.roots.map(cleanNode);
  }

  function updateNode(nodeId, patch = {}) {
    const node = state.byId.get(String(nodeId));
    if (!node) return null;
    if (patch.label !== undefined) node.label = String(patch.label);
    if (patch.icon !== undefined) node.icon = patch.icon;
    if (patch.disabled !== undefined) node.disabled = Boolean(patch.disabled);
    if (patch.data !== undefined) node.data = patch.data;
    if (patch.checked !== undefined) setChecked(node, patch.checked);
    render();
    return cleanNode(node);
  }

  function addNode(parentId, raw, index) {
    const parent = parentId != null ? state.byId.get(String(parentId)) : null;
    const node = normalizeNode(raw || {}, parent);
    if (parent) {
      if (index === undefined || index < 0 || index > parent.children.length) parent.children.push(node);
      else parent.children.splice(index, 0, node);
      parent.loaded = true;
      state.expanded.add(parent.id);
    } else {
      if (index === undefined || index < 0 || index > state.roots.length) state.roots.push(node);
      else state.roots.splice(index, 0, node);
    }
    refreshChecks();
    render();
    return cleanNode(node);
  }

  function removeNode(nodeId) {
    const node = state.byId.get(String(nodeId));
    if (!node) return false;
    const removeRecursive = (n) => {
      state.byId.delete(n.id);
      state.expanded.delete(n.id);
      state.checked.delete(n.id);
      state.indeterminate.delete(n.id);
      state.selected.delete(n.id);
      state.anchorId = state.anchorId === n.id ? null : state.anchorId;
      n.children.forEach(removeRecursive);
    };
    removeRecursive(node);
    if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node);
    else state.roots = state.roots.filter((c) => c !== node);
    refreshChecks();
    render();
    return true;
  }

  function setCheckAll(flag) {
    state.roots.forEach((root) => {
      const apply = (n) => {
        if (n.disabled || n.checkable === false) return;
        if (flag) state.checked.add(n.id); else state.checked.delete(n.id);
        state.indeterminate.delete(n.id);
        n.children.forEach(apply);
      };
      apply(root);
    });
    render();
    emitter.emit('check', { checkedNodes: getCheckedNodes() });
  }

  function destroy() {
    emitter.destroy();
    rootEl.remove();
  }

  const api = {
    el: rootEl,
    id,
    setData: loadData,
    getData,
    getNode,
    updateNode,
    addNode,
    removeNode,
    setChecked: (nodeId, checked) => setChecked(state.byId.get(String(nodeId)), checked),
    getChecked,
    setCheckAll,
    getSelected,
    select: (nodeId) => selectNode(state.byId.get(String(nodeId))),
    clearSelection: () => { state.selected.clear(); render(); },
    toggle: toggleNode,
    expand,
    expandTo,
    expandAll,
    collapseAll,
    filter: filterTree,
    refresh: render,
    setQuery: filterTree,
    on: (type, fn) => emitter.on(type, fn),
    off: (type, fn) => emitter.off(type, fn),
    destroy,
  };

  loadData(opts.data || []);
  emitter.emit('ready', api);
  return api;
}

export const tree = { create: createTree };
export default createTree;
