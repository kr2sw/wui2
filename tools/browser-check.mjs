/*!
 * WUI - tools/browser-check.mjs (개발용)
 * Edge/Chrome 헤드리스 + CDP 로 데모를 실제 실행해 콘솔 오류와 렌더 결과를 점검한다.
 *
 * 사용:
 *   node serve.mjs            (별도 터미널)
 *   node tools/browser-check.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = process.env.BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = process.env.APP_URL || 'http://localhost:4173/';
const DOC_URL = process.env.DOC_URL || new URL('DOC/', APP_URL).href;
const PORT = Number(process.env.CDP_PORT || 9333);
const SHOT_DIR = process.env.SHOT_DIR || join(tmpdir(), 'wui-shots');
const PROFILE = join(tmpdir(), `wui-cdp-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
let ws;
let seq = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 20000);
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, userGesture: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || 'evaluate failed');
  return res.result?.value;
}

async function waitFor(expression, { timeout = 10000, interval = 200 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(interval);
  }
  return false;
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = join(SHOT_DIR, `${name}.png`);
  await writeFile(file, Buffer.from(data, 'base64'));
  console.log(`  · screenshot ${file}`);
}

async function openTarget(url) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`target 생성 실패: ${res.status}`);
  return res.json();
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const browser = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    let version = null;
    for (let i = 0; i < 60; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        version = await res.json();
        break;
      } catch (_) { await sleep(150); }
    }
    if (!version) throw new Error('브라우저 디버깅 포트에 연결하지 못했습니다.');
    console.log(`[browser] ${version.Browser}`);

    const target = await openTarget(APP_URL);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        const text = `exception: ${details.exception?.description || details.text}`;
        problems.push(text);
        console.error('  !', text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
        const text = message.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        if (!/favicon/i.test(text)) {
          problems.push(`console.${message.params.type}: ${text}`);
          console.error('  !', `console.${message.params.type}: ${text}`);
        }
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        const { text, url } = message.params.entry;
        if (!/favicon/i.test(url || '') && !/favicon/i.test(text || '')) {
          problems.push(`log: ${text} ${url || ''}`);
          console.error('  !', `log: ${text} ${url || ''}`);
        }
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: APP_URL });
    await sleep(3000);

    /* ------------------------------ 통합 앱 ------------------------------ */
    console.log('[check] 통합 앱');
    if (!await waitFor("document.querySelectorAll('.wui-app-menu .wui-app-menuitem').length >= 6", { timeout: 12000 })) {
      problems.push('앱 메뉴가 렌더링되지 않았습니다.');
    }
    if (!await waitFor("document.querySelectorAll('.wui-app-pane.is-active, .wui-app-pane:not([hidden])').length >= 1", { timeout: 12000 })) {
      // pane 자체는 hidden 속성으로 토글된다
    }
    const appState = await evaluate(`(() => {
      const tabs = document.querySelectorAll('.wui-app-tab').length;
      const menu = document.querySelectorAll('.wui-app-menu .wui-app-menuitem').length;
      const pane = document.querySelector('.wui-app-pane:not([hidden])');
      const gridRows = pane ? pane.querySelectorAll('.wui-grid-row').length : 0;
      const treeRows = pane ? pane.querySelectorAll('.wui-tree-row').length : 0;
      const active = document.querySelector('.wui-app-tab.is-active .wui-app-tablabel')?.textContent || '';
      const ajax = document.querySelector('.wui-app-ajaxbadge')?.textContent || '';
      const visibleHidden = pane ? [...pane.querySelectorAll('[hidden]')]
        .filter((el) => getComputedStyle(el).display !== 'none').length : 0;
      return { tabs, menu, gridRows, treeRows, active, ajax, visibleHidden, loaded: pane?.dataset.loaded || '' };
    })()`);
    console.log('  ', JSON.stringify(appState));
    const paneText = await evaluate(`(() => {
      const pane = document.querySelector('.wui-app-pane:not([hidden])');
      return pane ? pane.innerText.slice(0, 600) : '(no pane)';
    })()`);
    console.log('   pane:', paneText.replace(/\n+/g, ' | '));
    if (appState.menu < 6) problems.push('메뉴 항목 수가 부족합니다.');
    if (appState.gridRows < 5) problems.push('대시보드 그리드 행이 렌더링되지 않았습니다.');
    if (appState.treeRows < 3) problems.push('대시보드 트리가 렌더링되지 않았습니다.');
    if (!/AJAX [1-9]/.test(appState.ajax)) problems.push('AJAX 요청 로그가 없습니다.');
    if (appState.visibleHidden > 0) problems.push(`hidden 요소 ${appState.visibleHidden}개가 화면에 남아 있습니다.`);
    await shot('01-app-dashboard');

    // 주문 입력 메뉴 열기
    const opened = await evaluate(`(() => {
      const item = document.querySelector('.wui-app-menuitem[data-id="order-form"] .wui-app-menubtn');
      if (!item) return false;
      item.click();
      return true;
    })()`);
    if (!opened) problems.push('주문 입력 메뉴를 찾지 못했습니다.');
    await waitFor("!!document.querySelector('.wui-app-pane[data-menu=\"order-form\"] .wui-layout')", { timeout: 12000 });
    await sleep(800);
    const formState = await evaluate(`(() => {
      const pane = document.querySelector('.wui-app-pane[data-menu="order-form"]');
      return {
        fields: pane ? pane.querySelectorAll('.wui-field').length : 0,
        inputs: pane ? pane.querySelectorAll('input,select,textarea').length : 0,
        tabs: document.querySelectorAll('.wui-app-tab').length,
        loaded: pane ? pane.dataset.loaded : '',
      };
    })()`);
    console.log('  ', JSON.stringify(formState));
    if (formState.fields < 10) problems.push('주문 입력 폼 필드가 부족합니다.');
    await shot('02-app-form');

    // 검증 실패 동작 (주문번호 비우고 저장)
    const validateResult = await evaluate(`(() => {
      const pane = document.querySelector('.wui-app-pane[data-menu="order-form"]');
      const input = pane.querySelector('[data-name="orderNo"] input');
      if (!input) return 'no-input';
      input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const submit = [...pane.querySelectorAll('.wui-layout-actions.is-bottom .wui-btn')].find((b) => b.textContent.includes('저장'));
      submit?.click();
      return { invalid: pane.querySelectorAll('.wui-field.is-invalid').length };
    })()`);
    console.log('  ', JSON.stringify(validateResult));
    if (!validateResult || validateResult === 'no-input' || validateResult.invalid < 1) {
      problems.push('필수값 검증이 동작하지 않았습니다.');
    }

    // 승인 문서 메뉴 (에디터)
    await evaluate(`document.querySelector('.wui-app-menuitem[data-id="approval"] .wui-app-menubtn')?.click()`);
    if (!await waitFor("!!document.querySelector('.wui-app-pane[data-menu=\"approval\"] .wui-editor')", { timeout: 12000 })) {
      problems.push('결재 문서 에디터가 렌더링되지 않았습니다.');
    }
    await sleep(700);
    await shot('03-app-editor');

    // 조직도 (data:false → 레이어만 요청)
    await evaluate(`document.querySelector('.wui-app-menuitem[data-id="org"] .wui-app-menubtn')?.click()`);
    if (!await waitFor("!!document.querySelector('.wui-app-pane[data-menu=\"org\"] .wui-tree-row')", { timeout: 12000 })) {
      problems.push('조직도 트리가 렌더링되지 않았습니다.');
    }
    await sleep(500);
    await shot('04-app-org');

    // 스킨 변경
    const skinResult = await evaluate(`(() => {
      document.querySelector('.wui-app-skinthemes .wui-swatch[data-theme="green"]')?.click();
      return {
        theme: document.documentElement.getAttribute('data-wui-theme'),
        rootTheme: document.querySelector('.wui-app')?.getAttribute('data-wui-theme'),
        primary: getComputedStyle(document.documentElement).getPropertyValue('--wui-primary').trim(),
      };
    })()`);
    console.log('  ', JSON.stringify(skinResult));
    if (skinResult.theme !== 'green') problems.push('스킨 테마 전환이 documentElement 에 적용되지 않았습니다.');
    await evaluate(`document.querySelector('.wui-app-skinthemes .wui-swatch[data-theme="blue"]')?.click()`);

    /* ------------------------------ 데모 뷰 ------------------------------ */
    const views = [
      ['editor', "!!document.querySelector('.wui-editor .wui-editor-area')", '05-editor'],
      ['grid', "document.querySelectorAll('#grid-mount .wui-grid-row').length > 5", '06-grid'],
      ['tree', "document.querySelectorAll('#tree-mount .wui-tree-row').length > 3", '07-tree'],
      ['layout', "!!document.querySelector('#layout-mount .wui-layout-grid')", '08-layout'],
      ['skin', "document.querySelectorAll('.demo-themecard').length >= 10", '09-skin'],
    ];
    for (const [view, expression, file] of views) {
      await evaluate(`document.querySelector('.demo-navbtn[data-view="${view}"]')?.click()`);
      if (!await waitFor(expression, { timeout: 12000 })) problems.push(`${view} 뷰가 렌더링되지 않았습니다.`);
      await sleep(500);
      const counts = await evaluate(`(() => {
        const active = document.querySelector('.demo-view.is-active');
        return {
          view: active?.dataset.view,
          grids: active?.querySelectorAll('.wui-grid-row').length || 0,
          trees: active?.querySelectorAll('.wui-tree-row').length || 0,
          fields: active?.querySelectorAll('.wui-field').length || 0,
          errors: active?.querySelectorAll('.wui-field.is-invalid').length || 0,
          visibleHidden: active ? [...active.querySelectorAll('[hidden]')]
            .filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('.wui-grid-row, .wui-virtual-row')).length : 0,
        };
      })()`);
      console.log('  ', view, JSON.stringify(counts));
      if (counts.visibleHidden > 0) problems.push(`${view} 뷰에 hidden 요소 ${counts.visibleHidden}개가 화면에 남아 있습니다.`);
      await shot(file);
    }

    // 스킨 버튼 동작
    await evaluate(`document.querySelector('.demo-themecard[data-theme="orange"]')?.click()`);
    const demoSkin = await evaluate(`document.documentElement.getAttribute('data-wui-theme')`);
    if (demoSkin !== 'orange') problems.push('데모 스킨 테마 전환이 실패했습니다.');

    // 모바일 레이아웃
    await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 2, mobile: true });
    await evaluate(`document.querySelector('.demo-navbtn[data-view="app"]')?.click()`);
    await sleep(1200);
    const mobile = await evaluate(`(() => {
      const sidebar = document.querySelector('.wui-app-sidebar');
      const transform = sidebar ? getComputedStyle(sidebar).transform : '';
      const menuBtn = document.querySelector('.wui-app-top > .wui-app-menubtn');
      const btnVisible = menuBtn ? getComputedStyle(menuBtn).display !== 'none' : false;
      menuBtn?.click();
      return { transform, btnVisible, open: document.querySelector('.wui-app')?.classList.contains('is-sidebar-open') };
    })()`);
    console.log('  ', JSON.stringify(mobile));
    if (!mobile.btnVisible || !mobile.open) problems.push('모바일 사이드바 토글이 동작하지 않았습니다.');
    await sleep(400);
    await shot('10-mobile');

    /* ------------------------------ 문서 뷰어 ------------------------------ */
    console.log('[check] 문서 뷰어');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: DOC_URL });
    if (!await waitFor("document.querySelectorAll('.doc-nav-item').length >= 11 && document.querySelector('.doc-title')", { timeout: 12000 })) {
      problems.push('문서 목록/본문이 렌더링되지 않았습니다.');
    }
    await sleep(700);
    const docState = await evaluate(`(() => {
      const article = document.querySelector('#docArticle');
      return {
        items: document.querySelectorAll('.doc-nav-item').length,
        title: document.querySelector('.doc-title')?.textContent || '',
        h2: article ? article.querySelectorAll('h2').length : 0,
        tables: article ? article.querySelectorAll('.doc-tablewrap table').length : 0,
        codes: article ? article.querySelectorAll('.doc-code pre code').length : 0,
        toc: article ? article.querySelectorAll('.doc-toc a').length : 0,
        copy: article ? article.querySelectorAll('[data-copy]').length : 0,
        mdLinks: article ? article.querySelectorAll('a[data-doc-link]').length : 0,
        raw: document.querySelector('#docRaw')?.getAttribute('href') || '',
      };
    })()`);
    console.log('  ', JSON.stringify(docState));
    if (docState.items < 11) problems.push('문서 목록 항목이 부족합니다.');
    if (!docState.title.includes('개요')) problems.push('첫 문서 제목이 올바르지 않습니다.');
    if (docState.h2 < 3 || !docState.tables || !docState.codes || !docState.toc) {
      problems.push('Markdown 헤딩/표/코드/목차 렌더링이 부족합니다.');
    }
    if (!docState.copy) problems.push('코드 복사 버튼이 없습니다.');
    await shot('11-doc-overview');

    // 문서 내 Markdown 링크 이동
    const clickedLink = await evaluate(`(() => {
      const a = document.querySelector('#docArticle a[data-doc-link]');
      if (!a) return '';
      const href = a.getAttribute('href');
      a.click();
      return href;
    })()`);
    await sleep(600);
    const linkedTitle = await evaluate(`document.querySelector('.doc-title')?.textContent || ''`);
    console.log('  link:', clickedLink, '→', linkedTitle);
    if (!clickedLink || !linkedTitle || linkedTitle.includes('개요')) {
      problems.push('문서 내 .md 링크 이동이 동작하지 않았습니다.');
    }

    // 사이드바 검색
    const searchState = await evaluate(`(() => {
      const input = document.querySelector('#docSearch');
      input.value = 'AJAX';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        items: document.querySelectorAll('.doc-nav-item').length,
        marks: document.querySelectorAll('.doc-nav-item mark').length,
        hint: document.querySelector('#docSearchHint')?.textContent || '',
      };
    })()`);
    console.log('  search:', JSON.stringify(searchState));
    if (searchState.items < 2 || !searchState.marks) problems.push('문서 검색이 동작하지 않았습니다.');
    await evaluate(`(() => {
      const input = document.querySelector('#docSearch');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    // 사이드바 문서 전환
    await evaluate(`document.querySelector('[data-doc-id="10-api-reference"]')?.click()`);
    if (!await waitFor("document.querySelector('.doc-title')?.textContent.includes('API 레퍼런스')", { timeout: 5000 })) {
      problems.push('문서 전환이 동작하지 않았습니다.');
    }
    if (!(await evaluate(`location.hash.includes('10-api-reference')`))) problems.push('문서 해시 라우팅이 동작하지 않았습니다.');
    const apiDocState = await evaluate(`(() => {
      const article = document.querySelector('#docArticle');
      return {
        h2: article ? article.querySelectorAll('h2').length : 0,
        tables: article ? article.querySelectorAll('.doc-tablewrap table').length : 0,
        rows: article ? article.querySelectorAll('.doc-tablewrap tbody tr').length : 0,
        codes: article ? article.querySelectorAll('.doc-code pre code').length : 0,
        hasBrokenPipes: article ? article.innerText.includes('| ---') : false,
      };
    })()`);
    console.log('  api doc:', JSON.stringify({ h2: apiDocState.h2, tables: apiDocState.tables, rows: apiDocState.rows, codes: apiDocState.codes }));
    if (apiDocState.h2 < 8 || apiDocState.tables < 5 || apiDocState.rows < 20 || apiDocState.codes < 3) {
      problems.push('API 레퍼런스 문서의 Markdown 렌더링이 부족합니다.');
    }
    if (apiDocState.hasBrokenPipes) problems.push('Markdown 표 구분선이 본문에 노출되었습니다.');

    // 테마 토글
    const themeBefore = await evaluate(`document.documentElement.getAttribute('data-theme')`);
    await evaluate(`document.querySelector('#docTheme')?.click()`);
    const themeAfter = await evaluate(`document.documentElement.getAttribute('data-theme')`);
    if (themeBefore === themeAfter) problems.push('문서 테마 토글이 동작하지 않았습니다.');
    await sleep(300);
    await shot('12-doc-dark');

    // 모바일 문서 목록
    await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    const docMobile = await evaluate(`(() => {
      const btn = document.querySelector('#docMenuBtn');
      const visible = btn ? getComputedStyle(btn).display !== 'none' : false;
      btn?.click();
      return { visible, open: document.body.classList.contains('is-nav-open') };
    })()`);
    console.log('  mobile:', JSON.stringify(docMobile));
    if (!docMobile.visible || !docMobile.open) problems.push('문서 모바일 목록 토글이 동작하지 않았습니다.');
    await sleep(300);
    await shot('13-doc-mobile');

    if (problems.length) {
      console.error('\n[browser] 문제 발견');
      problems.forEach((p) => console.error(`  ✗ ${p}`));
      process.exitCode = 1;
    } else {
      console.log('\n[browser] 모든 점검 통과');
    }
  } finally {
    try { ws?.close(); } catch (_) { /* noop */ }
    browser.kill();
    setTimeout(() => { rm(PROFILE, { recursive: true, force: true }).catch(() => {}); }, 500);
  }
}

main().catch((err) => {
  console.error('[browser] 실패', err);
  process.exit(1);
});
