# 10. API 레퍼런스

이 문서는 `WUI` 전역 객체와 각 팩토리가 반환하는 API 를 한눈에 찾기 위한 요약입니다. 옵션의 상세 동작과 예제는 [04. 에디터](04-editor.md), [05. 그리드](05-grid.md), [06. 트리](06-tree.md), [07. JSON 화면 배치](07-layout-json.md), [08. 메뉴·레이어·AJAX](08-menu-layer-ajax.md), [09. 스킨](09-skin.md)을 함께 참고하세요.

## 1. 전역 표면

```js
import WUI from './src/js/webui.js';
// 또는 named import
import { createGrid, ajax, skin } from './src/js/webui.js';
```

`webui.js` 는 모듈을 로드할 때 `window.WUI` 를 설정합니다. `<script type="module">` 이 아닌 일반 스크립트에서는 `webui.js` 를 직접 불러올 수 없으므로, 먼저 모듈에서 `window.WUI` 를 노출한 뒤 사용하세요.

| 키 | 설명 |
| --- | --- |
| `VERSION` | 키트 버전 문자열(현재 `1.0.0`) |
| `util` | 공통 유틸 모음 |
| `h`, `$`, `$$`, `on` | `util.h`, `util.$`, `util.$$`, `util.on` 단축 |
| `Emitter` | `on/once/off/emit/destroy` 이벤트 이미터 클래스 |
| `ajax` | fetch 래퍼 |
| `AjaxError` | AJAX 오류 클래스 |
| `skin` | 스킨 모듈 |
| `createEditor` / `editor` | 에디터 팩토리 / `{ create, sanitizeHtml }` |
| `sanitizeHtml` | 에디터 HTML 정화 함수 |
| `createGrid` / `grid` | 그리드 팩토리 / `{ create }` |
| `createTree` / `tree` | 트리 팩토리 / `{ create }` |
| `createLayout` / `layout` | 레이아웃 팩토리 / `{ create }` |
| `createApp` / `app` | 앱 셸 팩토리 / `{ create }` |
| `registerControl` | 레이아웃 컨트롤 등록 |
| `getControlFactory` | 등록된 컨트롤 팩토리 조회 |
| `listControls` | `{ type, label }[]` 반환 |
| `controlRegistry` | `{ registerControl, getControlFactory, listControls }` |

## 2. 공통 규약

### 마운트

모든 팩토리의 첫 인자는 CSS 선택자 문자열 또는 DOM 요소입니다.

```js
WUI.createGrid('#grid', options);
WUI.createGrid(document.querySelector('#grid'), options);
```

대상이 없으면 오류를 던집니다. `DIV`, `SECTION`, `TEXTAREA` 는 기존 내용을 비우고 마운트합니다. 에디터의 `TEXTAREA` 는 폼 전송을 위해 원본을 숨깁니다.

### 이벤트

모든 인스턴스는 `on(type, fn)`, `off(type, fn)` 을 제공합니다. `on` 은 해제 함수를 반환합니다.

```js
const off = grid.on('change', ({ key, value }) => console.log(key, value));
off();
```

`options.onXxx` 콜백과 이벤트는 같은 시점에 호출됩니다. 콜백이 먼저인지 이벤트가 먼저인지는 컴포넌트마다 다르므로, 순서에 의존하지 마세요.

### 정리

`destroy()` 는 DOM, 이벤트, 타이머, 하위 컴포넌트를 정리합니다. 앱은 열린 탭의 레이아웃과 스킨 피커까지 정리합니다.

### id

`options.id` 를 생략하면 `wui-grid-1` 같은 자동 id 가 부여됩니다. 그리드 너비 저장, aria 연결 등에 사용됩니다.

## 3. 에디터

```js
const editor = WUI.createEditor(mount, options);
```

### 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `value` | `''` | 초기 HTML |
| `placeholder` | 안내 문구 | 빈 영역 안내 |
| `height` | `320` | 편집 영역 높이 |
| `minHeight` | `180` | 최소 높이 |
| `toolbar` | `'full'` | `'full'`, `'basic'`, `false` |
| `stickyToolbar` | `true` | 툴바 sticky |
| `readOnly` | `false` | 읽기 전용 시작 |
| `autofocus` | `false` | 시작 시 포커스 |
| `autosave` | `false` | localStorage 자동저장 |
| `autosaveKey` | 자동 생성 | 자동저장 키 |
| `autosaveDelay` | `700` | 자동저장 디바운스(ms) |
| `image.accept` | `'image/*'` | 파일 입력 accept |
| `image.maxSize` | `5MB` | 최대 파일 크기 |
| `image.uploader` | `null` | `async (file) => url` |
| `table.maxRows` / `maxCols` | `20` / `10` | 표 최대 크기 |
| `table.defaultRows` / `defaultCols` | `3` / `3` | 기본 표 크기 |
| `sanitize` | `true` | 입출력 HTML 정화 |
| `showStatus` | `true` | 하단 상태 표시 |
| `onChange` | `null` | `{ html, text, empty, chars }` |
| `onSave` | `null` | `{ html, text, empty, chars }` |
| `onImage` | `null` | `{ file, src }` |

### 멤버

| 멤버 | 설명 |
| --- | --- |
| `el`, `toolbar`, `area`, `id` | 루트/툴바/편집 영역/인스턴스 id |
| `getHTML({ raw })` | HTML 반환. 기본 정화 |
| `setHTML(html, { silent })` | HTML 설정. 기본 `silent: true` |
| `getText()` / `setText(text)` | 텍스트 읽기/쓰기 |
| `getData()` | `{ html, text, empty, chars }` |
| `getValue()` / `setValue(v)` | `getHTML` / `setHTML` 별칭 |
| `focus()` | 편집 영역 포커스 |
| `exec(command, value)` | `document.execCommand` 실행 |
| `insertHTML(html)` / `insertText(text)` | HTML/텍스트 삽입 |
| `insertImage(src, { alt, width })` | URL 이미지 삽입 |
| `insertImageFile(file)` | 파일 검증 후 업로더/data URL 로 삽입 |
| `insertTable(rows, cols, header)` | 표 삽입 |
| `setFontSize(px)` | 선택 영역 글자 크기 |
| `save()` | 저장 이벤트 + 자동저장 갱신 |
| `clear()` | 내용 비우기 |
| `setReadOnly(flag)` | 읽기 전용 전환 |
| `setSourceMode(flag)` | HTML 소스 모드 |
| `toggleFullscreen(force)` | 전체화면 |
| `isDirty()` | 마지막 저장 이후 변경 여부 |
| `getSelectedText()` | 선택 텍스트 |
| `on/off/destroy` | 이벤트/정리 |

### 이벤트

`ready`, `change`, `save`, `clear`, `readonly`, `image`, `focus`, `blur`

## 4. 그리드

```js
const grid = WUI.createGrid(mount, options);
```

### 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `id` | 자동 | 인스턴스 id |
| `title` / `description` | `''` | 제목/설명 |
| `columns` / `data` | `[]` | 컬럼/초기 행(트리 모드: 중첩 `children`) |
| `height` / `maxHeight` / `minHeight` | `420` / `560` / `160` | 높이 |
| `rowHeight` / `headerHeight` | CSS 변수/36, 38 | 행/헤더 높이 |
| `virtual` / `overscan` | `true` / `6` | 가상 스크롤 |
| `selectable` / `checkboxColumn` / `indexColumn` / `statusColumn` | `true` / `true` / `true` / `false` | 선택/체크박스/번호/수정상태 열 |
| `stickyHeader` / `zebra` | `true` | 헤더 고정/줄무늬 |
| `resizable` / `sortable` / `multiSort` | `true` | 너비/정렬 |
| `search` / `filterRow` | `true` / `false` | 전체 검색/열 필터 행 |
| `toolbar` / `footer` / `showCount` | `true` | 도구 모음/집계/건수 |
| `emptyText` | `'데이터가 없습니다.'` | 빈 상태 문구 |
| `rowClass` | `null` | `(row) => string` |
| `persistWidths` | `false` | 너비 localStorage 저장 |
| `autoLoad` / `dataUrl` | `false` / `null` | 생성 시 AJAX 로드 |
| `tree` / `treeColumn` / `childrenKey` | `false` / 첫 사용자 컬럼 / `'children'` | 계층(트리) 행 |
| `defaultExpandLevel` / `indent` | `0` / `18` | 트리 초기 펼침 레벨/들여쓰기(px) |
| `onChange` / `onSave` / `onRowAdd` / `onSelect` / `onSort` / `onExpand` | `null` | 콜백 |

### 컬럼

`key`, `title`, `type`, `width`, `minWidth`, `align`, `editable`, `sortable`, `filterable`, `frozen`, `placeholder`, `default`, `decimals`, `unit`, `min`, `max`, `step`, `options`, `rules`, `required`, `requiredMessage`, `format`, `sortValue`, `render` 를 지원합니다. 자세한 형식은 [05. 그리드](05-grid.md)를 참고하세요.

### 메서드

| 그룹 | 메서드 |
| --- | --- |
| 데이터 | `setData(rows)`, `getData()`, `addRow(data?, { focus, markNew, parentRid })`, `removeRows(rids)`, `load(url, opts?)` |
| 컬럼 | `setColumns(cols)`, `getColumns()`, `setFrozen(key, side)`, `updateWidths()` |
| 정렬/필터 | `setSort(key, dir, { additive })`, `clearSort()`, `setFilter(key, value)`, `setQuery(value)`, `setFilterRow(enabled)`, `toggleFilterRow()` |
| 선택 | `selectAll()`, `clearSelection()`, `selectRow(rid)`, `getSelected()`, `getVisible()` |
| 트리 | `expand(rid)`, `collapse(rid)`, `toggleExpand(rid)`, `expandAll()`, `collapseAll()`, `isExpanded(rid)` |
| 검증/저장 | `validate()`, `save()`, `getChanges()`, `getRowStatus(rid)`, `downloadCSV(filename?)` |
| 셀/스크롤 | `focusCell(rid, key)`, `setCellValue(rid, key, value, opts?)`, `scrollToIndex(index)` |
| 크기/상태 | `setRowHeight(px)`, `setHeight(value)`, `refreshMetrics()`, `setLoading(flag)`, `setStatus(message, tone)` |
| 공통 | `on/off/destroy` |

getter: `el`, `id`, `viewport`, `rowHeight`, `hasChanges`, `errorCount`, `filterRow`, `tree`

### 이벤트

`ready`, `data`, `change`, `edit`, `select`, `sort`, `columns`, `resize`, `rowadd`, `rowremove`, `validate`, `save`, `load`, `loaderror`, `expand`, `filterrow`, `footer`

## 5. 트리

```js
const tree = WUI.createTree(mount, options);
```

### 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `data` | `[]` | 루트 노드 |
| `checkable` / `cascade` | `true` | 체크/전파 |
| `multiple` | `true` | 다중 선택 |
| `showIcons` / `showLines` / `showSearch` / `showActions` | `true` | 표시 옵션 |
| `searchPlaceholder` | `'트리 검색…'` | 검색 placeholder |
| `indent` | `18` | 레벨 들여쓰기(px) |
| `defaultExpandLevel` | `0` | `0` 접힘, `1` 루트 펼침, `-1` 전체 펼침 |
| `emptyText` | `'표시할 항목이 없습니다.'` | 빈 상태 |
| `lazy` | `null` | `{ load: async (node) => children[] }` |
| `renderNode` | `null` | `({ node, level, tree }) => Node|string` |
| `onSelect` / `onCheck` / `onExpand` / `onLoad` | `null` | 콜백 |

### 노드

`id`, `label`(`text` 별칭), `icon`, `disabled`, `selectable`, `checkable`, `checked`, `expanded`, `lazy`, `data`, `badge`, `children` 를 지원합니다.

### 메서드

| 그룹 | 메서드 |
| --- | --- |
| 데이터 | `setData(list)`, `getData()`, `getNode(id)`, `updateNode(id, patch)`, `addNode(parentId, raw, index?)`, `removeNode(id)` |
| 체크 | `setChecked(id, checked)`, `getChecked({ ids, parents })`, `setCheckAll(flag)` |
| 선택 | `select(id)`, `getSelected()`, `clearSelection()` |
| 펼침 | `toggle(id, force?)`, `expand(idOrIds, flag?)`, `expandTo(id)`, `expandAll()`, `collapseAll()` |
| 검색/렌더 | `filter(query)`, `setQuery(query)`, `refresh()` |
| 공통 | `on/off/destroy` |

`getSelected()` 는 선택이 1개면 노드, 여러 개면 배열을 반환합니다. `addNode` 의 첫 인자는 부모 id 이며, 루트에 추가하려면 `null` 을 사용합니다.

### 이벤트

`ready`, `select`, `check`, `expand`, `expandall`, `collapseall`, `load`, `loaderror`, `filter`

## 6. 레이아웃

```js
const form = WUI.createLayout(mount, schema, options);
```

### 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `id` | 자동 | 인스턴스 id |
| `cols` / `gap` | `12` / `12` | 기본 컬럼/간격 |
| `mode` | `'flow'` | 예약됨. 실제 배치는 `schema.mode` 사용 |
| `rowHeight` | `36` | absolute 모드 기본 행 높이 |
| `labelPosition` | `'top'` | 예약됨. 현재 상단 라벨 고정 |
| `readOnly` | `false` | 전체 읽기 전용 |
| `values` | `null` | 이름 기준 초기값 |
| `data` | `null` | `bind` 대상 데이터 |
| `imageUploader` | `null` | `async (file) => url` |
| `actions` | `null` | 스키마 액션 덮어쓰기 |
| `onChange` | `null` | `{ name, value, values, def }` |
| `onAction` | `null` | `{ action, def, values, schema }` |
| `onSubmit` | `null` | `{ values, schema }` |

### 메서드

| 멤버 | 설명 |
| --- | --- |
| `el`, `id` | 루트/인스턴스 id |
| `setSchema(schema, { values }?)` | 스키마 교체. 값 병합 가능 |
| `getSchema()` | 현재 스키마 |
| `getValues(opts?)` | 값 수집. `{ visibleOnly: true }` 지원 |
| `setValues(values, { silent })` | 값 설정 |
| `applyData(data)` | `bind` 필드 갱신 |
| `reset()` | 초기값으로 |
| `validate()` | `{ name, message, def }[]` |
| `submit()` | `{ valid, values, errors }` |
| `setErrors(map)` / `getErrors()` | 필드 오류 설정/조회 |
| `getControl(name)` / `getField(name)` | 컨트롤/메타 조회 |
| `focus(name)` | 필드로 스크롤 + 포커스 |
| `refresh()` / `refreshVisibility()` | 오류/조건 재평가 |
| `runAction(action, def?)` | 액션 실행 |
| `values` getter | `getValues()` 결과 |
| `controls` | `Map<name, control>` |
| `on/off/destroy` | 이벤트/정리 |

### 이벤트

`ready`, `change`, `values`, `error`, `validate`, `invalid`, `submit`, `submitinvalid`, `reset`, `action`

### 컨트롤 등록

```js
WUI.registerControl(type, factory, meta?);
```

`factory(ctx)` 는 다음을 반환합니다.

```js
{
  el,             // 필수: 컨트롤 요소
  getValue?,      // () => any
  setValue?,      // (value) => void
  focus?,         // () => void
  setDisabled?,   // (flag) => void
  destroy?,       // () => void
}
```

`ctx` 필드: `def`, `name`, `value`, `label`, `disabled`, `readOnly`, `options`(레이아웃 옵션), `onChange(value, { input })`.

`meta` 는 `{ label }` 을 가질 수 있으며 `listControls()` 에 표시됩니다. `custom` 타입은 `render(ctx)` 가 반환한 Node/문자열을 표시하고 `getValue`/`setValue` 로 값을 제어합니다.

## 7. 앱

```js
const app = WUI.createApp(mount, options);
```

### 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `menuUrl` | `'/api/menu'` | 메뉴 JSON URL |
| `layerUrl` | `'/api/layers/{layer}'` | 레이어 URL 템플릿/함수 |
| `dataUrl` | `'/api/data/{data}'` | 데이터 URL 템플릿/함수 |
| `submitUrl` | `null` | 기본 제출 URL |
| `title` / `subtitle` / `logo` | `'WUI'` / `'웹 UI 키트'` / `'W'` | 브랜드 |
| `hash` | `true` | `#/menu-id` 라우팅 |
| `tabs` | `true` | 탭 표시 |
| `skinPanel` | `true` | 스킨 패널 |
| `imageUploader` | `null` | 레이아웃 이미지 업로더 |
| `keepTitle` | `false` | 메뉴 JSON 의 `title` 로 브랜드 제목을 덮어쓰지 않음 |
| `cache` | `true` | 예약됨(현재 미사용) |
| `statusBar` | `true` | 예약됨(현재 항상 표시) |

URL 템플릿 변수: `{id}`, `{layer}`, `{data}`, `{menu}`. 값은 `encodeURIComponent` 로 치환됩니다. 함수는 `(menu, state) => url` 형태입니다.

### 메서드

| 멤버 | 설명 |
| --- | --- |
| `el` | 루트 요소 |
| `open(id)` | 메뉴 열기 |
| `reloadMenu()` | 메뉴 다시 로드 |
| `reload()` | 활성 탭 다시 로드 |
| `closeTab(id)` | 탭 닫기 |
| `toggleLog(force?)` | AJAX 로그 패널 |
| `toast(message, tone?)` | 토스트 |
| `getState()` | `{ menu, items, tabs, activeId, logs, loading, error }` |
| `on/off/destroy` | 이벤트/정리 |

### 이벤트

`ready`, `menu`, `menuready`, `menuerror`, `open`, `tabchange`, `tabclose`, `load`, `loaderror`, `change`, `submit`, `action`

## 8. AJAX

```js
const data = await WUI.ajax.get('/api/menu');
const saved = await WUI.ajax.post('/api/submit', { values });
```

| 멤버 | 설명 |
| --- | --- |
| `request(url, opts)` | 핵심 요청 함수 |
| `get(url, opts)` / `getJSON(url, opts)` | GET |
| `post(url, data, opts)` / `put(url, data, opts)` | POST/PUT |
| `delete(url, opts)` | DELETE |
| `mock(pattern, value, { delay, method })` | 모의 응답 등록 |
| `configure(options)` | `baseUrl`, `timeout`, `mock`, `headers` 기본값 |
| `buildUrl(url, params)` | 쿼리 문자열 구성 |
| `mockAvailable(method, url)` | mock 존재 여부 |
| `listMocks()` | 등록된 mock 목록 |
| `onLog(fn)` | 요청 로그 구독, 해제 함수 반환 |
| `getHistory()` / `clearHistory()` | 최근 60건 로그 |
| `reset()` | mock/로그/설정 초기화 |

`request` 옵션: `method`, `data`, `params`, `responseType`(`json`/`text`/`blob`/`arrayBuffer`), `timeout`, `signal`, `headers`, `credentials`, `cache`, `mock`(`true`/`'fallback'`/`false`), `raw`.

`AjaxError` 필드: `message`, `url`, `status`, `body`, `cause`.

## 9. 스킨

```js
WUI.skin.init({ target: document.documentElement });
WUI.skin.setTheme('green');
```

| 멤버 | 설명 |
| --- | --- |
| `init(options?)` | 저장값/기본값 적용, 대상 등록 |
| `addTarget(el)` / `removeTarget(el)` | 대상 추가/제거 |
| `apply(root?, options?)` | 대상에 적용 또는 새 루트 초기화 |
| `setTheme(name, opts?)` | 테마 |
| `setShape(nameOrObject, opts?)` | 모양/오버라이드 |
| `setDensity(name, opts?)` | 밀도 |
| `toggleBorders(force?)` | 테두리 토글 |
| `current()` | `{ theme, shape, density, overrides, borders, dark }` |
| `listThemes()` / `listShapes()` / `listDensities()` | 목록 |
| `onChange(fn)` | 변경 구독, 해제 함수 반환 |
| `reset()` | 기본값 |
| `registerTheme(name, def)` / `registerShape(name, def)` | 사용자 등록 |
| `createThemePicker(el)` / `createShapePicker(el)` | 피커 UI |

setter 의 `opts`: `{ target, persist }`. `persist: false` 는 localStorage 저장을 생략합니다.

## 10. 유틸

`WUI.util` 에서 모두 접근할 수 있습니다. DOM 헬퍼와 데이터 변환 위주입니다.

### DOM/이벤트

| 함수 | 설명 |
| --- | --- |
| `h(tag, attrs, ...children)` | 요소 생성. `class`, `style`, `on`, `dataset` 지원 |
| `$(sel, root?)` / `$$(sel, root?)` | 단일/전체 선택 |
| `on(root, type, selector, handler, options?)` | 위임 이벤트 |
| `append(parent, children)` / `clear(node)` | 자식 추가/비우기 |
| `raf(fn)` / `cancelRaf(id)` | requestAnimationFrame 래퍼 |
| `debounce(fn, wait?)` / `throttle(fn, wait?)` | 지연/제한 |
| `observeResize(node, callback)` | ResizeObserver 래퍼 |
| `toggleClass(node, name, force)` / `setStyleVars(node, vars)` | 클래스/변수 |
| `escapeHtml(value)` | HTML 이스케이프 |

### 값/날짜/검증

| 함수 | 설명 |
| --- | --- |
| `clone(value)` / `deepMerge(target, source)` | 복사/병합 |
| `uid(prefix?)` / `clamp(n, min, max)` | id/범위 |
| `isFn`, `isStr`, `isNum`, `isObj`, `isPlainObject`, `isArray`, `isEmpty` | 타입 검사 |
| `pad2(n)` | 2자리 패딩 |
| `toDate(value)` / `formatDate(value)` / `formatTime(value)` / `formatDateTime(value)` | 날짜 변환 |
| `todayStr()` / `nowTimeStr()` / `nowDateTimeStr()` / `addDays(value, days)` | 날짜 편의 |
| `parseNumber(value)` / `formatNumber(value, digits?)` / `cmp(a, b, type?)` | 숫자/비교 |
| `getPath(obj, path, fallback?)` / `setPath(obj, path, value)` | 중첩 경로 |
| `parseRules(rules)` / `validateValue(value, rules, ctx?)` | 검증 |
| `normalizeOptions(options, row?)` | 옵션 배열 정규화 |
| `readFileAsDataURL(file)` / `readFileAsText(file)` | 파일 읽기 |
| `storage.get/set/remove` | localStorage JSON 래퍼 |
| `download(filename, content, mime?)` / `copyToClipboard(text)` | 다운로드/복사 |
| `csvEscape(value)` / `toCSV(columns, rows)` | CSV |

## 11. 빠른 색인

| 하고 싶은 일 | API |
| --- | --- |
| 화면에 그리드 붙이기 | `WUI.createGrid('#grid', { columns, data })` |
| 그리드 데이터 저장 전 검증 | `grid.validate()`, `grid.save()` |
| 트리 체크 값 수집 | `tree.getChecked({ ids: true, parents: false })` |
| JSON 폼 값 수집 | `form.getValues({ visibleOnly: true })` |
| 사용자 컨트롤 추가 | `WUI.registerControl('rating', factory)` |
| 메뉴 기반 앱 | `WUI.createApp('#app', { menuUrl, layerUrl, dataUrl })` |
| 서버 없이 데모 | `WUI.ajax.mock('/api/menu', data, { delay: 120 })` |
| 테마 바꾸기 | `WUI.skin.setTheme('green')` |
| 요청 로그 보기 | `WUI.ajax.getHistory()`, `WUI.ajax.onLog(fn)` |
