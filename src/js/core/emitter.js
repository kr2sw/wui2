/*!
 * WUI - core/emitter.js
 * 아주 작은 이벤트 이미터. 모든 컴포넌트가 동일한 on/off/once/emit API 를 갖도록 사용.
 */
export class Emitter {
  constructor() {
    this._listeners = new Map();
  }

  /** @returns {() => void} 해제 함수 */
  on(type, handler) {
    if (typeof handler !== 'function') return () => {};
    const list = this._listeners.get(type) || [];
    list.push(handler);
    this._listeners.set(type, list);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    if (!type) { this._listeners.clear(); return; }
    if (!handler) { this._listeners.delete(type); return; }
    const list = this._listeners.get(type) || [];
    this._listeners.set(type, list.filter((fn) => fn !== handler));
  }

  emit(type, payload) {
    const list = this._listeners.get(type);
    if (list) {
      for (const handler of list.slice()) {
        try { handler(payload); } catch (err) { console.error(`[wui:${type}]`, err); }
      }
    }
    const all = this._listeners.get('*');
    if (all) {
      for (const handler of all.slice()) {
        try { handler({ type, payload }); } catch (err) { console.error('[wui:*]', err); }
      }
    }
    return this;
  }

  destroy() {
    this._listeners.clear();
  }
}
