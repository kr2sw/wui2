# 08. 메뉴·레이어·AJAX

`createApp` 은 메뉴 JSON 을 읽어 사이드바를 만들고, 메뉴 클릭 시 레이어 JSON 과 데이터 JSON 을 AJAX 로 읽어 `createLayout` 으로 화면을 구성합니다. 통신은 `core/ajax.js` 의 fetch 래퍼를 사용하며, 서버가 없을 때를 위한 mock 폴백을 지원합니다.

## 1. 앱 사용

```html
<link rel="stylesheet" href="../src/css/tokens.css">
<link rel="stylesheet" href="../src/css/base.css">
<link rel="stylesheet" href="../src/css/editor.css">
<link rel="stylesheet" href="../src/css/grid.css">
<link rel="stylesheet" href="../src/css/tree.css">
<link rel="stylesheet" href="../src/css/layout.css">
<link rel="stylesheet" href="../src/css/app.css">

<div id="app"></div>

<script type="module">
  import WUI from '../src/js/webui.js';

  WUI.skin.init({ target: document.documentElement });

  const app = WUI.createApp('#app', {
    menuUrl: '/api/menu',
    layerUrl: '/api/layers/{layer}',
    dataUrl: '/api/data/{data}',
    submitUrl: '/api/submit',
    title: 'WUI 스튜디오',
    subtitle: '메뉴 · 레이어 · 데이터',
    logo: 'W',
    hash: true,
    tabs: true,
    skinPanel: true,
  });
</script>
```

## 2. 앱 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `menuUrl` | `/api/menu` | 메뉴 JSON URL |
| `layerUrl` | `/api/layers/{layer}` | 레이어 URL 템플릿/함수 |
| `dataUrl` | `/api/data/{data}` | 데이터 URL 템플릿/함수 |
| `submitUrl` | `null` | 기본 제출 URL |
| `title` | `'WUI'` | 브랜드 제목 |
| `subtitle` | `'웹 UI 키트'` | 브랜드 부제 |
| `logo` | `'W'` | 로고 문자 |
| `hash` | `true` | `#/menu-id` 해시 라우팅 |
| `cache` | `true` | 예약됨(현재 미사용). 열린 탭의 화면은 항상 유지됩니다 |
| `tabs` | `true` | 탭 표시 |
| `skinPanel` | `true` | 사이드바 스킨 패널 |
| `statusBar` | `true` | 예약됨(현재 옵션과 무관하게 하단 상태 바 표시) |
| `keepTitle` | `false` | 메뉴 JSON 의 `title` 로 브랜드 제목을 덮어쓰지 않음 |
| `imageUploader` | `null` | 레이아웃 이미지 업로더 |

### URL 템플릿

지원 변수: `{id}`, `{layer}`, `{data}`, `{menu}`

```js
layerUrl: '/api/layers/{layer}',   // menu.layer || menu.id
dataUrl: '/api/data/{data}',        // menu.data || menu.id
```

값은 `encodeURIComponent` 로 치환됩니다. 함수를 사용할 수도 있습니다.

```js
createApp('#app', {
  layerUrl: (menu) => `/api/v2/layers/${encodeURIComponent(menu.id)}`,
  dataUrl: (menu, state) => menu.data === false ? null : `/api/v2/data/${menu.id}`,
});
```

## 3. 메뉴 JSON

```json
{
  "title": "WUI 스튜디오",
  "subtitle": "바닐라 JS 웹 UI 키트",
  "items": [
    { "id": "dashboard", "label": "대시보드", "icon": "▦", "badge": "Grid" },
    { "id": "order-form", "label": "주문 입력", "icon": "✎" },
    { "id": "org", "label": "조직도", "icon": "⌘", "data": false },
    {
      "id": "settings",
      "label": "설정",
      "icon": "⚙",
      "children": [
        { "id": "settings-general", "label": "일반 설정" },
        { "id": "settings-skin", "label": "스킨 갤러리" }
      ]
    }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `id` | 메뉴/탭/URL 식별자 |
| `label` | 표시 텍스트(`title`, `text` 별칭) |
| `icon` | 아이콘 문자열 |
| `badge` | 메뉴 라벨 옆 배지 |
| `disabled` | 비활성 |
| `children` / `items` | 하위 메뉴 |
| `layer` | 레이어 id 재정의 |
| `data` | 데이터 id 재정의. `false` 면 데이터 요청 생략 |

상위 메뉴는 그룹으로 동작하고, 리프 메뉴를 클릭하면 탭이 열립니다. 초기 화면은 첫 번째 리프 메뉴이거나 해시에 지정된 메뉴입니다.

## 4. 레이어 JSON

레이어는 `createLayout` 스키마에 앱 관련 필드를 더한 형태입니다.

```json
{
  "title": "주문 입력",
  "description": "12컬럼 flow 배치",
  "submitUrl": "/api/submit",
  "actions": [
    { "label": "초기화", "action": "reset" },
    { "label": "저장", "action": "submit", "variant": "primary" }
  ],
  "groups": [
    {
      "id": "basic",
      "title": "주문 정보",
      "items": [
        { "name": "orderNo", "label": "주문번호", "type": "text", "span": 4, "required": true },
        { "name": "orderedAt", "label": "주문일", "type": "date", "span": 4, "required": true }
      ]
    }
  ]
}
```

- `layer.submitUrl` 이 있으면 앱의 `submitUrl` 보다 우선합니다.
- 없으면 저장 시 "저장 URL 없음" 토스트만 표시합니다.
- `actions` 는 레이아웃과 동일하게 동작합니다.

### 데이터 JSON

```json
{
  "values": {
    "orderNo": "ORD-2026-0101",
    "customer": "김하늘",
    "status": "ready"
  },
  "orders": [
    { "orderNo": "ORD-2026-0101", "customer": "김하늘", "qty": 2 }
  ]
}
```

- `values` 는 레이아웃의 초기값으로 전달됩니다.
- 나머지 키는 `options.data` 로 전달되어 `dataKey` 기반 그리드/트리 임베드에 사용할 수 있습니다.
- 데이터 응답이 404 이면 `null` 로 처리하고 레이아웃만 렌더합니다. 그 외 오류는 화면 오류 상태로 표시합니다.

## 5. 로드 흐름

```text
createApp
  → GET menuUrl
  → 메뉴 정규화
  → 첫 리프 메뉴 openMenu
  → ensureTab
  → activateTab
  → GET layerUrl
  → (menu.data !== false) GET dataUrl
  → createLayout(host, layer, { values: data.values, data })
  → 탭 본문 렌더
```

- 같은 탭을 다시 클릭하면 캐시된 화면을 사용합니다.
- 새로고침/다시 읽기는 `force: true` 로 레이어와 데이터를 다시 요청합니다.
- 요청 중에는 로딩 화면, 실패 시 오류 카드와 "다시 시도"/"AJAX 로그" 버튼을 표시합니다.
- AJAX 요청 수는 상단 배지(`AJAX n`)에 표시됩니다.

## 6. 앱 API

| 멤버 | 설명 |
| --- | --- |
| `el` | 루트 요소 |
| `open(id)` | 메뉴 열기 |
| `reloadMenu()` | 메뉴 다시 로드 |
| `reload()` | 활성 탭 다시 로드 |
| `closeTab(id)` | 탭 닫기 |
| `toggleLog(force?)` | AJAX 로그 패널 |
| `toast(message, tone?)` | 토스트 표시 |
| `getState()` | `{ menu, items, tabs, activeId, logs, loading, error }` |
| `on/off/destroy` | 이벤트/정리 |

## 7. 앱 이벤트

| 이벤트 | 페이로드 |
| --- | --- |
| `ready` | `api` |
| `menu` | `{ menu, items }` |
| `menuready` | `{ menu }` |
| `menuerror` | `{ error }` |
| `open` | `{ menu }` |
| `tabchange` | `{ id, menu }` |
| `tabclose` | `{ id }` |
| `load` | `{ tab, layer, data }` |
| `loaderror` | `{ tab, error }` |
| `change` | `{ tab, name, value, values, def }` |
| `submit` | `{ tab, values, response }` |
| `action` | `{ tab, action, def, values, schema }` |

## 8. AJAX 래퍼

```js
import { ajax } from './src/js/webui.js';

const menu = await ajax.get('/api/menu');
const saved = await ajax.post('/api/submit', { menu: 'order-form', values });
const res = await ajax.request('/api/items', {
  method: 'GET',
  params: { page: 1, size: 20 },
  timeout: 5000,
});
```

### `ajax.request(url, opts)`

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `method` | `'GET'` | HTTP 메서드 |
| `data` | – | GET 이면 쿼리, 그 외 JSON 본문 |
| `params` | – | 쿼리 파라미터. 배열은 반복 키 |
| `responseType` | `'json'` | `json`, `text`, `blob`, `arrayBuffer` |
| `timeout` | `20000` | ms. 0이면 비활성 |
| `signal` | – | AbortSignal |
| `headers` | – | 추가 헤더 |
| `credentials` | `'same-origin'` | fetch credentials |
| `cache` | `'no-store'` | fetch cache |
| `mock` | – | `true` 항상 mock, `'fallback'` 실패 시 mock, `false` mock 무시 |
| `raw` | `false` | Response 객체 반환 |

편의 메서드: `ajax.get`, `ajax.post`, `ajax.put`, `ajax.delete`, `ajax.getJSON`.

### 오류

`AjaxError` 는 `message`, `url`, `status`, `body`, `cause` 를 가집니다.

```js
try {
  await ajax.get('/api/missing');
} catch (err) {
  console.log(err.name, err.status, err.url, err.body);
}
```

### URL 구성

```js
ajax.configure({ baseUrl: 'https://api.example.com' });
ajax.buildUrl('/orders', { page: 1, tag: ['a', 'b'] });
// https://api.example.com/orders?page=1&tag=a&tag=b
```

절대 URL, `data:`, `blob:` 은 `baseUrl` 을 붙이지 않습니다.

## 9. Mock 폴백

```js
ajax.mock('/api/menu', menuData, { delay: 120 });

ajax.mock('/api/layers/*', (info) => {
  const id = decodeURIComponent(info.url.split('/').pop().split('?')[0]);
  return layers[id] || { status: 404, body: { error: '레이어 없음', id } };
}, { delay: 180 });

ajax.mock('/api/submit', ({ method }) => ({
  ok: true,
  message: `저장되었습니다. (${method})`,
}), { method: 'POST', delay: 300 });
```

- 패턴의 `*` 는 와일드카드입니다.
- `method` 를 지정하면 해당 메서드에만 적용됩니다.
- 반환값이 `{ status, body, delay }` 형태이면 상태/지연을 제어합니다. `status >= 400` 이면 `AjaxError` 를 던집니다.
- 기본 모드 `mock: 'fallback'` 은 네트워크 실패 시 mock 을 사용합니다.
- `configure({ mock: true })` 는 항상 mock, `mock: false` 는 mock 을 무시합니다.

```js
ajax.configure({ mock: 'fallback' });
ajax.mockAvailable('GET', '/api/menu');  // boolean
ajax.listMocks();                         // [{ pattern, delay }]
```

### 요청 로그

```js
ajax.onLog((entry) => {
  console.log(entry.method, entry.url, entry.status, entry.source, entry.ms);
});

ajax.getHistory();   // 최근 60건
ajax.clearHistory();
```

로그 필드: `id`, `method`, `url`, `status`, `ok`, `ms`, `source`(`network`/`mock`/`mock-fallback`), `size`, `error?`, `note?`, `at`.

## 10. 서버 API

`serve.mjs` 는 의존성 없는 Node HTTP 서버입니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/menu` | `src/data/menu.json` |
| GET | `/api/layers/:id` | `src/data/layers/:id.json` |
| GET | `/api/data/:id` | `src/data/data/:id.json` |
| GET | `/api/tree` | `src/data/tree.json` |
| POST | `/api/submit` | `{ ok, action, message, menu, fieldCount, at }` |
| POST | `/api/action/:name` | 액션 모의 응답 |
| OPTIONS | `/api/*` | CORS preflight |

- `POST /api/submit` 에 `{ fail: true }` 를 보내면 422 응답을 반환합니다.
- 모든 응답은 `Cache-Control: no-store`.
- API 지연은 `API_DELAY` 환경변수(ms)로 조절합니다.
- 정적 파일은 프로젝트 루트 기준으로 제공하며 경로 탈출을 차단합니다.

## 11. 액션 처리

레이아웃 액션이 앱으로 전달되면 다음 순서로 처리합니다.

1. `def.url` 이 있으면 해당 URL 로 `POST`(또는 `def.method`) 요청
2. 내장 액션: `reload`, `close`, `log`, `theme`, `shape`, `density`, `borders`, `skin-reset`, `json`
3. 나머지는 `action` 이벤트 발생

```json
{
  "type": "button",
  "name": "notify",
  "text": "알림 보내기",
  "action": "notify",
  "url": "/api/action/notify",
  "method": "POST"
}
```

## 12. 보안과 운영 주의

- 메뉴/레이어 `html` 컨트롤은 신뢰된 JSON 만 사용하세요. 레이아웃은 HTML 문자열을 그대로 삽입합니다.
- 에디터 HTML 은 `sanitizeHtml` 로 정화되지만, 서버 저장 시에도 별도 검증을 권장합니다.
- mock 은 개발/데모용입니다. 운영에서는 `ajax.configure({ mock: false })` 로 끄세요.
- URL 템플릿 값은 인코딩되지만, 함수형 URL 을 사용할 때는 직접 인코딩해야 합니다.
- 인증이 필요한 API 는 `ajax.configure({ headers: { Authorization: ... } })` 또는 `request` 옵션을 사용하세요.
