/*!
 * WUI - core/ajax.js
 * fetch 기반 AJAX 래퍼.
 * - JSON 자동 파싱, 타임아웃, 에러 객체, 요청 로그
 * - mock 등록: 서버가 없거나(file://) 네트워크 실패 시 자동 대체
 */
export class AjaxError extends Error {
  constructor(message, { url, status = 0, body = null, cause = null } = {}) {
    super(message);
    this.name = 'AjaxError';
    this.url = url;
    this.status = status;
    this.body = body;
    this.cause = cause;
  }
}

const defaults = {
  baseUrl: '',
  timeout: 20000,
  /** 'fallback' | true | false  — true: 항상 mock, fallback: 실패 시 mock, false: mock 무시 */
  mock: 'fallback',
  headers: { Accept: 'application/json' },
};

const mocks = [];
let logHandlers = [];
let history = [];
let requestCount = 0;

function normalizeBase(base, url) {
  if (!base || /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return base.replace(/\/$/, '') + url;
  return `${base.replace(/\/$/, '')}/${url.replace(/^\.?\//, '')}`;
}

export function buildUrl(url, params) {
  const target = normalizeBase(defaults.baseUrl, url);
  if (!params) return target;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach((item) => query.append(k, item));
    else query.append(k, v);
  }
  const qs = query.toString();
  if (!qs) return target;
  return target + (target.includes('?') ? '&' : '?') + qs;
}

function patternToRegExp(pattern) {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
}

function findMock(method, url) {
  for (const entry of mocks) {
    if (entry.method && entry.method !== method) continue;
    if (entry.pattern.test(url) || entry.pattern.test(url.split('?')[0])) return entry;
  }
  return null;
}

async function resolveMock(entry, info) {
  let result = typeof entry.value === 'function' ? await entry.value(info) : entry.value;
  if (result && typeof result === 'object' && 'body' in result && ('status' in result || 'delay' in result)) {
    if (result.delay) await new Promise((r) => setTimeout(r, result.delay));
    if (result.status && result.status >= 400) {
      throw new AjaxError(`모의 응답 오류 (${result.status})`, {
        url: info.url, status: result.status, body: result.body,
      });
    }
    return result.body;
  }
  if (typeof entry.delay === 'number') await new Promise((r) => setTimeout(r, entry.delay));
  return result;
}

function logRequest(entry) {
  history = [entry, ...history].slice(0, 60);
  for (const handler of logHandlers) {
    try { handler(entry); } catch (err) { console.error('[wui:ajax:log]', err); }
  }
}

function mockAvailable(method, url) {
  return Boolean(findMock(method, url));
}

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.method='GET']
 * @param {object|BodyInit} [opts.data]  GET 이면 쿼리, 그 외는 JSON 본문
 * @param {object} [opts.params]
 * @param {'json'|'text'|'blob'|'arrayBuffer'} [opts.responseType='json']
 * @param {number} [opts.timeout]
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.raw]  응답 객체 그대로 반환
 */
export async function request(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const target = buildUrl(url, opts.params);
  const started = performance.now();
  const id = ++requestCount;
  const useMockOnly = opts.mock === true || (opts.mock !== false && defaults.mock === true);
  const allowMock = useMockOnly || (opts.mock !== false && defaults.mock === 'fallback') || opts.mock === 'fallback';
  const mock = useMockOnly || (allowMock && opts.mock !== false) ? findMock(method, target) : null;
  const info = { url: target, method, id };

  if (useMockOnly && mock) {
    try {
      const body = await resolveMock(mock, info);
      logRequest({
        id, method, url: target, status: 200, ok: true, ms: Math.round(performance.now() - started),
        source: 'mock', size: JSON.stringify(body ?? null).length, at: new Date(),
      });
      return body;
    } catch (err) {
      logRequest({
        id, method, url: target, status: err.status || 500, ok: false, ms: Math.round(performance.now() - started),
        source: 'mock', error: err.message, at: new Date(),
      });
      throw err;
    }
  }

  const timeout = opts.timeout ?? defaults.timeout;
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeout > 0
    ? setTimeout(() => { timedOut = true; controller.abort(); }, timeout)
    : null;
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const headers = { ...defaults.headers, ...(opts.headers || {}) };
  const init = {
    method,
    headers,
    credentials: opts.credentials || 'same-origin',
    cache: opts.cache || 'no-store',
    signal: controller.signal,
  };

  let bodyPreview = null;
  if (opts.data !== undefined && opts.data !== null && method !== 'GET' && method !== 'HEAD') {
    if (typeof opts.data === 'string' || opts.data instanceof FormData || opts.data instanceof Blob) {
      init.body = opts.data;
      if (opts.data instanceof FormData) delete headers['Content-Type'];
    } else {
      init.body = JSON.stringify(opts.data);
      headers['Content-Type'] = 'application/json;charset=utf-8';
    }
    try { bodyPreview = typeof init.body === 'string' ? init.body.slice(0, 300) : '[binary]'; } catch (_) { /* noop */ }
  }

  try {
    const response = await fetch(target, init);
    if (timer) clearTimeout(timer);
    if (!response.ok) {
      let body = null;
      try { body = await response.text(); } catch (_) { /* noop */ }
      throw new AjaxError(`요청 실패 (HTTP ${response.status})`, {
        url: target, status: response.status, body,
      });
    }
    const responseType = opts.responseType || 'json';
    let data;
    if (opts.raw) data = response;
    else if (responseType === 'json') {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    } else if (responseType === 'blob') data = await response.blob();
    else if (responseType === 'arrayBuffer') data = await response.arrayBuffer();
    else data = await response.text();

    logRequest({
      id, method, url: target, status: response.status, ok: true,
      ms: Math.round(performance.now() - started), source: 'network',
      size: typeof data === 'string' ? data.length : (data ? 1 : 0),
      requestBody: bodyPreview, at: new Date(),
    });
    return data;
  } catch (err) {
    if (timer) clearTimeout(timer);
    const aborted = err.name === 'AbortError';
    const reason = timedOut ? '요청 시간이 초과되었습니다.' : aborted ? '요청이 취소되었습니다.' : err.message;

    // 네트워크 실패 시 모의 데이터로 폴백 (file:// 로 열었을 때 데모가 동작하도록)
    if (mock && !aborted) {
      try {
        const body = await resolveMock(mock, info);
        logRequest({
          id, method, url: target, status: 200, ok: true, ms: Math.round(performance.now() - started),
          source: 'mock-fallback', size: JSON.stringify(body ?? null).length,
          note: reason, at: new Date(),
        });
        return body;
      } catch (mockErr) {
        /* 아래 공통 에러 처리 */
      }
    }
    logRequest({
      id, method, url: target, status: err.status || 0, ok: false,
      ms: Math.round(performance.now() - started), source: 'network',
      error: reason, requestBody: bodyPreview, at: new Date(),
    });
    if (err instanceof AjaxError) throw err;
    throw new AjaxError(reason, { url: target, status: 0, cause: err });
  }
}

export const get = (url, opts = {}) => request(url, { ...opts, method: 'GET' });
export const post = (url, data, opts = {}) => request(url, { ...opts, method: 'POST', data });
export const put = (url, data, opts = {}) => request(url, { ...opts, method: 'PUT', data });
export const del = (url, opts = {}) => request(url, { ...opts, method: 'DELETE' });
export const getJSON = (url, opts) => get(url, opts);

/**
 * 모의 응답 등록.
 * ajax.mock('/api/menu', {items: []})
 * ajax.mock({ pattern: '/api/layers/*', value: (info) => ({...}), delay: 300, method: 'GET' })
 */
export function mock(patternOrMap, value, options = {}) {
  if (typeof patternOrMap === 'string') {
    mocks.push({
      pattern: patternToRegExp(patternOrMap),
      raw: patternOrMap,
      value,
      delay: options.delay,
      method: options.method ? options.method.toUpperCase() : null,
    });
    return;
  }
  if (Array.isArray(patternOrMap)) { patternOrMap.forEach((item) => mock(item.pattern || item.url, item.value, item)); return; }
  if (patternOrMap && typeof patternOrMap === 'object') {
    for (const [key, val] of Object.entries(patternOrMap)) mock(key, val, options);
  }
}

export function configure(options = {}) {
  Object.assign(defaults, options);
  if (options.headers) defaults.headers = { ...defaults.headers, ...options.headers };
}

export function onLog(handler) {
  logHandlers.push(handler);
  return () => { logHandlers = logHandlers.filter((h) => h !== handler); };
}

export function getHistory() {
  return history.slice();
}

export function clearHistory() {
  history = [];
}

export function listMocks() {
  return mocks.map((m) => ({ pattern: m.raw, delay: m.delay }));
}

export function reset() {
  mocks.length = 0;
  history = [];
  logHandlers = [];
  requestCount = 0;
  Object.assign(defaults, {
    baseUrl: '', timeout: 20000, mock: 'fallback', headers: { Accept: 'application/json' },
  });
}

export const ajax = {
  request, get, post, put, delete: del, getJSON, mock, configure, onLog,
  getHistory, clearHistory, listMocks, reset, buildUrl, mockAvailable,
};
