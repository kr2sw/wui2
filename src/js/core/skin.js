/*!
 * WUI - core/skin.js
 * 스킨(색상 테마 / 모양 / 밀도) 관리. CSS 변수 + data 속성 기반이라 CSS 로도 확장 가능.
 * 외부 호출: WUI.skin.setTheme('green'), WUI.skin.setShape({ radius: 10, borderWidth: 2 })
 */
import { storage, isStr, isObj, clone } from './util.js';

const STORAGE_KEY = 'wui.skin';

/** 테마 정의: 이름, 라벨, 대표색(스와치), CSS 변수 */
export const THEMES = {
  blue: {
    label: '블루', color: '#2f6fed',
    vars: {
      '--wui-primary': '#2f6fed', '--wui-primary-hover': '#255fd4', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#e8efff', '--wui-primary-weak-fg': '#1c4fc4',
      '--wui-accent': '#0ea5e9',
    },
  },
  indigo: {
    label: '인디고', color: '#4f46e5',
    vars: {
      '--wui-primary': '#4f46e5', '--wui-primary-hover': '#4338ca', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#eceafe', '--wui-primary-weak-fg': '#4038c8', '--wui-accent': '#8b5cf6',
    },
  },
  green: {
    label: '그린', color: '#0f9d58',
    vars: {
      '--wui-primary': '#0f9d58', '--wui-primary-hover': '#0b8349', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#e5f7ee', '--wui-primary-weak-fg': '#0a7a45', '--wui-accent': '#22c55e',
    },
  },
  teal: {
    label: '틸', color: '#0d9488',
    vars: {
      '--wui-primary': '#0d9488', '--wui-primary-hover': '#0f766e', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#e0f5f2', '--wui-primary-weak-fg': '#0b6b62', '--wui-accent': '#14b8a6',
    },
  },
  purple: {
    label: '퍼플', color: '#9333ea',
    vars: {
      '--wui-primary': '#9333ea', '--wui-primary-hover': '#7e22ce', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#f3e8ff', '--wui-primary-weak-fg': '#7623c0', '--wui-accent': '#c084fc',
    },
  },
  orange: {
    label: '오렌지', color: '#ea580c',
    vars: {
      '--wui-primary': '#ea580c', '--wui-primary-hover': '#c2410c', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#ffedd5', '--wui-primary-weak-fg': '#b3400a', '--wui-accent': '#f97316',
    },
  },
  red: {
    label: '레드', color: '#dc2626',
    vars: {
      '--wui-primary': '#dc2626', '--wui-primary-hover': '#b91c1c', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#fee2e2', '--wui-primary-weak-fg': '#a61b1b', '--wui-accent': '#f87171',
    },
  },
  slate: {
    label: '슬레이트', color: '#475569',
    vars: {
      '--wui-primary': '#475569', '--wui-primary-hover': '#334155', '--wui-primary-fg': '#ffffff',
      '--wui-primary-weak': '#e2e8f0', '--wui-primary-weak-fg': '#334155', '--wui-accent': '#64748b',
    },
  },
  dark: {
    label: '다크', color: '#0f172a', dark: true,
    vars: {
      '--wui-primary': '#60a5fa', '--wui-primary-hover': '#93c5fd', '--wui-primary-fg': '#0b1220',
      '--wui-primary-weak': '#1e293b', '--wui-primary-weak-fg': '#bfdbfe', '--wui-accent': '#38bdf8',
      '--wui-bg': '#0b1220', '--wui-surface': '#111a2b', '--wui-surface-2': '#16213a',
      '--wui-fg': '#e6edf8', '--wui-muted': '#93a4bf',
      '--wui-border': '#25324a', '--wui-border-strong': '#354563',
      '--wui-hover': '#1b2942', '--wui-active': '#22334f',
      '--wui-editor-bg': '#0e1728', '--wui-grid-header-bg': '#16213a',
      '--wui-grid-stripe': '#0f1929', '--wui-shadow-color': 'rgba(0,0,0,.5)',
    },
  },
  midnight: {
    label: '미드나잇', color: '#312e81', dark: true,
    vars: {
      '--wui-primary': '#a5b4fc', '--wui-primary-hover': '#c7d2fe', '--wui-primary-fg': '#161436',
      '--wui-primary-weak': '#262450', '--wui-primary-weak-fg': '#c7d2fe', '--wui-accent': '#f472b6',
      '--wui-bg': '#0d0b22', '--wui-surface': '#151232', '--wui-surface-2': '#1c1840',
      '--wui-fg': '#eae7ff', '--wui-muted': '#a49fd0',
      '--wui-border': '#2b2757', '--wui-border-strong': '#3c3775',
      '--wui-hover': '#211d47', '--wui-active': '#2a2556',
      '--wui-editor-bg': '#120f2c', '--wui-grid-header-bg': '#1b1740',
      '--wui-grid-stripe': '#131030', '--wui-shadow-color': 'rgba(0,0,0,.55)',
    },
  },
};

/** 모양 프리셋 */
export const SHAPES = {
  sharp: { label: '각진', vars: { borderRadius: '0px', radiusSm: '0px', radiusLg: '0px', shadow: 'none' } },
  soft: { label: '부드럽게', vars: { borderRadius: '6px', radiusSm: '4px', radiusLg: '10px', shadow: 'sm' } },
  round: { label: '둥글게', vars: { borderRadius: '12px', radiusSm: '8px', radiusLg: '18px', shadow: 'md' } },
  pill: { label: '캡슐', vars: { borderRadius: '999px', radiusSm: '999px', radiusLg: '999px', shadow: 'sm' } },
};

export const DENSITIES = {
  compact: { label: '좁게', vars: { space: '8px', controlH: '28px', rowH: '30px', fontSize: '12.5px' } },
  normal: { label: '보통', vars: { space: '12px', controlH: '34px', rowH: '36px', fontSize: '13.5px' } },
  comfortable: { label: '넓게', vars: { space: '16px', controlH: '40px', rowH: '44px', fontSize: '14px' } },
};

const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px rgba(15,23,42,.08), 0 1px 3px rgba(15,23,42,.06)',
  md: '0 4px 12px rgba(15,23,42,.10), 0 2px 4px rgba(15,23,42,.06)',
  lg: '0 12px 32px rgba(15,23,42,.16), 0 4px 8px rgba(15,23,42,.08)',
};

const state = {
  theme: 'blue',
  shape: 'soft',
  density: 'normal',
  overrides: { radius: null, borderWidth: null, shadow: null },
  borders: true,
};

let targets = [];
let listeners = [];
let styleEl = null;
let customThemes = {};

function ensureStyleEl() {
  if (typeof document === 'undefined') return null;
  if (styleEl && styleEl.isConnected) return styleEl;
  styleEl = document.createElement('style');
  styleEl.id = 'wui-skin-runtime';
  document.head.appendChild(styleEl);
  return styleEl;
}

function cssForTheme(name, def) {
  const vars = Object.entries(def.vars || {}).map(([k, v]) => `${k}:${v};`).join('');
  return `[data-wui-theme="${name}"]{${vars}}`;
}

export function registerTheme(name, definition = {}) {
  const def = {
    label: definition.label || name,
    color: definition.color || '#64748b',
    dark: Boolean(definition.dark),
    vars: { ...(definition.vars || {}) },
  };
  THEMES[name] = def;
  customThemes[name] = def;
  const style = ensureStyleEl();
  if (style) style.textContent += `\n${cssForTheme(name, def)}`;
  return def;
}

export function registerShape(name, definition = {}) {
  SHAPES[name] = { label: definition.label || name, vars: { ...(definition.vars || {}) } };
  return SHAPES[name];
}

function writeVars(target, vars) {
  if (!target || !target.style) return;
  for (const [rawKey, value] of Object.entries(vars || {})) {
    if (value === null || value === undefined || value === '') continue;
    const key = rawKey.startsWith('--') ? rawKey : `--wui-${rawKey.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
    target.style.setProperty(key, String(value));
  }
}

function applyTo(target, opts = {}) {
  if (!target) return;
  const theme = opts.theme || state.theme;
  const shape = opts.shape || state.shape;
  const density = opts.density || state.density;
  target.setAttribute('data-wui', '');
  target.setAttribute('data-wui-theme', theme);
  target.setAttribute('data-wui-shape', shape);
  target.setAttribute('data-wui-density', density);
  target.classList.toggle('wui-no-border', opts.borders === false || state.borders === false);
  applyShapeOverrides(target);
}

function applyShapeOverrides(target) {
  const shape = SHAPES[state.shape] || SHAPES.soft;
  const vars = {};
  const radius = state.overrides.radius ?? shape.vars.borderRadius;
  const radiusSm = state.overrides.radius != null ? `${Math.max(0, state.overrides.radius - 2)}px` : shape.vars.radiusSm;
  const radiusLg = state.overrides.radius != null ? `${state.overrides.radius + 4}px` : shape.vars.radiusLg;
  if (radius) {
    vars['--wui-radius'] = isStr(radius) && /^\d+$/.test(radius) ? `${radius}px` : radius;
    vars['--wui-radius-sm'] = radiusSm;
    vars['--wui-radius-lg'] = radiusLg;
  }
  if (state.overrides.shadow) vars['--wui-shadow'] = SHADOWS[state.overrides.shadow] || state.overrides.shadow;
  else if (shape.vars.shadow) vars['--wui-shadow'] = SHADOWS[shape.vars.shadow] || shape.vars.shadow;
  if (state.overrides.borderWidth !== undefined && state.overrides.borderWidth !== null) {
    vars['--wui-border-width'] = `${state.overrides.borderWidth}px`;
  }
  writeVars(target, vars);
}

function persist() {
  storage.set(STORAGE_KEY, {
    theme: state.theme, shape: state.shape, density: state.density,
    overrides: state.overrides, borders: state.borders,
  });
}

function notify() {
  const payload = current();
  for (const fn of listeners.slice()) {
    try { fn(payload); } catch (err) { console.error('[wui:skin]', err); }
  }
}

export function init(options = {}) {
  const saved = options.persist === false ? null : storage.get(STORAGE_KEY, null);
  const merged = { ...state, ...(saved || {}), ...(options.defaults || {}) };
  state.theme = merged.theme || 'blue';
  state.shape = merged.shape || 'soft';
  state.density = merged.density || 'normal';
  state.overrides = { ...state.overrides, ...(merged.overrides || {}) };
  state.borders = merged.borders !== false;
  targets = [];
  addTarget(options.target || document.documentElement);
  if (options.persist !== false) persist();
  notify();
  return current();
}

export function addTarget(target) {
  if (!target || targets.includes(target)) return;
  targets.push(target);
  applyTo(target);
}

export function removeTarget(target) {
  targets = targets.filter((t) => t !== target);
}

export function apply(root, options = {}) {
  if (isObj(root) && root.nodeType) { applyTo(root, options); return; }
  if (isObj(root)) { init(root); return; }
  for (const target of targets) applyTo(target, options);
}

export function setTheme(name, options = {}) {
  if (!THEMES[name]) {
    console.warn(`[wui:skin] 알 수 없는 테마: ${name}`);
    return current();
  }
  state.theme = name;
  if (options.target) applyTo(options.target, { theme: name });
  else apply();
  if (options.persist !== false) persist();
  notify();
  return current();
}

export function setShape(shape, options = {}) {
  if (isStr(shape) && SHAPES[shape]) state.shape = shape;
  else if (isObj(shape)) {
    if (shape.name && SHAPES[shape.name]) state.shape = shape.name;
    if ('radius' in shape) state.overrides.radius = shape.radius === null ? null : Number(shape.radius);
    if ('borderWidth' in shape) state.overrides.borderWidth = shape.borderWidth === null ? null : Number(shape.borderWidth);
    if ('shadow' in shape) state.overrides.shadow = shape.shadow;
    if ('borders' in shape) state.borders = Boolean(shape.borders);
  }
  if (options.target) applyTo(options.target);
  else apply();
  if (options.persist !== false) persist();
  notify();
  return current();
}

export function setDensity(density, options = {}) {
  if (!DENSITIES[density]) return current();
  state.density = density;
  if (options.target) applyTo(options.target);
  else apply();
  if (options.persist !== false) persist();
  notify();
  return current();
}

export function toggleBorders(force) {
  state.borders = force === undefined ? !state.borders : Boolean(force);
  apply();
  persist();
  notify();
  return current();
}

export function current() {
  return {
    theme: state.theme,
    shape: state.shape,
    density: state.density,
    overrides: { ...state.overrides },
    borders: state.borders,
    dark: Boolean((THEMES[state.theme] || {}).dark),
  };
}

export function listThemes() {
  return Object.entries(THEMES).map(([name, def]) => ({
    name, label: def.label, color: def.color, dark: Boolean(def.dark),
  }));
}

export function listShapes() {
  return Object.entries(SHAPES).map(([name, def]) => ({ name, label: def.label }));
}

export function listDensities() {
  return Object.entries(DENSITIES).map(([name, def]) => ({ name, label: def.label }));
}

export function onChange(handler) {
  listeners.push(handler);
  return () => { listeners = listeners.filter((fn) => fn !== handler); };
}

export function reset() {
  state.theme = 'blue';
  state.shape = 'soft';
  state.density = 'normal';
  state.overrides = { radius: null, borderWidth: null, shadow: null };
  state.borders = true;
  apply();
  persist();
  notify();
  return current();
}

/* --------------------------- UI 헬퍼 (선택) --------------------------- */

export function createThemePicker(container, options = {}) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return null;
  const render = () => {
    el.innerHTML = '';
    el.classList.add('wui-swatches');
    for (const theme of listThemes()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wui-swatch' + (current().theme === theme.name ? ' is-active' : '');
      btn.title = theme.label;
      btn.setAttribute('aria-label', theme.label);
      btn.dataset.theme = theme.name;
      btn.innerHTML = `<span class="wui-swatch-color" style="background:${theme.color}"></span><span class="wui-swatch-label">${theme.label}</span>`;
      btn.addEventListener('click', () => setTheme(theme.name));
      el.appendChild(btn);
    }
  };
  render();
  const off = onChange(render);
  return { el, refresh: render, destroy: off };
}

export function createShapePicker(container, options = {}) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return null;
  const render = () => {
    el.innerHTML = '';
    el.classList.add('wui-shape-picker');
    for (const shape of listShapes()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wui-btn wui-btn-sm' + (current().shape === shape.name ? ' is-active' : '');
      btn.textContent = shape.label;
      btn.addEventListener('click', () => setShape(shape.name));
      el.appendChild(btn);
    }
    const radiusWrap = document.createElement('label');
    radiusWrap.className = 'wui-shape-radius';
    radiusWrap.innerHTML = `<span>모서리</span><input type="range" min="0" max="24" step="1" value="${current().overrides.radius ?? ''}">`;
    const range = radiusWrap.querySelector('input');
    range.value = current().overrides.radius ?? 6;
    range.addEventListener('input', () => setShape({ radius: Number(range.value) }));
    el.appendChild(radiusWrap);

    const borderWrap = document.createElement('label');
    borderWrap.className = 'wui-shape-border';
    borderWrap.innerHTML = `<input type="checkbox" ${current().borders ? 'checked' : ''}> <span>테두리</span>`;
    borderWrap.querySelector('input').addEventListener('change', (e) => toggleBorders(e.target.checked));
    el.appendChild(borderWrap);
  };
  render();
  const off = onChange(render);
  return { el, refresh: render, destroy: off };
}

export const skin = {
  init, apply, addTarget, removeTarget,
  setTheme, setShape, setDensity, toggleBorders, current,
  listThemes, listShapes, listDensities, onChange, reset,
  registerTheme, registerShape, createThemePicker, createShapePicker,
  THEMES, SHAPES, DENSITIES, SHADOWS,
};
