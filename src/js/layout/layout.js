/*!
 * WUI - layout/layout.js
 * JSON 화면 배치 엔진.
 *  - items / groups 기반 flow 그리드 (12 컬럼)
 *  - absolute 모드(pos) 지원
 *  - 컨트롤 레지스트리 확장 (registerControl)
 *  - 입력값 수집 / 검증 / 조건부 표시(visibleWhen) / 데이터 바인딩(bind)
 *
 * const form = WUI.createLayout('#form', schema, { values, onChange, onSubmit });
 */
import {
  h, $$, uid, clamp, clone, isFn, isPlainObject, validateValue, getPath, setPath,
  normalizeOptions, escapeHtml,
} from '../core/util.js';
import { Emitter } from '../core/emitter.js';
import { getControlFactory } from './controls.js';

const DEFAULTS = {
  cols: 12,
  gap: 12,
  mode: 'flow',        // 'flow' | 'absolute'
  rowHeight: 36,
  labelPosition: 'top', // 'top' | 'inline'
  readOnly: false,
  values: null,
  data: null,
  onChange: null,
  onAction: null,
  onSubmit: null,
  imageUploader: null,
  actions: null,
};

const BARE_TYPES = new Set(['html', 'heading', 'divider', 'spacer', 'button', 'hidden', 'checkbox', 'switch']);
const NO_VALUE_TYPES = new Set(['html', 'heading', 'divider', 'spacer', 'button', 'static']);
const WIDE_TYPES = new Set(['editor', 'grid', 'tree', 'html', 'divider', 'heading']);

let layoutSeq = 0;

export function createLayout(mount, schema = {}, options = {}) {
  const target = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!target) throw new Error('[wui:layout] 마운트 대상이 없습니다.');
  const opts = { ...DEFAULTS, ...options };
  const emitter = new Emitter();
  const id = opts.id || uid('wui-layout');
  const st = {
    schema: null,
    values: {},
    errors: {},
    controls: new Map(),
    fields: new Map(),
    destroyed: false,
  };

  const rootEl = h('div.wui-layout', { 'data-wui-layout': id });

  function append(parent, nodes) {
    for (const node of nodes.flat(Infinity)) if (node) parent.appendChild(node);
  }

  /* ------------------------------ 스키마 해석 ------------------------------ */
  function groupsOf(sc) {
    if (Array.isArray(sc.groups) && sc.groups.length) return sc.groups;
    return [{ title: null, items: sc.items || [] }];
  }

  function itemType(item) {
    return item.type || (item.render ? 'custom' : 'text');
  }

  function rulesOf(def) {
    const rules = [];
    if (def.rules) rules.push(...(Array.isArray(def.rules) ? def.rules : [def.rules]));
    if (def.required && !rules.some((r) => (typeof r === 'string' ? r : r.type) === 'required')) {
      rules.unshift({ type: 'required', message: def.requiredMessage });
    }
    if (def.pattern && !rules.some((r) => (typeof r === 'string' ? r : r.type) === 'pattern')) rules.push({ type: 'pattern', value: def.pattern });
    if (def.min !== undefined && ['number', 'range'].includes(itemType(def))) rules.push({ type: 'min', value: def.min });
    if (def.max !== undefined && ['number', 'range'].includes(itemType(def))) rules.push({ type: 'max', value: def.max });
    return rules;
  }

  function dynamicDef(def) {
    const merged = { ...def, ...(def.props || {}) };
    if (def.options && !merged.options) merged.options = def.options;
    return merged;
  }

  function initialValue(def, name) {
    if (opts.values && Object.prototype.hasOwnProperty.call(opts.values, name)) return clone(opts.values[name]);
    if (opts.data && def.bind) {
      const found = getPath(opts.data, def.bind);
      if (found !== undefined) return clone(found);
    }
    if (def.value !== undefined) return clone(def.value);
    if (def.default !== undefined) return isFn(def.default) ? def.default() : clone(def.default);
    switch (itemType(def)) {
      case 'checkbox':
      case 'switch':
        return false;
      case 'checkbox-group':
      case 'checkboxes':
        return [];
      case 'range':
      case 'slider':
        return def.min ?? 0;
      case 'number':
        return null;
      default:
        return '';
    }
  }

  /* ------------------------------ 조건 ------------------------------ */
  function matchCondition(cond) {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every(matchCondition);
    if (isFn(cond)) return Boolean(cond(currentValues()));
    const field = cond.field || cond.name;
    if (!field) return true;
    const actual = st.values[field];
    const expected = cond.value;
    switch (cond.op || 'eq') {
      case 'eq': return String(actual ?? '') === String(expected ?? '');
      case 'ne': return String(actual ?? '') !== String(expected ?? '');
      case 'in': return (Array.isArray(expected) ? expected : [expected]).map(String).includes(String(actual ?? ''));
      case 'nin': return !(Array.isArray(expected) ? expected : [expected]).map(String).includes(String(actual ?? ''));
      case 'gt': return Number(actual) > Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'empty':
      case 'isEmpty': return actual === '' || actual === null || actual === undefined || (Array.isArray(actual) && !actual.length);
      case 'notEmpty': return !(actual === '' || actual === null || actual === undefined || (Array.isArray(actual) && !actual.length));
      case 'contains': return Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? '').includes(String(expected ?? ''));
      case 'truthy': return Boolean(actual);
      case 'falsy': return !actual;
      default: return true;
    }
  }

  function evaluateVisibility() {
    for (const [name, meta] of st.fields) {
      const { def, el } = meta;
      const visible = !def.hidden && (def.visibleWhen === undefined ? true : matchCondition(def.visibleWhen));
      el.hidden = !visible;
      el.classList.toggle('is-hidden', !visible);
      el.style.display = visible ? '' : 'none';
      meta.visible = visible;
      const disabled = def.disabledWhen ? matchCondition(def.disabledWhen) : false;
      if (visible && disabled) meta.control?.setDisabled?.(true);
      else meta.control?.setDisabled?.(opts.readOnly || Boolean(def.disabled));
      meta.disabled = disabled || opts.readOnly || Boolean(def.disabled);
    }
  }

  /* ------------------------------ 렌더 ------------------------------ */
  function buildField(def, sectionCols, index) {
    const type = itemType(def);
    const name = def.name || `field_${index}`;
    const factory = getControlFactory(type)
      || (def.render ? getControlFactory('custom') : getControlFactory('text'));
    if (!factory) throw new Error(`[wui:layout] 알 수 없는 컨트롤 타입: ${type}`);

    if (st.controls.has(name)) {
      console.warn(`[wui:layout] 중복된 name: ${name}`);
      return null;
    }
    const value = initialValue(def, name);
    const rules = rulesOf(def);
    const hasLabel = !BARE_TYPES.has(type) && def.label !== false;
    const spanRaw = def.span ?? (WIDE_TYPES.has(type) ? sectionCols : Math.min(6, sectionCols));
    const span = clamp(spanRaw === 'full' ? sectionCols : Number(spanRaw) || sectionCols, 1, sectionCols);
    const spanSmRaw = def.spanSm ?? (WIDE_TYPES.has(type) ? sectionCols : sectionCols);
    const spanSm = clamp(spanSmRaw === 'full' ? sectionCols : Number(spanSmRaw) || sectionCols, 1, sectionCols);

    const fieldEl = h('div.wui-field', {
      'data-name': name,
      'data-type': type,
      class: [
        'wui-layout-field',
        BARE_TYPES.has(type) ? 'is-bare' : '',
        ['checkbox', 'switch'].includes(type) ? 'is-inline-control' : '',
        `is-type-${type}`,
      ].filter(Boolean).join(' '),
      style: {
        '--wui-span': span,
        '--wui-span-sm': spanSm,
        ...(def.hidden || type === 'hidden' ? { display: 'none' } : {}),
      },
    });
    if (st.schema.mode === 'absolute' && def.pos) {
      const pos = def.pos || {};
      fieldEl.style.gridArea = `${pos.y ?? 1} / ${pos.x ?? 1} / span ${pos.h ?? 1} / span ${pos.w ?? span}`;
      fieldEl.style.setProperty('--wui-span', span);
    }

    const controlMount = h('div.wui-field-body.wui-layout-control');
    const errorEl = h('div.wui-field-error', { role: 'alert' });

    if (hasLabel) {
      const req = rules.some((r) => (typeof r === 'string' ? r : r.type) === 'required');
      const labelEl = h('label.wui-field-label', { for: `${id}-${name}` },
        def.label !== undefined ? def.label : name,
        req ? h('span.wui-req', { title: '필수' }, '*') : null,
        def.labelHint ? h('span.wui-field-labelhint', {}, def.labelHint) : null);
      fieldEl.appendChild(labelEl);
    } else if (def.label && !['checkbox', 'switch', 'hidden'].includes(type)) {
      fieldEl.appendChild(h('div.wui-field-label', {}, def.label));
    }

    fieldEl.appendChild(controlMount);

    const control = factory.factory({
      def,
      name,
      value,
      label: def.label !== undefined ? String(def.label) : name,
      disabled: Boolean(def.disabled) || opts.readOnly,
      readOnly: Boolean(def.readOnly) || opts.readOnly,
      options: opts,
      onChange: (nextValue, changeOpts = {}) => handleControlChange(name, nextValue, changeOpts),
    });
    controlMount.appendChild(control.el);
    if (control.el.id === '') control.el.id = `${id}-${name}`;
    // label for 연결
    if (!control.el.id) control.el.id = `${id}-${name}`;
    const labelFor = fieldEl.querySelector('label.wui-field-label');
    if (labelFor) labelFor.setAttribute('for', control.el.id);

    if (control.setDisabled && (def.disabled || opts.readOnly)) control.setDisabled(true);

    if (def.help) fieldEl.appendChild(h('div.wui-field-help', {}, def.help));
    fieldEl.appendChild(errorEl);

    const meta = {
      name, def, type, el: fieldEl, fieldEl, controlMount, errorEl, control, visible: !def.hidden,
      disabled: Boolean(def.disabled) || opts.readOnly, rules, value,
    };
    st.controls.set(name, control);
    st.fields.set(name, meta);
    if (!NO_VALUE_TYPES.has(type)) st.values[name] = value;
    return fieldEl;
  }

  function buildSection(group, groupIndex) {
    const sc = st.schema;
    const cols = Number(group.cols || sc.cols || 12);
    const gap = Number(group.gap ?? sc.gap ?? 12);
    const items = group.items || [];
    const section = h('section.wui-layout-section', { 'data-section': group.id || `section-${groupIndex}` });
    if (group.title || group.description || group.aside) {
      const head = h('div.wui-layout-sectionhead', {},
        h('div', {},
          group.title ? h('h3.wui-layout-sectiontitle', {}, group.title) : null,
          group.description ? h('p.wui-layout-sectiondesc', {}, group.description) : null),
        group.aside ? h('div.wui-layout-aside', { html: group.aside }) : null);
      section.appendChild(head);
    }
    const grid = h('div.wui-layout-grid', {
      style: {
        '--wui-cols': cols,
        '--wui-gap-custom': `${gap}px`,
        ...(sc.mode === 'absolute' ? { gridAutoRows: `${sc.rowHeight || 36}px` } : {}),
      },
    });
    if (sc.mode === 'absolute') grid.classList.add('is-absolute');
    items.forEach((item, index) => {
      if (item.group === true) return;
      const def = dynamicDef(item);
      const field = buildField(def, cols, `${section.dataset.section}-${index}`);
      if (field) grid.appendChild(field);
    });
    section.appendChild(grid);
    return section;
  }

  function actionButton(action, index) {
    const btn = h('button.wui-btn', {
      type: 'button',
      class: action.variant ? `wui-btn-${action.variant}` : '',
      disabled: Boolean(action.disabled),
      'data-action': action.action || action.id || `action-${index}`,
    }, action.label || action.text || '실행');
    btn.addEventListener('click', () => runAction(action));
    return btn;
  }

  function buildActions(position) {
    const sc = st.schema;
    const list = (opts.actions || sc.actions || []).filter((a) => (a.position || 'bottom') === position);
    if (!list.length) return null;
    const bar = h('div.wui-layout-actions', { class: `is-${position}` });
    list.forEach((action, index) => bar.appendChild(actionButton(action, index)));
    return bar;
  }

  function render() {
    const sc = st.schema;
    // 기존 컨트롤 정리
    for (const control of st.controls.values()) {
      try { control.destroy(); } catch (_) { /* noop */ }
    }
    st.controls.clear();
    st.fields.clear();
    st.values = {};
    st.errors = {};
    rootEl.innerHTML = '';
    rootEl.className = `wui-layout${sc.mode === 'absolute' ? ' is-absolute' : ''}`;
    rootEl.classList.toggle('is-readonly', Boolean(opts.readOnly));

    if (sc.title || sc.description) {
      rootEl.appendChild(h('div.wui-layout-head', {},
        h('div', {},
          sc.title ? h('h2.wui-layout-title', {}, sc.title) : null,
          sc.description ? h('p.wui-layout-desc', {}, sc.description) : null),
        buildActions('top')));
    } else {
      const top = buildActions('top');
      if (top) rootEl.appendChild(top);
    }

    const body = h('div.wui-layout-body');
    groupsOf(sc).forEach((group, index) => body.appendChild(buildSection(group, index)));
    rootEl.appendChild(body);

    const bottom = buildActions('bottom');
    if (bottom) rootEl.appendChild(bottom);

    evaluateVisibility();
  }

  /* ------------------------------ 값 처리 ------------------------------ */
  function currentValues() {
    for (const [name, meta] of st.fields) {
      if (NO_VALUE_TYPES.has(meta.type)) continue;
      try {
        const value = meta.control.getValue();
        st.values[name] = value;
      } catch (_) { /* noop */ }
    }
    return st.values;
  }

  function getValues({ visibleOnly = false } = {}) {
    currentValues();
    if (!visibleOnly) return { ...st.values };
    const out = {};
    for (const [name, meta] of st.fields) {
      if (NO_VALUE_TYPES.has(meta.type)) continue;
      if (meta.visible === false) continue;
      out[name] = st.values[name];
    }
    return out;
  }

  function setValues(values = {}, { silent = false } = {}) {
    for (const [name, value] of Object.entries(values)) {
      const meta = st.fields.get(name);
      if (!meta) continue;
      meta.control?.setValue?.(value);
      st.values[name] = value;
    }
    evaluateVisibility();
    if (!silent) {
      emitter.emit('values', getValues());
      refreshErrors();
    }
  }

  function applyData(data) {
    const out = {};
    for (const meta of st.fields.values()) {
      if (meta.def.bind && data) {
        const value = getPath(data, meta.def.bind);
        if (value !== undefined) out[meta.name] = value;
      }
    }
    setValues(out);
    return out;
  }

  function reset() {
    const out = {};
    for (const meta of st.fields.values()) {
      out[meta.name] = initialValue(meta.def, meta.name);
    }
    setValues(out, { silent: true });
    st.errors = {};
    refreshErrors();
    evaluateVisibility();
    emitter.emit('reset', getValues());
  }

  function handleControlChange(name, value, changeOpts = {}) {
    const meta = st.fields.get(name);
    if (!meta) return;
    st.values[name] = value;
    if (meta.def.bind && opts.data) setPath(opts.data, meta.def.bind, value);
    if (!changeOpts.input) {
      validateField(meta, { silent: false });
    }
    evaluateVisibility();
    const payload = { name, value, values: getValues(), def: meta.def };
    emitter.emit('change', payload);
    if (isFn(opts.onChange)) opts.onChange(payload);
  }

  /* ------------------------------ 검증 ------------------------------ */
  function validateField(meta, { silent = false } = {}) {
    if (!meta.visible) return null;
    const rules = meta.rules;
    if (!rules.length) {
      setFieldError(meta, null);
      return null;
    }
    let value;
    try { value = meta.control.getValue(); } catch (_) { value = st.values[meta.name]; }
    const label = meta.def.label !== undefined ? String(meta.def.label) : meta.name;
    const message = validateValue(value, rules, { label, row: getValues() });
    setFieldError(meta, message);
    if (!silent && message) emitter.emit('error', { name: meta.name, message });
    return message;
  }

  function setFieldError(meta, message) {
    if (message) {
      st.errors[meta.name] = message;
      meta.fieldEl.classList.add('is-invalid');
      meta.errorEl.textContent = message;
      meta.controlMount.querySelectorAll('input,select,textarea').forEach((n) => n.setAttribute('aria-invalid', 'true'));
    } else {
      delete st.errors[meta.name];
      meta.fieldEl.classList.remove('is-invalid');
      meta.errorEl.textContent = '';
      meta.controlMount.querySelectorAll('input,select,textarea').forEach((n) => n.removeAttribute('aria-invalid'));
    }
  }

  function refreshErrors() {
    for (const meta of st.fields.values()) {
      if (st.errors[meta.name]) setFieldError(meta, st.errors[meta.name]);
      else setFieldError(meta, null);
    }
  }

  function validate({ silent = false } = {}) {
    const errors = [];
    st.errors = {};
    for (const meta of st.fields.values()) {
      if (!meta.visible) continue;
      const message = validateField(meta, { silent: true });
      if (message) errors.push({ name: meta.name, message, def: meta.def });
    }
    if (!silent && errors.length) {
      const first = st.fields.get(errors[0].name);
      first?.fieldEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      first?.control?.focus?.();
      emitter.emit('invalid', errors);
    }
    emitter.emit('validate', errors);
    return errors;
  }

  function setErrors(errors) {
    st.errors = {};
    const list = Array.isArray(errors) ? errors
      : Object.entries(errors || {}).map(([name, message]) => ({ name, message }));
    for (const item of list) {
      const meta = st.fields.get(item.name);
      if (!meta) continue;
      st.errors[item.name] = item.message;
      setFieldError(meta, item.message);
    }
    refreshErrors();
    return list;
  }

  function submit() {
    const errors = validate();
    if (errors.length) {
      emitter.emit('submitinvalid', { errors, values: getValues() });
      return { valid: false, errors, values: getValues() };
    }
    const payload = { values: getValues(), schema: st.schema };
    emitter.emit('submit', payload);
    if (isFn(opts.onSubmit)) opts.onSubmit(payload);
    return { valid: true, values: payload.values, errors: [] };
  }

  /* ------------------------------ 액션 ------------------------------ */
  function runAction(action) {
    const name = action.action || action.id || 'custom';
    if (name === 'submit') { submit(); return; }
    if (name === 'reset') { reset(); return; }
    const payload = { action: name, def: action, values: getValues(), schema: st.schema };
    emitter.emit('action', payload);
    if (isFn(opts.onAction)) opts.onAction(payload);
  }

  rootEl.addEventListener('wui-action', (e) => {
    const detail = e.detail || {};
    runAction({ action: detail.action, def: detail.def || {} });
  });

  /* ------------------------------ 공개 API ------------------------------ */
  function setSchema(nextSchema, { values } = {}) {
    st.schema = {
      cols: 12,
      gap: 12,
      mode: 'flow',
      ...nextSchema,
    };
    if (values) opts.values = { ...(opts.values || {}), ...values };
    render();
    evaluateVisibility();
    return api;
  }

  function getControl(name) {
    return st.controls.get(name) || null;
  }

  function getField(name) {
    return st.fields.get(name) || null;
  }

  function focus(name) {
    const meta = st.fields.get(name);
    if (!meta) return;
    if (!meta.visible) return;
    meta.fieldEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    meta.control?.focus?.();
  }

  function destroy() {
    st.destroyed = true;
    for (const control of st.controls.values()) {
      try { control.destroy(); } catch (_) { /* noop */ }
    }
    st.controls.clear();
    st.fields.clear();
    emitter.destroy();
    rootEl.remove();
  }

  const api = {
    el: rootEl,
    id,
    setSchema,
    getSchema: () => st.schema,
    getValues,
    setValues,
    applyData,
    reset,
    validate,
    submit,
    setErrors,
    getErrors: () => ({ ...st.errors }),
    getControl,
    getField,
    focus,
    refresh: () => { evaluateVisibility(); refreshErrors(); },
    refreshVisibility: evaluateVisibility,
    runAction,
    on: (type, fn) => emitter.on(type, fn),
    off: (type, fn) => emitter.off(type, fn),
    destroy,
    get values() { return getValues(); },
    controls: st.controls,
  };

  if (target.tagName === 'TEXTAREA' || target.tagName === 'DIV' || target.tagName === 'SECTION') {
    target.innerHTML = '';
    target.appendChild(rootEl);
  } else {
    target.appendChild(rootEl);
  }
  setSchema(schema);
  emitter.emit('ready', api);
  return api;
}

export const layout = { create: createLayout };
export default createLayout;
