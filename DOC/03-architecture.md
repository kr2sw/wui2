# 03. 아키텍처

WUI 는 "작은 코어 + 독립 컴포넌트 + 통합 엔트리" 구조입니다. 각 컴포넌트는 서로를 직접 알지 않고, 코어 유틸/이벤트/통신 위에서 동작합니다.

## 1. 모듈 구조

```text
src/js/
├─ core/
│  ├─ util.js       DOM 헬퍼, clone, 경로 접근, 검증, CSV, 저장소, 다운로드
│  ├─ emitter.js    on/off/once/emit/destroy
│  ├─ ajax.js       fetch 래퍼, 타임아웃, 로그, mock 폴백
│  └─ skin.js       테마/모양/밀도, CSS 변수 적용, 피커
├─ editor/
│  └─ editor.js     createEditor, sanitizeHtml
├─ grid/
│  └─ grid.js       createGrid
├─ tree/
│  └─ tree.js       createTree
├─ layout/
│  ├─ layout.js     createLayout
│  └─ controls.js   controlRegistry, 31개 기본 컨트롤
├─ app/
│  └─ app.js        createApp
├─ webui.js         통합 엔트리 (전역 WUI + named export)
└─ demo.js          데모 초기화, mock 등록, 뷰 라우팅
```

### 의존 방향

```text
util / emitter
   ↑        ↑
 ajax     skin
   ↑        ↑
 app ──→ layout ──→ controls ──→ editor / grid / tree
          │
 grid ────┴──→ core (util, emitter, ajax)
 tree ────────→ core (util, emitter)
 editor ──────→ core (util, emitter)
```

- `core` 는 다른 컴포넌트를 import 하지 않습니다.
- `editor`, `grid`, `tree` 는 서로 독립적입니다.
- `controls` 가 세 컴포넌트를 레이아웃 컨트롤로 감쌉니다.
- `app` 이 `layout` 과 `ajax`, `skin` 을 조합합니다.
- `webui.js` 만 전체를 조합해 외부에 노출합니다.

## 2. 진입점

```js
import WUI from './src/js/webui.js';

WUI.VERSION;              // '1.0.0'
WUI.createGrid(...);
WUI.ajax.get(...);
WUI.skin.setTheme(...);
```

`webui.js` 는 다음을 제공합니다.

- 기본 내보내기: 전역 `WUI` 와 동일한 객체
- named export: `createEditor`, `createGrid`, `createTree`, `createLayout`, `createApp`, `ajax`, `skin`, `util`, `Emitter`, `registerControl` 등
- 브라우저에서는 `window.WUI` 자동 할당

전역 객체는 다음 그룹으로 구성됩니다.

| 그룹 | 키 |
| --- | --- |
| 메타 | `VERSION`, `util` |
| DOM 헬퍼 | `h`, `$`, `$$`, `on` |
| 이벤트 | `Emitter` |
| 통신 | `ajax`, `AjaxError` |
| 스킨 | `skin` |
| 컴포넌트 | `createEditor`, `editor`, `sanitizeHtml`, `createGrid`, `grid`, `createTree`, `tree`, `createLayout`, `layout`, `createApp`, `app` |
| 레이아웃 확장 | `registerControl`, `getControlFactory`, `listControls`, `controlRegistry` |

## 3. 팩토리 생명주기

모든 팩토리는 같은 패턴을 따릅니다.

```js
const instance = WUI.createX(mount, options);
// mount: CSS 선택자 또는 Element
// options: 기본값과 병합

instance.el;       // 루트 요소
instance.on(...);  // 이벤트
instance.off(...);
instance.destroy();
```

### 생성 시점

| 컴포넌트 | 초기화 순서 |
| --- | --- |
| 에디터 | 옵션 병합 → 마크업 생성 → textarea 숨김 처리 → 자동저장 복원 → 초기 HTML 적용 → 툴바 생성 |
| 그리드 | 옵션 병합 → 마크업 → 컬럼 정규화/헤더 → 데이터 정규화 → 뷰 계산 → 행 렌더 → `ready` |
| 트리 | 옵션 병합 → 마크업 → 데이터 정규화(byId, expanded, checked) → 렌더 → `ready` |
| 레이아웃 | 옵션 병합 → 스키마 정규화 → 각 아이템 컨트롤 생성 → 조건 평가 → `ready` |
| 앱 | 옵션 병합 → 셸 마크업 → 스킨 대상 등록 → 메뉴 AJAX → 메뉴 렌더 → 첫 리프 메뉴 열기 |

### 파괴 시점

- `destroy()` 는 DOM 제거, Emitter 정리, 타이머/RAF 취소, 전역 리스너 해제를 수행합니다.
- 앱은 열린 탭의 레이아웃, 스킨 피커, `skin` 대상, `hashchange` 리스너를 정리합니다.
- 에디터는 `selectionchange`, 전체화면 클래스, 디바운스 타이머를 정리합니다.

## 4. 데이터 흐름

### 4.1 데모 데이터 파이프라인

```text
src/data/seed.js
   │  tools/build-data.mjs
   ├─→ src/data/menu.json
   ├─→ src/data/layers/*.json
   ├─→ src/data/data/*.json
   └─→ src/data/tree.json
          │
          ├─ serve.mjs  (/api/*)
          └─ demo.js    (ajax.mock)
```

- `seed.js` 가 유일한 원본입니다.
- 서버는 JSON 파일을 매 요청마다 읽습니다.
- `file://` 에서는 `demo.js` 의 mock 이 같은 seed 객체를 반환합니다.
- 따라서 서버 데모와 파일 데모의 데이터가 동일합니다.

### 4.2 앱 화면 로드

```text
createApp
  → ajax.get(menuUrl)
  → 메뉴 정규화(state.map, children)
  → 첫 리프 메뉴 openMenu
  → ensureTab → activateTab → loadTab
      → ajax.get(layerUrl resolved)
      → ajax.get(dataUrl resolved)  (menu.data !== false)
      → createLayout(layer, { values: data.values, data })
      → renderPane
```

URL 템플릿은 메뉴 객체로 치환됩니다.

```js
layerUrl: '/api/layers/{layer}'   // { id, layer, data, menu }
dataUrl:  '/api/data/{data}'
```

함수를 사용할 수도 있습니다.

```js
dataUrl: (menu) => `/api/data/${menu.id}?v=2`
```

### 4.3 레이아웃 값 흐름

```text
schema.values / data.bind / item.value
        ↓ 초기값
control.getValue()
        ↓ input/change
handleControlChange
  → st.values 갱신
  → bind 대상에 setPath
  → visibleWhen/disabledWhen 재평가
  → change 이벤트 + onChange 콜백
        ↓ submit
validate() → getValues() → onSubmit
```

## 5. 주요 설계 패턴

### 5.1 옵션 병합과 정규화

각 컴포넌트는 `DEFAULTS` 또는 `DEFAULT_OPTIONS` 를 갖고, 사용자 옵션을 얕게 병합합니다. 중첩 옵션(에디터의 `image`, `table`)은 별도로 병합합니다. 그리드 컬럼은 `normalizeColumn` 에서 타입별 기본 너비, 정렬, 편집 가능 여부, 규칙을 채웁니다.

### 5.2 이벤트 + 콜백

동일한 사건을 두 방식으로 전달합니다.

```js
const grid = createGrid('#g', {
  onChange: (payload) => console.log('callback', payload),
});

grid.on('change', (payload) => console.log('event', payload));
```

콜백은 옵션으로 간편하게, 이벤트는 다중 구독과 해제를 위해 사용합니다.

### 5.3 레지스트리

레이아웃 컨트롤은 `Map` 기반 레지스트리에 등록됩니다.

```js
registerControl('rating', (ctx) => {
  const el = document.createElement('div');
  // ...
  return { el, getValue, setValue, focus, setDisabled, destroy };
});
```

`createLayout` 은 `getControlFactory(type)` 으로 팩토리를 찾고, 없으면 `custom`(render가 있을 때) 또는 `text` 로 폴백합니다.

### 5.4 위임 이벤트

그리드는 행/셀을 매번 이벤트 바인딩하지 않고 `rowsEl` 에 `input`, `change`, `blur`, `keydown`, `click` 을 위임합니다. 가상 스크롤로 DOM 이 재생성되어도 리스너가 유지됩니다.

### 5.5 스냅샷과 변경 감지

그리드는 행마다 `_rid`(non-enumerable)를 부여하고, 초기/저장 시 JSON 스냅샷을 저장합니다. `getChanges()` 는 현재 행과 스냅샷을 비교합니다. `getData()` 는 `_rid` 를 제거한 복사본을 반환합니다.

## 6. CSS 구조

```text
tokens.css    디자인 토큰(색/간격/모서리/그림자/다크 테마 값)
base.css      리셋, 타이포, 버튼/입력/배지/알림/유틸리티
editor.css    에디터
grid.css      그리드
tree.css      트리
layout.css    레이아웃/필드/폼
app.css       앱 셸(사이드바/탑바/탭/로그/토스트/스킨 패널)
demo.css      데모 페이지 전용
```

로드 순서는 토큰 → 베이스 → 컴포넌트 → 레이아웃/앱 → 데모입니다. 스킨은 `tokens.css` 변수를 런타임에 덮어쓰고, 모양/밀도는 `data-wui-shape`, `data-wui-density` 선택자와 인라인 변수로 적용합니다.

## 7. 확장 지점

| 확장 | 방법 |
| --- | --- |
| 새 폼 컨트롤 | `WUI.registerControl(type, factory, { label })` |
| 새 테마 | `WUI.skin.registerTheme(name, { label, color, dark, vars })` |
| 새 모양 | `WUI.skin.registerShape(name, { label, vars })` |
| 그리드 셀 | `type: 'custom'` + `render(ctx)` |
| 트리 노드 | `renderNode({ node, level, tree })` |
| 데이터 소스 | `ajax.configure({ baseUrl })`, `grid.load(url)` |
| 앱 URL | `layerUrl`, `dataUrl`, `menuUrl`, `submitUrl` 함수/템플릿 |
| 액션 | 레이아웃 `action` + `app.on('action')` 또는 `def.url` |

## 8. 접근성과 안전성

- 그리드 `role="grid"`, 셀 `role="gridcell"`, 트리 `role="tree"`, 행 `role="treeitem"`.
- 에디터 툴바는 `role="toolbar"`, 버튼에 `aria-label`/`title`.
- 검증 오류는 `role="alert"`, 입력에 `aria-invalid`.
- 에디터는 허용 태그/속성 목록으로 HTML 을 정화하고 `javascript:` URL, `on*` 속성, 위험한 style 을 제거합니다.
- 문서 뷰어는 Markdown 을 렌더링할 때 HTML 을 이스케이프하고 URL 스킴을 제한합니다.
