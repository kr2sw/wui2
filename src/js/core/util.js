/*!
 * WUI (Web UI Kit) - core/util.js
 * 순수 바닐라 자바스크립트 유틸리티 모음. 외부 의존성 없음.
 */
export const VERSION = '1.0.0';

/* ------------------------------------------------------------------ *
 * 타입 / 기본
 * ------------------------------------------------------------------ */
export const isFn = (v) => typeof v === 'function';
export const isStr = (v) => typeof v === 'string';
export const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
export const isObj = (v) => v !== null && typeof v === 'object';
export const isPlainObject = (v) => {
  if (!isObj(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
export const isArray = Array.isArray;
export const isEmpty = (v) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* fallthrough */ }
  }
  return JSON.parse(JSON.stringify(value));
}

export function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return clone(source);
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

let _seq = 0;
export function uid(prefix = 'wui') {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * 하이픈 태그/클래스 축약을 지원하는 엘리먼트 생성기.
 * h('div.wui-box#main', { class: 'x', on: { click: fn }, style: { '--wui-span': 6 } }, 'text', childNode)
 */
export function h(tag, attrs, ...children) {
  let tagName = 'div';
  const classes = [];
  let id = null;
  const m = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(String(tag || 'div'));
  if (m) {
    if (m[1]) tagName = m[1];
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, mark, name) => {
      if (mark === '.') classes.push(name);
      else id = name;
      return '';
    });
  }
  const node = document.createElement(tagName);
  if (id) node.id = id;

  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  attrs = attrs || {};

  const classList = [...classes];
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === null || raw === undefined || raw === false) continue;
    const value = raw;
    switch (key) {
      case 'class':
      case 'className':
        classList.push(...(Array.isArray(value) ? value : String(value).split(/\s+/)).filter(Boolean));
        break;
      case 'style':
        if (isStr(value)) node.style.cssText = value;
        else if (isObj(value)) {
          for (const [sk, sv] of Object.entries(value)) {
            if (sv === null || sv === undefined) continue;
            if (sk.startsWith('--')) node.style.setProperty(sk, String(sv));
            else node.style[sk] = sv;
          }
        }
        break;
      case 'dataset':
        for (const [dk, dv] of Object.entries(value)) {
          if (dv !== null && dv !== undefined) node.dataset[dk] = String(dv);
        }
        break;
      case 'html':
        node.innerHTML = String(value);
        break;
      case 'text':
        node.textContent = String(value);
        break;
      case 'on':
        if (isObj(value)) {
          for (const [ev, fn] of Object.entries(value)) {
            if (isFn(fn)) node.addEventListener(ev, fn);
          }
        }
        break;
      case 'attrs':
        if (isObj(value)) for (const [ak, av] of Object.entries(value)) node.setAttribute(ak, String(av));
        break;
      case 'ref':
        if (isFn(value)) value(node);
        break;
      case 'value':
        node.value = value === undefined ? '' : value;
        break;
      case 'checked':
      case 'selected':
      case 'disabled':
      case 'readOnly':
      case 'required':
      case 'multiple':
        node[key] = Boolean(value);
        break;
      default:
        if (key.startsWith('on') && isFn(value)) node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, String(value));
    }
  }
  if (classList.length) node.className = classList.join(' ');

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** 이벤트 위임. selector 대신 함수를 넘길 수도 있다. */
export function on(root, type, selector, handler, options) {
  if (isFn(selector)) {
    root.addEventListener(type, selector, handler);
    return () => root.removeEventListener(type, selector, handler);
  }
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler.call(target, event, target);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

export function raf(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  return setTimeout(fn, 16);
}
export function cancelRaf(id) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

export function debounce(fn, wait = 200) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, wait);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  return debounced;
}

export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn(...args); }, remain);
    }
  };
}

export function observeResize(node, callback) {
  if (typeof ResizeObserver === 'undefined') {
    const handler = () => callback(node.getBoundingClientRect());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }
  const ro = new ResizeObserver(() => callback(node.getBoundingClientRect()));
  ro.observe(node);
  return () => ro.disconnect();
}

export function toggleClass(node, name, force) {
  if (!node) return;
  if (force === undefined) node.classList.toggle(name);
  else node.classList.toggle(name, Boolean(force));
}

export function setStyleVars(node, vars) {
  if (!node) return;
  for (const [k, v] of Object.entries(vars || {})) {
    if (v === null || v === undefined || v === '') node.style.removeProperty(k);
    else node.style.setProperty(k, String(v));
  }
}

/* ------------------------------------------------------------------ *
 * 날짜 / 시간 / 숫자
 * ------------------------------------------------------------------ */
export const pad2 = (n) => String(n).padStart(2, '0');

export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return `${formatDate(d)} ${formatTime(d)}`;
}

export const todayStr = () => formatDate(new Date());
export const nowTimeStr = () => formatTime(new Date());
export const nowDateTimeStr = () => `${todayStr()}T${nowTimeStr()}`;

export function addDays(value, days) {
  const d = toDate(value) || new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isNaN(n) ? null : n;
}

export function formatNumber(value, digits = 0) {
  const n = parseNumber(value);
  if (n === null) return '';
  return n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function cmp(a, b, type = 'text') {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  switch (type) {
    case 'number': {
      const na = parseNumber(a);
      const nb = parseNumber(b);
      if (na === null && nb === null) return 0;
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    }
    case 'date':
    case 'time':
    case 'datetime': {
      const da = toDate(a);
      const db = toDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    }
    case 'boolean':
      return (a ? 1 : 0) - (b ? 1 : 0);
    default:
      return String(a).localeCompare(String(b), 'ko', { numeric: true, sensitivity: 'base' });
  }
}

/* ------------------------------------------------------------------ *
 * 오브젝트 패스 (데이터 바인딩: 'user.name')
 * ------------------------------------------------------------------ */
export function getPath(obj, path, fallback = undefined) {
  if (!path) return obj;
  let cur = obj;
  for (const key of String(path).split('.')) {
    if (cur === null || cur === undefined) return fallback;
    cur = cur[key];
  }
  return cur === undefined ? fallback : cur;
}

export function setPath(obj, path, value) {
  const keys = String(path).split('.');
  let cur = obj;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) cur[key] = value;
    else {
      if (!isObj(cur[key])) cur[key] = {};
      cur = cur[key];
    }
  });
  return obj;
}

/* ------------------------------------------------------------------ *
 * 검증 (그리드 / 레이아웃 공용)
 * ------------------------------------------------------------------ */
export function parseRules(rules) {
  if (!rules) return [];
  return (Array.isArray(rules) ? rules : [rules]).filter(Boolean);
}

function ruleMessage(rule, fallback) {
  return (isStr(rule) ? '' : rule.message) || fallback;
}

export function validateValue(value, rules, ctx = {}) {
  const list = parseRules(rules);
  const label = ctx.label || '값';
  const empty = isEmpty(value);

  for (const rule of list) {
    if (isFn(rule)) {
      const r = rule(value, ctx.row, ctx);
      if (r === false) return `${label}이(가) 올바르지 않습니다.`;
      if (isStr(r)) return r;
      continue;
    }
    const type = isStr(rule) ? rule : rule.type;
    const opt = isStr(rule) ? {} : rule;
    switch (type) {
      case 'required':
        if (empty) return ruleMessage(rule, `${label}은(는) 필수입니다.`);
        break;
      case 'min':
        if (!empty && Number(value) < Number(opt.value ?? opt.min)) {
          return ruleMessage(rule, `${label}은(는) ${opt.value ?? opt.min} 이상이어야 합니다.`);
        }
        break;
      case 'max':
        if (!empty && Number(value) > Number(opt.value ?? opt.max)) {
          return ruleMessage(rule, `${label}은(는) ${opt.value ?? opt.max} 이하여야 합니다.`);
        }
        break;
      case 'minLength':
        if (!empty && String(value).length < Number(opt.value ?? opt.length)) {
          return ruleMessage(rule, `${label}은(는) ${opt.value ?? opt.length}자 이상 입력하세요.`);
        }
        break;
      case 'maxLength':
        if (!empty && String(value).length > Number(opt.value ?? opt.length)) {
          return ruleMessage(rule, `${label}은(는) ${opt.value ?? opt.length}자 이하로 입력하세요.`);
        }
        break;
      case 'pattern': {
        if (empty) break;
        const re = opt.value instanceof RegExp ? opt.value : new RegExp(opt.value ?? opt.pattern ?? '.*');
        if (!re.test(String(value))) return ruleMessage(rule, `${label} 형식이 올바르지 않습니다.`);
        break;
      }
      case 'email':
        if (empty) break;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
          return ruleMessage(rule, '이메일 형식이 올바르지 않습니다.');
        }
        break;
      case 'number':
        if (empty) break;
        if (parseNumber(value) === null) return ruleMessage(rule, `${label}은(는) 숫자여야 합니다.`);
        break;
      case 'custom': {
        const fn = opt.validate || opt.fn;
        if (!isFn(fn)) break;
        const r = fn(value, ctx.row, ctx);
        if (r === false) return ruleMessage(rule, `${label}이(가) 올바르지 않습니다.`);
        if (isStr(r)) return r;
        break;
      }
      default:
        break;
    }
  }
  return null;
}

export function normalizeOptions(options, row) {
  let list = isFn(options) ? options(row) : options;
  if (!list) return [];
  if (isPlainObject(list) && !Array.isArray(list)) {
    list = Object.entries(list).map(([value, label]) => ({ value, label }));
  }
  return (Array.isArray(list) ? list : []).map((item) => {
    if (isPlainObject(item)) {
      return {
        value: item.value !== undefined ? item.value : item.id,
        label: item.label !== undefined ? item.label : item.text,
        disabled: Boolean(item.disabled),
        raw: item,
      };
    }
    return { value: item, label: String(item), disabled: false, raw: item };
  });
}

/* ------------------------------------------------------------------ *
 * 파일 / 저장소 / 다운로드
 * ------------------------------------------------------------------ */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsText(file);
  });
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch (_) { /* noop */ }
  },
};

export function download(filename, content, mime = 'application/json;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) { /* noop */ }
  ta.remove();
  return Promise.resolve();
}

export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(columns, rows) {
  const head = columns.map((c) => csvEscape(c.title ?? c.key)).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(',')).join('\r\n');
  return `${head}\r\n${body}`;
}
