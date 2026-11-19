# 05. 그리드

`createGrid` 는 대량 데이터를 편집하기 위한 그리드입니다. 헤더 sticky, 좌/우 고정 열, 절대 위치 행 배치 기반 가상 스크롤, 정렬/검색/필터, 12종 셀 타입, 검증, 변경 추적, CSV 내보내기, 계층(트리) 행 표시를 제공합니다.

## 1. 기본 사용

```html
<link rel="stylesheet" href="../src/css/tokens.css">
<link rel="stylesheet" href="../src/css/base.css">
<link rel="stylesheet" href="../src/css/grid.css">

<div id="grid"></div>

<script type="module">
  import WUI from '../src/js/webui.js';

  const grid = WUI.createGrid('#grid', {
    title: '주문 목록',
    height: 420,
    filterRow: true,
    columns: [
      { key: 'orderNo', title: '주문번호', type: 'text', width: 140, frozen: 'left', required: true },
      { key: 'customer', title: '고객명', type: 'text', width: 100 },
      { key: 'qty', title: '수량', type: 'number', width: 80, min: 1, max: 99 },
      { key: 'orderedAt', title: '주문일', type: 'date', width: 130 },
      { key: 'status', title: '상태', type: 'badge', width: 90, editable: false, frozen: 'right',
        options: [
          { value: 'ready', label: '준비' },
          { value: 'done', label: '완료' },
        ] },
    ],
    data: [
      { orderNo: 'ORD-001', customer: '김하늘', qty: 2, orderedAt: '2026-11-01', status: 'ready' },
    ],
    onChange: ({ row, key, value }) => console.log(key, value, row),
  });
</script>
```

## 2. 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `id` | 자동 | 인스턴스 id. 너비 저장 키 등에 사용 |
| `title` | `''` | 그리드 제목/aria-label |
| `description` | `''` | 툴바 아래 설명 |
| `columns` | `[]` | 컬럼 정의 |
| `data` | `[]` | 초기 행 배열(트리 모드에서는 중첩 `children` 허용) |
| `height` | `420` | 뷰포트 높이 |
| `maxHeight` | `560` | 최대 높이 |
| `minHeight` | `160` | 최소 높이 |
| `rowHeight` | CSS 변수/36 | 행 높이 |
| `headerHeight` | CSS 변수/38 | 헤더 높이 |
| `virtual` | `true` | 가상 스크롤 |
| `overscan` | `6` | 화면 밖 여유 행 |
| `selectable` | `true` | 행 선택 |
| `checkboxColumn` | `true` | 선택 체크박스 열 |
| `indexColumn` | `true` | 번호 열 |
| `statusColumn` | `false` | 수정/추가 상태 표시 열(`추가`/`수정`) |
| `stickyHeader` | `true` | 헤더 고정 |
| `zebra` | `true` | 줄무늬 |
| `resizable` | `true` | 열 너비 조절 |
| `sortable` | `true` | 정렬 |
| `multiSort` | `true` | Shift 기반 다중 정렬 |
| `search` | `true` | 전체 검색 |
| `filterRow` | `false` | 열별 필터 입력 행(툴바 `필터` 버튼으로 토글 가능) |
| `toolbar` | `true` | 상단 도구 모음 |
| `footer` | `true` | 하단 집계 |
| `showCount` | `true` | 건수 표시 |
| `emptyText` | `데이터가 없습니다.` | 빈 상태 문구 |
| `rowClass` | `null` | `(row) => string` 행 클래스 |
| `persistWidths` | `false` | 열 너비 localStorage 저장 |
| `autoLoad` | `false` | 생성 시 `dataUrl` 로드 |
| `dataUrl` | `null` | 자동 로드 URL |
| `tree` | `false` | 계층(트리) 행 모드 |
| `treeColumn` | 첫 사용자 컬럼 | 펼침 토글/인덴트가 표시될 컬럼 key (`treeColumn` 지정 시 `tree` 자동 활성화) |
| `childrenKey` | `'children'` | 자식 배열 키 |
| `defaultExpandLevel` | `0` | 초기 펼침 레벨 (`0` 모두 접힘, `-1` 모두 펼침, `N` level < N 펼침) |
| `indent` | `18` | 레벨당 들여쓰기(px) |
| `onChange` | `null` | 셀 변경 콜백 |
| `onSave` | `null` | 저장 콜백 |
| `onRowAdd` | `null` | 행 추가 콜백 |
| `onSelect` | `null` | 선택 변경 콜백 |
| `onSort` | `null` | 정렬 변경 콜백 |
| `onExpand` | `null` | 트리 펼침/접힘 콜백 |

## 3. 컬럼 정의

```js
{
  key: 'amount',            // 데이터 키 (필수)
  title: '금액',             // 헤더 텍스트
  type: 'number',           // 셀 타입
  width: 120,               // 초기 너비
  minWidth: 70,             // 최소 너비 (기본 min(70, width))
  align: 'right',           // left | center | right
  editable: true,           // 편집 가능 여부
  sortable: true,
  filterable: true,
  frozen: 'left',           // 'left' | 'right' | null
  placeholder: '0',
  default: 0,               // 새 행 기본값
  decimals: 0,              // number 표시 소수 자릿수
  unit: '원',               // slider 표시 단위
  min: 0, max: 1000000, step: 1000,   // number/slider
  options: [...],           // select/radio/badge
  rules: [...],             // 검증 규칙
  required: true,           // required 규칙 단축
  requiredMessage: '필수입니다.',
  format: (value, row, col) => string,  // 표시값 변환
  sortValue: (value, row) => any,        // 정렬 키 변환
  render: (ctx) => Node|string,          // type: 'custom'
}
```

`options` 는 배열, `{ value: label }` 객체, `(row) => 배열` 함수를 모두 허용합니다. 각 옵션은 `value`, `label`, `disabled` 를 가질 수 있습니다.

### 고정 열

- `frozen: 'left'` 는 왼쪽, `frozen: 'right'` 는 오른쪽에 고정됩니다.
- 컬럼 배열 순서와 무관하게 표시 시 좌/중앙/우 순서로 재배치됩니다.
- 런타임 변경은 `grid.setFrozen(key, 'left' | 'right' | null)` 입니다.
- 선택/번호 열은 항상 왼쪽 고정입니다.

## 4. 셀 타입 (12종)

| 타입 | 편집 UI | 값 형식 | 비고 |
| --- | --- | --- | --- |
| `text` | `<input type="text">` | string | 기본 |
| `textarea` | `<textarea>` | string | 1행 높이, Enter 로 다음 행 이동 |
| `number` | `<input inputmode="decimal">` | number \| null | 숫자 파싱, `decimals` 표시 |
| `date` | `<input type="date">` | `YYYY-MM-DD` | |
| `time` | `<input type="time">` | `HH:mm` | |
| `datetime` | `<input type="datetime-local">` | `YYYY-MM-DDTHH:mm` | |
| `select` | `<select>` | 옵션 value | `placeholder`/`emptyLabel` |
| `radio` | 라디오 그룹 | 옵션 value | 셀 안에 라디오 표시 |
| `checkbox` | 체크박스 | boolean | 기본값 `false` |
| `slider` | `<input type="range">` | number | `min/max/step/unit` |
| `badge` | 읽기 전용 배지 | string | `editable: false` 와 함께 사용 |
| `custom` | 사용자 렌더 | 자유 | `render(ctx)` |

`badge` 는 `editable: false` 일 때 `wui-badge` 로 표시됩니다. 편집 가능하게 두면 기본 텍스트 입력으로 동작합니다.

### 사용자 정의 셀

```js
{
  key: 'score',
  title: '평점',
  type: 'custom',
  width: 140,
  render: ({ value, row, commit, setError }) => {
    const wrap = document.createElement('div');
    wrap.className = 'score-stars';
    for (let i = 1; i <= 5; i += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i <= value ? '★' : '☆';
      b.addEventListener('click', () => commit(i));
      wrap.appendChild(b);
    }
    if (value < 1) setError('1점 이상 선택하세요.');
    return wrap;
  },
}
```

`ctx` 필드: `value`, `row`, `column`, `cell`, `grid`, `commit(next, { silent })`, `setError(message)`.

## 5. 검증

공통 검증 엔진(`validateValue`)을 사용합니다.

```js
{ key: 'email', title: '이메일', rules: ['email'] }

{ key: 'phone', title: '연락처', rules: [
  { type: 'pattern', value: '^01[0-9]-?\\d{3,4}-?\\d{4}$', message: '휴대폰 번호 형식이 아닙니다.' },
] }

{ key: 'name', title: '이름', rules: [
  'required',
  { type: 'minLength', value: 2 },
  { type: 'maxLength', value: 20 },
] }
```

지원 규칙:

| 규칙 | 옵션 | 설명 |
| --- | --- | --- |
| `required` | – | 빈 값 불가 |
| `min` / `max` | `value` 또는 `min`/`max` | 숫자 범위 |
| `minLength` / `maxLength` | `value` 또는 `length` | 문자열 길이 |
| `pattern` | `value`(RegExp/문자열) | 정규식 |
| `email` | – | 이메일 형식 |
| `number` | – | 숫자 여부 |
| `custom` | `validate`/`fn` | 사용자 함수. `false` 또는 메시지 문자열 반환 |
| 함수 | – | `(value, row, ctx) => false|string` |

```js
{
  type: 'custom',
  validate: (value, row) => value > row.min ? true : '최소값보다 커야 합니다.',
  message: '값을 확인하세요.',
}
```

- `validate()` 는 전체 행을 검사하고 `{ rid, key, message, row }[]` 를 반환합니다.
- 오류 셀에는 `is-invalid` 클래스와 `title` 이 적용됩니다.
- `save()` 는 검증 실패 시 `null` 을 반환하고 첫 오류 셀로 이동합니다.
- `grid.errorCount` 로 현재 오류 수를 읽을 수 있습니다.

## 6. 계층(트리) 그리드

`tree: true` 또는 `treeColumn` 을 지정하면 행을 계층 구조로 표시합니다. 데이터는 각 행에 자식 배열(`childrenKey`, 기본 `children`)을 포함하는 중첩 형태입니다.

```js
const grid = WUI.createGrid('#grid', {
  tree: true,
  treeColumn: 'name',
  childrenKey: 'children',
  defaultExpandLevel: 1,   // 0: 모두 접힘, -1: 모두 펼침, N: level < N 펼침
  indent: 18,
  statusColumn: true,
  columns: [
    { key: 'name', title: '이름', type: 'text', width: 240 },
    { key: 'owner', title: '담당', type: 'text', width: 120 },
  ],
  data: [
    {
      name: '개발본부', owner: '김민준',
      children: [
        { name: '웹팀', owner: '이서연', children: [] },
        { name: '모바일팀', owner: '박도윤' },
      ],
    },
  ],
  onExpand: ({ rid, expanded, row }) => console.log(rid, expanded),
});
```

동작:

- `treeColumn` 셀에 펼침/접힘 토글과 레벨 인덴트가 표시됩니다.
- 검색/열 필터 시 일치 노드와 그 상위 경로를 유지하며, 일치가 포함된 분기는 자동으로 펼쳐 표시됩니다.
- 정렬은 각 계층의 형제(sibling) 단위로 재귀 적용됩니다.
- `focusCell` 은 대상이 숨겨진 경우 필터를 해제하고 상위 노드를 펼쳐 위치로 이동합니다.
- `getData()` 는 트리 모드에서 중첩 구조(루트 배열)를 반환합니다. `getChanges()`/수정 상태 추적은 전체 노드 기준으로 동작하며 비교 시 `children` 은 제외합니다.
- `addRow(data, { focus, markNew, parentRid })`: 트리 모드에서 선택 행과 같은 레벨의 형제로 추가합니다(선택 없으면 루트 끝). `parentRid` 지정 시 해당 부모의 자식으로 추가하고 부모를 펼칩니다.
- `removeRows(rids)`: 트리 모드에서 선택 노드와 하위 노드를 함께 제거합니다.
- 가상 스크롤은 펼침 상태에 따른 가시 행 목록을 기준으로 동작합니다. 푸터의 총 건수는 전체 노드 수입니다.

> 참고: 레이아웃 컨트롤 `type: 'tree-grid'`(`src/js/layout/controls.js`)는 좌측 트리 패널과 우측 그리드 패널을 조합한 별도 컨트롤입니다. 그리드 컴포넌트 내부의 계층 행은 `createGrid` 의 `tree` 옵션으로 사용합니다.

## 7. API

```js
const grid = WUI.createGrid('#grid', options);
```

### 데이터/컬럼

| 메서드 | 설명 |
| --- | --- |
| `setData(rows)` | 데이터 교체. `rows`/`data`/`items` 래퍼 허용. 트리 모드에서는 중첩 구조 허용 |
| `getData()` | `_rid` 를 제거한 행 복사본(트리 모드: 중첩 루트 배열) |
| `addRow(data?, { focus, markNew, parentRid })` | 행 추가. 트리 모드에서는 선택 행의 형제 또는 `parentRid` 자식으로 추가 |
| `removeRows(rids)` | 행 삭제, 삭제 수 반환(트리 모드: 하위 노드 포함 제거) |
| `load(url, ajaxOptions?)` | AJAX 로드. 배열이면 `setData` |
| `setColumns(columns)` | 컬럼 교체(고정 상태/저장 너비 유지) |
| `getColumns()` | 사용자 컬럼 복사본 |
| `setFrozen(key, side)` | 열 고정 변경 |
| `setRowHeight(px)` / `setHeight(value)` | 높이 변경 |
| `refreshMetrics()` | CSS 변수 기준 높이 재측정 |

### 정렬/필터/선택

| 메서드 | 설명 |
| --- | --- |
| `setSort(key, dir, { additive })` | 정렬 설정. `dir` 이 없으면 해당 키 제거 |
| `clearSort()` | 전체 정렬 해제 |
| `setFilter(key, value)` | 열 필터 설정. 빈 값은 해제 |
| `setQuery(value)` | 전체 검색 |
| `setFilterRow(enabled)` / `toggleFilterRow()` | 필터 행 표시/숨김. 숨길 때 필터 조건 초기화 |
| `selectAll()` / `clearSelection()` | 전체 선택/해제 |
| `selectRow(rid)` | 특정 행 선택 |
| `getSelected()` | 선택 행 복사본 |
| `getVisible()` | 현재 뷰(필터/정렬/트리 펼침 반영) 행 복사본 |

### 트리

| 메서드 | 설명 |
| --- | --- |
| `expand(rid)` / `collapse(rid)` / `toggleExpand(rid)` | 노드 펼침/접힘 |
| `expandAll()` / `collapseAll()` | 전체 펼침/접힘 |
| `isExpanded(rid)` | 펼침 여부 |

### 검증/저장/내보내기

| 메서드 | 설명 |
| --- | --- |
| `validate()` | 전체 검증, 오류 배열 반환 |
| `save()` | 검증 후 스냅샷 갱신, 데이터 반환(실패 시 `null`) |
| `getChanges()` | 변경 행 배열 `{ row, original, rid, type, status }` (`type`: `added`/`modified`) |
| `getRowStatus(rid)` | 행 상태 (`''`/`'new'`/`'modified'`) |
| `downloadCSV(filename?)` | BOM 포함 UTF-8 CSV |
| `getSelected()` | 선택 행 |
| `focusCell(rid, key)` | 필터 해제 및 필요 시 상위 노드 펼침 후 해당 셀 포커스 |
| `setCellValue(rid, key, value, options?)` | 값 설정 |
| `scrollToIndex(index)` | 행 인덱스로 스크롤 |
| `setLoading(flag)` / `setStatus(message, tone)` | 로딩/상태 표시 |
| `on/off/destroy` | 이벤트/정리 |

### getter

- `el`, `id`, `viewport`
- `rowHeight`
- `hasChanges`
- `errorCount`
- `filterRow`
- `tree`

### AJAX 로드 예

```js
const grid = WUI.createGrid('#grid', {
  columns: [],
  autoLoad: true,
  dataUrl: '/api/data/orders',
});

// 또는
await grid.load('/api/data/orders', { params: { page: 1 } });
```

응답이 `{ columns, rows }` 이면 컬럼이 비어 있을 때 컬럼도 함께 설정합니다.

## 8. 이벤트

| 이벤트 | 페이로드 |
| --- | --- |
| `ready` | `api` |
| `data` | `{ rows, count }` |
| `change` | `{ rid, row, key, value, oldValue, index, changed, status }` |
| `edit` | `{ rid, row, key, value, status }` (입력 중) |
| `select` | `{ rows, count }` |
| `sort` | `[{ key, dir }]` |
| `columns` | 컬럼 배열 |
| `resize` | `{ key, width }` |
| `rowadd` | `{ row, index, status }` |
| `rowremove` | `{ rids, removed }` |
| `validate` | 오류 배열 |
| `save` | 데이터 배열 |
| `load` | `{ url, count }` |
| `loaderror` | `{ url, error }` |
| `expand` | `{ rid, expanded, row }` (트리) |
| `filterrow` | `{ enabled }` |
| `footer` | `{ total, visible, selected, errors, changes }` |

```js
grid.on('change', ({ rid, key, value }) => {
  console.log(rid, key, value);
});

grid.on('save', (rows) => {
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
});
```

## 9. 가상 스크롤과 고정

- 헤더는 `position: sticky` 로 고정됩니다.
- 행은 `position: absolute` + `translateY` 로 배치되고, 스크롤 위치에 해당하는 행만 렌더링합니다.
- `rowHeight` 는 모든 행이 동일해야 합니다.
- 고정 열은 `left`/`right` 오프셋과 `position: sticky` 로 유지됩니다.
- 열 너비 조절은 pointer 이벤트 + `requestAnimationFrame` 으로 처리합니다.
- `persistWidths: true` 이면 `localStorage` 키 `wui.grid.<id>.widths` 에 저장됩니다.

## 10. 상태와 스냅샷

- 각 행에는 non-enumerable `_rid` 가 부여됩니다.
- `getData()` / `getVisible()` / `getSelected()` 는 `_rid` 없는 복사본을 반환합니다(트리 모드 `getData()`는 중첩 구조).
- 초기 데이터와 `save()` 시점에 JSON 스냅샷을 저장합니다.
- `getChanges()` 는 현재 값과 스냅샷을 비교하며 `type`(`added`/`modified`)과 `status` 를 포함합니다.
- `statusColumn: true` 이면 상태 열과 행 클래스(`is-new`/`is-modified`)로 변경 여부를 표시합니다. 추가 행은 `addRow(..., { markNew: true })`(기본값) 기준으로 `추가` 상태입니다.
- `number` 는 `null | number`, `checkbox` 는 `boolean` 으로 정규화됩니다.

## 11. 스타일과 확장

- 루트: `.wui-grid`, 뷰포트 `.wui-grid-viewport`, 헤더 `.wui-grid-header`, 행 `.wui-grid-row`, 셀 `.wui-grid-cell`.
- 상태 클래스: `.is-frozen`, `.is-frozen-left`, `.is-frozen-right`, `.is-invalid`, `.is-selected`, `.is-align-right`, `.is-new`, `.is-modified`.
- 트리 클래스: `.wui-grid-treecell`, `.wui-grid-tree-toggle`, `.wui-grid-tree-spacer`.
- `rowClass(row)` 로 행별 클래스를 추가할 수 있습니다.
- `format` 으로 표시 문자열을, `sortValue` 로 정렬 키를 바꿀 수 있습니다.

## 12. 제한 사항

- 열 순서 변경(드래그), 열 숨김, 그룹핑, 피벗은 제공하지 않습니다.
- 행 높이는 균일해야 하며 자동 줄바꿈 행 높이는 지원하지 않습니다.
- 편집은 셀 단위이며, 셀 병합은 지원하지 않습니다.
- 트리 모드에서 지연 로딩(lazy children)과 체크박스 cascade 선택은 제공하지 않습니다(별도 트리 컴포넌트 `createTree` 참고).
- 서버 저장은 `save` 이벤트/콜백에서 직접 구현해야 합니다.
