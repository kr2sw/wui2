/*!
 * WUI - app/app.js
 * 메뉴 JSON → 클릭 → 레이어 JSON + 데이터 JSON AJAX 로드 → 화면 배치 렌더
 * 탭, 해시 라우팅, AJAX 로그, 스킨 패널 포함.
 *
 * const app = WUI.createApp('#app', {
 *   menuUrl: '/api/menu',
 *   layerUrl: '/api/layers/{layer}',
 *   dataUrl: '/api/data/{data}'
 * });
 */
import { h, $$, isFn, debounce, download, escapeHtml, nowTimeStr } from '../core/util.js';
import { Emitter } from '../core/emitter.js';
import { ajax } from '../core/ajax.js';
import { createLayout } from '../layout/layout.js';
import { skin } from '../core/skin.js';

const DEFAULTS = {
  menuUrl: '/api/menu',
  layerUrl: '/api/layers/{layer}',
  dataUrl: '/api/data/{data}',
  submitUrl: null,
  title: 'WUI',
  subtitle: '웹 UI 키트',
  logo: 'W',
  hash: true,
  cache: true,
  tabs: true,
  skinPanel: true,
  statusBar: true,
  imageUploader: null,
};

export function createApp(mount, options = {}) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error('[wui:app] 마운트 대상이 없습니다.');
  const opts = { ...DEFAULTS, ...options };
  const emitter = new Emitter();

  const state = {
    menu: null,
    items: [],
    map: new Map(),
    open: new Set(),
    tabs: [],
    activeId: null,
    logs: [],
    loadingMenu: false,
    menuError: null,
    sidebarCollapsed: false,
  };

  /* ------------------------------ 마크업 ------------------------------ */
  const rootEl = h('div.wui-app');
  const sidebarEl = h('aside.wui-app-sidebar');
  const brandEl = h('div.wui-app-brand');
  const menuNav = h('nav.wui-app-menu', { 'aria-label': '메뉴' });
  const sideFoot = h('div.wui-app-sidefoot');
  const overlayEl = h('div.wui-app-overlay', { hidden: true });
  const sideToggleBtn = h('button.wui-app-sidebartoggle', {
    type: 'button',
    title: '메뉴 접기',
    'aria-label': '메뉴 접기',
  }, '«');

  const mainEl = h('div.wui-app-main');
  const topEl = h('header.wui-app-top');
  const menuBtn = h('button.wui-app-menubtn', { type: 'button', title: '메뉴', 'aria-label': '메뉴 열기' }, '☰');
  const crumbsEl = h('div.wui-app-crumbs');
  const actionsEl = h('div.wui-app-actions');
  const ajaxBadge = h('span.wui-app-ajaxbadge', { title: 'AJAX 로그' }, 'AJAX 0');
  const refreshBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: '현재 화면 새로고침 (레이어+데이터)' }, '↻ 새로고침');
  const logBtn = h('button.wui-btn.wui-btn-sm', { type: 'button', title: 'AJAX 로그 보기' }, '로그');

  const tabsEl = h('div.wui-app-tabs');
  const viewEl = h('div.wui-app-view');
  const welcomeEl = h('div.wui-app-welcome');
  const toastEl = h('div.wui-app-toasts');
  const logPanel = h('div.wui-app-logpanel', { hidden: true });
  const statusEl = h('footer.wui-app-status');

  // 사이드바
  sidebarEl.appendChild(brandEl);
  sidebarEl.appendChild(menuNav);
  sidebarEl.appendChild(sideFoot);
  // 메인
  if (opts.tabs) mainEl.appendChild(tabsEl);
  mainEl.appendChild(viewEl);
  mainEl.appendChild(statusEl);
  rootEl.appendChild(sidebarEl);
  append(rootEl, [overlayEl, mainEl, toastEl, logPanel]);

  function append(parent, nodes) {
    for (const node of nodes.flat(Infinity)) if (node) parent.appendChild(node);
  }

  /* ------------------------------ 브랜드/스킨 ------------------------------ */
  function isMobileSidebar() {
    return window.matchMedia('(max-width: 980px)').matches;
  }

  function setMenuCollapsed(collapsed) {
    state.sidebarCollapsed = Boolean(collapsed);
    rootEl.classList.toggle('is-menu-collapsed', state.sidebarCollapsed);
    const label = state.sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기';
    sideToggleBtn.title = label;
    sideToggleBtn.setAttribute('aria-label', label);
    sideToggleBtn.textContent = state.sidebarCollapsed ? '»' : '«';
  }

  function renderBrand() {
    brandEl.innerHTML = '';
    brandEl.appendChild(h('div.wui-app-logo', {}, opts.logo || 'W'));
    brandEl.appendChild(h('div.wui-app-brandtext', {},
      h('div.wui-app-brandtitle', {}, opts.title || 'WUI'),
      h('div.wui-app-brandsub', {}, opts.subtitle || '')));
    brandEl.appendChild(sideToggleBtn);
  }

  let skinPicker = null;
  let shapePicker = null;
  function renderSkinPanel() {
    sideFoot.innerHTML = '';
    if (!opts.skinPanel) { sideFoot.hidden = true; return; }
    const head = h('div.wui-app-skinhead', {},
      h('span', {}, '스킨'),
      h('button.wui-app-skinreset', { type: 'button', title: '기본값으로' }, '초기화'));
    head.querySelector('button').addEventListener('click', () => skin.reset());
    const themeWrap = h('div.wui-app-skinthemes');
    const shapeWrap = h('div.wui-app-skinshapes');
    const density = h('div.wui-app-density');
    density.appendChild(h('span.wui-small.wui-muted', {}, '밀도'));
    const select = h('select.wui-select.wui-input-sm', {
      on: { change: () => skin.setDensity(select.value) },
    }, [
      { value: 'compact', label: '좁게' },
      { value: 'normal', label: '보통' },
      { value: 'comfortable', label: '넓게' },
    ].map((o) => h('option', { value: o.value }, o.label)));
    select.value = skin.current().density;
    density.appendChild(select);
    append(sideFoot, [head, themeWrap, shapeWrap, density]);
    skinPicker = skin.createThemePicker(themeWrap);
    shapePicker = skin.createShapePicker(shapeWrap);
    skin.onChange(() => { if (select.value !== skin.current().density) select.value = skin.current().density; });
  }

  /* ------------------------------ 메뉴 ------------------------------ */
  function normalizeMenu(json) {
    state.map = new Map();
    state.items = [];
    state.menu = json || {};
    const list = (json && (json.items || json.menus || json.menu)) || [];
    const walk = (nodes, parent) => (nodes || []).map((raw, index) => {
      const id = String(raw.id !== undefined && raw.id !== null ? raw.id : `menu-${index}`);
      const item = {
        ...raw,
        id,
        label: raw.label !== undefined ? raw.label : (raw.title || raw.text || id),
        icon: raw.icon || '',
        parent,
        children: walk(raw.children || raw.items, { id, label: raw.label || id }),
      };
      state.map.set(id, item);
      return item;
    });
    state.items = walk(list, null);
    state.open = new Set(state.items.filter((m) => m.children.length).map((m) => m.id));
    renderMenu();
    renderBrand();
    emitter.emit('menu', { menu: json, items: state.items });
  }

  function findMenu(id) { return state.map.get(String(id)) || null; }

  function firstLeaf(items = state.items) {
    for (const item of items) {
      if (item.children.length) {
        const found = firstLeaf(item.children);
        if (found) return found;
      } else if (!item.disabled) return item;
    }
    return null;
  }

  function breadcrumb(menu) {
    const path = [];
    let cur = menu;
    while (cur) { path.unshift(cur); cur = cur.parent ? findMenu(cur.parent.id) : null; }
    return path;
  }

  function renderMenu() {
    menuNav.innerHTML = '';
    if (state.loadingMenu) {
      menuNav.appendChild(h('div.wui-app-menuloading', {}, h('span.wui-spinner'), '메뉴 불러오는 중…'));
      return;
    }
    if (state.menuError) {
      menuNav.appendChild(h('div.wui-app-menuerror', {},
        h('div.wui-bold', {}, '메뉴를 불러오지 못했습니다'),
        h('div.wui-small', {}, state.menuError.message || String(state.menuError)),
        (() => {
          const b = h('button.wui-btn.wui-btn-sm', { type: 'button' }, '다시 시도');
          b.addEventListener('click', () => loadMenu());
          return b;
        })()));
      return;
    }
    if (!state.items.length) {
      menuNav.appendChild(h('div.wui-empty', {}, h('div.wui-empty-title', {}, '메뉴가 없습니다')));
      return;
    }
    const renderList = (items, depth) => {
      const ul = h('ul.wui-app-menulist', { class: depth ? 'is-sub' : '' });
      for (const item of items) {
        const li = h('li.wui-app-menuitem', { 'data-id': item.id });
        const active = state.activeId === item.id;
        const hasChildren = item.children.length > 0;
        const open = state.open.has(item.id);
        const btn = h('button.wui-app-menubtn', {
          type: 'button',
          title: item.label,
          class: [
            hasChildren ? 'is-group' : 'is-leaf',
            active ? 'is-active' : '',
            open ? 'is-open' : '',
            item.disabled ? 'is-disabled' : '',
          ].filter(Boolean).join(' '),
          'aria-expanded': hasChildren ? String(open) : undefined,
          disabled: item.disabled,
        });
        if (item.icon) btn.appendChild(h('span.wui-app-menuicon', {}, item.icon));
        btn.appendChild(h('span.wui-app-menulabel', {}, item.label));
        if (item.badge) btn.appendChild(h('span.wui-app-menubadge', {}, String(item.badge)));
        if (hasChildren) btn.appendChild(h('span.wui-app-menuchev', {}, open ? '▾' : '▸'));
        btn.addEventListener('click', () => {
          if (hasChildren) {
            if (state.sidebarCollapsed && !isMobileSidebar()) {
              setMenuCollapsed(false);
              if (!state.open.has(item.id)) state.open.add(item.id);
              renderMenu();
              return;
            }
            if (state.open.has(item.id)) state.open.delete(item.id);
            else state.open.add(item.id);
            renderMenu();
          } else {
            openMenu(item);
          }
        });
        li.appendChild(btn);
        if (hasChildren) {
          const sub = renderList(item.children, depth + 1);
          if (!open) sub.hidden = true;
          li.appendChild(sub);
        }
        ul.appendChild(li);
      }
      return ul;
    };
    menuNav.appendChild(renderList(state.items, 0));
  }

  /* ------------------------------ AJAX 로그 ------------------------------ */
  function updateAjaxBadge() {
    const count = state.logs.length;
    ajaxBadge.textContent = `AJAX ${count}`;
    ajaxBadge.classList.toggle('is-error', state.logs.some((l) => !l.ok));
    if (statusEl) {
      const last = state.logs[0];
      statusEl.innerHTML = '';
      statusEl.appendChild(h('span', {}, last
        ? `${last.method} ${last.url} · ${last.status || 'ERR'} · ${last.ms}ms · ${last.source === 'network' ? 'HTTP' : 'MOCK'}${last.note ? ' (fallback)' : ''}`
        : '대기 중'));
      statusEl.appendChild(h('span.wui-grow', {}));
      statusEl.appendChild(h('span', {}, `${new Date().toLocaleTimeString('ko-KR')}`));
    }
    if (!logPanel.hidden) renderLogPanel();
  }

  function renderLogPanel() {
    logPanel.innerHTML = '';
    logPanel.appendChild(h('div.wui-app-loghead', {},
      h('span.wui-bold', {}, `AJAX 로그 (${state.logs.length})`),
      h('span.wui-grow', {}),
      (() => {
        const b = h('button.wui-btn.wui-btn-sm.wui-btn-ghost', { type: 'button' }, '지우기');
        b.addEventListener('click', () => { state.logs = []; updateAjaxBadge(); });
        return b;
      })(),
      (() => {
        const b = h('button.wui-btn.wui-btn-sm.wui-btn-ghost', { type: 'button' }, '닫기');
        b.addEventListener('click', () => { logPanel.hidden = true; });
        return b;
      })()));
    const list = h('div.wui-app-loglist');
    if (!state.logs.length) list.appendChild(h('div.wui-empty', {}, h('div.wui-empty-title', {}, '기록이 없습니다')));
    state.logs.forEach((entry) => {
      list.appendChild(h('div.wui-app-logrow', { class: entry.ok ? '' : 'is-error' },
        h('span.wui-app-logmethod', {}, entry.method),
        h('span.wui-app-logurl', { title: entry.url }, entry.url),
        h('span.wui-app-logstatus', {}, String(entry.status || 'ERR')),
        h('span.wui-app-logms', {}, `${entry.ms}ms`),
        h('span.wui-app-logsource', { class: entry.source === 'network' ? 'is-http' : 'is-mock' },
          entry.source === 'network' ? 'HTTP' : entry.source === 'mock' ? 'MOCK' : 'MOCK↺'),
        h('span.wui-app-logtime', {}, entry.at ? entry.at.toLocaleTimeString('ko-KR') : '')));
    });
    logPanel.appendChild(list);
  }

  ajax.onLog((entry) => {
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 100);
    updateAjaxBadge();
  });

  /* ------------------------------ 탭 ------------------------------ */
  function renderTabs() {
    if (!opts.tabs) return;
    tabsEl.innerHTML = '';
    if (!state.tabs.length) { tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    state.tabs.forEach((tab) => {
      const item = h('div.wui-app-tab', {
        class: tab.id === state.activeId ? 'is-active' : '',
        role: 'tab',
        'aria-selected': String(tab.id === state.activeId),
      });
      const label = h('button.wui-app-tablabel', { type: 'button', title: tab.label }, tab.label);
      label.addEventListener('click', () => activateTab(tab.id));
      const close = h('button.wui-app-tabclose', { type: 'button', title: '닫기', 'aria-label': `${tab.label} 닫기` }, '✕');
      close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
      append(item, [label, close]);
      tabsEl.appendChild(item);
    });
  }

  function activateTab(id, { silent = false } = {}) {
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return;
    state.activeId = tab.id;
    for (const t of state.tabs) t.el.hidden = t.id !== tab.id;
    welcomeEl.hidden = state.tabs.length > 0;
    renderTabs();
    renderMenu();
    updateCrumbs(tab.menu);
    if (opts.hash && !silent) {
      const next = `#/${tab.id}`;
      if (location.hash !== next) history.replaceState(null, '', next);
    }
    emitter.emit('tabchange', { id: tab.id, menu: tab.menu });
  }

  function closeTab(id) {
    const index = state.tabs.findIndex((t) => t.id === id);
    if (index < 0) return;
    const tab = state.tabs[index];
    try { tab.layout?.destroy(); } catch (_) { /* noop */ }
    tab.el.remove();
    state.tabs.splice(index, 1);
    if (state.activeId === id) {
      const next = state.tabs[Math.max(0, index - 1)] || state.tabs[index];
      if (next) activateTab(next.id);
      else {
        state.activeId = null;
        welcomeEl.hidden = false;
        renderTabs();
        renderMenu();
        updateCrumbs(null);
        if (opts.hash) history.replaceState(null, '', location.pathname + location.search);
      }
    } else {
      renderTabs();
    }
    emitter.emit('tabclose', { id });
  }

  function updateCrumbs(menu) {
    crumbsEl.innerHTML = '';
    if (!menu) {
      crumbsEl.appendChild(h('span.wui-app-crumbtitle', {}, '메뉴를 선택하세요'));
      return;
    }
    const path = breadcrumb(menu);
    path.forEach((item, i) => {
      if (i) crumbsEl.appendChild(h('span.wui-app-crumbsep', {}, '/'));
      crumbsEl.appendChild(h('span', { class: i === path.length - 1 ? 'wui-app-crumbtitle' : 'wui-app-crumbitem' }, item.label));
    });
  }

  /* ------------------------------ 레이어 로드 ------------------------------ */
  function resolve(spec, menu) {
    if (!spec) return null;
    if (isFn(spec)) return spec(menu, state);
    const values = {
      id: menu.id,
      layer: menu.layer || menu.id,
      data: menu.data || menu.id,
      menu: menu.id,
    };
    return String(spec).replace(/\{(\w+)\}/g, (_, key) => (values[key] !== undefined ? encodeURIComponent(values[key]) : ''));
  }

  function ensureTab(menu) {
    let tab = state.tabs.find((t) => t.id === menu.id);
    if (tab) return tab;
    const el = h('div.wui-app-pane', { 'data-menu': menu.id, hidden: true });
    viewEl.appendChild(el);
    tab = { id: menu.id, label: menu.label, menu, el, loaded: false, loading: false, error: null };
    state.tabs.push(tab);
    return tab;
  }

  function openMenu(menuOrId) {
    const menu = typeof menuOrId === 'string' ? findMenu(menuOrId) : menuOrId;
    if (!menu) return;
    if (menu.children.length) {
      if (state.open.has(menu.id)) state.open.delete(menu.id);
      else state.open.add(menu.id);
      renderMenu();
      return;
    }
    if (menu.disabled) return;
    // 상위 그룹 열기
    let parent = menu.parent;
    while (parent) { state.open.add(parent.id); parent = parent.parent ? findMenu(parent.parent.id) : null; }
    const tab = ensureTab(menu);
    activateTab(tab.id, { silent: true });
    if (!tab.loaded && !tab.loading) loadTab(tab);
    if (opts.hash && location.hash !== `#/${menu.id}`) history.replaceState(null, '', `#/${menu.id}`);
    emitter.emit('open', { menu });
  }

  async function loadTab(tab, { force = false } = {}) {
    if (tab.loading) return tab.promise;
    if (tab.loaded && !force) return null;
    if (force) {
      try { tab.layout?.destroy(); } catch (_) { /* noop */ }
      tab.layout = null;
      tab.loaded = false;
    }
    tab.loading = true;
    tab.error = null;
    renderPaneLoading(tab);
    tab.promise = (async () => {
      try {
        const layerUrl = resolve(opts.layerUrl, tab.menu);
        const layer = await ajax.get(layerUrl);
        let data = null;
        const dataUrl = resolve(opts.dataUrl, tab.menu);
        if (dataUrl && tab.menu.data !== false) {
          try { data = await ajax.get(dataUrl); }
          catch (err) {
            if (err.status === 404) data = null;
            else throw err;
          }
        }
        tab.layer = layer;
        tab.data = data;
        tab.loaded = true;
        tab.loadedAt = new Date();
        renderPane(tab);
        emitter.emit('load', { tab, layer, data });
      } catch (err) {
        tab.error = err;
        tab.loaded = false;
        renderPaneError(tab, err);
        emitter.emit('loaderror', { tab, error: err });
      } finally {
        tab.loading = false;
        tab.promise = null;
      }
    })();
    return tab.promise;
  }

  function paneShell(tab) {
    tab.el.innerHTML = '';
    const head = h('div.wui-app-panehead', {},
      h('div.wui-app-panetitle', {},
        tab.menu.icon ? h('span.wui-app-paneicon', {}, tab.menu.icon) : null,
        h('span', {}, tab.menu.label)),
      h('div.wui-app-paneactions', {},
        h('span.wui-app-panemeta', {}, tab.loadedAt ? `불러옴 ${tab.loadedAt.toLocaleTimeString('ko-KR')}` : ''),
        (() => {
          const b = h('button.wui-btn.wui-btn-sm', { type: 'button', title: '이 화면의 레이어/데이터 다시 읽기' }, '↻ 다시 읽기');
          b.addEventListener('click', () => reloadTab(tab));
          return b;
        })()));
    const body = h('div.wui-app-panebody');
    tab.el.appendChild(head);
    tab.el.appendChild(body);
    return body;
  }

  function renderPaneLoading(tab) {
    const body = paneShell(tab);
    body.appendChild(h('div.wui-app-paneloading', {},
      h('div.wui-spinner'),
      h('div', {},
        h('div.wui-bold', {}, '화면을 구성하는 중…'),
        h('div.wui-small.wui-muted', {}, '메뉴 → 레이어(JSON) → 데이터(JSON) 순으로 AJAX 요청합니다.'))));
  }

  function renderPaneError(tab, err) {
    const body = paneShell(tab);
    body.appendChild(h('div.wui-app-paneerror', {},
      h('div.wui-alert.wui-alert-danger', {},
        h('div', {},
          h('div.wui-bold', {}, '화면을 불러오지 못했습니다.'),
          h('div.wui-small', {}, err.message || String(err)),
          err.url ? h('div.wui-small.wui-mono', {}, err.url) : null)),
      h('div.wui-flex', {},
        (() => {
          const b = h('button.wui-btn.wui-btn-sm', { type: 'button' }, '다시 시도');
          b.addEventListener('click', () => loadTab(tab, { force: true }));
          return b;
        })(),
        (() => {
          const b = h('button.wui-btn.wui-btn-sm', { type: 'button' }, 'AJAX 로그');
          b.addEventListener('click', () => toggleLog(true));
          return b;
        })())));
  }

  function renderPane(tab) {
    const body = paneShell(tab);
    const layer = tab.layer || {};
    const data = tab.data || {};
    const layoutHost = h('div.wui-app-layout');
    body.appendChild(layoutHost);

    const form = createLayout(layoutHost, layer, {
      values: data.values || {},
      data,
      imageUploader: opts.imageUploader,
      onSubmit: (payload) => handleSubmit(tab, payload),
      onAction: (payload) => handleAction(tab, payload),
      onChange: (payload) => {
        tab.dirty = true;
        emitter.emit('change', { tab, ...payload });
      },
    });
    tab.layout = form;
    tab.el.dataset.loaded = 'true';
    form.on('submit', () => { tab.dirty = false; });
    form.on('validate', (errors) => {
      if (errors.length) toast(`${errors.length}건의 입력 오류가 있습니다.`, 'error');
    });
  }

  async function handleSubmit(tab, payload) {
    const url = (tab.layer && tab.layer.submitUrl) || opts.submitUrl;
    const values = payload.values;
    if (!url) {
      toast('입력값이 검증되었습니다. (저장 URL 없음 — 데모)', 'ok');
      tab.dirty = false;
      return;
    }
    try {
      const response = await ajax.post(url, { menu: tab.menu.id, values });
      toast((response && (response.message || response.msg)) || '저장되었습니다.', 'ok');
      tab.dirty = false;
      emitter.emit('submit', { tab, values, response });
    } catch (err) {
      toast(`저장 실패: ${err.message}`, 'error');
    }
  }

  function handleAction(tab, payload) {
    const { action, def } = payload;
    if (!def) return;
    if (def.url) {
      ajax.request(def.url, { method: def.method || 'POST', data: payload.values })
        .then((res) => toast((res && res.message) || `${action} 완료`, 'ok'))
        .catch((err) => toast(`${action} 실패: ${err.message}`, 'error'));
      return;
    }
    if (action === 'reload') { reloadTab(tab); return; }
    if (action === 'close') { closeTab(tab.id); return; }
    if (action === 'log') { toggleLog(true); return; }
    if (action === 'theme') {
      const next = def.theme || def.value;
      skin.setTheme(next);
      toast(`테마: ${(skin.THEMES[next] || {}).label || next}`, 'ok');
      return;
    }
    if (action === 'shape') {
      const next = def.shape || def.value;
      skin.setShape(next);
      toast(`모양: ${(skin.SHAPES[next] || {}).label || next}`, 'ok');
      return;
    }
    if (action === 'density') {
      const next = def.density || def.value;
      skin.setDensity(next);
      toast(`밀도: ${(skin.DENSITIES[next] || {}).label || next}`, 'ok');
      return;
    }
    if (action === 'borders') {
      const next = skin.toggleBorders();
      toast(`테두리: ${next.borders ? '사용' : '사용 안 함'}`, 'ok');
      return;
    }
    if (action === 'skin-reset') {
      skin.reset();
      toast('스킨을 기본값으로 되돌렸습니다.', 'ok');
      return;
    }
    if (action === 'json') {
      download(`${tab.menu.id}-values.json`, JSON.stringify(payload.values, null, 2));
      toast('입력값을 JSON 으로 내려받았습니다.', 'ok');
      return;
    }
    toast(`액션: ${action}`, '');
    emitter.emit('action', { tab, ...payload });
  }

  function reloadTab(tab) {
    if (!tab) return;
    loadTab(tab, { force: true });
  }

  /* ------------------------------ 토스트/공통 ------------------------------ */
  function toast(message, tone = '') {
    const el = h('div.wui-app-toast', { class: tone ? `is-${tone}` : '' }, message);
    toastEl.appendChild(el);
    setTimeout(() => el.classList.add('is-in'), 10);
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  function toggleLog(force) {
    const next = force === undefined ? logPanel.hidden : Boolean(force);
    logPanel.hidden = !next;
    if (next) renderLogPanel();
  }

  function setSidebar(open) {
    rootEl.classList.toggle('is-sidebar-open', open);
    overlayEl.hidden = !open;
  }

  /* ------------------------------ 초기화 ------------------------------ */
  renderBrand();
  renderSkinPanel();
  topEl.appendChild(menuBtn);
  topEl.appendChild(crumbsEl);
  append(actionsEl, [ajaxBadge, refreshBtn, logBtn]);
  topEl.appendChild(actionsEl);
  mainEl.insertBefore(topEl, mainEl.firstChild);

  welcomeEl.appendChild(h('div.wui-app-welcomecard', {},
    h('div.wui-app-welcomelogo', {}, opts.logo || 'W'),
    h('h1', {}, opts.title || 'WUI'),
    h('p', {}, '왼쪽 메뉴를 선택하면 레이어(JSON)와 데이터(JSON)를 AJAX 로 읽어 화면을 구성합니다.'),
    h('div.wui-app-welcomegrid', {},
      h('div', {}, h('span.wui-badge', {}, 'Editor'), h('div.wui-small', {}, '서식 · 표 · 이미지 첨부')),
      h('div', {}, h('span.wui-badge', {}, 'Grid'), h('div.wui-small', {}, '고정 열 · 가상 스크롤 · 검증')),
      h('div', {}, h('span.wui-badge', {}, 'Layout'), h('div.wui-small', {}, 'JSON 화면 배치')),
      h('div', {}, h('span.wui-badge', {}, 'Skin'), h('div.wui-small', {}, '테마 · 모양 · 밀도')))));
  viewEl.appendChild(welcomeEl);

  sideToggleBtn.addEventListener('click', () => setMenuCollapsed(!state.sidebarCollapsed));
  menuBtn.addEventListener('click', () => setSidebar(!rootEl.classList.contains('is-sidebar-open')));
  overlayEl.addEventListener('click', () => setSidebar(false));
  refreshBtn.addEventListener('click', () => {
    const tab = state.tabs.find((t) => t.id === state.activeId);
    if (tab) reloadTab(tab);
    else loadMenu();
  });
  logBtn.addEventListener('click', () => toggleLog());
  ajaxBadge.addEventListener('click', () => toggleLog());

  if (opts.hash) {
    window.addEventListener('hashchange', onHashChange);
  }

  function onHashChange() {
    const id = (location.hash || '').replace(/^#\/?/, '');
    if (!id) return;
    const menu = findMenu(id);
    if (menu && !menu.children.length && id !== state.activeId) openMenu(menu);
  }

  async function loadMenu() {
    state.loadingMenu = true;
    state.menuError = null;
    renderMenu();
    try {
      const json = await ajax.get(opts.menuUrl);
      if (json && json.title && !opts.keepTitle) opts.title = json.title;
      if (json && json.subtitle) opts.subtitle = json.subtitle;
      normalizeMenu(json);
      state.loadingMenu = false;
      renderMenu();
      renderBrand();
      emitter.emit('menuready', { menu: json });
      // 초기 메뉴
      const hashId = (location.hash || '').replace(/^#\/?/, '');
      const fromHash = hashId ? findMenu(hashId) : null;
      const initial = fromHash && !fromHash.children.length ? fromHash : firstLeaf();
      if (initial) openMenu(initial);
    } catch (err) {
      state.loadingMenu = false;
      state.menuError = err;
      renderMenu();
      toast(`메뉴 로드 실패: ${err.message}`, 'error');
      emitter.emit('menuerror', { error: err });
    }
  }

  const api = {
    el: rootEl,
    open: (id) => openMenu(id),
    reloadMenu: () => loadMenu(),
    reload: () => {
      const tab = state.tabs.find((t) => t.id === state.activeId);
      if (tab) reloadTab(tab);
    },
    closeTab,
    toggleLog,
    toast,
    setMenuCollapsed,
    toggleMenu: () => setMenuCollapsed(!state.sidebarCollapsed),
    getState: () => ({
      menu: state.menu, items: state.items, tabs: state.tabs.map((t) => ({ id: t.id, label: t.label, loaded: t.loaded })),
      activeId: state.activeId, logs: state.logs.slice(), loading: state.loadingMenu, error: state.menuError,
      sidebarCollapsed: state.sidebarCollapsed,
    }),
    on: (type, fn) => emitter.on(type, fn),
    off: (type, fn) => emitter.off(type, fn),
    destroy() {
      window.removeEventListener('hashchange', onHashChange);
      state.tabs.forEach((tab) => { try { tab.layout?.destroy(); } catch (_) { /* noop */ } });
      skinPicker?.destroy?.();
      shapePicker?.destroy?.();
      skin.removeTarget(rootEl);
      emitter.destroy();
      rootEl.remove();
    },
  };

  target.appendChild(rootEl);
  skin.addTarget(rootEl);
  loadMenu();
  updateAjaxBadge();
  emitter.emit('ready', api);
  return api;
}

export const app = { create: createApp };
export default createApp;
