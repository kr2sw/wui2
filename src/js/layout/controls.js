/*!
 * WUI - layout/controls.js
 * 화면 배치(JSON)에서 사용하는 컨트롤 레지스트리.
 * 외부에서 registerControl('myType', factory) 로 확장 가능.
 *
 * factory(ctx) => { el, getValue, setValue, focus, setDisabled, destroy }
 * ctx = { def, name, value, label, disabled, readOnly, options, onChange }
 */
import {
  h, uid, normalizeOptions, parseNumber, escapeHtml, clamp, readFileAsDataURL,
  formatNumber, isFn, isPlainObject, clone,
} from '../core/util.js';
import { createEditor } from '../editor/editor.js';
import { createGrid } from '../grid/grid.js';
import { createTree } from '../tree/tree.js';

const registry = new Map();

export function registerControl(type, factory, meta = {}) {
  if (!type || !isFn(factory)) throw new Error('[wui:layout] registerControl(type, factory)');
  registry.set(type, { factory, meta });
}

export function getControlFactory(type) {
  return registry.get(type) || null;
}

export function listControls() {
  return Array.from(registry.entries()).map(([type, item]) => ({ type, label: item.meta.label || type }));
}

/* ------------------------------ 공통 헬퍼 ------------------------------ */
function base(input, { getValue, setValue, focus, destroy, extra } = {}) {
  return {
    el: input,
    getValue: getValue || (() => input.value),
    setValue: setValue || ((v) => { input.value = v ?? ''; }),
    focus: focus || (() => input.focus()),
    setDisabled: (flag) => {
      if ('disabled' in input) input.disabled = Boolean(flag);
      input.classList.toggle('is-disabled', Boolean(flag));
    },
    destroy: destroy || (() => input.remove()),
    ...(extra || {}),
  };
}

function fieldInput(type, { parse = (v) => v, format = (v) => v ?? '' } = {}) {
  return (ctx) => {
    const input = h('input.wui-input', {
      type,
      name: ctx.name,
      value: format(ctx.value),
      placeholder: ctx.def.placeholder || '',
      disabled: Boolean(ctx.disabled),
      min: ctx.def.min,
      max: ctx.def.max,
      step: ctx.def.step,
      autocomplete: ctx.def.autocomplete || 'off',
      inputmode: ctx.def.inputmode || (type === 'number' ? 'decimal' : undefined),
      on: {
        input: () => ctx.onChange(parse(input.value), { input: true }),
        change: () => ctx.onChange(parse(input.value)),
      },
    });
    return base(input, {
      getValue: () => parse(input.value),
      setValue: (v) => { input.value = format(v); },
    });
  };
}

/* ------------------------------ 기본 입력 ------------------------------ */
registerControl('text', fieldInput('text'), { label: '텍스트' });
registerControl('string', fieldInput('text'), { label: '텍스트' });
registerControl('email', fieldInput('email'), { label: '이메일' });
registerControl('password', fieldInput('password'), { label: '비밀번호' });
registerControl('number', fieldInput('number', { parse: (v) => parseNumber(v), format: (v) => (v === null || v === undefined ? '' : v) }), { label: '숫자' });
registerControl('date', fieldInput('date', { format: (v) => (v ? String(v).slice(0, 10) : '') }), { label: '날짜' });
registerControl('time', fieldInput('time', { format: (v) => (v ? String(v).slice(0, 5) : '') }), { label: '시간' });
registerControl('datetime', fieldInput('datetime-local', { format: (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '') }), { label: '일시' });
registerControl('color', fieldInput('color', { format: (v) => v || '#2f6fed' }), { label: '색상' });

registerControl('textarea', (ctx) => {
  const ta = h('textarea.wui-textarea', {
    name: ctx.name,
    rows: ctx.def.rows || 4,
    placeholder: ctx.def.placeholder || '',
    disabled: Boolean(ctx.disabled),
    style: ctx.def.height ? { height: `${ctx.def.height}px` } : undefined,
    on: {
      input: () => ctx.onChange(ta.value, { input: true }),
      change: () => ctx.onChange(ta.value),
    },
  }, ctx.value ?? '');
  return base(ta, { setValue: (v) => { ta.value = v ?? ''; } });
}, { label: '여러 줄 텍스트' });

registerControl('hidden', (ctx) => {
  const input = h('input', { type: 'hidden', name: ctx.name, value: ctx.value ?? '' });
  return base(input, { setValue: (v) => { input.value = v ?? ''; } });
}, { label: '숨김 값' });

/* ------------------------------ 선택 ------------------------------ */
registerControl('select', (ctx) => {
  const sel = h('select.wui-select', {
    name: ctx.name,
    disabled: Boolean(ctx.disabled),
    multiple: Boolean(ctx.def.multiple),
    on: {
      change: () => {
        const values = Array.from(sel.selectedOptions).map((o) => o.value);
        ctx.onChange(ctx.def.multiple ? values : (sel.value === '' ? (ctx.def.emptyAsNull ? null : '') : sel.value));
      },
    },
  });
  if (ctx.def.placeholder || ctx.def.emptyLabel) {
    sel.appendChild(h('option', { value: '' }, ctx.def.placeholder || ctx.def.emptyLabel));
  }
  for (const opt of normalizeOptions(ctx.def.options, ctx.def)) {
    sel.appendChild(h('option', { value: String(opt.value), disabled: opt.disabled }, opt.label));
  }
  const setValue = (v) => {
    if (Array.isArray(v)) Array.from(sel.options).forEach((o) => { o.selected = v.map(String).includes(o.value); });
    else sel.value = v === null || v === undefined ? '' : String(v);
  };
  setValue(ctx.value);
  return base(sel, { setValue });
}, { label: '선택' });

registerControl('radio', (ctx) => {
  const groupName = ctx.def.name || `${ctx.name}-${uid('r')}`;
  const wrap = h('div.wui-radio-group', { role: 'radiogroup', 'aria-label': ctx.label || ctx.name });
  const inputs = [];
  for (const opt of normalizeOptions(ctx.def.options, ctx.def)) {
    const input = h('input', {
      type: 'radio', name: groupName, value: String(opt.value),
      disabled: Boolean(ctx.disabled) || opt.disabled,
      checked: String(ctx.value) === String(opt.value),
    });
    input.addEventListener('change', () => { if (input.checked) ctx.onChange(opt.value); });
    inputs.push(input);
    wrap.appendChild(h('label.wui-radio', {}, input, h('span', {}, opt.label)));
  }
  if (ctx.def.inline === false) wrap.style.flexDirection = 'column';
  return base(wrap, {
    getValue: () => {
      const checked = inputs.find((i) => i.checked);
      return checked ? checked.value : '';
    },
    setValue: (v) => { inputs.forEach((i) => { i.checked = String(v) === i.value; }); },
    focus: () => inputs.find((i) => i.checked)?.focus() || inputs[0]?.focus(),
    destroy: () => wrap.remove(),
  });
}, { label: '라디오' });

registerControl('checkbox-group', (ctx) => {
  const wrap = h('div.wui-check-group', { role: 'group', 'aria-label': ctx.label || ctx.name });
  const inputs = [];
  for (const opt of normalizeOptions(ctx.def.options, ctx.def)) {
    const input = h('input', {
      type: 'checkbox', value: String(opt.value),
      disabled: Boolean(ctx.disabled) || opt.disabled,
    });
    input.addEventListener('change', () => ctx.onChange(read()));
    inputs.push(input);
    wrap.appendChild(h('label.wui-check', {}, input, h('span', {}, opt.label)));
  }
  const read = () => {
    const checked = inputs.filter((i) => i.checked).map((i) => i.value);
    return checked;
  };
  const setValue = (list) => {
    const values = Array.isArray(list) ? list.map(String) : String(list ?? '').split(',').filter(Boolean);
    inputs.forEach((i) => { i.checked = values.includes(i.value); });
  };
  setValue(ctx.value);
  return base(wrap, { getValue: read, setValue, destroy: () => wrap.remove() });
}, { label: '체크박스 그룹' });
registerControl('checkboxes', (ctx) => getControlFactory('checkbox-group').factory(ctx), { label: '체크박스 그룹' });

registerControl('checkbox', (ctx) => {
  const input = h('input', { type: 'checkbox', name: ctx.name, disabled: Boolean(ctx.disabled), checked: Boolean(ctx.value) });
  input.addEventListener('change', () => ctx.onChange(input.checked));
  const label = h('label.wui-check', {}, input, h('span', {}, ctx.def.text || ctx.def.label || ''));
  return base(label, {
    getValue: () => input.checked,
    setValue: (v) => { input.checked = Boolean(v); },
    focus: () => input.focus(),
    setDisabled: (flag) => { input.disabled = Boolean(flag); },
    destroy: () => label.remove(),
  });
}, { label: '체크박스' });

registerControl('switch', (ctx) => {
  const input = h('input', { type: 'checkbox', name: ctx.name, disabled: Boolean(ctx.disabled), checked: Boolean(ctx.value) });
  input.addEventListener('change', () => ctx.onChange(input.checked));
  const label = h('label.wui-switch', {}, input, h('span', {}, ctx.def.text || ctx.def.label || ''));
  return base(label, {
    getValue: () => input.checked,
    setValue: (v) => { input.checked = Boolean(v); },
    focus: () => input.focus(),
    setDisabled: (flag) => { input.disabled = Boolean(flag); },
    destroy: () => label.remove(),
  });
}, { label: '스위치' });

registerControl('range', (ctx) => {
  const min = ctx.def.min ?? 0;
  const max = ctx.def.max ?? 100;
  const step = ctx.def.step ?? 1;
  const value = ctx.value === null || ctx.value === undefined || ctx.value === '' ? min : Number(ctx.value);
  const out = h('output.wui-range-out', {}, `${value}${ctx.def.unit || ''}`);
  const input = h('input.wui-range', {
    type: 'range', name: ctx.name, min, max, step, value,
    disabled: Boolean(ctx.disabled),
    on: {
      input: () => { out.textContent = `${input.value}${ctx.def.unit || ''}`; ctx.onChange(Number(input.value), { input: true }); },
      change: () => ctx.onChange(Number(input.value)),
    },
  });
  const wrap = h('div.wui-range-wrap', {}, input, out);
  return base(wrap, {
    getValue: () => Number(input.value),
    setValue: (v) => { input.value = v ?? min; out.textContent = `${input.value}${ctx.def.unit || ''}`; },
    focus: () => input.focus(),
    setDisabled: (flag) => { input.disabled = Boolean(flag); },
    destroy: () => wrap.remove(),
    input,
  });
}, { label: '슬라이더' });
registerControl('slider', (ctx) => getControlFactory('range').factory(ctx), { label: '슬라이더' });

/* ------------------------------ 특수 ------------------------------ */
registerControl('html', (ctx) => {
  const div = h('div.wui-layout-html', { html: ctx.def.html || ctx.def.content || '' });
  return base(div, { getValue: () => null, setValue: () => {} });
}, { label: 'HTML' });

registerControl('heading', (ctx) => {
  const div = h(`div.wui-layout-heading.wui-layout-heading-${ctx.def.level || 3}`, {}, ctx.def.text || ctx.def.label || '');
  return base(div, { getValue: () => null, setValue: () => {} });
}, { label: '제목' });

registerControl('divider', () => base(h('hr.wui-hr'), { getValue: () => null, setValue: () => {} }), { label: '구분선' });

registerControl('spacer', (ctx) => {
  const div = h('div.wui-layout-spacer', { style: { height: `${ctx.def.height || 12}px` } });
  return base(div, { getValue: () => null, setValue: () => {} });
}, { label: '여백' });

registerControl('static', (ctx) => {
  const div = h('div.wui-layout-static', {}, ctx.def.text ?? ctx.value ?? '');
  return base(div, { getValue: () => null, setValue: (v) => { div.textContent = v ?? ''; } });
}, { label: '고정 텍스트' });

registerControl('button', (ctx) => {
  const btn = h('button.wui-btn', {
    type: 'button',
    class: ctx.def.variant ? `wui-btn-${ctx.def.variant}` : '',
    disabled: Boolean(ctx.disabled),
    title: ctx.def.title || '',
  }, ctx.def.text || ctx.def.label || '실행');
  btn.addEventListener('click', () => {
    btn.dispatchEvent(new CustomEvent('wui-action', {
      bubbles: true,
      detail: { action: ctx.def.action || ctx.name, def: ctx.def, control: ctx.name },
    }));
  });
  return base(btn, { getValue: () => null, setValue: () => {}, focus: () => btn.focus() });
}, { label: '버튼' });

/* ------------------------------ 파일/이미지 ------------------------------ */
registerControl('file', (ctx) => {
  const value = Array.isArray(ctx.value) ? ctx.value : [];
  const listEl = h('div.wui-file-list');
  const input = h('input', { type: 'file', hidden: true, multiple: Boolean(ctx.def.multiple), accept: ctx.def.accept || '' });
  const pick = h('button.wui-btn.wui-btn-sm', { type: 'button' }, ctx.def.buttonText || '파일 선택');
  const wrap = h('div.wui-file', {}, pick, input, listEl);
  let files = value.slice();

  const renderList = () => {
    listEl.innerHTML = '';
    files.forEach((file, index) => {
      const item = h('div.wui-file-item', {},
        h('span.wui-file-name', { title: file.name }, file.name || '파일'),
        h('span.wui-small.wui-muted', {}, file.size ? `${Math.round(file.size / 1024).toLocaleString()}KB` : ''),
        h('button.wui-file-del', { type: 'button', title: '제거' }, '✕'));
      item.querySelector('.wui-file-del').addEventListener('click', () => {
        files.splice(index, 1);
        renderList();
        ctx.onChange(files.slice());
      });
      listEl.appendChild(item);
    });
    if (!files.length && ctx.def.hint) listEl.appendChild(h('div.wui-small.wui-muted', {}, ctx.def.hint));
  };

  input.addEventListener('change', async () => {
    const picked = Array.from(input.files || []);
    input.value = '';
    for (const file of picked) {
      try {
        let dataUrl = null;
        if (ctx.def.readAsDataUrl !== false) dataUrl = await readFileAsDataURL(file);
        files.push({ name: file.name, size: file.size, type: file.type, dataUrl });
      } catch (err) {
        console.warn('[wui:layout:file]', err);
      }
    }
    renderList();
    ctx.onChange(files.slice());
  });
  pick.addEventListener('click', () => input.click());
  renderList();
  return base(wrap, {
    getValue: () => files.slice(),
    setValue: (v) => { files = Array.isArray(v) ? v.slice() : []; renderList(); },
    focus: () => pick.focus(),
    setDisabled: (flag) => { pick.disabled = Boolean(flag); },
    destroy: () => wrap.remove(),
  });
}, { label: '파일 첨부' });

registerControl('image', (ctx) => {
  let src = ctx.value || '';
  const preview = h('div.wui-image-preview', { hidden: !src });
  const img = h('img', { alt: '', src: src || '' });
  preview.appendChild(img);
  const urlInput = h('input.wui-input.wui-input-sm', { type: 'text', placeholder: '이미지 URL 또는 파일 선택', value: src });
  const fileInput = h('input', { type: 'file', accept: ctx.def.accept || 'image/*', hidden: true });
  const pick = h('button.wui-btn.wui-btn-sm', { type: 'button' }, '첨부');
  const clear = h('button.wui-btn.wui-btn-sm.wui-btn-ghost', { type: 'button', title: '이미지 제거' }, '✕');
  const wrap = h('div.wui-image', {},
    preview,
    h('div.wui-input-group', {}, urlInput, pick, clear),
    fileInput);

  const setSrc = (next) => {
    src = next || '';
    urlInput.value = src;
    preview.hidden = !src;
    img.src = src;
    ctx.onChange(src);
  };
  urlInput.addEventListener('change', () => setSrc(urlInput.value));
  clear.addEventListener('click', () => setSrc(''));
  pick.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const next = isFn(ctx.def.uploader) ? await ctx.def.uploader(file)
        : isFn(ctx.options.imageUploader) ? await ctx.options.imageUploader(file)
          : await readFileAsDataURL(file);
      setSrc(next);
    } catch (err) {
      console.warn('[wui:layout:image]', err);
    }
  });
  return base(wrap, {
    getValue: () => src,
    setValue: (v) => { src = v || ''; urlInput.value = src; preview.hidden = !src; img.src = src; },
    focus: () => urlInput.focus(),
    setDisabled: (flag) => { urlInput.disabled = Boolean(flag); pick.disabled = Boolean(flag); },
    destroy: () => wrap.remove(),
  });
}, { label: '이미지' });

/* ------------------------------ 에디터/그리드/트리 ------------------------------ */
registerControl('editor', (ctx) => {
  const mount = h('div.wui-layout-editor');
  const editorApi = createEditor(mount, {
    value: ctx.value || '',
    height: ctx.def.height || 220,
    toolbar: ctx.def.toolbar === false ? false : (ctx.def.toolbar || 'full'),
    readOnly: Boolean(ctx.disabled || ctx.readOnly),
    placeholder: ctx.def.placeholder || '',
    showStatus: ctx.def.status !== false,
    onChange: ({ html }) => ctx.onChange(html, { input: true }),
  });
  return {
    el: mount,
    gridless: false,
    getValue: () => editorApi.getHTML(),
    setValue: (v) => editorApi.setHTML(v || ''),
    focus: () => editorApi.focus(),
    setDisabled: (flag) => editorApi.setReadOnly(Boolean(flag)),
    destroy: () => editorApi.destroy(),
    editor: editorApi,
  };
}, { label: '웹 에디터' });

registerControl('grid', (ctx) => {
  const mount = h('div.wui-layout-gridcontrol');
  const data = ctx.def.data || (ctx.options.data && ctx.options.data.grids && ctx.options.data.grids[ctx.def.dataKey]) || [];
  const gridApi = createGrid(mount, {
    columns: ctx.def.columns || [],
    data,
    height: ctx.def.height || 280,
    toolbar: ctx.def.toolbar !== false,
    search: ctx.def.search !== false,
    footer: ctx.def.footer !== false,
    virtual: ctx.def.virtual !== false,
    selectable: ctx.def.selectable !== false,
    checkboxColumn: ctx.def.checkboxColumn !== false,
    indexColumn: ctx.def.indexColumn !== false,
    statusColumn: Boolean(ctx.def.statusColumn),
    filterRow: Boolean(ctx.def.filterRow),
    tree: Boolean(ctx.def.tree),
    treeColumn: ctx.def.treeColumn || null,
    childrenKey: ctx.def.childrenKey || 'children',
    defaultExpandLevel: ctx.def.defaultExpandLevel ?? 0,
    indent: ctx.def.indent,
    title: ctx.def.title || '',
    onChange: () => ctx.onChange(gridApi.getData()),
    onSave: (rows) => ctx.onChange(rows),
    onExpand: ctx.def.onExpand,
  });
  return {
    el: mount,
    getValue: () => gridApi.getData(),
    setValue: (rows) => gridApi.setData(Array.isArray(rows) ? rows : []),
    focus: () => gridApi.viewport.focus(),
    setDisabled: () => {},
    destroy: () => gridApi.destroy(),
    grid: gridApi,
  };
}, { label: '그리드' });

registerControl('tree', (ctx) => {
  const mount = h('div.wui-layout-treecontrol');
  const data = ctx.def.data || (ctx.options.data && ctx.options.data.trees && ctx.options.data.trees[ctx.def.dataKey]) || [];
  const treeApi = createTree(mount, {
    data,
    checkable: ctx.def.checkable !== false,
    cascade: ctx.def.cascade !== false,
    showSearch: ctx.def.search !== false,
    showActions: ctx.def.actions !== false,
    defaultExpandLevel: ctx.def.expandLevel ?? 1,
    lazy: ctx.def.lazy || null,
    onCheck: () => ctx.onChange(treeApi.getChecked({ ids: true })),
    onSelect: (node) => ctx.onChange(treeApi.getChecked({ ids: true })),
  });
  return {
    el: mount,
    getValue: () => treeApi.getChecked({ ids: true }),
    setValue: (ids) => {
      const set = new Set((ids || []).map(String));
      treeApi.collapseAll();
      for (const nodeId of set) treeApi.setChecked(nodeId, true);
    },
    focus: () => treeApi.el.querySelector('.wui-tree-row')?.focus(),
    setDisabled: () => {},
    destroy: () => treeApi.destroy(),
    tree: treeApi,
  };
}, { label: '트리' });

registerControl('tree-grid', (ctx) => {
  const mount = h('div.wui-layout-treegrid');
  const split = h('div.wui-treegrid', { style: { display: 'grid', gap: '12px', gridTemplateColumns: ctx.def.treeWidth ? `${ctx.def.treeWidth}px 1fr` : '280px 1fr', alignItems: 'stretch' } });
  const treeMount = h('div.wui-treegrid-tree');
  const gridMount = h('div.wui-treegrid-grid');
  split.appendChild(treeMount);
  split.appendChild(gridMount);
  mount.appendChild(split);

  const treeData = ctx.def.treeData || (ctx.options.data && ctx.options.data.trees && ctx.options.data.trees[ctx.def.treeKey]) || ctx.def.data || [];
  const gridData = ctx.def.gridData || (ctx.options.data && ctx.options.data.grids && ctx.options.data.grids[ctx.def.gridKey]) || [];

  let current = isPlainObject(ctx.value) ? clone(ctx.value) : { tree: [], grid: [] };
  const emit = (patch = {}) => {
    current = { tree: treeApi.getChecked({ ids: true }), grid: gridApi.getData(), ...patch };
    ctx.onChange(current);
  };

  const treeApi = createTree(treeMount, {
    data: treeData,
    checkable: ctx.def.checkable !== false,
    cascade: ctx.def.cascade !== false,
    showSearch: ctx.def.treeSearch !== false,
    showActions: ctx.def.treeActions !== false,
    defaultExpandLevel: ctx.def.expandLevel ?? 1,
    onCheck: () => emit(),
    onSelect: (node) => {
      if (isFn(ctx.def.onTreeSelect)) ctx.def.onTreeSelect(node, { tree: treeApi, grid: gridApi, emit });
      emit();
    },
  });

  const gridApi = createGrid(gridMount, {
    columns: ctx.def.columns || [],
    data: Array.isArray(current.grid) && current.grid.length ? current.grid : gridData,
    height: ctx.def.height || 320,
    toolbar: ctx.def.toolbar !== false,
    search: ctx.def.search !== false,
    footer: ctx.def.footer !== false,
    virtual: ctx.def.virtual !== false,
    filterRow: Boolean(ctx.def.filterRow),
    statusColumn: ctx.def.statusColumn !== false,
    title: ctx.def.gridTitle || ctx.def.title || '',
    onChange: () => emit(),
    onSave: () => emit(),
  });

  if (Array.isArray(current.tree) && current.tree.length) {
    const set = new Set(current.tree.map(String));
    for (const nodeId of set) treeApi.setChecked(nodeId, true);
  }

  return {
    el: mount,
    getValue: () => ({ tree: treeApi.getChecked({ ids: true }), grid: gridApi.getData() }),
    setValue: (v) => {
      const val = isPlainObject(v) ? v : {};
      if (Array.isArray(val.tree)) {
        treeApi.collapseAll();
        const set = new Set(val.tree.map(String));
        for (const nodeId of set) treeApi.setChecked(nodeId, true);
      }
      if (Array.isArray(val.grid)) gridApi.setData(val.grid);
      current = { tree: treeApi.getChecked({ ids: true }), grid: gridApi.getData() };
    },
    focus: () => treeApi.el.querySelector('.wui-tree-row')?.focus(),
    setDisabled: () => {},
    destroy: () => { gridApi.destroy(); treeApi.destroy(); mount.remove(); },
    tree: treeApi,
    grid: gridApi,
  };
}, { label: '트리 그리드' });

/* ------------------------------ 콤보/스플리터 ------------------------------ */
function comboBase(ctx) {
  let current = ctx.value;
  let open = false;
  let disabled = Boolean(ctx.disabled || ctx.readOnly);
  const popupClass = ctx.def.popupClass || '';
  const wrap = h('div.wui-combo', { class: disabled ? 'is-disabled' : '' });
  const trigger = h('button.wui-combo-trigger', { type: 'button', disabled });
  const valueEl = h('span.wui-combo-value');
  const arrow = h('span.wui-combo-arrow', {}, '▼');
  trigger.append(valueEl, arrow);
  const popup = h('div.wui-combo-popup' + (popupClass ? '.' + popupClass : ''), { hidden: true });
  wrap.append(trigger, popup);

  function getOpts() { return normalizeOptions(ctx.def.options || [], null); }
  function close() {
    if (!open) return;
    open = false; wrap.classList.remove('is-open'); popup.hidden = true;
  }
  function syncValue() { /* overridden */ }
  function renderPopup() { /* overridden */ }
  function openPopup() {
    if (disabled) return;
    open = true; wrap.classList.add('is-open'); popup.hidden = false;
    renderPopup();
  }
  function toggle() { if (disabled) return; open ? close() : openPopup(); }

  trigger.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); trigger.focus(); }
    else if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) { e.preventDefault(); openPopup(); }
  });

  const onDoc = (e) => { if (open && !wrap.contains(e.target)) close(); };
  document.addEventListener('mousedown', onDoc);

  const api = {
    wrap, trigger, valueEl, popup, getOpts, close, openPopup, toggle,
    get current() { return current; },
    setCurrent(v, opts = {}) {
      current = v;
      syncValue();
      if (opts.emit !== false) ctx.onChange(v);
    },
    setSync(fn) { syncValue = fn; syncValue(); },
    setRender(fn) { renderPopup = fn; },
    setDisabled(flag) {
      disabled = Boolean(flag);
      wrap.classList.toggle('is-disabled', disabled);
      trigger.disabled = disabled;
      if (disabled) close();
    },
    destroy() { document.removeEventListener('mousedown', onDoc); wrap.remove(); },
  };
  return api;
}

registerControl('image-combo', (ctx) => {
  const c = comboBase(ctx);
  c.setSync(() => {
    const opts = c.getOpts();
    const sel = opts.find((o) => String(o.value) === String(c.current));
    c.valueEl.innerHTML = '';
    c.valueEl.classList.toggle('is-placeholder', !sel);
    if (!sel) { c.valueEl.textContent = ctx.def.placeholder || '선택'; return; }
    const src = sel.raw?.image || sel.raw?.img || sel.raw?.src || sel.raw?.icon;
    if (src) c.valueEl.appendChild(h('img.wui-combo-thumb', { src, alt: '' }));
    c.valueEl.appendChild(document.createTextNode(sel.label != null ? String(sel.label) : String(sel.value)));
  });
  c.setRender(() => {
    const opts = c.getOpts();
    c.popup.innerHTML = '';
    if (!opts.length) { c.popup.appendChild(h('div.wui-combo-empty', {}, '항목 없음')); return; }
    for (const opt of opts) {
      const selected = String(opt.value) === String(c.current);
      const src = opt.raw?.image || opt.raw?.img || opt.raw?.src || opt.raw?.icon;
      const btn = h('button.wui-combo-option', { type: 'button', class: selected ? 'is-selected' : '', disabled: opt.disabled });
      if (src) btn.appendChild(h('img.wui-combo-thumb', { src, alt: '' }));
      btn.appendChild(h('span', {}, opt.label != null ? String(opt.label) : String(opt.value)));
      btn.addEventListener('click', () => {
        if (opt.disabled) return;
        c.setCurrent(opt.value);
        c.close();
        c.trigger.focus();
      });
      c.popup.appendChild(btn);
    }
  });
  return {
    el: c.wrap,
    getValue: () => c.current ?? null,
    setValue: (v) => c.setCurrent(v, { emit: false }),
    focus: () => c.trigger.focus(),
    setDisabled: (f) => c.setDisabled(f),
    destroy: () => c.destroy(),
  };
}, { label: '이미지 콤보' });

registerControl('checkbox-combo', (ctx) => {
  const c = comboBase(ctx);
  if (!Array.isArray(c.current)) c.current = Array.isArray(ctx.value) ? [...ctx.value] : [];
  c.setSync(() => {
    const opts = c.getOpts();
    const vals = Array.isArray(c.current) ? c.current.map(String) : [];
    const selected = opts.filter((o) => vals.includes(String(o.value)));
    c.valueEl.innerHTML = '';
    c.valueEl.classList.toggle('is-placeholder', !selected.length);
    if (!selected.length) { c.valueEl.textContent = ctx.def.placeholder || '선택'; return; }
    const text = selected.length <= 2
      ? selected.map((o) => (o.label != null ? o.label : o.value)).join(', ')
      : selected.length + '개 선택';
    c.valueEl.textContent = String(text);
  });
  c.setRender(() => {
    const opts = c.getOpts();
    const vals = new Set((Array.isArray(c.current) ? c.current : []).map(String));
    c.popup.innerHTML = '';
    if (!opts.length) { c.popup.appendChild(h('div.wui-combo-empty', {}, '항목 없음')); return; }
    for (const opt of opts) {
      const checked = vals.has(String(opt.value));
      const btn = h('button.wui-combo-option', { type: 'button', class: checked ? 'is-selected' : '', disabled: opt.disabled });
      const cb = h('input', { type: 'checkbox', checked, tabindex: '-1' });
      cb.disabled = Boolean(opt.disabled);
      btn.append(h('span.wui-check', {}, cb, h('span', {}, opt.label != null ? String(opt.label) : String(opt.value))));
      btn.addEventListener('click', () => {
        if (opt.disabled) return;
        const next = new Set((Array.isArray(c.current) ? c.current : []).map(String));
        if (next.has(String(opt.value))) next.delete(String(opt.value)); else next.add(String(opt.value));
        const mapped = opts.filter((o) => next.has(String(o.value))).map((o) => o.value);
        c.setCurrent(mapped);
        c.renderPopup();
      });
      c.popup.appendChild(btn);
    }
  });
  c.setSync(() => {
    const opts = c.getOpts();
    const vals = Array.isArray(c.current) ? c.current.map(String) : [];
    const selected = opts.filter((o) => vals.includes(String(o.value)));
    c.valueEl.innerHTML = '';
    c.valueEl.classList.toggle('is-placeholder', !selected.length);
    if (!selected.length) { c.valueEl.textContent = ctx.def.placeholder || '선택'; return; }
    const text = selected.length <= 2
      ? selected.map((o) => (o.label != null ? o.label : o.value)).join(', ')
      : selected.length + '개 선택';
    c.valueEl.textContent = String(text);
  });
  return {
    el: c.wrap,
    getValue: () => (Array.isArray(c.current) ? [...c.current] : []),
    setValue: (v) => c.setCurrent(Array.isArray(v) ? [...v] : (v == null || v === '' ? [] : [v]), { emit: false }),
    focus: () => c.trigger.focus(),
    setDisabled: (f) => c.setDisabled(f),
    destroy: () => c.destroy(),
  };
}, { label: '체크박스 콤보' });

registerControl('tree-combo', (ctx) => {
  ctx.def.popupClass = 'wui-combo-tree';
  const c = comboBase(ctx);
  let treeApi = null;
  let suppressSelect = false;
  const data = ctx.def.data || (ctx.options.data && ctx.options.data.trees && ctx.options.data.trees[ctx.def.dataKey]) || ctx.def.options || [];
  function findLabel(nodes, id) {
    for (const n of nodes || []) {
      const nid = n.id != null ? String(n.id) : null;
      if (nid === String(id)) return n.label || n.text || nid;
      const found = findLabel(n.children, id);
      if (found) return found;
    }
    return null;
  }
  c.setSync(() => {
    c.valueEl.innerHTML = '';
    const has = c.current != null && c.current !== '';
    c.valueEl.classList.toggle('is-placeholder', !has);
    if (!has) { c.valueEl.textContent = ctx.def.placeholder || '선택'; return; }
    let label = null;
    if (treeApi && isFn(treeApi.getNode)) {
      try { const node = treeApi.getNode(c.current); if (node) label = node.label; } catch (_) {}
    }
    if (!label) label = findLabel(Array.isArray(data) ? data : [], c.current);
    c.valueEl.textContent = label || String(c.current);
  });
  c.setRender(() => {
    c.popup.innerHTML = '';
    const mount = h('div');
    c.popup.appendChild(mount);
    try { if (treeApi) treeApi.destroy(); } catch (_) {}
    suppressSelect = false;
    treeApi = createTree(mount, {
      data: Array.isArray(data) ? data : [],
      checkable: false,
      showSearch: ctx.def.search !== false,
      showActions: false,
      defaultExpandLevel: ctx.def.expandLevel ?? 1,
      onSelect: (node) => {
        if (!node) return;
        if (suppressSelect) {
          c.setCurrent(node.id, { emit: false });
          return;
        }
        c.setCurrent(node.id);
        c.close();
        c.trigger.focus();
      },
    });
    if (c.current != null && c.current !== '') {
      try {
        suppressSelect = true;
        if (isFn(treeApi.expandTo)) treeApi.expandTo(c.current);
        if (isFn(treeApi.select)) treeApi.select(c.current);
      } catch (_) {}
      suppressSelect = false;
    }
  });
  return {
    el: c.wrap,
    getValue: () => (c.current ?? null),
    setValue: (v) => c.setCurrent(v, { emit: false }),
    focus: () => c.trigger.focus(),
    setDisabled: (f) => c.setDisabled(f),
    destroy: () => { try { if (treeApi) treeApi.destroy(); } catch (_) {} c.destroy(); },
    tree: () => treeApi,
  };
}, { label: '트리 콤보' });

registerControl('splitter', (ctx) => {
  const orientation = ctx.def.orientation === 'vertical' ? 'vertical' : 'horizontal';
  let ratio = typeof ctx.def.ratio === 'number' ? ctx.def.ratio : (typeof ctx.value === 'number' ? ctx.value : 0.5);
  ratio = Math.min(0.9, Math.max(0.1, ratio));
  const minSize = Number(ctx.def.minSize || ctx.def.min || 60);
  const gutterSize = Number(ctx.def.gutterSize || ctx.def.gutter || 8);
  const height = ctx.def.height || 220;
  const panesDef = Array.isArray(ctx.def.panes) ? ctx.def.panes : [ctx.def.pane1 || ctx.def.first || {}, ctx.def.pane2 || ctx.def.second || {}];

  const root = h('div.wui-splitter' + (orientation === 'vertical' ? '.is-vertical' : '.is-horizontal'), {
    style: { height: typeof height === 'number' ? (height + 'px') : String(height) },
  });

  function paneContent(def) {
    const p = h('div.wui-splitter-pane');
    if (def && def.title) p.appendChild(h('div.wui-splitter-pane-title', {}, def.title));
    if (def && def.html) {
      const ctn = h('div'); ctn.innerHTML = String(def.html); p.appendChild(ctn);
    } else if (def && def.text) {
      p.appendChild(h('div', {}, String(def.text)));
    } else if (def && isFn(def.render)) {
      const out = def.render({ def, ctx });
      if (out instanceof Node) p.appendChild(out);
      else if (out != null) { const ctn = h('div'); ctn.innerHTML = String(out); p.appendChild(ctn); }
    }
    return p;
  }

  const pane1 = paneContent(panesDef[0] || {});
  const pane2 = paneContent(panesDef[1] || {});
  const gutter = h('div.wui-splitter-gutter', { role: 'separator', 'aria-orientation': orientation, tabindex: '0', title: '드래그하여 크기 조절' });
  root.append(pane1, gutter, pane2);

  function apply() {
    const total = orientation === 'horizontal' ? root.clientWidth : root.clientHeight;
    const avail = Math.max(0, total - gutterSize);
    if (avail <= 0) return;
    let first = Math.round(avail * ratio);
    first = Math.max(minSize, Math.min(avail - minSize, first));
    const second = Math.max(0, avail - first);
    if (orientation === 'horizontal') {
      pane1.style.flex = '0 0 ' + first + 'px';
      pane1.style.width = first + 'px';
      pane2.style.flex = '1 1 ' + second + 'px';
      pane2.style.width = '';
      pane1.style.height = '100%';
      pane2.style.height = '100%';
    } else {
      pane1.style.flex = '0 0 ' + first + 'px';
      pane1.style.height = first + 'px';
      pane2.style.flex = '1 1 ' + second + 'px';
      pane2.style.height = '';
      pane1.style.width = '100%';
      pane2.style.width = '100%';
    }
    gutter.style.flex = '0 0 ' + gutterSize + 'px';
  }

  requestAnimationFrame(apply);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => apply());
    ro.observe(root);
  }

  let dragging = false;
  function onMove(e) {
    if (!dragging) return;
    const rect = root.getBoundingClientRect();
    const total = orientation === 'horizontal' ? rect.width : rect.height;
    const avail = Math.max(1, total - gutterSize);
    let pos = orientation === 'horizontal' ? (e.clientX - rect.left) : (e.clientY - rect.top);
    pos = Math.max(minSize, Math.min(avail - minSize, pos));
    ratio = pos / avail;
    apply();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    ctx.onChange(Number(ratio.toFixed(4)));
  }
  gutter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    root.classList.add('is-dragging');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  gutter.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if ((orientation === 'horizontal' && e.key === 'ArrowLeft') || (orientation === 'vertical' && e.key === 'ArrowUp')) {
      e.preventDefault();
      ratio = Math.max(0.1, ratio - step); apply(); ctx.onChange(Number(ratio.toFixed(4)));
    } else if ((orientation === 'horizontal' && e.key === 'ArrowRight') || (orientation === 'vertical' && e.key === 'ArrowDown')) {
      e.preventDefault();
      ratio = Math.min(0.9, ratio + step); apply(); ctx.onChange(Number(ratio.toFixed(4)));
    }
  });

  return {
    el: root,
    getValue: () => Number(ratio.toFixed(4)),
    setValue: (v) => { if (typeof v === 'number' && isFinite(v)) { ratio = Math.min(0.9, Math.max(0.1, v)); apply(); } },
    focus: () => gutter.focus(),
    setDisabled: () => {},
    destroy: () => { try { if (ro) ro.disconnect(); } catch (_) {} root.remove(); },
  };
}, { label: '스플리터' });

/* ------------------------------ 사용자 정의 ------------------------------ */
registerControl('custom', (ctx) => {
  let current = ctx.value;
  const el = h('div.wui-layout-custom');
  const commit = (next) => { current = next; ctx.onChange(next); };
  const out = isFn(ctx.def.render) ? ctx.def.render({
    def: ctx.def,
    name: ctx.name,
    value: current,
    label: ctx.label,
    options: ctx.options,
    commit,
  }) : null;
  if (out instanceof Node) el.appendChild(out);
  else if (typeof out === 'string') el.innerHTML = out;
  return {
    el,
    getValue: () => (isFn(ctx.def.getValue) ? ctx.def.getValue() : current),
    setValue: (v) => { current = v; if (isFn(ctx.def.setValue)) ctx.def.setValue(v); },
    focus: () => el.querySelector('input,select,textarea,button')?.focus(),
    setDisabled: (flag) => { el.querySelectorAll('input,select,textarea,button').forEach((n) => { n.disabled = Boolean(flag); }); },
    destroy: () => el.remove(),
  };
}, { label: '사용자 정의' });

export const controlRegistry = { registerControl, getControlFactory, listControls };
export default controlRegistry;
